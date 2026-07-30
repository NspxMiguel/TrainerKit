import { audioEmCache, guardarAudio } from "../ai/cacheAudio.ts";
import { edgeSupports, edgeSynthesize, getEdgeVoice } from "../ai/edgeTts.ts";
import {
  elevenSharedOn,
  elevenSharedSynthesize,
  getSharedVoice,
} from "../ai/elevenShared.ts";
import { elevenAvailable, elevenSynthesize } from "../ai/elevenlabs.ts";
import {
  KOKORO_VOICES,
  kokoroReady,
  kokoroSupports,
  kokoroSynthesize,
} from "../ai/kokoro.ts";
import { synthesize, ttsAvailable } from "../ai/tts.ts";

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
 *
 * ⚠️ ATUALIZACAO: "o narrador da pokex fico paia po". Ele esta certo, e o motivo
 * nao tem conserto por ajuste: `SpeechSynthesis` usa a voz do SISTEMA, e em
 * portugues ela vai de sofrivel a robotica dependendo do aparelho. Mexer em
 * `pitch` nao resolve o timbre.
 *
 * Entao quando da, a fala passa por TTS de verdade (ver `ai/tts.ts`) e a voz do
 * sistema fica sendo o PLANO B — pra quem nao tem chave, pra quando a rede cai, e
 * pra quando a Groq recusa o modelo. Nunca fica muda.
 *
 * ⚠️ "Quando da" e mais estreito do que eu esperava, e isso saiu de testar com a
 * chave do Miguel: o unico TTS no catalogo da Groq e o Orpheus, ele exige aceite
 * de termos no console, e e SO INGLES. Pra portugues a voz do sistema continua
 * sendo a certa — voz bonita pronunciando errado e pior que voz feia pronunciando
 * certo. Ver `tts.ts` pro detalhe.
 */

/** Preferencia guardada: quem nao quer voz nao deveria ter que desligar sempre. */
const VOICE_KEY = "tk:dex-voz";

/**
 * A voz ESCOLHIDA na mao, quando ha uma.
 *
 * A pontuacao automatica acerta na maioria dos aparelhos, mas gosto de voz e
 * gosto — e o Miguel pediu pra poder escolher. Guardado por `voiceURI`, nao por
 * nome: dois aparelhos podem ter vozes de nome igual e `voiceURI` e o
 * identificador de verdade.
 */
const VOICE_PICK_KEY = "tk:dex-voz-escolhida";

/** Voz do Kokoro escolhida (`pf_dora`, `am_michael`…). Vazio = usa a primeira. */
const KOKORO_PICK_KEY = "tk:dex-voz-kokoro";

/**
 * A voz neural, LIGADA por padrao.
 *
 * Padrao ligado porque ela nao pede nada: sem chave, sem conta, sem download,
 * sem permissao. Se ela precisasse de qualquer uma dessas quatro coisas, o
 * padrao teria que ser desligado — foi o criterio do modelo local e continua
 * valendo. Aqui nao precisa, entao deixar desligada seria esconder a unica voz
 * boa do app atras de um interruptor que ninguem ia procurar.
 *
 * Desligar cai pra voz do sistema, que funciona offline.
 */
const NEURAL_KEY = "tk:dex-voz-neural";

/**
 * A ESCOLHA, uma só, no formato `motor:id`.
 *
 * Substitui quatro preferências independentes — uma por motor — que juntas
 * respondiam a uma pergunta só ("qual voz lê a ficha?") e por isso deixavam a
 * tela com ~30 opções e nenhuma resposta clara. Ver `ai/vozes.ts`.
 *
 * Vazio = ninguém escolheu, e aí vale a ordem automática: a primeira
 * recomendada pro idioma da tela.
 */
const ESCOLHA_KEY = "tk:dex-voz-v2";

