import { createHash, randomUUID } from "node:crypto";

import WebSocket from "ws";

/**
 * A voz humana em portugues, de graça e sem chave.
 *
 * O Miguel, quatro vezes: "o narrador da pokex fico paia", "ainda com leitor
 * paia demais", "bem ruim luciana e joana... quero vozes reais, vozes boas
 * estilo eleven labs. mas gratis obvio", e por fim "eleven labs é pago, procura
 * um free, q n precisa configurar. chatão."
 *
 * As saidas que eu ja tinha nao serviam:
 *   · `SpeechSynthesis` usa a voz do sistema, e em portugues elas sao de uma
 *     geracao anterior de sintese. Luciana e o teto.
 *   · Kokoro roda no aparelho e e otimo, mas o `kokoro-js` fonemiza SEMPRE em
 *     ingles (`n = "a" === A ? "en-us" : "en"`, no fonte da lib). Portugues com
 *     fonema ingles nao e portugues.
 *   · ElevenLabs fala portugues de verdade, mas pede chave e e paga.
 *
 * Isto aqui e o motor de "Ler em voz alta" do Microsoft Edge: vozes neurais,
 * pt-BR nativo, sem chave, sem conta, sem cota publicada.
 *
 * ⚠️ O QUE ISTO E, DITO SEM ENFEITE: um endpoint interno do Edge, alcançado com
 * os cabeçalhos do Edge. Nao e uma API publica com termos de uso que autorizem
 * isto — e zona cinzenta, eu falei isso pro Miguel antes de escrever, e ele
 * mandou seguir ("deixa todas as opções. quanto mais melhor"). Fica registrado
 * aqui porque quem ler este arquivo depois merece saber, e porque o dia em que
 * a Microsoft fechar isto, o app tem que continuar falando — por isso `dexVoice`
 * NUNCA depende so daqui: se esta funcao morrer, a voz cai pro plano seguinte e
 * no fim das contas pro sistema, que nunca falha.
 *
 * POR QUE PASSA PELO SERVIDOR: o navegador nao consegue definir `Origin` nem
 * `User-Agent` num WebSocket — a API nao deixa, de propósito. Testei: sem esses
 * cabeçalhos o handshake volta 403. Entao quem abre o socket e o Node.
 */

/** O token fixo do cliente Edge. Nao e segredo de ninguem: esta no binario. */
const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";

/**
 * A versao do Chromium que o servico aceita.
 *
 * ⚠️ ISTO EXPIRA. Meu primeiro teste usou `130.0.2849.68` e levou 403 em toda
 * chamada, com o token calculado certo — o servidor recusa versao velha. Se um
 * dia a voz parar de funcionar com 403, e ISTO: alinhar com o que o `edge-tts`
 * usa hoje (`constants.py`, `CHROMIUM_FULL_VERSION`).
 */
const CHROMIUM = "143.0.3650.75";
const MAJOR = CHROMIUM.split(".")[0];

/**
 * As vozes que esta funcao aceita, uma lista fechada.
 *
 * Pelo mesmo motivo do allowlist de modelos em `ai.ts`: sem isto, qualquer um
 * manda qualquer `voice` e a funcao vira um proxy aberto pro servico inteiro.
 * Sao as dez linguas do app, com as vozes que soam melhor em cada uma.
 */
const VOZES = new Set([
  "pt-BR-ThalitaMultilingualNeural",
  "pt-BR-FranciscaNeural",
  "pt-BR-AntonioNeural",
  "en-US-AvaMultilingualNeural",
  "en-US-AndrewMultilingualNeural",
  "en-GB-SoniaNeural",
  "es-ES-XimenaNeural",
  "es-ES-AlvaroNeural",
  "es-MX-DaliaNeural",
  "es-MX-JorgeNeural",
  "fr-FR-VivienneMultilingualNeural",
  "fr-FR-RemyMultilingualNeural",
  "de-DE-SeraphinaMultilingualNeural",
  "de-DE-FlorianMultilingualNeural",
  "it-IT-GiuseppeMultilingualNeural",
  "it-IT-IsabellaNeural",
  "ja-JP-NanamiNeural",
  "ja-JP-KeitaNeural",
  "ko-KR-HyunsuMultilingualNeural",
  "ko-KR-SunHiNeural",
  "ru-RU-SvetlanaNeural",
  "ru-RU-DmitryNeural",
]);

/** Teto de texto. A ficha inteira da ~400; 1.200 e folga com margem. */
const MAX_CHARS = 1200;

/** Janela e cota por IP. Mais generoso que o `ai.ts`: ler ficha e o uso normal. */
const JANELA_MS = 60_000;
const POR_JANELA = 20;

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
 * O `Sec-MS-GEC`: SHA-256 do relogio em ticks de 100ns + o token.
 *
 * O relogio e arredondado pra baixo em 5 minutos, e e isso que permite o
 * servidor recalcular o mesmo valor do outro lado.
 *
 * ⚠️ A conta TEM que ser em ponto flutuante, nao em BigInt. `ticks` chega perto
 * de 1,34e17, acima de `Number.MAX_SAFE_INTEGER` — mas a implementacao de
 * referencia usa float e o servidor espera o hash DAQUELE numero. "Mais exato"
 * aqui e simplesmente diferente, e diferente e 403.
 */
