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

/**
 * O endereco e utilizavel a partir daqui?
 *
 * Um `http://` numa pagina servida por `https://` e bloqueado pelo navegador
 * como conteudo misto, e o erro que chega ao app e um `TypeError: Failed to
 * fetch` — indistinguivel de "servidor fora do ar". Melhor dizer o que
 * realmente aconteceu.
 */
export function checkUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "endereço inválido";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "só http ou https";
  }
  if (
    parsed.protocol === "http:" &&
    globalThis.location?.protocol === "https:" &&
    parsed.hostname !== "localhost" &&
    parsed.hostname !== "127.0.0.1"
  ) {
    return "o navegador bloqueia http numa página https — use https";
  }
  return null;
}

/** Endereco efetivo: o do usuario, ou o embarcado. */
export function resolvedDatasetUrl(): string {
  return current ?? BUILTIN_DATASET;
}

/**
 * Confere se o que voltou parece mesmo um dataset do TrainerKit.
 *
 * Sem isto, apontar pra um JSON qualquer daria uma tela branca ou, pior,
 * numeros errados calculados sobre lixo. A checagem e do formato MINIMO que o
 * app precisa pra funcionar, nao do arquivo inteiro: um dataset customizado
 * pode legitimamente nao trazer `rankings` ou `moveNames`, e a tela some em vez
 * de quebrar.
 */
export function looksLikeDataset(value: unknown): string | null {
  if (typeof value === "string") return "veio texto, não JSON";
  if (typeof value !== "object" || value === null) return "não é um objeto JSON";

  const d = value as Record<string, unknown>;
  const required: Array<[string, (v: unknown) => boolean]> = [
    ["cpm", (v) => Array.isArray(v) && v.length > 0 && typeof v[0] === "number"],
    ["species", (v) => Array.isArray(v) && v.length > 0],
    ["fastMoves", Array.isArray],
    ["chargedMoves", Array.isArray],
    ["typeChart", (v) => typeof v === "object" && v !== null],
    ["typeOrder", (v) => Array.isArray(v) && v.length === 18],
    ["settings", (v) => typeof v === "object" && v !== null],
    ["version", (v) => typeof v === "object" && v !== null],
  ];

  for (const [field, ok] of required) {
    if (!(field in d)) return `falta o campo "${field}"`;
    if (!ok(d[field])) return `o campo "${field}" está com formato inesperado`;
  }

  // Uma especie precisa ter o minimo pra calcular qualquer coisa.
  const first = (d.species as unknown[])[0] as Record<string, unknown>;
  for (const field of ["id", "name", "baseStats", "types"]) {
    if (!(field in first)) return `as espécies não têm "${field}"`;
  }

  return null;
}
