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

/**
 * As vozes REAIS da conta, por idioma — buscadas na API, nao escritas de cabeca.
 *
 * ⚠️ O QUE ESTAVA AQUI ERA INVENTADO, e o Miguel pegou pelo ouvido: "os nomes
 * tao errados kkk, sarah ta com voz de homem".
 *
 * Eu tinha cravado seis pares nome/id de memoria. Conferindo contra
 * `/v2/voices`: QUATRO DOS SEIS IDS NAO EXISTEM na conta (Rachel, Domi, Josh,
 * Arnold). So Sarah e Adam eram reais.
 *
 * E o efeito nao foi "essa voz nao funciona" — foi pior. Pedir um id inexistente
 * falhava, a cadeia de voz caia calada pra proxima opcao, e saia OUTRA voz com o
 * rotulo da primeira. Ele tocou "Sarah" e ouviu um homem porque quem falou foi o
 * Antonio, do motor neural. O rotulo mentia por causa do fallback silencioso.
 *
 * Agora os ids, os nomes e o genero vem da API, e a lista e POR IDIOMA: cada voz
 * so aparece onde a ElevenLabs declara `verified_languages`. Coreano e russo
 * ficam sem — nenhuma voz da conta cobre esses dois, e inventar seria repetir o
 * erro.
 */
export const ELEVEN_VOICES: Record<
  string,
  ReadonlyArray<{ id: string; label: string; nativa: boolean }>
