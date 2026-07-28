import { getSpriteSettings, type SpriteSettings } from "./settings.ts";

/**
 * Camada de sprite — resolvida em runtime pela configuracao.
 *
 * Nenhum componente de UI monta URL por conta propria: todos pedem aqui. Isso e
 * o que permite o app ser distribuido sem arte nenhuma e ainda assim mostrar
 * imagem completa pra quem liga a fonte nos Ajustes.
 *
 * O tile de monograma nao e "o modo sem imagem": ele e o estado de carga e o
 * fallback de qualquer especie sem arquivo, em qualquer fonte.
 */

const POKEAPI = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

export interface SpriteRequest {
  /**
   * Id do sprite resolvido no ETL contra o indice do PokeAPI. Nao e a dex: as
   * formas regionais vivem na faixa 10000+ e nao seguem formula (Rattata de
   * Alola e 10091, Raichu de Alola e 10100).
   */
  spriteId: number | null;
  dex: number;
  shiny?: boolean;
}

/** URL do sprite, ou `null` quando a fonte esta desligada ou nao tem arte. */
export function spriteUrl(
  req: SpriteRequest,
  settings: SpriteSettings = getSpriteSettings(),
): string | null {
  if (settings.source === "off") return null;
  if (req.spriteId === null) return null;

  const shiny = req.shiny ? "/shiny" : "";

  switch (settings.source) {
    case "pokeapi-artwork":
      return `${POKEAPI}/other/official-artwork${shiny}/${req.spriteId}.png`;

    case "pokeapi-home":
      return `${POKEAPI}/other/home${shiny}/${req.spriteId}.png`;

    case "custom": {
      const template = settings.customTemplate.trim();
      if (!template) return null;
      return template
        .replaceAll("{id}", String(req.spriteId))
        .replaceAll("{dex}", String(req.dex));
    }
  }
}

// ---------------------------------------------------------------- monograma

/**
 * Cor por tipo. Nao sao as cores do jogo — sao uma paleta propria, escolhida
 * para funcionar sobre fundo claro e escuro e manter o contraste do texto
 * branco por cima.
 */
const TYPE_COLORS: Record<string, readonly [string, string]> = {
  normal: ["#B4AFA3", "#6E6A61"],
  fighting: ["#D4633F", "#7A2B1B"],
  flying: ["#9FB6E8", "#4E5F8C"],
  poison: ["#B173C4", "#5C2E70"],
  ground: ["#D9A65E", "#7E5A22"],
  rock: ["#B8A583", "#6B5C3E"],
  bug: ["#A9BE4A", "#57661D"],
  ghost: ["#8A7CC4", "#443A73"],
  steel: ["#A9B4C0", "#5A646F"],
  fire: ["#F0813F", "#8C3A10"],
  water: ["#5BA8EE", "#1E568C"],
  grass: ["#6FC163", "#2A6B29"],
  electric: ["#F0C63F", "#8A6A0B"],
  psychic: ["#EE7FA6", "#8C2A50"],
  ice: ["#79D2DC", "#2A6E77"],
  dragon: ["#7A6BE0", "#362B84"],
  dark: ["#7C6D62", "#3B322C"],
  fairy: ["#EE9DC6", "#8C3F68"],
};

const FALLBACK_COLORS = ["#8E96A6", "#454C5A"] as const;

/** Gradiente do tile de reserva, na cor do tipo primario. */
export function typeGradient(types: readonly string[]): string {
  const [from, to] = TYPE_COLORS[types[0] ?? ""] ?? FALLBACK_COLORS;
  return `radial-gradient(72% 72% at 32% 24%, ${from} 0%, ${to} 100%)`;
}

/** Cor solida do tipo, para chips e etiquetas. */
export function typeColor(type: string): string {
  return (TYPE_COLORS[type] ?? FALLBACK_COLORS)[0];
}

const TYPE_NAMES_PT: Record<string, string> = {
  normal: "Normal",
  fighting: "Lutador",
  flying: "Voador",
  poison: "Venenoso",
  ground: "Terrestre",
  rock: "Pedra",
  bug: "Inseto",
  ghost: "Fantasma",
  steel: "Aço",
  fire: "Fogo",
  water: "Água",
  grass: "Planta",
  electric: "Elétrico",
  psychic: "Psíquico",
  ice: "Gelo",
  dragon: "Dragão",
  dark: "Sombrio",
  fairy: "Fada",
};

export function typeName(type: string): string {
  return TYPE_NAMES_PT[type] ?? type;
}

/**
 * Monograma de duas letras.
 *
 * Usa o nome de exibicao, entao "Rattata (Alola)" vira "RA" e nao "RA(" — o
 * corte ignora tudo que nao for letra.
 */
export function monogram(name: string): string {
  const letters = name.replace(/[^\p{L}]/gu, "");
  return letters.slice(0, 2).toUpperCase();
}
