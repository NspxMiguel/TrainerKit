/**
 * ElevenLabs compartilhada — a voz mais cara do app, com o orçamento mais curto.
 *
 * A chave é do Miguel e mora em `ELEVENLABS_API_KEY` na Vercel. Ele nunca me
 * mandou o valor, e é assim que tem que ser: a chave da Groq que ele colou no
 * chat está num transcript pra sempre.
 *
 * ⚠️ A CONTA, ANTES DO CÓDIGO — ela é quem desenha esta função inteira:
 *
 *   Plano gratuito: 10.000 créditos por mês. Com `eleven_flash_v2_5` (metade do
 *   custo por caractere) isso dá ~20.000 caracteres. Uma ficha da Pokédex tem
 *   ~400. Ou seja: **~50 leituras por MÊS, pra todos os usuários somados.**
 *
 * Cinquenta. No mês. Isso não é uma voz de uso diário — é uma degustação. E o
 * desenho tem que dizer isso na cara em vez de deixar acabar no dia 2 e o app
 * parecer quebrado pelos 28 dias restantes.
 *
 * Daí as três defesas, em ordem de importância:
 *
 *   1. PERGUNTA À PRÓPRIA ELEVENLABS quanto sobrou, e recusa antes de zerar
 *      (`RESERVA`). É a única checagem que não depende de eu adivinhar o
 *      consumo — e é o que impede a conta dele de ser drenada em silêncio.
 *   2. Teto de texto curto (400), porque cada caractere aqui é dinheiro.
 *   3. Limite por IP, curto.
 *
 * E no cliente: a voz compartilhada NÃO entra sozinha na cadeia de fallback.
 * Gastar recurso escasso sem alguém ter pedido é como esse tipo de cota morre.
 */

/** Modelo. `flash` custa metade dos créditos e a diferença não se ouve numa ficha. */
const MODELO = "eleven_flash_v2_5";

/**
 * Vozes da biblioteca padrão, que toda conta tem.
 *
 * Allowlist pelo mesmo motivo do `ai.ts` e do `tts.ts`: sem ela, qualquer um
 * manda qualquer `voice` e a função vira proxy aberto pra conta dele — inclusive
 * pra vozes clonadas, se ele criar alguma um dia.
 */
const VOZES = new Set([
  /*
   * BRASILEIRAS, da Voice Library — as que o Miguel disse que existiam e eu
   * tinha dito que não.
   *
   * Eu havia consultado `/v2/voices`, que é a biblioteca PADRÃO da conta: 21
   * vozes, todas american/british/australian. Concluí "não existe voz brasileira
   * na biblioteca gratuita" e escrevi isso na tela do app, com todas as letras.
   * Estava errado — eu tinha olhado num lugar e afirmado sobre outro.
   *
   * `/v1/shared-voices?language=pt` devolve 40 vozes pt-BR de verdade, com
   * sotaque `brazilian`, criadas e compartilhadas por outros usuários. Estas
   * seis são as mais usadas (o número é `cloned_by_count`, quantas contas as
   * adicionaram — Adriano tem 125 mil).
   */
  "hwnuNyWkl9DjdTFykrN6", // Adriano — grave, brasileiro
  "Qrdut83w0Cr152Yb4Xn3", // Paulo — expressivo, brasileiro
  "oJebhZNaPllxk6W0LSBA", // Carla — narradora, brasileira
  "GDzHdQOi6jjf8zaXhCYD", // Raquel — expressiva, brasileira
  "4za2kOXGgUd57HRSQ1fn", // Lendário — animado, brasileiro
  "MZxV5lN3cv7hi1376O0m", // Ana Dias — formal, brasileira

  // Biblioteca padrão (inglês), pra quem usa o app em outro idioma.
  /*
   * ⚠️ Rachel, Domi, Josh e Arnold SAIRAM: nao existem nesta conta. Eu os havia
   * escrito de memoria, e pedi-los falhava — e a falha caia calada noutra voz,
   * fazendo o rotulo mentir. Estes vieram de `/v2/voices`.
   */
  "EXAVITQu4vr4xnSDxMaL", // Sarah, feminina, americana
  "pNInz6obpgDQGcFmaJgB", // Adam, masculino, americano
  "hpp4J3VqNfWAUOO0d1Us", // Bella
  "CwhRBWXzGAHq8TQ4Fs17", // Roger
  "FGY2WhTYpPnrIDTdsKH5", // Laura
  "IKne3meq5aSn9XLyUdCD", // Charlie
  "JBFqnCBsd6RMkjVDRZzb", // George
  "N2lVS1w4EtoT3dr4eOWO", // Callum
  "SAz9YHcvj6GT2YYXdXww", // River
  "TX3LPaxmHKxFdv7VOQHJ", // Liam
  "Xb7hH8MSUJpSbSDYk0k2", // Alice
  "XrExE9yKIg1WjnnlVkGX", // Matilda
  "cgSgspJ2msm6clMCkdW9", // Jessica
  "cjVigY5qzO86Huf0OWal", // Eric
  "nPczCjzI2devNBz1zQrb", // Brian
  "onwK4e9ZLuTAKqWW03F9", // Daniel
  "pFZP5JQG7iQjIQuC4Bku", // Lily
]);

