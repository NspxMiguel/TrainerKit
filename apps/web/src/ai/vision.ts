import { getGroqKey } from "./groq.ts";

/**
 * "Que Pokemon e esse?" a partir de uma imagem.
 *
 * Isto e a parte da ideia do Miguel que EXIGE um modelo que enxergue: "VC APONTA
 * PRA ALGUM POKEMON, OU TIRA PRINT E MANDA PRA ELE". Duas limitacoes reais, e as
 * duas ficam visiveis na tela em vez de escondidas:
 *
 * 1. So funciona com a Groq. Os modelos que rodam no aparelho (WebLLM) sao de
 *    TEXTO — nao enxergam. O unico multimodal do catalogo pede quase 4 GB de
 *    memoria de video, mais que o orcamento de uma aba no iPhone.
 * 2. O modelo devolve um NOME, e nome pode vir errado ou inventado. Por isso a
 *    resposta e casada contra a lista de especies do dataset antes de valer: se
 *    nao casar, a tela diz "sem dados" em vez de mostrar a ficha do bicho errado.
 *
 * A imagem nao e guardada em lugar nenhum. Vai na requisicao, e acabou — o mesmo
 * princípio do leitor de print.
 */

/** Modelo de visao da Groq. Separado dos de texto: sao catalogos diferentes. */
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

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
  return getGroqKey() !== null;
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
  if (!chave) throw new Error("sem-chave");

  const dataUrl = await toDataUrl(file);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${chave}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      // Temperatura zero: identificar nao e tarefa criativa, e qualquer variacao
      // aqui e chance de o modelo trocar um nome parecido por outro.
      temperature: 0,
      max_tokens: 24,
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
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${detail.slice(0, 120)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const bruto = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (bruto === "" || /^unknown$/i.test(bruto)) return null;

  // O modelo as vezes desobedece e devolve uma frase. Pega o que parece nome e
  // deixa o casamento com o dataset decidir se presta.
  return bruto.split("\n")[0]!.replace(/[.!?]+$/, "").slice(0, 40);
}
