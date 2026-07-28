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
const VERSIONS = `${POKEAPI}/versions`;

/**
 * Ate onde cada geracao desenhou sprite.
 *
 * Os jogos antigos so tem arte dos Pokemon que existiam na epoca: Vermelho/Azul
 * param no 151, Cristal no 251, Esmeralda no 386. Preto/Branco cobre a Pokedex
 * inteira e por isso fecha a cascata.
 *
 * Verificado por requisicao: dex 152 em generation-i da 404, dex 1025 em
 * black-white da 200 com PNG 96x96 valido.
 */
const RETRO_CHAIN: ReadonlyArray<{ maxDex: number; path: string }> = [
  { maxDex: 151, path: "generation-i/red-blue" },
  { maxDex: 251, path: "generation-ii/crystal" },
  { maxDex: 386, path: "generation-iii/emerald" },
  { maxDex: Infinity, path: "generation-v/black-white" },
];

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

/**
 * Escolhe a pasta de geracao para o modo Game Boy.
 *
 * A decisao usa a DEX, nao o spriteId: formas regionais tem id acima de 10000 e
 * cairiam sempre na ultima geracao, mesmo sendo de um Pokemon da primeira. Como
 * elas so foram desenhadas a partir da setima geracao, o `spriteId` alto sai da
 * cascata sozinho na hora de montar a URL.
 */
function retroPath(dex: number, spriteId: number): string {
  // Formas alternativas (id 10000+) so existem em pixel art moderna.
  if (spriteId >= 10000) return "generation-v/black-white";
  return RETRO_CHAIN.find((g) => dex <= g.maxDex)!.path;
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
    case "gameboy":
      return `${VERSIONS}/${retroPath(req.dex, req.spriteId)}${shiny}/${req.spriteId}.png`;

    case "pixel":
      return `${VERSIONS}/generation-v/black-white${shiny}/${req.spriteId}.png`;

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

/**
 * Pixel art precisa de renderizacao sem suavizacao — o navegador interpola por
 * padrao e transforma um sprite de 96px num borrao ao ampliar pra 116.
 */
export function isPixelArt(source: SpriteSettings["source"]): boolean {
  return source === "gameboy" || source === "pixel";
}

/**
 * Os sprites de Game Boy e Game Boy Color sao PNG de paleta SEM canal alfa: o
 * fundo e branco opaco, nao transparente. Jogados direto sobre o gradiente do
 * tipo, viram um quadrado branco no meio da cor.
 *
 * Em vez de disfarcar, o modo Game Boy assume isso: o sprite fica numa telinha
 * clara, que e como ele aparecia no aparelho. Gen III em diante ja vem
 * transparente e ganha a mesma telinha so para o conjunto nao ficar mestico.
 *
 * Verificado nos arquivos: red-blue e crystal sao `tipo=paleta` sem tRNS;
 * emerald e RGBA e black-white tem tRNS.
 */
export function needsScreen(source: SpriteSettings["source"]): boolean {
  return source === "gameboy";
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

/** Nome do tipo em portugues. */
export const TYPE_NAMES_PT: Record<string, string> = {
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
