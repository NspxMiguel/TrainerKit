import { useSyncExternalStore } from "react";

/**
 * Atualizacao do app, com a pessoa no controle.
 *
 * A CAUSA RAIZ, que levou tempo pra achar: o service worker que o plugin gera
 * NAO chama `self.skipWaiting()` sozinho. Ele so escuta uma mensagem:
 *
 *   self.addEventListener("message", e => {
 *     e.data && e.data.type === "SKIP_WAITING" && self.skipWaiting()
 *   })
 *
 * Ou seja: a versao nova baixa, instala, e fica em `waiting` — parada — ate
 * alguem MANDAR ela assumir. E ninguem mandava. O registro que o plugin
 * injetava era `navigator.serviceWorker.register(...)` e nada mais, e o meu
 * tambem nao postava a mensagem. Por isso o Miguel atualizava a pagina o dia
 * inteiro e continuava vendo a versao velha: nao era cache teimoso, era uma
 * versao nova pronta, esperando um sinal que nunca vinha.
 *
 * Enquanto houver qualquer aba aberta, o `waiting` nao vira `active` por conta
 * propria. So quando TODOS os clientes fecham. Num app instalado, que fica
 * aberto em segundo plano, isso pode nao acontecer por dias.
 *
 * Agora o sinal existe e e um botao. Melhor ainda: virou algo visivel. Um app
 * que se atualiza sozinho e magico quando funciona e enlouquecedor quando nao
 * funciona, porque nao ha nada na tela pra olhar.
 */

const ADIADO_ATE = "tk:atualizacao-adiada-ate";
const NUNCA_AVISAR = "tk:atualizacao-nao-avisar";

/** Quantos dias o "lembrar depois" adia. */
export const DIAS_ADIADO = 3;

export interface UpdateState {
  /** Ha uma versao nova instalada, parada, esperando o sinal. */
  available: boolean;
  /** Uma checagem manual esta em andamento. */
  checking: boolean;
  /**
   * O aviso deve estar na tela?
   *
   * Fica DENTRO do estado, e nao numa funcao que a UI chama, por um motivo
   * concreto: `useSyncExternalStore` compara a referencia do snapshot pra
   * decidir se re-renderiza. Adiar ou silenciar so mexe no localStorage — se o
   * objeto de estado nao mudar junto, o React nao re-renderiza e o aviso fica
   * na tela depois de a pessoa mandar ele sumir.
   */
  visible: boolean;
}

const IDLE: UpdateState = { available: false, checking: false, visible: false };

let state: UpdateState = IDLE;
const listeners = new Set<() => void>();

/** Recalcula o estado inteiro e avisa. Sempre um objeto novo. */
function set(patch: Partial<Pick<UpdateState, "available" | "checking">> = {}): void {
  const available = patch.available ?? state.available;
  const checking = patch.checking ?? state.checking;
  state = { available, checking, visible: available && !isMutedForever() && !isSnoozed() };
  for (const fn of listeners) fn();
}

export function useUpdate(): UpdateState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => state,
    () => IDLE,
  );
}

/** localStorage defensivo — Safari privado lanca ao gravar. */
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
      // Preferencia nao guardada e melhor que app quebrado.
    }
  },
  del(k: string): void {
    try {
      globalThis.localStorage?.removeItem(k);
    } catch {
      // idem
    }
  },
};

function isSnoozed(): boolean {
  const ate = Number(store.get(ADIADO_ATE) ?? 0);
  return Number.isFinite(ate) && Date.now() < ate;
}

export function isMutedForever(): boolean {
  return store.get(NUNCA_AVISAR) === "1";
}

export function snoozeUpdate(dias = DIAS_ADIADO): void {
  store.set(ADIADO_ATE, String(Date.now() + dias * 86_400_000));
  set();
}

export function neverAskUpdate(): void {
  store.set(NUNCA_AVISAR, "1");
  set();
}

/** Volta a avisar — o caminho de quem se arrependeu do "não avisar mais". */
export function askUpdateAgain(): void {
  store.del(NUNCA_AVISAR);
  store.del(ADIADO_ATE);
  set();
}

let registration: ServiceWorkerRegistration | null = null;

