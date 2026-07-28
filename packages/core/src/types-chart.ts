/**
 * Efetividade de tipo.
 *
 * O GAME_MASTER entrega, para cada tipo atacante, um array de 18 multiplicadores
 * indexado pelo tipo defensor. Os valores nao sao 2/0.5/0 como na serie
 * principal — o Pokemon GO usa:
 *
 *   1.6        super efetivo
 *   1.0        neutro
 *   0.625      resistido
 *   0.390625   duplamente resistido (0.625^2) — o jogo nao tem imunidade real
 *
 * "Imune" na serie principal vira 0.390625 aqui, entao Normal ainda arranha
 * Fantasma. Tratar como zero seria erro de calculo, nao simplificacao.
 */

export type TypeChart = Readonly<Record<string, readonly number[]>>;

/** Ordem do enum de tipos, usada para indexar `attackScalar`. Vem do dataset. */
export type TypeOrder = readonly string[];

export const SUPER_EFFECTIVE = 1.6;
export const NEUTRAL = 1;
export const RESISTED = 0.625;
export const DOUBLE_RESISTED = 0.390625;

/**
 * Multiplicador de um tipo atacante contra UM tipo defensor.
 *
 * Devolve 1 quando o tipo e desconhecido: melhor calcular neutro do que
 * explodir a tela inteira por causa de um tipo novo que o jogo adicionou e o
 * nosso dataset ainda nao conhece.
 */
export function effectivenessAgainstType(
  chart: TypeChart,
  order: TypeOrder,
  attackType: string,
  defenderType: string,
): number {
  const row = chart[attackType];
  if (!row) return NEUTRAL;

  const index = order.indexOf(defenderType);
  if (index < 0) return NEUTRAL;

  return row[index] ?? NEUTRAL;
}

/**
 * Multiplicador contra um Pokemon, que pode ter dois tipos.
 *
 * Os multiplicadores se MULTIPLICAM entre si: um golpe super efetivo contra os
 * dois tipos da 1.6 x 1.6 = 2.56, e um resistido pelos dois da 0.390625.
 */
export function effectiveness(
  chart: TypeChart,
  order: TypeOrder,
  attackType: string,
  defenderTypes: readonly string[],
): number {
  let multiplier = NEUTRAL;
  for (const defenderType of defenderTypes) {
    multiplier *= effectivenessAgainstType(chart, order, attackType, defenderType);
  }
  return multiplier;
}

/**
 * Bonus de mesmo tipo (STAB).
 *
 * Vem do `BATTLE_SETTINGS.sameTypeAttackBonusMultiplier` — nao chumbar 1.2 aqui,
 * porque o jogo ja mexeu nesse numero antes.
 */
export function stab(
  moveType: string,
  attackerTypes: readonly string[],
  multiplier: number,
): number {
  return attackerTypes.includes(moveType) ? multiplier : 1;
}
