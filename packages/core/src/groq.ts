/**
 * A CHAMADA À GROQ — a metade que não depende de plataforma.
 *
 * Isto morava em `apps/web/src/ai/groq.ts` junto do armazenamento da chave, que
 * é `localStorage` e não atravessa pro React Native. O que atravessa é isto: um
 * `fetch` e nada mais. Sem DOM, sem `window`, sem armazenamento — cada app
 * guarda a chave do jeito dele e passa por parâmetro.
 *
 * ⚠️ O QUE O MODELO DEVE FAZER NÃO MORA AQUI. O `system`, as regras e o formato
 * ficam com quem faz a pergunta, porque a pergunta é a mesma quando o modelo
 * roda no aparelho. Sem essa separação, ligar IA local exigiria duplicar cada
 * prompt.
 *
 * ── A chave é de quem usa ───────────────────────────────────────────────────
 *
 * "app a pessoa coloca a ia dela, key dela, nada free, free so o site". No app
 * nativo existem duas opções e só: desligado, e a chave da própria pessoa. A
 * camada gratuita da Groq é dela, não nossa — nada aqui passa por servidor
 * nosso, e não existe servidor nosso.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * O modelo padrão.
 *
 * ⚠️ Catálogo de provedor muda sem aviso — não dá pra assumir que ele fica. O
 * que dá pra fazer é conferir o catálogo quando a IA parar de responder, em vez
 * de procurar o defeito no cliente.
 */
export const GROQ_MODEL = "openai/gpt-oss-120b";

/** Uma conversa com a Groq, com a chave de quem perguntou. */
export async function groqChat(
  apiKey: string,
  model: string,
  messages: readonly ChatMessage[],
  options: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 320,
      messages,
    }),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${detail.slice(0, 120)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("resposta vazia");
  return text;
}