export function vozEscolhida(): string | null {
  try {
    return globalThis.localStorage?.getItem(ESCOLHA_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setVozEscolhida(chave: string | null): void {
  try {
    if (chave === null) globalThis.localStorage?.removeItem(ESCOLHA_KEY);
    else globalThis.localStorage?.setItem(ESCOLHA_KEY, chave);
  } catch {
    /* preferencia nao persistida vale mais que app quebrado */
  }
}

export function neuralOn(): boolean {
  try {
    return globalThis.localStorage?.getItem(NEURAL_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setNeuralOn(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(NEURAL_KEY, on ? "1" : "0");
  } catch {
    /* preferencia nao persistida vale mais que app quebrado */
  }
}

export function getKokoroVoice(): string | null {
  try {
    return globalThis.localStorage?.getItem(KOKORO_PICK_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setKokoroVoice(id: string | null): void {
  try {
    if (id === null) globalThis.localStorage?.removeItem(KOKORO_PICK_KEY);
    else globalThis.localStorage?.setItem(KOKORO_PICK_KEY, id);
  } catch {
    /* preferencia nao persistida vale mais que app quebrado */
  }
}

export function getPickedVoiceUri(): string | null {
  try {
    return globalThis.localStorage?.getItem(VOICE_PICK_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setPickedVoiceUri(uri: string | null): void {
  try {
    if (uri === null) globalThis.localStorage?.removeItem(VOICE_PICK_KEY);
    else globalThis.localStorage?.setItem(VOICE_PICK_KEY, uri);
  } catch {
    /* preferencia nao persistida vale mais que app quebrado */
  }
}

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
 * Vozes de NOVIDADE da Apple.
 *
 * ⚠️ Aqui estava o "leitor paia" e eu levei tres rodadas pra achar, porque
 * procurei no lugar errado: culpei o timbre do sistema quando o defeito era
 * ESCOLHA. `getVoices()` devolve 180 vozes, dez delas em portugues, e a versao
 * anterior pegava a PRIMEIRA que casasse o idioma. A primeira, em ordem
 * alfabetica, e "Eddy (Portuguese (Brazil))" — uma das vozes caricatas que a
 * Apple embarca pra brincadeira. "Luciana", a voz séria de pt-BR, estava na
 * mesma lista o tempo todo.
 *
 * A lista e por nome porque esses nomes sao estaveis entre versoes do iOS e do
 * macOS, e porque nao ha nenhum campo na API que diga "esta e de brincadeira".
 */
const NOVIDADE = new Set([
  "albert", "bad news", "bahh", "bells", "boing", "bubbles", "cellos", "eddy",
  "flo", "fred", "good news", "grandma", "grandpa", "jester", "junior", "kathy",
  "organ", "ralph", "reed", "rocko", "sandy", "shelley", "superstar", "trinoids",
  "whisper", "wobble", "zarvox",
]);

/** O nome sem o idioma entre parenteses: "Eddy (Portuguese (Brazil))" -> "eddy". */
function nomeBase(v: SpeechSynthesisVoice): string {
  return v.name.split("(")[0]!.trim().toLowerCase();
}

/**
 * Nota da voz. Maior e melhor.
 *
 * Sinais, do mais forte pro mais fraco:
 *   · novidade da Apple e eliminatorio — sao piores que qualquer alternativa
 *   · Siri e as variantes Enhanced/Premium sao as boas de verdade, e o usuario
 *     pode baixa-las em Ajustes → Acessibilidade → Conteudo falado
 *   · idioma exato (pt-BR) ganha do idioma raiz (pt-PT lendo brasileiro)
 *   · voz local nao depende de rede e nao tem atraso
 */
function notaDaVoz(v: SpeechSynthesisVoice, language: string): number {
  if (NOVIDADE.has(nomeBase(v))) return -1000;

  let nota = 0;
  const nome = v.name.toLowerCase();
  if (nome.includes("siri")) nota += 300;
  if (nome.includes("premium") || nome.includes("enhanced")) nota += 200;

  const alvo = language.toLowerCase();
  const lang = v.lang.toLowerCase().replace("_", "-");
  if (lang === alvo) nota += 100;
  else if (lang.split("-")[0] === alvo.split("-")[0]) nota += 50;
  else return -1000; // idioma errado nunca serve

  if (v.localService) nota += 10;
  if (v.default) nota += 5;
  return nota;
}

/**
 * Escolhe a MELHOR voz do sistema, nao a primeira.
 *
 * A lista chega VAZIA na primeira chamada em varios navegadores — ela e
 * preenchida de forma assincrona — e por isso quem chama aceita `null` e deixa o
 * sistema escolher.
 */
function pickVoice(language: string): SpeechSynthesisVoice | null {
  const vozes = globalThis.speechSynthesis?.getVoices() ?? [];
  if (vozes.length === 0) return null;

  // Escolha manual ganha da automatica. Se a voz sumiu (trocou de aparelho,
  // desinstalou), cai na pontuacao em vez de ficar muda.
  const escolhida = getPickedVoiceUri();
  if (escolhida !== null) {
    const achada = vozes.find((v) => v.voiceURI === escolhida);
    if (achada) return achada;
  }

  let melhor: SpeechSynthesisVoice | null = null;
  let melhorNota = -Infinity;
  for (const v of vozes) {
    const nota = notaDaVoz(v, language);
    if (nota > melhorNota) {
      melhorNota = nota;
      melhor = v;
    }
  }
  return melhorNota <= -1000 ? null : melhor;
}

/** Qual voz o app escolheu, pra tela poder mostrar. */
export function chosenVoiceName(language: string): string | null {
  return pickVoice(language)?.name ?? null;
}

export interface VoiceOption {
  uri: string;
  name: string;
  lang: string;
  /** A que a pontuacao escolheria sozinha. */
  recommended: boolean;
}

/**
 * As vozes que valem a pena oferecer, na ordem em que valem.
 *
 * As caricatas ficam de FORA da lista, nao no fim: oferecer "Grandpa" pra ler
 * uma ficha de Pokemon nao e opcao, e ninguem que escolhesse ela ficaria
 * satisfeito. Se a pessoa quiser mesmo, o sistema dela tem esse ajuste.
 */
export function listVoices(language: string): VoiceOption[] {
  const vozes = globalThis.speechSynthesis?.getVoices() ?? [];
  const melhor = pickVoiceAuto(language);

  return vozes
    .map((v) => ({ v, nota: notaDaVoz(v, language) }))
    .filter((x) => x.nota > -1000)
    .sort((a, b) => b.nota - a.nota)
    .map(({ v }) => ({
      uri: v.voiceURI,
      name: v.name,
      lang: v.lang,
      recommended: v.voiceURI === melhor?.voiceURI,
    }));
}

/** A escolha automatica, ignorando a manual. Usada pra marcar a recomendada. */
function pickVoiceAuto(language: string): SpeechSynthesisVoice | null {
  const vozes = globalThis.speechSynthesis?.getVoices() ?? [];
  let melhor: SpeechSynthesisVoice | null = null;
  let melhorNota = -Infinity;
  for (const v of vozes) {
    const nota = notaDaVoz(v, language);
    if (nota > melhorNota) {
      melhorNota = nota;
      melhor = v;
    }
  }
  return melhorNota <= -1000 ? null : melhor;
}

/**
 * Toca uma frase curta com UMA voz especifica, pra pessoa ouvir antes de decidir.
 *
 * "reproduzindo previas ao clicar em cima de um" — sem isso a escolha e as
 * cegas: nomes como "Luciana" e "Joana" nao dizem nada sobre como soam.
 */
export function previewVoice(uri: string, texto: string): void {
  const synth = globalThis.speechSynthesis;
  if (!synth) return;
  synth.cancel();

  const voz = synth.getVoices().find((v) => v.voiceURI === uri);
  const u = new SpeechSynthesisUtterance(texto);
  if (voz) {
    u.voice = voz;
    u.lang = voz.lang;
  }
  u.rate = 0.88;
  u.pitch = 0.85;
  synth.speak(u);
}

export function stopSpeaking(): void {
  pararAudio();
  globalThis.speechSynthesis?.cancel();
}

/**
 * O audio que esta tocando agora.
 *
 * Guardado no modulo porque `stopSpeaking` precisa alcancar ele de qualquer
 * tela — e porque dois `speak()` seguidos nao podem virar duas vozes por cima
 * uma da outra, que foi o primeiro bug que apareceu ao trocar de bicho rapido
 * com a navegacao de anterior/proximo.
 */
let tocando: HTMLAudioElement | null = null;
let urlAtual: string | null = null;

function pararAudio(): void {
  if (tocando) {
    tocando.pause();
    tocando.src = "";
    tocando = null;
  }
  if (urlAtual) {
    URL.revokeObjectURL(urlAtual);
    urlAtual = null;
  }
}

/**
 * Erro da ultima tentativa de TTS, pra tela poder mostrar.
 *
 * A Groq lista as vozes validas na mensagem de erro quando a voz esta errada, e
 * eu nao pude verificar o nome delas sem a chave — entao essa mensagem e o
 * caminho pra descobrir, e engoli-la deixaria o Miguel adivinhando.
 */
let ultimoErroTts: string | null = null;

export function lastTtsError(): string | null {
  return ultimoErroTts;
}

/**
 * Fala. Com voz boa se der, com a do sistema se nao.
 *
 * A ordem importa: tenta a Groq primeiro e SÓ cai pro sistema em falha. O
 * contrario (tocar a do sistema enquanto baixa a boa) daria duas vozes.
 */
export async function speak(text: string, language: string): Promise<void> {
  stopSpeaking();

  /*
   * UMA voz escolhida, e um caminho pra ela.
   *
   * Antes isto era uma cascata de quatro `if`s, cada um consultando o
   * interruptor do seu motor: Kokoro carregado? neural ligada? ElevenLabs com
   * chave? Funcionava, mas ninguém conseguia prever qual voz ia sair — e a tela
   * de Ajustes tinha que expor os quatro interruptores pra a pessoa ter alguma
   * chance de controlar o resultado. Era a origem do "totalmente confuso".
   *
   * Agora: a pessoa escolhe UMA voz, e a cascata só existe como PLANO B, pra
   * quando a escolhida falha (rede caiu, cota acabou, modelo não carregou).
   * Nunca fica muda — mas também nunca troca de voz sem motivo.
   */
  const escolha = vozEscolhida();
  if (escolha) {
    const [motor, ...resto] = escolha.split(":");
    const id = resto.join(":");
    try {
      const blob = await porMotor(motor ?? "", id, text, language);
      if (blob) {
        await tocarBlob(blob);
        ultimoErroTts = null;
        return;
      }
      if (motor === "sistema") {
        await speakWithSystem(text, language, id);
        ultimoErroTts = null;
        return;
      }
    } catch (e) {
      // Guarda e cai pro plano B. Ficar mudo porque a voz escolhida falhou
      // seria pior que falar com outra.
      ultimoErroTts = e instanceof Error ? e.message : String(e);
    }
  }

  /*
   * PLANO B, na ordem de quem tem menos chance de falhar de novo.
   *
   * Kokoro primeiro quando já está carregado: é a única que não usa rede. Depois
   * a neural, que é grátis e sem cota. A ElevenLabs NÃO entra aqui — ela custa
   * de um bolo de ~50 leituras por mês pra todo mundo, e gastar isso num
   * fallback que ninguém pediu é como essa cota morre no dia 2.
   */
  if (kokoroReady() && kokoroSupports(language)) {
    try {
      const blob = await kokoroSynthesize(text, getKokoroVoice() ?? defaultKokoroVoice(language));
      await tocarBlob(blob);
      ultimoErroTts = null;
      return;
    } catch (e) {
      ultimoErroTts = e instanceof Error ? e.message : String(e);
    }
  }

  if (edgeSupports(language)) {
    try {
      const blob = await comCache("edge", getEdgeVoice(language), text, () =>
        edgeSynthesize(text, language),
      );
      await tocarBlob(blob);
      ultimoErroTts = null;
      return;
    } catch (e) {
      ultimoErroTts = e instanceof Error ? e.message : String(e);
    }
  }

  await speakWithSystem(text, language);
}

/**
 * Gera pelo motor pedido. `null` = este motor não gera Blob (é o do sistema,
 * que fala direto pelo navegador e não devolve áudio).
 */
async function porMotor(
  motor: string,
  id: string,
  texto: string,
  idioma: string,
): Promise<Blob | null> {
  switch (motor) {
    case "edge":
      // `id` e so PREFERENCIA: `edgeSynthesize` descarta o que nao for do idioma.
      return comCache("edge", getEdgeVoice(idioma, id), texto, () =>
        edgeSynthesize(texto, idioma, id),
      );
    case "kokoro":
      return kokoroSynthesize(texto, id);
    case "eleven-share":
      return comCache("11-share", id, texto, () => elevenSharedSynthesize(texto, id, idioma));
    case "eleven-user":
      return comCache("11-user", id, texto, () => elevenSynthesize(texto));
    case "sistema":
      return null;
    default:
      throw new Error(`motor desconhecido: ${motor}`);
  }
}

/**
 * Procura no cache; so gera se nao achou; guarda o que gerou.
 *
 * Falha do cache nunca impede a fala: `audioEmCache` e `guardarAudio` engolem
 * os proprios erros e devolvem null / nada. O pior caso e gastar cota de novo,
 * nunca ficar mudo.
 */
async function comCache(
  motor: string,
  voz: string,
  texto: string,
  gerar: () => Promise<Blob>,
): Promise<Blob> {
  const guardado = await audioEmCache(motor, voz, texto);
  if (guardado) return guardado;
  const novo = await gerar();
  await guardarAudio(motor, voz, texto, novo);
  return novo;
}

/** A voz padrao do idioma quando ninguem escolheu. */
function defaultKokoroVoice(language: string): string {
  const vozes = KOKORO_VOICES[language] ?? [];
  return vozes[0]?.id ?? "af_heart";
}

/**
 * Toca um Blob de audio ate o fim.
 *
 * Compartilhado por Kokoro e Groq. Resolve tambem no erro: sem isso, um audio
 * que falha em tocar deixaria a promessa pendurada e o botao "Falar"
 * desabilitado pra sempre.
 */
async function tocarBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  urlAtual = url;
  const audio = new Audio(url);
  tocando = audio;
  await new Promise<void>((resolve) => {
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    void audio.play().catch(() => resolve());
  });
  pararAudio();
}

/**
 * O plano C: a voz do sistema, com a entrega de aparelho.
 *
 * `rate` 0.88 e `pitch` 0.85: mais lento e mais grave que a fala natural, que e
 * o que faz soar anunciado em vez de conversado. Nao mexer nisso sem ouvir —
 * abaixo de 0.8 vira paródia, acima de 1 vira assistente de banco. Nao conserta
 * o timbre (isso e do sistema), so o ritmo.
 */
async function speakWithSystem(
  text: string,
  language: string,
  /** `voiceURI` específico, quando a pessoa escolheu uma voz do sistema. */
  uri?: string,
): Promise<void> {
  const synth = globalThis.speechSynthesis;
  if (!synth) return;

  synth.cancel();

  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language;
    u.rate = 0.88;
    u.pitch = 0.85;
    // A escolhida ganha de `pickVoice`, que é só o palpite automático.
    const voz =
      (uri ? (synth.getVoices().find((v) => v.voiceURI === uri) ?? null) : null) ??
      pickVoice(language);
    if (voz) u.voice = voz;

    // Resolve nos dois casos: `onerror` dispara quando a aba perde o foco no
    // meio da fala, e sem tratar isso a promessa nunca resolveria.
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}
