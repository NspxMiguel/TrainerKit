/**
 * A ElevenLabs compartilhada, do lado do navegador.
 *
 * A conta inteira está em `api/tts11.ts` e vale repetir a linha que importa:
 * ~50 leituras por MÊS, pra todos os usuários somados. Isso não é uma voz de uso
 * diário, é uma degustação — e as três decisões deste arquivo saem daí:
 *
 *   1. Ela NUNCA entra sozinha na cadeia de fallback (ver `dexVoice.speak`).
 *      Precisa ser escolhida. Gastar recurso escasso sem alguém ter pedido é
 *      exatamente como esse tipo de cota morre no dia 2 do mês.
 *   2. O saldo é lido do servidor e mostrado ANTES, não descoberto no erro.
 *   3. O áudio gerado fica em cache no aparelho (`cacheAudio.ts`). Reouvir a
 *      mesma ficha não custa nada — e essa é a economia de verdade, ao
 *      contrário de "apagar os áudios antigos", que não devolve crédito nenhum
 *      porque a cota é gasta na GERAÇÃO, não no armazenamento.
 */

const PADRAO = "https://trainerkit-ia.vercel.app/api/tts11";

export const ELEVEN_PROXY: string = import.meta.env.VITE_TK_TTS11_PROXY ?? PADRAO;

const LIGADA_KEY = "tk:dex-11-compartilhada";
const VOZ_KEY = "tk:dex-11-voz";

/** As mesmas da allowlist da funcao: pedir outra volta 400. */
export const ELEVEN_SHARED_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah" },
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel" },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh" },
  { id: "VR6AewLTigWG4xSOukaG", label: "Arnold" },
] as const;

/** Teto da funcao. Cortar aqui evita um 413 previsivel. */
export const ELEVEN_MAX_CHARS = 400;

const store = {
  get(k: string): string | null {
    try {
      return globalThis.localStorage?.getItem(k) ?? null;
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      globalThis.localStorage?.setItem(k, v);
    } catch {
      /* preferencia nao persistida vale mais que app quebrado */
    }
  },
};

/** Desligada por padrao — ver a decisao 1 no topo. */
export function elevenSharedOn(): boolean {
  return store.get(LIGADA_KEY) === "1";
}

export function setElevenSharedOn(on: boolean): void {
  store.set(LIGADA_KEY, on ? "1" : "0");
}

export function getSharedVoice(): string {
  const salva = store.get(VOZ_KEY);
  if (salva && ELEVEN_SHARED_VOICES.some((v) => v.id === salva)) return salva;
  return ELEVEN_SHARED_VOICES[0].id;
}

export function setSharedVoice(id: string): void {
  store.set(VOZ_KEY, id);
}

/**
 * Quanto sobrou na conta do mes, ja descontada a reserva do servidor.
 *
 * `null` = nao consegui perguntar. A tela trata isso como "nao sei" e nao como
 * "acabou": sao coisas diferentes e misturar as duas mentiria pro usuario.
 */
export async function creditosRestantes(signal?: AbortSignal): Promise<number | null> {
  try {
    const res = await fetch(ELEVEN_PROXY, {
      method: "GET",
      ...(signal ? { signal } : {}),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { remaining?: number | null };
    return typeof d.remaining === "number" ? d.remaining : null;
  } catch {
    return null;
  }
}

/**
 * Gera o audio pela chave compartilhada.
 *
 * Nao toca nada: no iPhone o audio so pode comecar dentro de um gesto do
 * usuario, e essa regra e de quem tem o clique na mao.
 */
export async function elevenSharedSynthesize(
  text: string,
  /** Voz escolhida na tela. Só vale se estiver no allowlist (ver `getSharedVoice`). */
  preferida?: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const res = await fetch(ELEVEN_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text.slice(0, ELEVEN_MAX_CHARS),
      voice:
        preferida && ELEVEN_SHARED_VOICES.some((v) => v.id === preferida)
          ? preferida
          : getSharedVoice(),
    }),
    ...(signal ? { signal } : {}),
  });

  if (!res.ok) {
    const corpo = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(corpo.error ?? `${res.status}`);
  }

  return res.blob();
}
