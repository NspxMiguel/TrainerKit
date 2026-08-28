import { getGroqKey } from "./groq.ts";

/**
 * Voz de verdade, quando ha chave da Groq.
 *
 * A voz do narrador precisava soar humana sem custar nada, e o caminho antigo
 * nao dava conta: `SpeechSynthesis` usa a voz do
 * sistema, e a voz do sistema em portugues varia de sofrivel a robotica
 * dependendo do aparelho. Nao ha como consertar isso ajustando `pitch`.
 *
 * O que existe de graça e sem cadastro novo: a Groq expoe TTS no mesmo endpoint
 * padrao da OpenAI (`/audio/speech`) e com a MESMA chave que o app ja usa pro
 * texto. Zero configuracao a mais pra quem ja ligou a IA, e o plano gratuito da
 * Groq cobre narracao de ficha com folga.
 *
 * ⚠️ VERIFICADO COM A CHAVE DELE, e o resultado mudou o plano:
 *
 *   `playai-tts` ESTA DESCONTINUADO. A Groq responde 400
 *   "model_decommissioned". Era o que eu tinha escrito de memoria, e nunca teria
 *   funcionado.
 *
 *   O que existe no catalogo e `canopylabs/orpheus-v1-english` — Orpheus, TTS de
 *   verdade, e bom. Mas ele responde 400 "model_terms_required": o ADMIN DA ORG
 *   precisa aceitar os termos em console.groq.com/playground?model=canopylabs%2F
 *   orpheus-v1-english. Aceite de termos e ato do dono da conta, entao isto fica
 *   pra ele — um clique, uma vez.
 *
 *   ⚠️ E ele e SO INGLES. Lendo portugues, a pronuncia sai errada. Por isso o app
 *   so usa Orpheus quando o idioma da interface e ingles; em qualquer outro a voz
 *   do sistema continua sendo a certa, mesmo sendo mais feia. Voz bonita falando
 *   errado e pior que voz feia falando certo.
 */

/**
 * Modelo de TTS. VERIFICADO no catalogo da conta.
 *
 * Exige aceite de termos no console (uma vez, pelo dono da conta) e e so ingles.
 */
export const GROQ_TTS_MODEL = "canopylabs/orpheus-v1-english";

/** Voz padrao do Orpheus. Se a Groq recusar, o erro dela lista as validas. */
export const GROQ_TTS_VOICE = "tara";

const VOICE_KEY = "tk:tts-voz";

export function getTtsVoice(): string {
  try {
    return globalThis.localStorage?.getItem(VOICE_KEY) ?? GROQ_TTS_VOICE;
  } catch {
    return GROQ_TTS_VOICE;
  }
}

/**
 * O TTS bom vale pra este idioma?
 *
 * Orpheus e so ingles. Usar ele pra ler portugues daria uma voz bonita
 * pronunciando errado — pior que a voz do sistema, que ao menos sabe as regras do
 * idioma. Entao a checagem inclui o idioma, nao so a chave.
 */
export function ttsAvailable(language: string): boolean {
  return getGroqKey() !== null && language.toLowerCase().startsWith("en");
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
    // quais valem. Engolir isso deixaria quem configurou adivinhando.
    const detalhe = await res.text().catch(() => "");
    throw new Error(`${res.status} ${detalhe.slice(0, 240)}`);
  }

  return res.blob();
}
