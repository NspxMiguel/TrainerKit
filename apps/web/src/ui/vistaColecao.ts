import { useSyncExternalStore } from "react";

/**
 * Grade ou lista, numa preferência que duas telas leem.
 *
 * Nasceu porque o alternador precisou MUDAR DE LUGAR: ele vivia dentro da
 * Coleção, ao lado do título dela. Quando a Coleção virou um modo da Pokédex, o
 * título sumiu e o botão ficou sozinho, com quase 300px de vazio ao lado —
 * "aquele negócio ali voando de lista ou grade".
 *
 * O lugar certo dele é a linha do seletor "Todos / Meus", que é onde as escolhas
 * de vista daquela tela já moram. Mas quem DESENHA o botão passou a ser a
 * `PokedexScreen`, e quem USA a preferência continua sendo a `CollectionScreen`.
 *
 * Duas telas lendo o mesmo estado é exatamente onde nasce o bug que eu já fiz
 * neste app: uma escreve numa chave, a outra lê de outra, e a interface fica
 * coerente consigo mesma enquanto o comportamento ignora a escolha. Por isso a
 * preferência mora aqui, num lugar só, com um assinante — trocar num lado
 * atualiza o outro na hora, sem prop atravessando componente.
 */

const KEY = "tk:colecao-grade";

const ouvintes = new Set<() => void>();

function avisar(): void {
  for (const fn of ouvintes) fn();
}

function ler(): boolean {
  try {
    // Grade por padrão: é a "cara de Pokédex" e a mesma vista da aba.
    return globalThis.localStorage?.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setEmGrade(v: boolean): void {
  try {
    globalThis.localStorage?.setItem(KEY, v ? "1" : "0");
  } catch {
    /* preferencia nao persistida vale mais que app quebrado */
  }
  avisar();
}

export function useEmGrade(): boolean {
  return useSyncExternalStore(
    (fn) => {
      ouvintes.add(fn);
      return () => {
        ouvintes.delete(fn);
      };
    },
    ler,
    () => true,
  );
}
