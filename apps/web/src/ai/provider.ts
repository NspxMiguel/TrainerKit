import { useSyncExternalStore } from "react";

import { getGroqKey, getGroqModel, groqChat } from "./groq.ts";
import { bloqueio, registrarUso } from "./quota.ts";
import { filtrar } from "./guarda.ts";
import {
  DEFAULT_LOCAL_MODEL,
  engineReady,
  hasWebGPU,
  localChat,
  onEngineChange,
  unloadEngine,
} from "./local.ts";

/**
 * De onde vem a resposta do modelo.
 *
 * Duas opcoes de verdade, e nenhuma delas passa por servidor meu:
 *
 *   GROQ    chave do usuario, direto ao provedor. Rapido, quase de graca, mas
 *           precisa de conta e de internet.
 *   LOCAL   modelo na GPU do aparelho. Sem chave, sem conta, offline — e custa
 *           centenas de megabytes de download uma vez.
 *
 * A escolha e do usuario e mora nos Ajustes. `off` e o padrao: um app que liga
 * IA sozinho e um app que decide gastar dado ou dinheiro alheio.
 *
 * Todo o resto do app fala com `chat()` e nao sabe qual dos dois respondeu — que
 * e o que permitiu acrescentar o local sem tocar em nenhuma tela.
 */

export type AiProvider = "off" | "groq" | "local" | "shared";

/**
 * A URL da funcao que guarda a chave compartilhada.
 *
 * O PADRAO E A FUNCAO PUBLICADA, e nao vazio.
 *
 * Antes isto so vinha de `VITE_TK_AI_PROXY`, definida unicamente no workflow do
 * GitHub. Consequencia, visivel abrindo os Ajustes: no `pnpm dev` a opcao
 * "Grátis" simplesmente NAO EXISTIA. O app publicado tinha o recurso e o app de
 * desenvolvimento, nao. Toda vez que eu conferia uma tela de
 * IA, conferia a versao errada.
 *
 * A URL nao e segredo: ela ja esta escrita no bundle publicado, que qualquer um
 * baixa. O segredo e a CHAVE, e ela mora numa variavel de ambiente da Vercel, do
 * outro lado desta URL. Tratar um endereco publico como se fosse credencial so
 * escondia o recurso de mim mesmo.
 *
 * A variavel continua valendo e sobrescreve — e o que aponta um build pra uma
 * funcao de teste sem tocar em codigo.
 */
const AI_PROXY_PADRAO = "https://trainerkit-ia.vercel.app/api/ai";

export const AI_PROXY: string = import.meta.env.VITE_TK_AI_PROXY ?? AI_PROXY_PADRAO;

export function sharedAvailable(): boolean {
  return AI_PROXY !== "";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const PROVIDER_KEY = "tk:ia";
const LOCAL_MODEL_KEY = "tk:ia-local-modelo";

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

function lerProvider(): AiProvider {
  const raw = store.get(PROVIDER_KEY);
  if (raw === "groq" || raw === "local" || raw === "off") return raw;
  // "shared" so vale se a funcao existe neste build: quem escolheu compartilhada
  // e depois recebeu um build sem proxy cai pra desligado, em vez de tentar
  // falar com uma URL vazia.
  if (raw === "shared") return sharedAvailable() ? "shared" : "off";

  /*
   * Migracao de quem ja tinha chave da Groq.
   *
   * Antes desta tela nao havia escolha: ter chave ERA ter IA ligada. Se a pessoa
   * ja tinha uma, ela continua com a IA funcionando — cair pra "desligado" num
   * update seria tirar um recurso que ela ligou de propósito.
   */
  if (getGroqKey()) return "groq";

  /*
   * Sem escolha nenhuma: LIGADA na compartilhada.
   *
   * "por padrao deixa chave publica". O padrao era "desligado", e desligado por
   * padrao significa que ninguem nunca viu o recurso funcionar: pra descobrir que
   * existe IA, a pessoa tinha que entrar nos Ajustes procurando uma coisa que ela
   * nao sabia estar la. O teto por dia e por hora (ver `quota.ts`, que traz a
   * conta do orcamento real da Groq) e o que torna isso sustentavel.
   */
  return sharedAvailable() ? "shared" : "off";
}

let provider = lerProvider();
let localModel = store.get(LOCAL_MODEL_KEY) ?? DEFAULT_LOCAL_MODEL;

const listeners = new Set<() => void>();
const emit = () => {
  for (const fn of listeners) fn();
};

export function getProvider(): AiProvider {
  return provider;
}

export function setProvider(next: AiProvider): void {
  const anterior = provider;
  provider = next;
  store.set(PROVIDER_KEY, next);

  // Saindo do local: solta a GPU. Um modelo de 1 GB parado na memoria de video
  // deixa o resto do telefone lento, e ninguem liga isso a um app de Pokemon.
  if (anterior === "local" && next !== "local") void unloadEngine();

  emit();
}

export function getLocalModel(): string {
  return localModel;
}

export function setLocalModel(id: string): void {
  localModel = id;
  store.set(LOCAL_MODEL_KEY, id);
  emit();
}

export interface AiState {
  provider: AiProvider;
  localModel: string;
  /** Vai responder AGORA, sem download nem configuracao no meio. */
  ready: boolean;
  /**
   * Escolhido, possivel, e faltando so baixar o modelo.
   *
   * Existe porque `ready: false` sozinho nao distingue "nao da" de "da, mas
   * baixa 900 MB primeiro" — e as duas situacoes pedem telas diferentes.
   */
  needsDownload: boolean;
}

export function useAi(): AiState {
  const snap = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      const soltaMotor = onEngineChange(fn);
      return () => {
        listeners.delete(fn);
        soltaMotor();
      };
    },
    /*
     * `engineReady` entra no snapshot, e o motor avisa quando muda.
     *
     * Era o defeito que fazia a IA local "nao funcionar": `ready` dizia sim so
     * por existir WebGPU, com o modelo AINDA nao baixado. A caixa de pergunta
     * aparecia, a primeira pergunta disparava 900 MB em silencio, e nada na
     * tela dizia isso — ela so ficava parada. Alem disso o estado era lido uma
     * vez na montagem, entao terminar o download nao acendia nada.
     */
    () =>
      `${provider} ${localModel} ${getGroqKey() ?? ""} ${engineReady(localModel) ? "1" : "0"}`,
    () => `off ${DEFAULT_LOCAL_MODEL}  0`,
  );

  const [p, m, chave, motor] = snap.split(" ");
  const atual = (p ?? "off") as AiProvider;
  const modelo = m ?? DEFAULT_LOCAL_MODEL;

  if (atual === "groq") {
    return { provider: atual, localModel: modelo, ready: chave !== "", needsDownload: false };
  }

  // Compartilhada: pronta se o build tem proxy. Nao ha chave nem download.
  if (atual === "shared") {
    return {
      provider: atual,
      localModel: modelo,
      ready: sharedAvailable(),
      needsDownload: false,
    };
  }

  if (atual === "local") {
    const podeRodar = hasWebGPU();
    return {
      provider: atual,
      localModel: modelo,
      ready: podeRodar && motor === "1",
      needsDownload: podeRodar && motor !== "1",
    };
  }

  return { provider: atual, localModel: modelo, ready: false, needsDownload: false };
}

