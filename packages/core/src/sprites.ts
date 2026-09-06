/**
 * DE ONDE VEM A IMAGEM DA ESPÉCIE — a parte que os dois apps compartilham.
 *
 * O app é distribuído **sem arte nenhuma** e funciona assim: o monograma
 * colorido não é "o modo sem imagem", é o estado de carga e o recurso de
 * qualquer espécie sem arquivo, em qualquer fonte. Ligar uma fonte é escolha de
 * quem instala, e por isso o padrão é `off`.
 *
 * ⚠️ Isto morava só em `apps/web/src/sprites/`, junto de mil linhas de
 * armazenamento offline, pré-carga e leitura de `.zip` — coisas que dependem de
 * IndexedDB e não atravessam pro nativo. O que atravessa é isto: qual é a URL.
 */

/** As fontes que vêm no app. O web ainda aceita `src:<uuid>` de .zip próprio. */
export type BuiltinSourceId = "off" | "pokeapi-artwork" | "pokeapi-home";

/** Chaves de tradução de cada fonte. O texto mora no dicionário. */
export const SPRITE_SOURCE_KEYS: Record<BuiltinSourceId, { title: string; detail: string }> = {
  off: { title: "sprites.none", detail: "sprites.noneDetail" },
  "pokeapi-artwork": { title: "sprites.official", detail: "sprites.officialDetail" },
  "pokeapi-home": { title: "sprites.home", detail: "sprites.homeDetail" },
};

const POKEAPI = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

export interface SpriteRequest {
  /**
   * Id do sprite resolvido no ETL contra o índice do PokeAPI. **Não é a dex**:
   * as formas regionais vivem na faixa 10000+ e não seguem fórmula (Rattata de
   * Alola é 10091, Raichu de Alola é 10100).
   */
  spriteId: number | null;
  shiny?: boolean;
}

/** URL da imagem, ou `null` quando a fonte está desligada ou não há arte. */
export function spriteUrl(req: SpriteRequest, source: BuiltinSourceId): string | null {
  if (source === "off" || req.spriteId === null) return null;
  const shiny = req.shiny ? "/shiny" : "";
  const pasta = source === "pokeapi-artwork" ? "other/official-artwork" : "other/home";
  return `${POKEAPI}/${pasta}${shiny}/${req.spriteId}.png`;
}
