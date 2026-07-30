/**
 * Voz neural em portugues, sem chave e sem conta.
 *
 * O lado do navegador da funcao em `api/tts.ts` — a explicacao inteira, e a
 * ressalva sobre a origem dessas vozes, esta la. Aqui so o cliente.
 *
 * Isto e o que faltava: das quatro vozes que o app tem, esta e a unica que junta
 * as tres coisas que o Miguel pediu — humana, gratis, e sem nada pra configurar.
 * Kokoro so fala ingles, ElevenLabs pede chave e e paga, e a do sistema em
 * portugues e a Luciana.
 */

/**
 * A URL da funcao.
 *
 * Mesmo raciocinio do `AI_PROXY`: o padrao e a funcao publicada, porque endereco
 * publico nao e segredo e esconder isso atras de uma variavel de ambiente so
 * fazia o recurso sumir do `pnpm dev` — foi o "kd publico?" de novo.
 */
const PADRAO = "https://trainerkit-ia.vercel.app/api/tts";

export const TTS_PROXY: string = import.meta.env.VITE_TK_TTS_PROXY ?? PADRAO;

/**
 * As vozes, por idioma do app.
 *
 * Tem que bater com o allowlist da funcao (`VOZES` em `api/tts.ts`): pedir uma
 * que nao esta la volta 400. As "Multilingual" sao a geracao mais nova e soam
 * melhor, entao vem primeiro — e a primeira e a padrao de quem nunca escolheu.
 */
export const EDGE_VOICES: Record<string, ReadonlyArray<{ id: string; label: string }>> = {
  "pt-BR": [
    { id: "pt-BR-ThalitaMultilingualNeural", label: "Thalita" },
    { id: "pt-BR-AntonioNeural", label: "Antônio" },
    /*
     * A Francisca saiu.
     *
     * O Miguel ouviu as tres e disse: "menos a francisca, isso é pt portugal".
     * A Microsoft rotula ela como pt-BR, mas quem fala o idioma ouve o sotaque —
     * e nesse julgamento quem manda e o ouvido dele, nao a etiqueta do catalogo.
     * O id continua no allowlist da funcao: tirar de la quebraria quem ja tinha
     * escolhido ela, e `getEdgeVoice` ja cai na primeira da lista nesse caso.
     */
  ],
  en: [
    { id: "en-US-AvaMultilingualNeural", label: "Ava" },
    { id: "en-US-AndrewMultilingualNeural", label: "Andrew" },
    { id: "en-GB-SoniaNeural", label: "Sonia" },
  ],
  es: [
    { id: "es-ES-XimenaNeural", label: "Ximena" },
    { id: "es-ES-AlvaroNeural", label: "Álvaro" },
  ],
  "es-419": [
    { id: "es-MX-DaliaNeural", label: "Dalia" },
    { id: "es-MX-JorgeNeural", label: "Jorge" },
  ],
  fr: [
    { id: "fr-FR-VivienneMultilingualNeural", label: "Vivienne" },
    { id: "fr-FR-RemyMultilingualNeural", label: "Rémy" },
  ],
  de: [
    { id: "de-DE-SeraphinaMultilingualNeural", label: "Seraphina" },
    { id: "de-DE-FlorianMultilingualNeural", label: "Florian" },
  ],
  it: [
    { id: "it-IT-GiuseppeMultilingualNeural", label: "Giuseppe" },
    { id: "it-IT-IsabellaNeural", label: "Isabella" },
  ],
  ja: [
    { id: "ja-JP-NanamiNeural", label: "ナナミ" },
    { id: "ja-JP-KeitaNeural", label: "ケイタ" },
  ],
  ko: [
    { id: "ko-KR-HyunsuMultilingualNeural", label: "현수" },
    { id: "ko-KR-SunHiNeural", label: "선히" },
  ],
  ru: [
    { id: "ru-RU-SvetlanaNeural", label: "Светлана" },
    { id: "ru-RU-DmitryNeural", label: "Дмитрий" },
  ],
};

const ESCOLHA_KEY = "tk:dex-voz-edge";

export function edgeSupports(language: string): boolean {
  return (EDGE_VOICES[language]?.length ?? 0) > 0;
}

export function edgeVoicesFor(language: string): ReadonlyArray<{ id: string; label: string }> {
  return EDGE_VOICES[language] ?? [];
}

export function getEdgeVoice(language: string): string {
  let salva: string | null = null;
  try {
    salva = globalThis.localStorage?.getItem(ESCOLHA_KEY) ?? null;
  } catch {
    /* preferencia nao lida vale mais que app quebrado */
  }
  const lista = edgeVoicesFor(language);
  // A escolha so vale se for do idioma atual: quem escolheu "Antônio" e depois
  // trocou o app pra japones nao quer ouvir japones com voz brasileira.
  if (salva && lista.some((v) => v.id === salva)) return salva;
  return lista[0]?.id ?? "";
}

export function setEdgeVoice(id: string | null): void {
  try {
    if (id === null) globalThis.localStorage?.removeItem(ESCOLHA_KEY);
    else globalThis.localStorage?.setItem(ESCOLHA_KEY, id);
  } catch {
    /* preferencia nao persistida vale mais que app quebrado */
  }
}

/**
 * Gera o audio e devolve o MP3.
 *
 * Nao toca nada: no iPhone o audio so pode comecar dentro de um gesto do
 * usuario, e essa regra e de quem tem o clique na mao.
 */
export async function edgeSynthesize(
  text: string,
  language: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const voz = getEdgeVoice(language);
  if (voz === "") throw new Error("idioma sem voz neural");

  const res = await fetch(TTS_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // 1.200 e o teto da funcao; cortar aqui evita um 413 previsivel.
    body: JSON.stringify({ text: text.slice(0, 1200), voice: voz }),
    ...(signal ? { signal } : {}),
  });

  if (!res.ok) {
    const corpo = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(corpo.error ?? `${res.status}`);
  }

  return res.blob();
}
