/**
 * "QUE ESPÉCIE É ESSA?" a partir de uma imagem.
 *
 * ⚠️ Isto morava só em `apps/web/src/ai/vision.ts`, e o app nativo trazia um
 * comentário dizendo que NÃO identificava por imagem. O motivo alegado — "a IA
 * é a da pessoa" — não separa os dois: no web ela também é, e é a chave dela
 * que faz a chamada. O que faltava era o código atravessar.
 *
 * Duas limitações reais, e as duas ficam visíveis na tela:
 *
 * 1. Precisa de um modelo que ENXERGUE. Sem chave não há identificação, e o
 *    botão nem aparece — prometer e não cumprir é pior que não prometer.
 * 2. O modelo devolve um NOME, e nome pode vir errado ou inventado. Quem chama
 *    casa contra o dataset antes de mostrar ficha nenhuma; se não casar, a tela
 *    diz que não soube em vez de abrir o bicho errado.
 *
 * A imagem não é guardada em lugar nenhum: vai na requisição e acabou — o mesmo
 * princípio do leitor de print.
 */

/**
 * ⚠️ VERIFICADO contra `/v1/models` da conta, não escrito de memória. O nome
 * anterior (`meta-llama/llama-4-scout-17b-16e-instruct`) dava 404 porque não
 * existe no catálogo. Este é o único que aceita imagem; os outros respondem
 * "content must be a string".
 */
export const MODELO_DE_VISAO = "qwen/qwen3.6-27b";

const SISTEMA = `Você identifica especie em imagens.

Responda APENAS com o nome da especie em inglês, sem pontuação, sem explicação,
sem frase. Exemplos de resposta válida: Pikachu / Charizard / Mr. Mime.

Se a imagem não tiver uma especie, ou você não tiver certeza de qual é, responda
exatamente: UNKNOWN

Nunca invente um nome. UNKNOWN é uma resposta correta e esperada.`;

/**
 * O nome que sobrou da resposta bruta, ou `null` quando o modelo não soube.
 *
 * ⚠️ Separado da chamada de rede DE PROPÓSITO: é a parte que quebra em
 * silêncio, e é a única que dá pra testar sem gastar cota. Três armadilhas
 * medidas contra a Groq de verdade moram aqui — o bloco `<think>` de um modelo
 * de raciocínio, o `UNKNOWN` que é resposta certa, e a frase inteira que ele
 * devolve quando desobedece.
 */
export function nomeDaResposta(bruto: string): string | null {
  const limpo = bruto.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (limpo === "" || /^unknown$/i.test(limpo)) return null;
  const primeira = limpo.split("\n")[0] ?? "";
  const nome = primeira
    .replace(/[.!?]+$/, "")
    .trim()
    .slice(0, 40);
  return nome === "" || /^unknown$/i.test(nome) ? null : nome;
}

/** O corpo do pedido. Fora da função de rede para o teste poder olhar dentro. */
export function corpoDaVisao(dataUrl: string): Record<string, unknown> {
  return {
    model: MODELO_DE_VISAO,
    /* Temperatura zero: identificar não é tarefa criativa, e qualquer variação
       aqui é chance de trocar um nome parecido por outro. */
    temperature: 0,
    /* ⚠️ OBRIGATÓRIO. O Qwen 3.6 é modelo de raciocínio: sem isto ele gasta a
       resposta inteira dentro de um `<think>` e o nome nunca sai. Medido: com
       30 tokens voltava "\n<think>\nThe user wants me to identify…" e nada
       mais; com `none`, veio "Charizard" e ponto. */
    reasoning_effort: "none",
    /* 400, e não 40: mesmo sem raciocínio visível o modelo gasta tokens antes
       de responder, e com 40 a resposta voltou VAZIA. */
    max_tokens: 400,
    messages: [
      { role: "system", content: SISTEMA },
      {
        role: "user",
        content: [
          { type: "text", text: "Que especie é este?" },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  };
}

/**
 * Identifica a espécie. `dataUrl` é `data:image/jpeg;base64,...`.
 *
 * ⚠️ O erro da Groq sobe INTEIRO (300 caracteres, não 120): a mensagem de
 * limite diz quantos tokens faltam e em quanto tempo libera, e cortada no meio
 * ela não serve de nada. No plano gratuito são 8.000 tokens por minuto e cada
 * imagem custa uns 2.500 — ou seja umas 3 fotos por minuto. "Rate limit" é
 * informação acionável (espere um minuto), não defeito do app.
 */
export async function identificarEspecie(
  chave: string,
  dataUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
    body: JSON.stringify(corpoDaVisao(dataUrl)),
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`${res.status} ${detalhe.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return nomeDaResposta(json.choices?.[0]?.message?.content ?? "");
}
