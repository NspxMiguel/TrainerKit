/**
 * Voz neural em portugues, sem chave e sem conta.
 *
 * O lado do navegador da funcao em `api/tts.ts` — a explicacao inteira, e a
 * ressalva sobre a origem dessas vozes, esta la. Aqui so o cliente.
 *
 * Isto e o que faltava: das quatro vozes que o app tem, esta e a unica que junta
 * as tres exigencias — humana, gratis, e sem nada pra configurar.
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
    /*
     * Antônio primeiro, Thalita depois — decidido pelo OUVIDO dele, não pela
     * etiqueta da Microsoft.
     *
     * "sotaque de joana parece mais brasileira doq thalita. thalita parece
     * mexicana." A Microsoft rotula as duas como pt-BR, e eu não tenho como
     * julgar sotaque; ele tem. A Thalita era a primeira da lista, ou seja, era o
     * padrão de quem nunca escolheu — e o padrão era justamente a que soa errada
     * pra quem fala o idioma.
     *
     * A Joana que ele citou é voz do SISTEMA (pt-PT no catálogo do aparelho),
     * não do Edge. Ela continua na lista, uma seção abaixo, com a etiqueta
     * pt-PT: se ele preferir, é um toque — e a etiqueta continua dizendo a
     * verdade pra quem é de Portugal.
     */
    { id: "pt-BR-AntonioNeural", label: "Antônio" },
    { id: "pt-BR-ThalitaMultilingualNeural", label: "Thalita" },
    /*
     * A Francisca saiu.
     *
     * A Microsoft rotula a Francisca como pt-BR, mas o sotaque dela e de
     * Portugal, e quem fala o idioma ouve na primeira frase — nesse julgamento
     * quem manda e o ouvido, nao a etiqueta do catalogo.
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

/**
 * A voz que vai falar, garantidamente DO IDIOMA pedido.
 *
 * ⚠️ Esta função é a trava contra um defeito concreto: uma voz brasileira lendo
 * texto em japonês, porque a preferência salva venceu o idioma da tela.
 *
 * A regra é uma só e vale pra qualquer origem: uma voz só é usada se estiver na
 * lista DAQUELE idioma. Preferência salva que não está na lista é descartada, e
 * cai na primeira do idioma. Não existe caminho por onde um id de outro idioma
 * chegue ao sintetizador — nem por preferência velha, nem por parâmetro.
 *
 * `preferida` existe porque a tela agora guarda a escolha num lugar só
 * (`tk:dex-voz-v2`), e ela precisa chegar até aqui.
 */
export function getEdgeVoice(language: string, preferida?: string): string {
  const lista = edgeVoicesFor(language);

  // 1) o que a tela pediu agora, se for deste idioma
  if (preferida && lista.some((v) => v.id === preferida)) return preferida;

  // 2) a preferência antiga (usuários que escolheram antes da tela nova)
  let salva: string | null = null;
  try {
    salva = globalThis.localStorage?.getItem(ESCOLHA_KEY) ?? null;
  } catch {
    /* preferencia nao lida vale mais que app quebrado */
  }
  if (salva && lista.some((v) => v.id === salva)) return salva;

  // 3) a primeira do idioma. Nunca uma de outro.
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
/**
 * Texto que pode viajar na URL — e portanto ser guardado no CDN.
 *
 * ⚠️ A regra e estreita de propósito. GET vira cache compartilhado, e cache
 * compartilhado significa que a URL fica em log de CDN, em historico e em
 * qualquer proxy no caminho. Entao so entra aqui texto que o PROPRIO APP
 * escreveu sobre uma especie — a ficha da Pokedex, que e identica pra todo mundo
 * que abrir o mesmo bicho no mesmo idioma.
 *
 * Resposta de IA NUNCA: ela pode citar a colecao de quem perguntou ("o seu
 * Blissey com IV 98%"), e isso e dado do usuario. Continua no POST, sem cache.
 *
 * O limite de 700 tambem e proposital: acima disso a URL codificada passa de
 * ~2.000 caracteres, que e onde proxies e CDNs comecam a recusar. Texto maior
 * cai no POST sozinho, sem quebrar nada.
 */
const MAX_URL_CHARS = 700;

export async function edgeSynthesize(
  text: string,
  language: string,
  /** A escolhida na tela. Ignorada se não for deste idioma — ver `getEdgeVoice`. */
  preferida?: string,
  /**
   * `true` = o texto veio do app (ficha da Pokédex) e pode ser cacheado no CDN
   * pra todos os usuários. Quem chama decide, e o padrão é o caminho privado.
   */
  compartilhavel = false,
  signal?: AbortSignal,
): Promise<Blob> {
  const voz = getEdgeVoice(language, preferida);
  if (voz === "") throw new Error("idioma sem voz neural");

  // 1.200 e o teto da funcao; cortar aqui evita um 413 previsivel.
  const corte = text.slice(0, 1200);

  /*
   * GET quando da, POST quando nao da.
   *
   * O GET e o que permite o CDN guardar: mesma voz + mesmo texto = mesma URL, e
   * a partir da segunda pessoa o audio sai do cache sem custar nada nem acordar
   * a funcao: o primeiro ouvinte paga a sintese pelos seguintes.
   */
  const podeCachear = compartilhavel && corte.length <= MAX_URL_CHARS;

  const res = podeCachear
    ? await fetch(
        `${TTS_PROXY}?v=${encodeURIComponent(voz)}&t=${encodeURIComponent(corte)}`,
        { method: "GET", ...(signal ? { signal } : {}) },
      )
    : await fetch(TTS_PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: corte, voice: voz }),
        ...(signal ? { signal } : {}),
      });

  if (!res.ok) {
    const corpo = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(corpo.error ?? `${res.status}`);
  }

  return res.blob();
}