/** Teto de texto. Curto de propósito: ver a conta no topo. */
const MAX_CHARS = 400;

/**
 * Créditos que a função se recusa a encostar.
 *
 * Existe pra a cota NUNCA chegar a zero pela chave compartilhada: se o Miguel
 * quiser usar a própria conta da ElevenLabs pra qualquer outra coisa no fim do
 * mês, ainda vai ter com o que. Sem esta reserva, o "grátis pro povão" comeria
 * a conta dele inteira e ele descobriria tentando usar.
 */
const RESERVA = 1000;

/** Limite por IP: 3 por hora. É degustação, não uso contínuo. */
const JANELA_MS = 3_600_000;
const POR_JANELA = 3;

const contador = new Map<string, { n: number; ate: number }>();

function excedeu(ip: string): boolean {
  const agora = Date.now();
  const atual = contador.get(ip);
  if (!atual || agora > atual.ate) {
    contador.set(ip, { n: 1, ate: agora + JANELA_MS });
    if (contador.size > 5000) {
      for (const [k, v] of contador) if (agora > v.ate) contador.delete(k);
    }
    return false;
  }
  atual.n += 1;
  return atual.n > POR_JANELA;
}

/**
 * Quanto sobrou na conta, perguntando pra quem sabe.
 *
 * `character_limit - character_count`. É o número real, não a minha estimativa —
 * e por isso é ele que decide, não um contador meu que erraria por acumulação.
 */
