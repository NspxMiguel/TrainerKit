import { getGroqKey } from "./groq.ts";

/**
 * Voz de verdade, quando ha chave da Groq.
 *
 * O Miguel: "o narrador da pokex fico paia po. Procura algum serviço free, com
 * voz boa estilo elevenlabs". Ele esta certo — `SpeechSynthesis` usa a voz do
 * sistema, e a voz do sistema em portugues varia de sofrivel a robotica
 * dependendo do aparelho. Nao ha como consertar isso ajustando `pitch`.
 *
 * O que existe de graça e sem cadastro novo: a Groq expoe TTS no mesmo endpoint
 * padrao da OpenAI (`/audio/speech`) e com a MESMA chave que o app ja usa pro
 * texto. Zero configuracao a mais pra quem ja ligou a IA, e o plano gratuito da
 * Groq cobre narracao de ficha com folga.
 *
 * ⚠️ O QUE EU CONSEGUI VERIFICAR, e o que nao:
 *
 *   VERIFIQUEI  o endpoint existe. `POST /openai/v1/audio/speech` sem chave
 *               responde 401 "Invalid API Key", enquanto uma rota inventada
 *               responde 404 "Unknown request URL" — ou seja, a rota e real.
 *
 *   NAO VERIFIQUEI  o nome exato do modelo e das vozes, porque isso exige uma
 *               chave e eu nao tenho a do Miguel. Por isso o codigo NAO trava:
 *               se o modelo ou a voz estiverem errados, a mensagem de erro da
 *               Groq sobe pra tela inteira (ela lista as vozes validas) e a
 *               narracao cai na voz do sistema. Falhar barulhento e melhor que
 *               um botao de falar que nao fala.
 */

/** Modelo e voz padrao. Trocaveis pela tela quando a Groq recusar estes. */
export const GROQ_TTS_MODEL = "playai-tts";
export const GROQ_TTS_VOICE = "Fritz-PlayAI";

const VOICE_KEY = "tk:tts-voz";

export function getTtsVoice(): string {
  try {
    return globalThis.localStorage?.getItem(VOICE_KEY) ?? GROQ_TTS_VOICE;
  } catch {
    return GROQ_TTS_VOICE;
  }
}

export function setTtsVoice(voice: string): void {
  try {
    globalThis.localStorage?.setItem(VOICE_KEY, voice);
  } catch {
    /* preferencia nao persistida vale mais que app quebrado */
  }
}

export function ttsAvailable(): boolean {
  return getGroqKey() !== null;
}

/**
 * Pede o audio e devolve um Blob de WAV.
 *
 * Nao toca nada: quem chama decide quando e como, porque no iPhone o audio so
 * pode comecar dentro de um gesto do usuario e essa regra e de quem tem o
 * clique na mao.
 *
 * O texto vai limitado a 1.200 caracteres. A ficha inteira da uns 400, entao
 * o limite so existe pra uma pergunta longa nao virar uma cobranca longa.
 */
export async function synthesize(
  text: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const chave = getGroqKey();
  if (!chave) throw new Error("sem-chave");

  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${chave}`,
    },
    body: JSON.stringify({
      model: GROQ_TTS_MODEL,
      voice: getTtsVoice(),
      input: text.slice(0, 1200),
      response_format: "wav",
    }),
    ...(signal ? { signal } : {}),
  });

  if (!res.ok) {
    // A mensagem da Groq sobe inteira: quando a voz e invalida, e ela que diz
    // quais valem. Engolir isso deixaria o Miguel adivinhando.
    const detalhe = await res.text().catch(() => "");
    throw new Error(`${res.status} ${detalhe.slice(0, 240)}`);
  }

  return res.blob();
}
