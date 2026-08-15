import { getGroqKey } from "./groq.ts";
import { AI_PROXY, getProvider } from "./provider.ts";

/**
 * "Que Pokemon e esse?" a partir de uma imagem.
 *
 * Esta e a parte da Pokedex que EXIGE um modelo que enxergue: apontar a camera
 * pra um Pokemon, ou mandar um print. Duas limitacoes reais, e as
 * duas ficam visiveis na tela em vez de escondidas:
 *
 * 1. So funciona com a Groq. Os modelos que rodam no aparelho (WebLLM) sao de
 *    TEXTO — nao enxergam. O unico multimodal que o catalogo do MLC oferece pede
 *    quase 4 GB de memoria de video, mais que o orcamento de uma aba no iPhone.
 * 2. O modelo devolve um NOME, e nome pode vir errado ou inventado. Por isso a
 *    resposta e casada contra a lista de especies do dataset antes de valer: se
 *    nao casar, a tela diz "sem dados" em vez de mostrar a ficha do bicho errado.
 *
 * A imagem nao e guardada em lugar nenhum. Vai na requisicao, e acabou — o mesmo
 * princípio do leitor de print.
 *
 * ⚠️ LIMITE REAL, medido na conta: 8.000 tokens por minuto no plano
 * gratuito, e cada imagem custa uns 2.500. Ou seja ~3 fotos por minuto antes de
 * a Groq recusar. Por isso o erro dela sobe inteiro pra tela: "rate limit" e uma
 * informacao acionavel (espere um minuto), nao um defeito do app.
 */

/**
 * Modelo de visao da Groq.
 *
 * ⚠️ O nome anterior — `meta-llama/llama-4-scout-17b-16e-instruct` — dava 404:
 * foi escrito de memoria, sem chave pra conferir, e o modelo nao existe no
 * catalogo.
 *
 * Este esta VERIFICADO contra `/v1/models` da conta: `qwen/qwen3.6-27b` e o
 * unico do catalogo que aceita imagem — os outros respondem "content must be a
 * string", ele responde sobre a imagem. Testado com a arte oficial do Charizard:
 * devolveu exatamente "Charizard".
 */
const VISION_MODEL = "qwen/qwen3.6-27b";

const SYSTEM = `Você identifica Pokémon em imagens.

Responda APENAS com o nome do Pokémon em inglês, sem pontuação, sem explicação,
sem frase. Exemplos de resposta válida: Pikachu / Charizard / Mr. Mime.

Se a imagem não tiver um Pokémon, ou você não tiver certeza de qual é, responda
exatamente: UNKNOWN

Nunca invente um nome. UNKNOWN é uma resposta correta e esperada.`;

/**
 * Le a imagem como data URL.
 *
 * A API aceita URL ou base64 embutido; base64 e o unico caminho aqui porque a
 * imagem nunca foi pra servidor nenhum — ela veio da camera ou da galeria e vai
 * direto pro provedor.
 */
function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("nao consegui ler a imagem"));
    reader.readAsDataURL(file);
  });
}

export function visionAvailable(): boolean {
  /*
   * ⚠️ Isto dizia `getGroqKey() !== null` — ou seja, a foto SÓ funcionava com
   * chave própria, e a tela mandava "Falta a chave da Groq" mesmo com a IA
   * grátis ligada e respondendo o resto do app — a tela cobrava uma chave que
   * aquele caminho nem usa.
   *
   * O conserto de verdade foi no servidor: a função agora
   * aceita conteúdo com imagem e o `qwen/qwen3.6-27b` entrou no allowlist.
   * Verificado contra produção com um sprite real — devolveu "Pikachu".
   */
  const p = getProvider();
  return p === "groq" ? getGroqKey() !== null : p === "shared";
}

/**
 * Devolve o nome em ingles, ou `null` quando o modelo nao soube.
 *
 * Quem chama e responsavel por casar o nome contra o dataset — este modulo nao
 * conhece as especies, e nao deveria: assim a mesma funcao serve pra qualquer
 * base que o usuario aponte.
 */
export async function identifySpecies(
  file: File,
  signal?: AbortSignal,
): Promise<string | null> {
  const chave = getGroqKey();
  const compartilhada = getProvider() === "shared";
  if (!chave && !compartilhada) throw new Error("sem-chave");

  const dataUrl = await toDataUrl(file);

  /*
   * Compartilhada passa pela FUNÇÃO; chave própria vai direto.
   *
   * O corpo é o mesmo nos dois casos — a função repassa o que recebe. A
   * diferença é só quem carrega a chave, e por isso a URL e o cabeçalho mudam.
   */
  const res = await fetch(compartilhada ? AI_PROXY : "https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(compartilhada ? {} : { Authorization: `Bearer ${chave}` }),
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      // Temperatura zero: identificar nao e tarefa criativa, e qualquer variacao
      // aqui e chance de o modelo trocar um nome parecido por outro.
      temperature: 0,
      /*
       * `reasoning_effort: "none"` e OBRIGATORIO aqui.
       *
       * O Qwen 3.6 e modelo de raciocinio: sem isto ele gasta a resposta inteira
       * dentro de um bloco `<think>` e o nome nunca sai. Testado: com 30 tokens
       * a resposta era "\n<think>\nThe user wants me to identify the Pokémon…" e
       * nada mais; com `none`, veio "Charizard" e ponto.
       */
      reasoning_effort: "none",
      /*
       * Os dois nomes, de propósito: a Groq lê `max_tokens` e a minha função lê
       * `maxTokens`. Mandar só um funcionava num caminho e falhava no outro.
       *
       * 400, não 40: com o raciocínio escondido pela função, o modelo gasta
       * tokens pensando antes de responder. Com 40 a resposta voltou VAZIA —
       * medido contra produção.
       */
      max_tokens: 400,
      maxTokens: 400,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Que Pokémon é este?" },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
    ...(signal ? { signal } : {}),
  });

  if (!res.ok) {
    // 300 caracteres, nao 120: a mensagem de limite da Groq diz quantos tokens
    // faltam e em quanto tempo libera, e cortada no meio ela nao serve de nada.
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  // Cinto e suspensorio: mesmo com `reasoning_effort: "none"`, se um dia o modelo
  // voltar a pensar em voz alta, o bloco sai daqui em vez de virar "nome" e
  // falhar o casamento com o dataset.
  const bruto = (json.choices?.[0]?.message?.content ?? "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .trim();
  if (bruto === "" || /^unknown$/i.test(bruto)) return null;

  // O modelo as vezes desobedece e devolve uma frase. Pega o que parece nome e
  // deixa o casamento com o dataset decidir se presta.
  return bruto.split("\n")[0]!.replace(/[.!?]+$/, "").slice(0, 40);
}
