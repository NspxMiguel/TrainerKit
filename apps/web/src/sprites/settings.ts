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
export type SpriteSourceId =
  | "off"
  | "gameboy"
  | "pixel"
  | "pokeapi-artwork"
  | "pokeapi-home"
  | "custom";

export interface SpriteSettings {
  source: SpriteSourceId;
  /**
   * Template do provider custom. `{id}` e trocado pelo id do sprite e `{dex}`
   * pelo numero da Pokedex.
   */
  customTemplate: string;
}

const STORAGE_KEY = "tk:sprites";

export const DEFAULT_SETTINGS: SpriteSettings = {
  // Desligado por padrao. Ligar e uma escolha de quem instala, nao nossa.
  source: "off",
  customTemplate: "",
};

export const SOURCE_LABELS: Record<SpriteSourceId, { title: string; detail: string }> = {
  off: {
    title: "Sem imagens",
    detail: "Só o selo com a cor do tipo e as iniciais. Nada é baixado.",
  },
  gameboy: {
    title: "Game Boy",
    detail:
      "O sprite mais antigo que existe de cada um: Vermelho/Azul, depois Cristal, Esmeralda, e Preto/Branco pros novos. ~1 KB cada.",
  },
  pixel: {
    title: "Pixel art uniforme",
    detail: "Tudo no estilo Preto/Branco. Mesma cara da Pokédex inteira. ~1 KB cada.",
  },
  "pokeapi-artwork": {
    title: "Arte oficial",
    detail: "Ilustração grande. Bonita, mas ~150 KB por Pokémon.",
  },
  "pokeapi-home": {
    title: "Renders 3D",
    detail: "Modelos do Pokémon HOME. Estilo uniforme e moderno. ~170 KB cada.",
  },
  custom: {
    title: "Fonte própria",
    detail: "Seus arquivos. Use {id} e {dex} no endereço.",
  },
};

function read(): SpriteSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SpriteSettings>;
    return {
      source: parsed.source ?? DEFAULT_SETTINGS.source,
      customTemplate: parsed.customTemplate ?? DEFAULT_SETTINGS.customTemplate,
    };
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