async function creditosRestantes(
  chave: string,
): Promise<{ resta: number | null; motivo: string }> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": chave },
    });

    if (!res.ok) {
      /*
       * O status da ElevenLabs sobe junto, e não como enfeite.
       *
       * Sem ele, "não consegui saber a cota" é indistinguível de "a chave está
       * errada" e de "a chave não tem permissão pra ler a conta" — três causas
       * com três consertos diferentes, e nenhuma delas visível de fora. Foi
       * exatamente o que aconteceu no primeiro teste contra a chave real: veio
       * `remaining: null` e não dava pra saber o porquê.
       *
       * Só o status e o começo da mensagem. A chave nunca entra na resposta.
       */
      const txt = await res.text().catch(() => "");
      return { resta: null, motivo: `elevenlabs ${res.status}: ${txt.slice(0, 160)}` };
    }

    const d = (await res.json()) as { character_count?: number; character_limit?: number };
    if (typeof d.character_count !== "number" || typeof d.character_limit !== "number") {
      return { resta: null, motivo: "resposta sem character_count/character_limit" };
    }
    return { resta: d.character_limit - d.character_count, motivo: "ok" };
  } catch (e) {
    // Falhou a consulta: devolve null e quem chama decide. NÃO devolve "tem
    // crédito" por otimismo — chute otimista aqui é a conta dele zerando.
    return { resta: null, motivo: e instanceof Error ? e.message : "falha de rede" };
  }
}

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  const json = (corpo: unknown, status: number) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors },
    });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const chave = process.env.ELEVENLABS_API_KEY;
  if (!chave) return json({ error: "ELEVENLABS_API_KEY nao configurada no servidor" }, 503);

  /*
   * GET = quanto sobrou, sem gerar nada.
   *
   * O app pergunta isto pra mostrar o saldo ANTES de a pessoa apertar, e pra
   * esconder a opção quando acabou. Sem isso, a única forma de descobrir que a
   * cota do mês morreu seria apertando e levando erro.
   *
   * Devolve só o número. Nada da resposta da ElevenLabs (plano, e-mail, id de
   * usuário, datas) trafega — não serve pro app e é dado da conta dele.
   */
  /*
   * `?vozes=1` — a lista, com idioma e prévia.
   *
   * O Miguel: "eleven labs nao tem função de testar vozes... e as vozes nao tao
   * em portugues, tao em outra lingua. (…) la no eleven labs fala pra qual
   * lingua q é cada voz."
   *
   * Ele está certo nas duas. Eu cravei seis ids de cabeça (Rachel, Domi, Sarah,
   * Josh, Arnold, Adam) — que são todas vozes INGLESAS — e a tela mostrava só o
   * nome, sem idioma e sem como ouvir. Escolher voz lendo "Domi" é escolher às
   * cegas.
   *
   * A ElevenLabs já responde as duas coisas: `labels.accent` / `verified_languages`
   * dizem a língua, e `preview_url` é um MP3 pronto que NÃO consome crédito
   * nenhum. Ou seja: dá pra ouvir antes de gastar.
   *
   * Só o que a tela usa sai daqui. Nada de id de usuário, plano ou datas.
   */
  /*
   * `?compartilhadas=1` — a Voice Library, onde estão as vozes brasileiras.
   *
   * O Miguel: "eleven labs tem sim vozes brasileiras... tem uma função de criar
   * voz e compartilhar com os outros, e ai sim tem brasileiro".
   *
   * Ele está certo e eu tinha olhado no lugar errado. `/v2/voices` devolve a
   * biblioteca PADRÃO da conta — 21 vozes, todas american/british/australian.
   * As vozes de verdade em português estão na Voice Library pública
   * (`/v1/shared-voices`), criadas por outros usuários e filtráveis por idioma.
   */
  if (req.method === "GET" && new URL(req.url).searchParams.has("compartilhadas")) {
    const lang = new URL(req.url).searchParams.get("lang") ?? "pt";
    const res = await fetch(
      `https://api.elevenlabs.io/v1/shared-voices?page_size=40&language=${encodeURIComponent(lang)}&sort=trending`,
      { headers: { "xi-api-key": chave } },
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return json({ error: `elevenlabs ${res.status}: ${t.slice(0, 200)}` }, res.status);
    }
    const d = (await res.json()) as {
      voices?: Array<{
        voice_id?: string;
        name?: string;
        preview_url?: string;
        accent?: string;
        language?: string;
        locale?: string;
        gender?: string;
        cloned_by_count?: number;
      }>;
    };
    return json(
      {
        voices: (d.voices ?? []).map((v) => ({
          id: v.voice_id,
          name: v.name,
          preview: v.preview_url,
          accent: v.accent ?? null,
          locale: v.locale ?? v.language ?? null,
          gender: v.gender ?? null,
          usos: v.cloned_by_count ?? 0,
        })),
      },
      200,
    );
  }

  if (req.method === "GET" && new URL(req.url).searchParams.has("vozes")) {
    const res = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", {
      headers: { "xi-api-key": chave },
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return json({ error: `elevenlabs ${res.status}: ${t.slice(0, 160)}` }, res.status);
    }
    const d = (await res.json()) as {
      voices?: Array<{
        voice_id?: string;
        name?: string;
        preview_url?: string;
        labels?: Record<string, string>;
        verified_languages?: Array<{ language?: string; accent?: string }>;
      }>;
    };
    return json(
      {
        voices: (d.voices ?? []).map((v) => ({
          id: v.voice_id,
          name: v.name,
          preview: v.preview_url,
          accent: v.labels?.accent ?? null,
          gender: v.labels?.gender ?? null,
          langs: [...new Set((v.verified_languages ?? []).map((l) => l.language).filter(Boolean))],
        })),
      },
      200,
    );
  }

  if (req.method === "GET") {
    const { resta, motivo } = await creditosRestantes(chave);
    return json(
      {
        remaining: resta === null ? null : Math.max(0, resta - RESERVA),
        // `reason` só aparece quando NÃO deu certo. Serve pra depurar de fora
        // sem abrir log — e é o que diz se falta permissão na chave.
        ...(resta === null ? { reason: motivo } : {}),
      },
      200,
    );
  }

  if (req.method !== "POST") return json({ error: "use POST" }, 405);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "desconhecido";
  if (excedeu(ip)) {
    return json({ error: "limite da voz compartilhada atingido. Use a sua chave." }, 429);
  }

  let corpo: { text?: unknown; voice?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return json({ error: "corpo invalido" }, 400);
  }

  const texto = typeof corpo.text === "string" ? corpo.text.trim() : "";
  const voz = typeof corpo.voice === "string" ? corpo.voice : "";

  if (texto === "") return json({ error: "text ausente" }, 400);
  if (texto.length > MAX_CHARS) return json({ error: "texto grande demais" }, 413);
  if (!VOZES.has(voz)) return json({ error: "voz nao permitida" }, 400);

  /*
   * A checagem que protege a conta, feita ANTES de gerar.
   *
   * `null` (não consegui perguntar) recusa também. Parece severo, mas o outro
   * caminho é gerar às cegas na conta de alguém — e o custo de errar pro lado
   * seguro é uma leitura que não aconteceu.
   */
  const { resta, motivo } = await creditosRestantes(chave);
  if (resta === null) return json({ error: `nao consegui verificar a cota (${motivo})` }, 503);
  if (resta - texto.length < RESERVA) {
    return json(
      { error: "a cota gratuita do mes acabou. Use a sua chave da ElevenLabs ou a voz neural." },
      429,
    );
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": chave },
    body: JSON.stringify({ text: texto, model_id: MODELO }),
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    return json({ error: detalhe.slice(0, 300) }, res.status);
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      // O saldo depois desta geração, pro app mostrar sem uma segunda chamada.
      "X-Credits-Left": String(Math.max(0, resta - texto.length - RESERVA)),
      ...cors,
    },
  });
}