> = {
  /*
   * ⚠️ NENHUMA VOZ DE BIBLIOTECA AQUI. Ver a nota grande logo abaixo.
   *
   * O Adriano saiu desta lista. Ele era a primeira opcao do portugues, marcado
   * `nativa: true` como "o unico brasileiro de verdade" — e nunca falou uma
   * palavra. Voz de Voice Library num plano gratuito devolve 402 na API, a
   * chamada falhava, o app caia calado pra voz neural, e o rotulo "Adriano"
   * ficava em cima de outra voz.
   *
   * Era isso que o Miguel ouviu como "voz de brian e adriano e eric =": Brian e
   * Eric sao diferentes de verdade (audios de 35.152 e 30.973 bytes), o Adriano
   * e que era os outros dois.
   *
   * O id continua no allowlist de `api/tts11.ts`: no dia em que a conta virar
   * paga, e so devolver a linha aqui.
   */
  "pt-BR": [
    { id: "nPczCjzI2devNBz1zQrb", label: "Brian", nativa: false },
    { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica", nativa: false },
  ],
  /*
   * So o ingles ganha a lista inteira, e isso nao e favoritismo.
   *
   * As 22 vozes da conta sao TODAS american/british/australian — conferido em
   * `/v2/voices`, uma por uma. Em ingles elas sao nativas e soam claramente
   * diferentes entre si, entao seis opcoes sao seis escolhas de verdade.
   *
   * Nos outros idiomas elas leem pelo modelo multilingue, com sotaque de quem
   * aprendeu — e ai tres vozes masculinas americanas lendo portugues soam a
   * mesma coisa pra quem escuta. Oferecer tres era vender escolha que nao
   * existe, e cada uma dessas leituras sai de um bolo de ~50 por MES.
   *
   * Entao fora do ingles ficam DUAS, uma de cada genero — que e a unica
   * diferenca que o ouvido pega quando o sotaque e o mesmo. Quem quiser voz da
   * propria lingua tem a neural, que e nativa, gratis e sem cota.
   */
  en: [
    { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", nativa: true },
    { id: "pNInz6obpgDQGcFmaJgB", label: "Adam", nativa: true },
    { id: "hpp4J3VqNfWAUOO0d1Us", label: "Bella", nativa: true },
    { id: "JBFqnCBsd6RMkjVDRZzb", label: "George", nativa: true },
    { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice", nativa: true },
    { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica", nativa: true },
  ],
  es: [
    { id: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger", nativa: false },
    { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda", nativa: false },
  ],
  "es-419": [
    { id: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger", nativa: false },
    { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda", nativa: false },
  ],
  fr: [
    { id: "N2lVS1w4EtoT3dr4eOWO", label: "Callum", nativa: false },
    { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura", nativa: false },
  ],
  de: [
    { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", nativa: false },
    { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily", nativa: false },
  ],
  it: [
    { id: "SAz9YHcvj6GT2YYXdXww", label: "River", nativa: false },
    { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda", nativa: false },
  ],
  ja: [
    { id: "JBFqnCBsd6RMkjVDRZzb", label: "George", nativa: false },
    { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica", nativa: false },
  ],
  // Coreano e russo continuam VAZIOS: nenhuma voz da conta declara esses
  // idiomas, e inventar uma entrada aqui seria repetir o erro dos ids de
  // memoria. Nesses dois a lista mostra so a neural, que cobre os dois.
  ko: [],
  ru: [],
};


/** Compatibilidade: o allowlist da funcao aceita qualquer id que apareca acima. */
export const ELEVEN_SHARED_VOICES = ELEVEN_VOICES.en!;

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

/**
 * As vozes deste idioma — e o INGLES como saida quando ele nao tem nenhuma.
 *
 * O Miguel: "coloca opção de usar em ingles quando nao disponivel na sua lingua.
 * pra todos os idiomas tem q ve ne pae".
 *
 * Coreano e russo nao tem NENHUMA voz da ElevenLabs nesta conta. Sem esta saida,
 * quem usa o app nessas duas linguas simplesmente nao veria a opcao existir —
 * e "nao existe" e uma resposta pior que "existe, com sotaque ingles", porque a
 * segunda a pessoa pode escutar e decidir sozinha.
 *
 * A regra continua a mesma do motor neural: a voz so e usada se estiver na lista
 * de ALGUM idioma conhecido. O que muda e que a lista de recurso e o ingles em
 * vez de vazio.
 */
export function vozesDoIdioma(
  idioma: string,
): ReadonlyArray<{ id: string; label: string; nativa: boolean }> {
  const proprias = ELEVEN_VOICES[idioma] ?? [];
  if (proprias.length > 0) return proprias;

  /*
   * ⚠️ Ao cair pro ingles, `nativa` vira FALSO — sempre.
   *
   * As entradas do ingles sao `nativa: true`, o que e verdade EM INGLES. Sem
   * este mapa elas chegavam em coreano ainda marcadas como nativas, e a tela
   * mostrava a Sarah debaixo de "falam o seu idioma" pra quem usa o app em
   * coreano. Foi o teste dos idiomas que pegou, nao eu.
   *
   * A saida existe pra dar opcao a quem nao tem nenhuma, nao pra mentir sobre
   * o sotaque dela.
   */
  return (ELEVEN_VOICES.en ?? []).map((v) => ({ ...v, nativa: false }));
}

export function getSharedVoice(idioma = "en"): string {
  const lista = vozesDoIdioma(idioma);
  const salva = store.get(VOZ_KEY);
  // A escolha so vale se for deste idioma: preferencia de outra lingua e
  // exatamente como uma voz acaba falando o idioma errado.
  if (salva && lista.some((v) => v.id === salva)) return salva;
  return lista[0]?.id ?? "";
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
  /** Voz escolhida na tela. Só vale se for do idioma — ver `getSharedVoice`. */
  preferida?: string,
  idioma = "en",
  signal?: AbortSignal,
): Promise<Blob> {
  const res = await fetch(ELEVEN_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text.slice(0, ELEVEN_MAX_CHARS),
      voice:
        preferida && vozesDoIdioma(idioma).some((v) => v.id === preferida)
          ? preferida
          : getSharedVoice(idioma),
    }),
    ...(signal ? { signal } : {}),
  });

  if (!res.ok) {
    const corpo = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(corpo.error ?? `${res.status}`);
  }

  return res.blob();
}
