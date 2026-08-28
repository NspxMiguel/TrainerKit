import { useSyncExternalStore } from "react";

import { carregarIndice, guardarArte, quantasDestas } from "./armazem.ts";

/**
 * Baixar as imagens de uma vez, em vez de uma a uma enquanto se navega.
 *
 * O comportamento padrao e sob demanda: cada tile busca a propria imagem quando
 * aparece na tela, e o service worker guarda. Isso e certo pra quem so quer
 * consultar uma especie — ninguem devia baixar 900 imagens pra ver uma.
 *
 * Mas quem vai FICAR usando paga o preco em cada tela nova: os sprites chegam
 * devagar, um por um, e a grade pisca monograma antes de cada imagem. Pra esse caso o certo e o oposto — baixa tudo uma vez, aceita
 * esperar, e depois nunca mais.
 *
 * ⚠️ AQUI SE DIZIA QUE GRAVAR ERA DESNECESSARIO, e isso custava o download
 * inteiro no caso mais comum de teste.
 *
 * O argumento era: o service worker intercepta com a regra `CacheFirst` do
 * `tk-sprites`, entao um `fetch` normal enche o mesmo cache que o `<img>` usaria
 * depois. Verdadeiro — QUANDO EXISTE service worker. Medido:
 *
 *   http://localhost:5273    isSecureContext=true    caches=true   sw=true
 *   http://10.0.0.21:5273    isSecureContext=FALSE   caches=FALSE  sw=FALSE
 *
 * Origem HTTP com IP nao e contexto seguro, e o app e testado no celular
 * exatamente por ali. Naquele endereco o download buscava ~150 MB e guardava
 * ZERO — o painel enchia ate 100%, dizia o tamanho, e nada tinha sido guardado.
 *
 * Agora o blob que ja era lido pra medir o tamanho tambem e GRAVADO
 * (`armazem.ts`, IndexedDB, que existe em origem insegura). Onde ha service
 * worker as duas coisas acontecem e uma nao atrapalha a outra.
 */

export interface PrefetchState {
  status: "idle" | "running" | "done" | "stopped";
  done: number;
  total: number;
  /** Quanto ja veio da rede, em bytes. E o numero que o usuario paga. */
  bytes: number;
  failed: number;
  /** `false` enquanto o painel esta aberto; `true` depois de mandar pro fundo. */
  background: boolean;
}

const IDLE: PrefetchState = {
  status: "idle",
  done: 0,
  total: 0,
  bytes: 0,
  failed: 0,
  background: false,
};

let state: PrefetchState = IDLE;
const listeners = new Set<() => void>();

function set(patch: Partial<PrefetchState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}

export function getPrefetch(): PrefetchState {
  return state;
}

export function usePrefetch(): PrefetchState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getPrefetch,
    () => IDLE,
  );
}

let abort: AbortController | null = null;

/**
 * Seis por vez.
 *
 * Um de cada vez desperdicaria a banda; cem de uma vez faria o navegador
 * enfileirar tudo por conta propria e, pior, deixaria o app sem conexao livre
 * pra qualquer outra coisa enquanto isso. Seis e a ordem de grandeza do limite
 * que os navegadores aplicam por dominio de qualquer jeito.
 */
const CONCURRENCY = 6;

/**
 * Baixa uma imagem, com tentativas. Devolve o tamanho, ou `null` se desistiu.
 *
 * A retentativa nao e zelo excessivo: seis conexoes simultaneas pro mesmo
 * dominio fazem o servidor derrubar algumas, e sem repetir o painel acusava
 * dezenas de "falharam" que eram so tropeco de rede. Com uma segunda chance o
 * numero passa a significar o que diz — imagem que aquela fonte realmente nao
 * tem.
 *
 * A pausa entre tentativas cresce (250ms, 500ms) porque insistir no mesmo
 * instante em que o servidor esta recusando so gera outra recusa.
 */
async function fetchOnce(
  url: string,
  signal: AbortSignal,
  attempts: number,
): Promise<Blob | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal.aborted) return null;
    try {
      const res = await fetch(url, { signal });
      // 404 e resposta definitiva: repetir nao vai criar o arquivo.
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(String(res.status));
      // O corpo precisa ser consumido pro service worker concluir a gravacao.
      // De quebra, e daqui que sai o tamanho real — e agora tambem o que fica
      // guardado no aparelho.
      return await res.blob();
    } catch {
      if (signal.aborted) return null;
      if (attempt + 1 < attempts) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
  }
  return null;
}

export async function startPrefetch(urls: readonly string[]): Promise<void> {
  if (state.status === "running") return;

  abort?.abort();
  abort = new AbortController();
  const { signal } = abort;

  set({ status: "running", done: 0, total: urls.length, bytes: 0, failed: 0, background: false });

  let next = 0;

  const worker = async (): Promise<void> => {
    while (!signal.aborted) {
      const i = next++;
      if (i >= urls.length) return;

      const url = urls[i]!;
      const blob = await fetchOnce(url, signal, 2);
      if (signal.aborted) return;

      if (blob === null) {
        // Uma imagem que falta nao estraga o resto: o tile cai no monograma,
        // que e um estado previsto e nao um erro.
        set({ done: state.done + 1, failed: state.failed + 1 });
      } else {
        await guardarArte(url, blob);
        set({ done: state.done + 1, bytes: state.bytes + blob.size });
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (!signal.aborted) set({ status: "done" });
}

export function stopPrefetch(): void {
  abort?.abort();
  abort = null;
  set({ status: "stopped" });
}

/** Some com o painel sem parar o download. */
export function sendPrefetchToBackground(): void {
  set({ background: true });
}

/** Traz o painel de volta — o caminho de quem quer parar depois de mandar pro fundo. */
export function restorePrefetchPanel(): void {
  set({ background: false });
}

export function dismissPrefetch(): void {
  state = IDLE;
  for (const fn of listeners) fn();
}

/** "12,4 MB" no idioma de quem esta lendo. */
export function formatMb(bytes: number, language: string): string {
  return `${(bytes / 1_048_576).toLocaleString(language, { maximumFractionDigits: 1 })} MB`;
}

/**
 * Quantas destas imagens ja estao no aparelho.
 *
 * ⚠️ E ISTO QUE FAZ O BOTAO PARAR DE REAPARECER. O estado acima e de memoria:
 * ele nasce `idle` a cada abertura, entao depois de recarregar o app voltava a
 * oferecer um download de 1.024 imagens que ja estavam guardadas — "msm dps de
 * baixado, aparece pra baixar".
 *
 * Persistir um sinalizador de "ja baixou" resolveria a tela e mentiria: o
 * usuario pode ter limpado o armazenamento, ou a cota pode ter estourado no
 * meio. Contar o que existe responde a mesma pergunta sem poder divergir do
 * aparelho.
 */
export async function jaGuardadas(urls: readonly string[]): Promise<number> {
  return quantasDestas(urls);
}

/** Deixa o indice pronto antes de a primeira grade montar. */
export function aquecerArmazem(): Promise<unknown> {
  return carregarIndice();
}