/** A IA vai responder se alguem pedir? Usado pelas telas que a oferecem. */
export function aiReady(): boolean {
  if (provider === "shared") return sharedAvailable();
  if (provider === "groq") return getGroqKey() !== null;
  // Mesma correcao do hook: WebGPU sem modelo carregado nao responde nada.
  if (provider === "local") return hasWebGPU() && engineReady(localModel);
  return false;
}

/**
 * Uma pergunta, um texto de volta.
 *
 * Lanca em qualquer falha — quem chama decide o que mostrar. Todas as telas que
 * usam isto continuam inteiras sem a resposta: o veredito por regras ja esta
 * escrito, e o modelo so o reescreve com outras palavras.
 */
export async function chat(
  messages: readonly ChatMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
    /**
     * A pergunta CRUA que o usuario digitou, quando houve uma.
     *
     * Passar isto liga o porteiro (`guarda.ts`). Fica aqui, e nao em cada tela,
     * pra a regra ser uma so: quem esquecer de filtrar teria aberto um buraco
     * que ninguem veria ate a fatura — ou, no caso da chave gratuita, ate a cota
     * de todo mundo sumir.
     *
     * Telas que montam o texto sozinhas (o "Você sabia", o montador de time) nao
     * passam nada: nao ha entrada de usuario pra filtrar ali.
     */
    pergunta?: string;
  } = {},
): Promise<string> {
  if (provider === "off") throw new Error("ia-desligada");

  /*
   * O porteiro vem ANTES de tudo, inclusive antes da IA local.
   *
   * Na local nao ha cota nem chave pra proteger, mas ha o proposito do app: um
   * assistente de Pokemon que escreve codigo Python nao e um recurso, e um
   * vazamento de escopo. E se o filtro so valesse na compartilhada, bastaria
   * trocar o provedor pra furar — e ai ele nao seria um filtro, seria um enfeite.
   */
  if (options.pergunta !== undefined) {
    const v = filtrar(options.pergunta);
    if (!v.ok) throw new Error(`filtro-${v.motivo}`);
  }

  if (provider === "local") {
    // Sem `signal`: o web-llm nao aceita cancelamento numa geracao ja iniciada.
    // Cancelar aqui seria mentira, e mentira em codigo de rede vira bug de
    // memoria depois.
    return localChat(localModel, messages, options);
  }

  /*
   * Compartilhada: a chave fica no servidor e o navegador nunca a ve.
   *
   * O erro da funcao sobe inteiro — o 429 dela diz "use a sua chave ou a IA no
   * aparelho", que e exatamente o que a pessoa precisa ler quando o limite
   * gratuito acaba.
   */
  if (provider === "shared") {
    // O teto, ANTES de gastar a chave dele. Erro proprio pra tela poder dizer
    // "acabaram as de hoje" em vez de repassar um 429 cru — e "hora" e "dia"
    // sao mensagens diferentes: uma manda voltar amanha, a outra daqui a pouco.
    const parou = bloqueio();
    if (parou === "dia") throw new Error("cota-diaria");
    if (parou === "hora") throw new Error("cota-hora");

    const res = await fetch(AI_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      }),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    const corpo = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!res.ok) {
      /*
       * 429 da GROQ, nao do nosso contador.
       *
       * Os limites da Groq sao por ORGANIZACAO: os 100.000 tokens por dia sao o
       * balde de todo mundo junto. Entao a cota pode acabar la mesmo com a
       * pessoa tendo perguntas sobrando aqui — e pra quem esta usando isso e a
       * mesma coisa, entao merece a mesma frase, e nao um "429" cru.
       */
      if (res.status === 429) throw new Error("cota-diaria");
      throw new Error(corpo.error ?? `${res.status}`);
    }
    if (!corpo.text) throw new Error("resposta vazia");

    // So conta DEPOIS de a resposta chegar inteira. Rede caindo no meio nao pode
    // consumir uma das cinco de quem nao leu nada.
    registrarUso();
    return corpo.text;
  }

  const chave = getGroqKey();
  if (!chave) throw new Error("sem-chave");
  return groqChat(chave, getGroqModel(), messages, options);
}
