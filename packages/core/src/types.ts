/**
 * Tipos do dominio. Sem dependencia de DOM, de React ou de rede — este pacote
 * precisa continuar compilando se um dia o app virar nativo.
 */

export type PokemonType =
  | "normal" | "fighting" | "flying" | "poison" | "ground" | "rock"
  | "bug" | "ghost" | "steel" | "fire" | "water" | "grass"
  | "electric" | "psychic" | "ice" | "dragon" | "dark" | "fairy";

/** Stats base da especie, como vem do GAME_MASTER. */
export interface BaseStats {
  atk: number;
  def: number;
  /** `baseStamina` no GAME_MASTER. Vira PS. */
  hp: number;
}

/**
 * IV individual. Sempre 0..15 — o jogo nao tem outro intervalo.
 * Nao ha tipo mais estreito em TS sem uniao de 16 literais, entao a validacao
 * fica em `isValidIV`.
 */
export interface IVs {
  atk: number;
  def: number;
  hp: number;
}

export interface Species {
  /** Identificador estavel, ex.: "machamp". Nunca o apelido do jogador. */
  id: string;
  dex: number;
  name: string;
  types: [PokemonType] | [PokemonType, PokemonType];
  baseStats: BaseStats;
  fastMoves: string[];
  chargedMoves: string[];
  /** Movimentos exclusivos de TM Elite — nao aparecem em captura normal. */
  eliteFastMoves: string[];
  eliteChargedMoves: string[];
  familyId: string | null;
  /** `null` quando a especie nao evolui. */
  evolvesInto: string[];
}

/** Um Pokemon concreto da colecao do usuario. */
export interface OwnedPokemon {
  id: string;
  speciesId: string;
  /** Apelido dado pelo jogador. Puramente cosmetico — nunca use pra identificar especie. */
  nickname: string | null;
  cp: number;
  hp: number;
  /** Nivel em passos de 0.5, de 1 a 55. */
  level: number;
  ivs: IVs;
  lucky: boolean;
  shadow: boolean;
  purified: boolean;
  fastMove: string | null;
  chargedMoves: string[];
  /** ISO 8601. */
  caughtAt: string | null;
  addedAt: string;
}

export const MIN_IV = 0;
export const MAX_IV = 15;
export const MIN_LEVEL = 1;
/**
 * O cap subiu pra 55. A tabela de CPM do GAME_MASTER tem 109 entradas em passos
 * de meio nivel, terminando em 0.8653. Usar 50 aqui subestimaria o custo de
 * power-up e daria veredito errado nos Pokemon ja no topo.
 */
export const MAX_LEVEL = 55;

export function isValidIV(v: number): boolean {
  return Number.isInteger(v) && v >= MIN_IV && v <= MAX_IV;
}

/** Niveis validos sao multiplos de 0.5 dentro de [1, 55]. */
export function isValidLevel(level: number): boolean {
  return (
    level >= MIN_LEVEL &&
    level <= MAX_LEVEL &&
    Number.isInteger(level * 2)
  );
}
