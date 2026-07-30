import { useSyncExternalStore } from "react";

/**
 * O registro de VISTOS.
 *
 * E a funcao mais caracteristica de uma Pokedex e o app nao tinha nenhuma: nos
 * jogos ela registra automaticamente quem voce ENCONTROU, e separado disso quem
 * voce CAPTUROU. O contador "152 vistos / 87 capturados" e metade da razao de
 * alguem abrir uma Pokedex.
 *
 * Aqui:
 *   VISTO      voce abriu a ficha dele no modo Pokedex. E o mais perto de
 *              "encontrei" que um app fora do jogo pode saber honestamente.
 *   CAPTURADO  esta na sua colecao. Ja existia, so nao estava sendo contado.
 *
 * Fica em localStorage e nao em IndexedDB de propósito: e um conjunto de ids
 * curtos, lido em toda abertura de ficha, e o custo de abrir uma transacao pra
 * isso e maior que o dado. `wipeEverything` limpa junto porque limpa a chave
 * inteira do localStorage.
 */

const KEY = "tk:vistos";

function ler(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

let vistos = ler();
const listeners = new Set<() => void>();

/**
 * O snapshot e a QUANTIDADE, nao o conjunto.
 *
 * `useSyncExternalStore` compara por identidade, e devolver o `Set` faria o
 * React re-renderizar pra sempre — o mesmo erro que ja custou uma sessao neste
 * projeto com o banner de atualizacao. Quem precisa saber de um id especifico
 * chama `wasSeen`, que nao passa pelo store.
 */
function emit(): void {
  for (const fn of listeners) fn();
}

export function markSeen(speciesId: string): void {
  if (vistos.has(speciesId)) return;
  vistos = new Set(vistos).add(speciesId);
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify([...vistos]));
  } catch {
    /* nao poder guardar nao pode derrubar a tela */
  }
  emit();
}

export function wasSeen(speciesId: string): boolean {
  return vistos.has(speciesId);
}

export function seenCount(): number {
  return vistos.size;
}

/**
 * Os ids vistos, pra quem precisa CRUZAR com outra fonte.
 *
 * O aparelho mostrava "VISTOS: 0 · CAPTURADOS: 6": este registro so sabe de
 * quem foi identificado no Modo Pokedex, e a colecao mora em IndexedDB. Contar
 * os dois separados nao junta — e por isso `seenCount()` sozinho nao serve la.
 *
 * Devolve uma copia: entregar o `Set` interno deixaria qualquer chamador mexer
 * no registro sem passar por `markSeen`, e sem avisar ninguem.
 */
export function seenIds(): ReadonlySet<string> {
  return new Set(vistos);
}

export function useSeenCount(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => vistos.size,
    () => 0,
  );
}
