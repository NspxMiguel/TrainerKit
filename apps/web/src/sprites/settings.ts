import { useSyncExternalStore } from "react";

/**
 * Fontes de imagem, ligadas por configuracao.
 *
 * O app e distribuido SEM nenhuma arte: o que sai daqui e so codigo e numeros.
 * Quem quiser imagens liga a fonte nos Ajustes, e o download acontece no
 * aparelho de quem ligou. Isso mantem o artefato publicavel limpo sem tirar
 * nada de quem usa.
 *
 * O provider `custom` existe pra quem tem os proprios arquivos: aponta o
 * template e pronto, sem precisar mexer no codigo.
 */
/**
 * Fonte ativa.
 *
 * Alem das embutidas, aceita `src:<uuid>` apontando para uma fonte que o
 * usuario adicionou (manifesto por URL ou .zip importado).
 */
export type BuiltinSourceId = "off" | "pokeapi-artwork" | "pokeapi-home";
export type SpriteSourceId = BuiltinSourceId | `src:${string}`;

export interface SpriteSettings {
  source: SpriteSourceId;
}

const STORAGE_KEY = "tk:sprites";

export const DEFAULT_SETTINGS: SpriteSettings = {
  // Desligado por padrao. Ligar e uma escolha de quem instala, nao nossa.
  source: "off",
};

/** Chaves de traducao de cada fonte embutida. O texto mora no dicionario. */
export const SOURCE_KEYS: Record<BuiltinSourceId, { title: string; detail: string }> = {
  off: { title: "sprites.none", detail: "sprites.noneDetail" },
  "pokeapi-artwork": { title: "sprites.official", detail: "sprites.officialDetail" },
  "pokeapi-home": { title: "sprites.home", detail: "sprites.homeDetail" },
};

function read(): SpriteSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SpriteSettings>;
    return { source: parsed.source ?? DEFAULT_SETTINGS.source };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let current: SpriteSettings = read();
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function getSpriteSettings(): SpriteSettings {
  return current;
}

export function setSpriteSettings(next: Partial<SpriteSettings>): void {
  current = { ...current, ...next };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reage a mudanca de fonte sem precisar passar prop por toda a arvore. */
export function useSpriteSettings(): SpriteSettings {
  return useSyncExternalStore(subscribe, getSpriteSettings, () => DEFAULT_SETTINGS);
}
