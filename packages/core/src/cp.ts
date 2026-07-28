import type { BaseStats, IVs } from "./types.js";
import { MAX_LEVEL, MIN_LEVEL } from "./types.js";

/**
 * Tabela de CP Multiplier.
 *
 * Indexada por nivel INTEIRO (indice 0 = nivel 1), exatamente como o
 * `PLAYER_LEVEL_SETTINGS.cpMultiplier` do GAME_MASTER entrega. Meios niveis nao
 * estao na tabela e sao derivados por interpolacao — ver `cpmForLevel`.
 *
 * Vem do dataset, nunca digitada a mao: sao ~55 floats de 7 casas em que um
 * digito errado produz um app que mente com confianca.
 */
export type CpmTable = readonly number[];

/**
 * CPM de um nivel qualquer, inclusive meio nivel.
 *
 * O jogo nao armazena CPM de meio nivel; ele o deriva da media quadratica entre
 * os dois inteiros vizinhos. Nao e media aritmetica — usar media simples produz
 * erro de alguns pontos de PC nos niveis altos, que e justamente onde o usuario
 * esta decidindo gastar 100.000 de poeira.
 */
export function cpmForLevel(cpm: CpmTable, level: number): number {
  if (level < MIN_LEVEL || level > MAX_LEVEL) {
    throw new RangeError(`nivel fora de [1, ${MAX_LEVEL}]: ${level}`);
  }

  const lower = Math.floor(level);
  const lowerCpm = cpm[lower - 1];
  if (lowerCpm === undefined) {
    throw new RangeError(`tabela de CPM nao cobre o nivel ${lower}`);
  }
  if (lower === level) return lowerCpm;

  const upperCpm = cpm[lower];
  if (upperCpm === undefined) {
    throw new RangeError(`tabela de CPM nao cobre o nivel ${lower + 1}`);
  }
  return Math.sqrt((lowerCpm * lowerCpm + upperCpm * upperCpm) / 2);
}

/** Ataque efetivo. */
export function effectiveAttack(base: BaseStats, ivs: IVs, cpm: number): number {
  return (base.atk + ivs.atk) * cpm;
}

/** Defesa efetiva. */
export function effectiveDefense(base: BaseStats, ivs: IVs, cpm: number): number {
  return (base.def + ivs.def) * cpm;
}

/**
 * PS efetivo (stamina).
 *
 * O piso de 10 e do jogo, nao nosso: Pokemon de nivel baixo com IV de PS zero
 * ainda tem 10 de PS.
 */
export function effectiveStamina(base: BaseStats, ivs: IVs, cpm: number): number {
  return Math.max(Math.floor((base.hp + ivs.hp) * cpm), 10);
}

/**
 * PC — a formula canonica do jogo.
 *
 *   PC = floor( (atk * sqrt(def) * sqrt(hp) * cpm^2) / 10 )
 *
 * onde atk/def/hp sao base + IV (sem CPM aplicado; o CPM entra ao quadrado).
 * Piso de 10, tambem do jogo.
 */
export function computeCP(base: BaseStats, ivs: IVs, cpm: number): number {
  const atk = base.atk + ivs.atk;
  const def = base.def + ivs.def;
  const sta = base.hp + ivs.hp;

  const cp = Math.floor((atk * Math.sqrt(def) * Math.sqrt(sta) * cpm * cpm) / 10);
  return Math.max(cp, 10);
}

/** Atalho: PC a partir do nivel, resolvendo o CPM pela tabela. */
export function computeCPAtLevel(
  cpm: CpmTable,
  base: BaseStats,
  ivs: IVs,
  level: number,
): number {
  return computeCP(base, ivs, cpmForLevel(cpm, level));
}

/**
 * Stat product — a metrica que ordena IV em PvP.
 *
 * Note o `floor` no PS: e o mesmo arredondamento que o jogo aplica, e ignora-lo
 * troca a ordem do ranking em empates apertados.
 */
export function statProduct(base: BaseStats, ivs: IVs, cpm: number): number {
  return (
    effectiveAttack(base, ivs, cpm) *
    effectiveDefense(base, ivs, cpm) *
    effectiveStamina(base, ivs, cpm)
  );
}

/** Todos os niveis validos, do menor ao maior, em passos de 0.5. */
export function allLevels(maxLevel: number = MAX_LEVEL): number[] {
  const levels: number[] = [];
  for (let l = MIN_LEVEL; l <= maxLevel; l += 0.5) levels.push(l);
  return levels;
}
