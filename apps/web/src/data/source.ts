import { useSyncExternalStore } from "react";

/**
 * De onde vem o dataset do jogo.
 *
 * O app embarca um, gerado no build a partir do GAME_MASTER publico. Mas essa
 * escolha nao precisa ser minha para sempre: quem quiser apontar pra outra
 * fonte — uma base propria, um fork mais atualizado, um recorte so com o que
 * interessa — aponta e pronto, exatamente como acontece com as imagens.
 *
 * Isso vale por tres motivos, e nenhum e capricho:
 *
 *   O app fica DESACOPLADO de mim. Se eu parar de atualizar a base, ninguem
 *   fica preso a um jogo de dois anos atras — troca a fonte e segue.
 *
 *   A base envelhece por conta propria. O jogo muda a cada poucos dias; quem
 *   precisa do dado de hoje nao devia depender do meu deploy.
 *
 *   E e a mesma postura do resto: o TrainerKit nao hospeda dado de jogo como
 *   quem e dono dele. Ele aponta.
 */

const KEY = "tk:fonte-dados";

/** Endereco do dataset embarcado, relativo a raiz publicada. */
export const BUILTIN_DATASET = `${import.meta.env.BASE_URL}dataset/gamedata.json`;

/** localStorage defensivo — Safari privado lanca ao gravar. */
const store = {
  get(k: string): string | null {
    try {
      return globalThis.localStorage?.getItem(k) ?? null;
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null): void {
    try {
      if (v === null) globalThis.localStorage?.removeItem(k);
      else globalThis.localStorage?.setItem(k, v);
    } catch {
      // Preferencia nao persistida vale mais que app quebrado.
    }
  },
};

let current: string | null = store.get(KEY);
const listeners = new Set<() => void>();

export function getDataSource(): string | null {
  return current;
}

/** `null` volta pro dataset embarcado. */
export function setDataSource(url: string | null): void {
  current = url;
  store.set(KEY, url);
  for (const fn of listeners) fn();
}

export function useDataSource(): string | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getDataSource,
    () => null,
  );
}

/** Endereco efetivo: o do usuario, ou o embarcado. */
export function resolvedDatasetUrl(): string {
  return current ?? BUILTIN_DATASET;
}

/*
 * ⚠️ `checkUrl` e `looksLikeDataset` MORAVAM AQUI e foram para o
 * `packages/core` (`checarUrl`, `validarDataset`): o app nativo precisa das
 * mesmas duas checagens, e a cópia que existia aqui devolvia frase em
 * português cravada — o que deixava a tela em duas línguas para quem não
 * estivesse em português. Agora elas devolvem CHAVE, e quem mostra traduz.
 */
export { checarUrl, validarDataset, type ProblemaDaFonte } from "@trainerkit/core";
