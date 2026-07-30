/**
 * A voz da Pokedex.
 *
 * O Miguel: "ATÉ IMITAR A VOZ DA POKEDEX ORIGINAL". Duas coisas sobre isso, e
 * vale dizer as duas antes do codigo:
 *
 * 1. Nao da pra CLONAR a voz. A da serie e a performance de um dublador real, e
 *    reproduzi-la exigiria clonagem de voz de uma pessoa identificavel — que e
 *    outra classe de problema, tecnica e legal, e nao e a que estamos resolvendo.
 * 2. O que da, e chega perto do efeito, e a ENTREGA: a Pokedex nao soa robotica
 *    por timbre, soa por ritmo. Ela anuncia. Fala devagar, sem entonacao de
 *    conversa, com pausa depois do nome, e sempre na mesma cadencia.
 *
 * Entao aqui e `SpeechSynthesis` do proprio sistema com `rate` e `pitch`
 * ajustados, pausas escritas na pontuacao, e um bipe curto antes — o bipe faz
 * metade do trabalho de "isto e um aparelho falando", e sai de Web Audio, sem
 * arquivo nenhum.
 *
 * Homenagem, nao imitacao. E funciona no iPhone e no Android sem baixar nada.
 */

/** Preferencia guardada: quem nao quer voz nao deveria ter que desligar sempre. */
const VOICE_KEY = "tk:dex-voz";

export function voiceOn(): boolean {
  try {
    return globalThis.localStorage?.getItem(VOICE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setVoiceOn(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(VOICE_KEY, on ? "1" : "0");
  } catch {
    /* preferencia nao persistida vale mais que app quebrado */
  }
}

export function speechSupported(): boolean {
  return typeof globalThis.speechSynthesis !== "undefined";
}

/**
 * O bipe de aparelho ligando.
 *
 * Duas notas curtas em onda quadrada. `AudioContext` criado e fechado por bipe
 * de propósito: um contexto vivo mantem o audio do sistema "em uso", e no iPhone
 * isso aparece como o app segurando a saida de som sem estar tocando nada.
 */
export async function beep(): Promise<void> {
  const Ctx = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;

  const ctx = new Ctx();
  try {
    const agora = ctx.currentTime;
    for (const [i, freq] of [880, 1320].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      // Envelope curto: sem ele o corte seco estala no alto-falante.
      gain.gain.setValueAtTime(0, agora + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.06, agora + i * 0.09 + 0.01);
      gain.gain.linearRampToValueAtTime(0, agora + i * 0.09 + 0.07);
      osc.connect(gain).connect(ctx.destination);
      osc.start(agora + i * 0.09);
      osc.stop(agora + i * 0.09 + 0.08);
    }
    await new Promise((r) => setTimeout(r, 220));
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

/**
 * Escolhe a voz do sistema.
 *
 * Prefere a do idioma pedido. A lista chega VAZIA na primeira chamada em vários
 * navegadores — ela e preenchida de forma assincrona — e por isso quem chama
 * aceita `null` e deixa o sistema escolher: uma voz padrao lendo portugues e
 * melhor que silencio esperando a lista.
 */
function pickVoice(language: string): SpeechSynthesisVoice | null {
  const vozes = globalThis.speechSynthesis?.getVoices() ?? [];
  if (vozes.length === 0) return null;

  const exata = vozes.find((v) => v.lang.toLowerCase() === language.toLowerCase());
  if (exata) return exata;

  const raiz = language.split("-")[0]!.toLowerCase();
  return vozes.find((v) => v.lang.toLowerCase().startsWith(raiz)) ?? null;
}

export function stopSpeaking(): void {
  globalThis.speechSynthesis?.cancel();
}

/**
 * Fala o texto com a entrega de aparelho.
 *
 * `rate` 0.88 e `pitch` 0.85: mais lento e mais grave que a fala natural, que e
 * o que faz soar anunciado em vez de conversado. Nao mexer nisso sem ouvir —
 * abaixo de 0.8 vira paródia, acima de 1 vira assistente de banco.
 */
export async function speak(text: string, language: string): Promise<void> {
  const synth = globalThis.speechSynthesis;
  if (!synth) return;

  synth.cancel();

  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language;
    u.rate = 0.88;
    u.pitch = 0.85;
    const voz = pickVoice(language);
    if (voz) u.voice = voz;

    // Resolve nos dois casos: `onerror` dispara quando a aba perde o foco no
    // meio da fala, e sem tratar isso a promessa nunca resolveria.
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}
