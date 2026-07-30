/**
 * A chave compartilhada, escondida atras de uma funcao.
 *
 * O Miguel pediu uma "key publica com limites" pra quem nao quer criar conta na
 * Groq. Publica no cliente e impossivel: qualquer chave que chegue ao navegador
 * pode ser lida em dez segundos no painel de rede, e em horas ela estaria num
 * repositorio de chaves vazadas sendo usada pelo mundo. Entao ela vive AQUI, numa
 * variavel de ambiente da Vercel, e o navegador fala com esta funcao.
 *
 * ⚠️ COMO CONFIGURAR (isto e trabalho do Miguel, nao meu — eu nao ponho chave de
 * ninguem em servico nenhum):
 *
 *   1. REVOGUE a chave que voce colou no chat. Ela esta num transcript e deve ser
 *      considerada vazada. Gere outra em console.groq.com/keys.
 *   2. Na Vercel, no projeto: Settings → Environment Variables →
 *      `GROQ_API_KEY` = a chave NOVA. Marque as tres (Production, Preview,
 *      Development). Nunca commite esse valor.
 *   3. No build do app, defina `VITE_TK_AI_PROXY` com a URL desta funcao
 *      (ex.: `https://trainerkit.vercel.app/api/ai`). Sem essa variavel o app
 *      simplesmente nao oferece a opcao compartilhada — nada quebra.
 *
 * O QUE ESTA FUNCAO PROTEGE, e o que ela nao protege:
 *
 *   PROTEGE  a chave nunca sai do servidor. Limita tamanho de entrada, tamanho de
 *            saida, modelos permitidos e requisicoes por IP. Nao registra NADA do
 *            conteudo — nem pergunta, nem resposta, nem colecao.
 *
 *   NAO PROTEGE  contra abuso determinado. O contador por IP vive na memoria da
 *            instancia, e a Vercel cria e destroi instancias — quem quiser
 *            insistir consegue passar. Limite de verdade exige um KV (Upstash,
 *            Vercel KV) e esta anotado como o proximo passo. O teto real que te
 *            protege hoje e o da propria Groq: plano gratuito, 8.000 tokens por
 *            minuto, e quando estoura ela recusa — nao gera fatura.
 */

/** Modelos que esta funcao aceita. Fora desta lista, 400. */
const PERMITIDOS = new Set(["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]);

/** Teto de entrada. A colecao inteira em contexto da ~6.000; 12.000 e folga. */
const MAX_CHARS = 12_000;

/** Teto de saida. As telas do app pedem no maximo 320. */
const MAX_TOKENS = 400;

/** Janela e cota do contador por IP. */
const JANELA_MS = 60_000;
const POR_JANELA = 8;

const contador = new Map<string, { n: number; ate: number }>();

function excedeu(ip: string): boolean {
  const agora = Date.now();
  const atual = contador.get(ip);

  if (!atual || agora > atual.ate) {
    contador.set(ip, { n: 1, ate: agora + JANELA_MS });
    // Limpeza oportunista: sem isto o Map cresce pra sempre numa instancia
    // que sobrevive muito tempo.
    if (contador.size > 5000) {
      for (const [k, v] of contador) if (agora > v.ate) contador.delete(k);
    }
    return false;
  }

  atual.n += 1;
  return atual.n > POR_JANELA;
}

interface Mensagem {
  role: "system" | "user" | "assistant";
  content: string;
}

/*
 * `edge`, nao `nodejs`.
 *
 * Eu escrevi o handler no formato web — `(req: Request) => Response` — e
 * declarei runtime `nodejs`, que espera `(req, res)` e so termina quando alguem
 * chama `res.end()`. Ninguem chamava: a funcao pendurava ate o teto e devolvia
 * FUNCTION_INVOCATION_TIMEOUT, com 504 em toda chamada. So apareceu ao bater no
 * endereco publicado.
 *
 * `edge` e o runtime cujo contrato E este, e ainda cai melhor pra um proxy fino:
 * comeca em milissegundos e roda perto de quem chamou.
 */
export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  /*
   * CORS, e o preflight junto.
   *
   * O app vive em `spxmiguel.github.io` e esta funcao em `trainerkit-ia.vercel.app`
   * — origens diferentes. Sem estes cabecalhos o navegador recusa a resposta
   * ANTES de o codigo do app ver qualquer coisa, e tudo que chega na tela e um
   * "Failed to fetch" sem explicacao. Foi exatamente o que apareceu no primeiro
   * teste pelo app publicado: o `curl` passava e o navegador nao.
   *
   * `Content-Type: application/json` num POST dispara preflight, entao o OPTIONS
   * tem que responder tambem — so o cabecalho no POST nao bastaria.
   *
   * `*` na origem porque o endpoint e publico por desenho: ele nao le cookie nem
   * sessao, so recebe uma pergunta e devolve texto. Restringir a origem daria
   * uma sensacao de protecao que nao existe — quem quiser chamar de fora chama
   * com `curl`, e quem protege de verdade e o limite por IP.
   */
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  const json = (corpo: unknown, status: number) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors },
    });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "use POST" }, 405);

  const chave = process.env.GROQ_API_KEY;
  if (!chave) {
    // Erro explicito em vez de 500 mudo: se a variavel nao foi definida, quem
    // esta depurando precisa saber exatamente isso.
    return json({ error: "GROQ_API_KEY nao configurada no servidor" }, 503);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "desconhecido";
  if (excedeu(ip)) {
    return json(
      { error: "limite da chave compartilhada atingido. Use a sua chave da Groq ou a IA no aparelho." },
      429,
    );
  }

  let corpo: { messages?: Mensagem[]; temperature?: number; maxTokens?: number; model?: string };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return json({ error: "corpo invalido" }, 400);
  }

  const messages = corpo.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "messages ausente" }, 400);
  }

  const total = messages.reduce((n, m) => n + (typeof m.content === "string" ? m.content.length : 0), 0);
  if (total > MAX_CHARS) return json({ error: "pergunta grande demais" }, 413);

  const modelo = corpo.model ?? "llama-3.3-70b-versatile";
  if (!PERMITIDOS.has(modelo)) return json({ error: "modelo nao permitido" }, 400);

  const resposta = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: modelo,
      temperature: Math.min(1, Math.max(0, corpo.temperature ?? 0.3)),
      max_tokens: Math.min(MAX_TOKENS, Math.max(1, corpo.maxTokens ?? 320)),
      messages,
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    // Repassa o status da Groq: 429 dela e informacao util (espere um minuto), e
    // transformar tudo em 500 esconderia isso.
    return json({ error: detalhe.slice(0, 300) }, resposta.status);
  }

  const dados = (await resposta.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const texto = dados.choices?.[0]?.message?.content?.trim() ?? "";
  if (texto === "") return json({ error: "resposta vazia" }, 502);

  // Devolve SO o texto. O objeto da Groq traz ids e contagens que nao servem pro
  // app e nao precisam trafegar.
  return json({ text: texto }, 200);
}