function secMsGec(): string {
  let ticks = Date.now() / 1000 + 11_644_473_600;
  ticks -= ticks % 300;
  ticks *= 1e9 / 100;
  return createHash("sha256").update(`${ticks.toFixed(0)}${TOKEN}`).digest("hex").toUpperCase();
}

/** Escapa o que quebraria o SSML — e o texto vem de fora. */
function escapar(t: string): string {
  return t
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Abre o socket, manda o SSML, junta os pedaços de MP3. */
function sintetizar(texto: string, voz: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const id = randomUUID().replaceAll("-", "");
    const url =
      `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
      `?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${secMsGec()}` +
      `&Sec-MS-GEC-Version=1-${CHROMIUM}&ConnectionId=${id}`;

    const ws = new WebSocket(url, {
      headers: {
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "User-Agent":
          `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)` +
          ` Chrome/${MAJOR}.0.0.0 Safari/537.36 Edg/${MAJOR}.0.0.0`,
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const pedacos: Buffer[] = [];
    // Rede pendurada nao pode segurar a funcao ate o teto da Vercel.
    const relogio = setTimeout(() => {
      ws.terminate();
      reject(new Error("tempo esgotado falando com o servico de voz"));
    }, 20_000);

    const carimbo = () => new Date().toISOString().replace("T", " ").replace("Z", "Z");

    ws.on("open", () => {
      ws.send(
        `X-Timestamp:${carimbo()}\r\nContent-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: {
                    sentenceBoundaryEnabled: "false",
                    wordBoundaryEnabled: "false",
                  },
                  outputFormat: "audio-24khz-48kbitrate-mono-mp3",
                },
              },
            },
          }),
      );

      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${voz.slice(0, 5)}'>` +
        `<voice name='${voz}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapar(texto)}</prosody>` +
        `</voice></speak>`;

      ws.send(
        `X-RequestId:${id}\r\nContent-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${carimbo()}\r\nPath:ssml\r\n\r\n${ssml}`,
      );
    });

    ws.on("message", (dado: Buffer, ehBinario: boolean) => {
      if (!ehBinario) {
        if (dado.toString("utf8").includes("Path:turn.end")) ws.close();
        return;
      }
      // Binario: 2 bytes com o tamanho do cabeçalho, o cabeçalho, e o audio.
      const tam = dado.readUInt16BE(0);
      if (dado.subarray(2, 2 + tam).toString("utf8").includes("Path:audio")) {
        pedacos.push(dado.subarray(2 + tam));
      }
    });

    ws.on("error", (e) => {
      clearTimeout(relogio);
      reject(e);
    });

    ws.on("close", () => {
      clearTimeout(relogio);
      const total = Buffer.concat(pedacos);
      if (total.length === 0) reject(new Error("o servico de voz nao devolveu audio"));
      else resolve(total);
    });
  });
}

/*
 * `nodejs`, nao `edge` — o oposto do `ai.ts`.
 *
 * O runtime edge nao tem socket bruto, e sem socket bruto nao ha WebSocket com
 * cabeçalho proprio. Aqui o custo de partida maior compensa: e a unica forma.
 */
export const config = { runtime: "nodejs", maxDuration: 30 };

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface Res {
  status: (n: number) => Res;
  setHeader: (k: string, v: string) => void;
  json: (b: unknown) => void;
  send: (b: unknown) => void;
  end: () => void;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "use POST" });
    return;
  }

  const fwd = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() ?? "desconhecido";
  if (excedeu(ip)) {
    res.status(429).json({ error: "muitas leituras seguidas. Espere um minuto." });
    return;
  }

  const corpo = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as {
    text?: unknown;
    voice?: unknown;
  };

  const texto = typeof corpo?.text === "string" ? corpo.text.trim() : "";
  const voz = typeof corpo?.voice === "string" ? corpo.voice : "";

  if (texto === "") {
    res.status(400).json({ error: "text ausente" });
    return;
  }
  if (texto.length > MAX_CHARS) {
    res.status(413).json({ error: "texto grande demais" });
    return;
  }
  if (!VOZES.has(voz)) {
    res.status(400).json({ error: "voz nao permitida" });
    return;
  }

  try {
    const mp3 = await sintetizar(texto, voz);
    res.setHeader("Content-Type", "audio/mpeg");
    // Cache curto no CDN: a mesma ficha lida duas vezes nao precisa de duas
    // idas ao servico. `s-maxage` so vale pro CDN, e nao guarda nada no aparelho.
    res.setHeader("Cache-Control", "public, s-maxage=3600");
    res.status(200).send(mp3);
  } catch (e) {
    // O erro sobe legivel: quando isto quebrar, quem for depurar precisa saber
    // se foi 403 (versao do Chromium venceu) ou tempo esgotado.
    res.status(502).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