/**
 * Manda a versao nova assumir e recarrega.
 *
 * A recarga NAO acontece aqui: ela vem do `controllerchange`, disparado quando
 * o service worker novo de fato assume. Recarregar antes disso devolveria a
 * mesma versao velha, porque quem responde a navegacao ainda seria o antigo.
 */
export function applyUpdate(): void {
  const waiting = registration?.waiting;
  if (!waiting) {
    // Sem ninguem esperando, recarregar e o melhor que da pra fazer.
    window.location.reload();
    return;
  }
  waiting.postMessage({ type: "SKIP_WAITING" });
}

/** Procura versao nova agora. Devolve se achou. */
export async function checkForUpdate(): Promise<boolean> {
  if (!registration) return false;
  set({ checking: true });
  try {
    await registration.update();
    // `update()` resolve quando a busca termina; a instalacao pode continuar
    // depois. O `updatefound` abaixo e quem liga `available` de verdade.
    await new Promise((r) => setTimeout(r, 1200));
  } catch {
    // Offline, por exemplo. Nao e erro que mereca tela.
  } finally {
    set({ checking: false });
  }
  return state.available;
}

/**
 * A saida de emergencia.
 *
 * Existe porque a versao presa do Miguel nao tem como receber o botao de
 * atualizar — o codigo do botao esta justamente na versao que ele nao consegue
 * baixar. Isto apaga o service worker e os caches e recarrega do servidor.
 *
 * NAO toca na colecao: ela vive em IndexedDB, e os ajustes em localStorage.
 * O que se perde sao os sprites e as fontes ja baixados, que voltam sozinhos.
 */
export async function forceReinstall(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    // Sem service worker nao ha o que desregistrar.
  }
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    // Idem pro Cache Storage.
  }
  /*
   * `reload()` nao basta.
   *
   * Sem service worker a navegacao volta pro caminho normal — e o caminho
   * normal passa pelo cache HTTP, onde o GitHub Pages guardou o `index.html`
   * com `max-age=600`. O recarregamento devolveria o mesmo HTML apontando pro
   * mesmo bundle antigo, e o botao de emergencia nao teria emergencia nenhuma.
   *
   * Um endereco DIFERENTE nao esta nesse cache. O parametro nao faz nada no
   * app, e some sozinho no proximo lancamento, porque o `start_url` do manifest
   * e a raiz.
   */
  window.location.replace(`${import.meta.env.BASE_URL}?atualizado=${Date.now()}`);
}

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  /*
   * Havia controlador ANTES de tudo?
   *
   * Na primeira visita nao ha, e o `controllerchange` dispara assim que o
   * primeiro service worker assume. Recarregar ali seria recarregar a pagina
   * que a pessoa acabou de abrir, sem motivo — o codigo em memoria ja e o mais
   * novo que existe.
   */
  const jaTinhaControlador = Boolean(navigator.serviceWorker.controller);
  let recarregando = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!jaTinhaControlador || recarregando) return;
    recarregando = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        // Sem isto o navegador busca o proprio `sw.js` pelo cache HTTP, e o
        // `max-age=600` do GitHub Pages manda na frequencia das atualizacoes.
        updateViaCache: "none",
      })
      .then((reg) => {
        registration = reg;

        // Ja havia uma parada esperando de uma visita anterior.
        if (reg.waiting && navigator.serviceWorker.controller) {
          set({ available: true });
        }

        reg.addEventListener("updatefound", () => {
          const novo = reg.installing;
          if (!novo) return;
          novo.addEventListener("statechange", () => {
            // `installed` COM controlador = e uma atualizacao, nao a primeira
            // instalacao. Sem essa checagem o app avisaria "versao nova
            // disponivel" pra quem acabou de abrir o app pela primeira vez.
            if (novo.state === "installed" && navigator.serviceWorker.controller) {
              set({ available: true });
            }
          });
        });

        const checar = () => {
          // Numa aba escondida gasta rede sem ninguem olhando; e voltar pro app
          // e justamente quando vale conferir.
          if (document.visibilityState === "visible") void reg.update();
        };

        setInterval(checar, 60 * 60 * 1000);
        document.addEventListener("visibilitychange", checar);
      })
      .catch(() => {
        // Sem service worker o app continua funcionando online. Falhar aqui nao
        // pode derrubar nada — Safari privado, por exemplo, recusa o registro.
      });
  });
}
