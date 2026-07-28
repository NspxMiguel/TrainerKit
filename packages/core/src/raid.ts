import type { BaseStats, IVs } from "./types.js";
import { effectiveAttack, effectiveDefense, effectiveStamina } from "./cp.js";
import { effectiveness, stab, type TypeChart, type TypeOrder } from "./types-chart.js";

/**
 * Desempenho em raide.
 *
 * Tres numeros importam, e eles medem coisas diferentes:
 *
 *   DPS  dano por segundo — quao rapido derruba
 *   TDO  dano total antes de morrer — quanto aguenta entregar
 *   ER   nota unica que combina os dois
 *
 * Um glass cannon tem DPS alto e TDO baixo; um tanque, o contrario. Ranquear so
 * por DPS elege Pokemon que morrem antes de entregar o dano, e ranquear so por
 * TDO elege parede que nao mata ninguem. Por isso o ranking usa ER.
 */

export interface Move {
  id: string;
  name: string;
  type: string;
  power: number;
  /** Negativo em golpes carregados (gasta energia), positivo em rapidos (gera). */
  energyDelta: number;
  durationMs: number;
}

export interface BattleSettings {
  sameTypeAttackBonusMultiplier: number;
  /** Intervalo medio entre ataques do chefe. Define quanto dano voce toma. */
  enemyAttackInterval: number;
  maximumEnergy: number;
  shadowPokemonAttackBonusMultiplier: number;
  shadowPokemonDefenseBonusMultiplier: number;
}

export interface Attacker {
  types: readonly string[];
  baseStats: BaseStats;
  ivs: IVs;
  cpm: number;
  fast: Move;
  charged: Move;
  shadow?: boolean;
}

export interface Defender {
  types: readonly string[];
  baseStats: BaseStats;
  /** Chefes de raide usam stamina fixa por nivel, nao a stamina base da especie. */
  cpm: number;
  /** Dano por segundo que o chefe entrega. Estimado do moveset dele. */
  incomingDps: number;
}

export interface RaidPerformance {
  dps: number;
  tdo: number;
  /** ER = DPS^0,75 x TDO^0,25 */
  er: number;
  /** Segundos que o atacante sobrevive. */
  survivalSeconds: number;
}

/** Dano de um golpe. O `+1` no fim e do jogo, nao arredondamento nosso. */
export function damage(
  power: number,
  attack: number,
  defense: number,
  effectivenessMultiplier: number,
  stabMultiplier: number,
): number {
  return (
    Math.floor(0.5 * power * (attack / defense) * effectivenessMultiplier * stabMultiplier) + 1
  );
}

/**
 * Ciclo de energia.
 *
 * O atacante encadeia golpes rapidos ate juntar energia para o carregado. O DPS
 * real e a media ponderada dos dois ao longo desse ciclo — usar so o golpe
 * carregado superestima muito, porque ele nao pode ser usado o tempo todo.
 */
export function computeRaidPerformance(
  attacker: Attacker,
  defender: Defender,
  chart: TypeChart,
  order: TypeOrder,
  settings: BattleSettings,
): RaidPerformance {
  const shadowAtk = attacker.shadow ? settings.shadowPokemonAttackBonusMultiplier : 1;
  const shadowDef = attacker.shadow ? settings.shadowPokemonDefenseBonusMultiplier : 1;

  const atk = effectiveAttack(attacker.baseStats, attacker.ivs, attacker.cpm) * shadowAtk;
  const def = effectiveDefense(attacker.baseStats, attacker.ivs, attacker.cpm) * shadowDef;
  const hp = effectiveStamina(attacker.baseStats, attacker.ivs, attacker.cpm);

  const defenderDef = effectiveDefense(defender.baseStats, { atk: 15, def: 15, hp: 15 }, defender.cpm);

  const moveDamage = (move: Move): number =>
    damage(
      move.power,
      atk,
      defenderDef,
      effectiveness(chart, order, move.type, defender.types),
      stab(move.type, attacker.types, settings.sameTypeAttackBonusMultiplier),
    );

  const fastDamage = moveDamage(attacker.fast);
  const chargedDamage = moveDamage(attacker.charged);

  const fastSeconds = attacker.fast.durationMs / 1000;
  const chargedSeconds = attacker.charged.durationMs / 1000;

  // Quantos golpes rapidos para pagar um carregado. `energyDelta` do carregado
  // e negativo, entao o custo e o valor absoluto.
  const energyPerFast = attacker.fast.energyDelta;
  const energyCost = Math.abs(attacker.charged.energyDelta);
  const fastPerCycle = energyPerFast > 0 ? Math.ceil(energyCost / energyPerFast) : Infinity;

  if (!Number.isFinite(fastPerCycle)) {
    // Golpe rapido que nao gera energia: so existe o ciclo de golpe rapido.
    const dps = fastDamage / fastSeconds;
    const survival = hp / defender.incomingDps;
    const tdo = dps * survival;
    return { dps, tdo, er: equivalentRating(dps, tdo), survivalSeconds: survival };
  }

  const cycleDamage = fastDamage * fastPerCycle + chargedDamage;
  const cycleSeconds = fastSeconds * fastPerCycle + chargedSeconds;
  const dps = cycleDamage / cycleSeconds;

  // Quanto tempo aguenta apanhando. `incomingDps` ja embute a defesa do
  // atacante do lado de quem calcula o chefe.
  const survivalSeconds = hp / (defender.incomingDps / (def / 200));
  const tdo = dps * survivalSeconds;

  return { dps, tdo, er: equivalentRating(dps, tdo), survivalSeconds };
}

/**
 * Equivalent Rating.
 *
 *   ER = DPS^0,75 x TDO^0,25
 *
 * O expoente maior no DPS e proposital: em raide com varios treinadores, matar
 * rapido vale mais que sobreviver, porque quem cai volta. A formula foi
 * conferida contra oito valores publicados, com erro abaixo de 0,02%.
 */
export function equivalentRating(dps: number, tdo: number): number {
  if (dps <= 0 || tdo <= 0) return 0;
  return Math.pow(dps, 0.75) * Math.pow(tdo, 0.25);
}
