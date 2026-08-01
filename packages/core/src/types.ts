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
  /** Nivel em passos de 0.5, de 1 a `MAX_LEVEL`. */
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
 * Ate onde da pra PAGAR: `maxNormalUpgradeLevel` do GAME_MASTER.
 *
 * ⚠️ Este e o numero do "PC maximo" e de todo custo de poeira e doce. Aqui
 * estava 55, com um comentario afirmando que "o cap subiu pra 55" porque a
 * tabela de CPM vai ate 0.8653. A tabela vai; o jogo nao deixa. Ver a nota
 * longa em `packages/dataset/src/etl.ts` — de 41 pra frente o CPM e uma reta de
 * 0.005 por nivel, e a permissao mora em `POKEMON_UPGRADE_SETTINGS`, nao ali.
 *
 * O erro inflava o PC maximo em ~6% (o CPM entra ao quadrado na formula).
 */
export const MAX_POWERUP_LEVEL = 50;

/** O que o Melhor Amigo soma por cima — `defaultCpBoostAdditionalLevel`. */
export const BEST_BUDDY_LEVELS = 1;

/**
 * O maior nivel que um Pokemon pode APARENTAR.
 *
 * Diferente do de cima e a diferenca importa: o Melhor Amigo mostra o PC ja com
 * o bonus, entao o solver de nivel PRECISA chegar aqui. Um solver que parasse
 * em 50 nao acharia solucao nenhuma justamente pro Pokemon mais investido da
 * colecao — e a tela diria "esses numeros nao existem juntos".
 *
 * Continua sendo o limite de `cpmForLevel` e de `isValidLevel`.
 */
export const MAX_LEVEL = MAX_POWERUP_LEVEL + BEST_BUDDY_LEVELS;

export function isValidIV(v: number): boolean {
  return Number.isInteger(v) && v >= MIN_IV && v <= MAX_IV;
}

/** Niveis validos sao multiplos de 0.5 dentro de [1, MAX_LEVEL]. */
export function isValidLevel(level: number): boolean {
  return (
    level >= MIN_LEVEL &&
    level <= MAX_LEVEL &&
    Number.isInteger(level * 2)
  );
}
