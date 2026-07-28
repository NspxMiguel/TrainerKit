import type { Move } from "./raid.js";
import { effectiveness, stab, type TypeChart, type TypeOrder } from "./types-chart.js";

/**
 * Melhor moveset por contexto.
 *
 * O mesmo Pokemon tem movesets diferentes conforme o objetivo, e a razao nao e
 * gosto — sao contas diferentes:
 *
 *   raide   dano por segundo contra UM alvo conhecido, sem trocas. Golpe
 *           carregado caro mas devastador compensa.
 *   pvp     turnos e energia. Golpe barato que sai rapido costuma vencer o
 *           golpe forte que nunca carrega, porque o oponente troca e escuda.
 *   geral   quem nao e ruim em nenhum dos dois.
 *
 * Por isso `power` sozinho nunca responde: em PvP o que importa e dano POR
 * ENERGIA e quantos turnos custa carregar.
 */

export type Context = "raid" | "pvp" | "general";

export interface MoveWithPvp extends Move {
  name: string;
  pvp: { power: number; energyDelta: number; turns: number } | null;
  /** Aprendido so por TM Elite: nao aparece em captura normal. */
  elite?: boolean;
}

export interface Moveset {
  fast: MoveWithPvp;
  charged: MoveWithPvp;
  /** Nota do conjunto no contexto pedido. So compara com outros do mesmo Pokemon. */
  score: number;
  /** `true` quando algum dos dois exige TM Elite. */
  needsElite: boolean;
}

interface ScoreInput {
  attackerTypes: readonly string[];
  chart: TypeChart;
  order: TypeOrder;
  stabMultiplier: number;
  /** Tipos do alvo. Vazio = media contra tudo. */
  defenderTypes?: readonly string[];
}

/**
 * Dano por segundo do ciclo, para raide.
 *
 * Considera quantos golpes rapidos pagam um carregado — usar so o carregado
 * superestima muito, porque ele nao pode ser usado o tempo todo.
 */
function raidScore(fast: MoveWithPvp, charged: MoveWithPvp, input: ScoreInput): number {
  const multiplier = (move: MoveWithPvp): number =>
    stab(move.type, input.attackerTypes, input.stabMultiplier) *
    (input.defenderTypes && input.defenderTypes.length > 0
      ? effectiveness(input.chart, input.order, move.type, input.defenderTypes)
      : 1);

  const fastDamage = fast.power * multiplier(fast);
  const chargedDamage = charged.power * multiplier(charged);

  const fastSeconds = fast.durationMs / 1000;
  const chargedSeconds = charged.durationMs / 1000;
  if (fastSeconds <= 0 || chargedSeconds <= 0) return 0;

  const energyPerFast = fast.energyDelta;
  if (energyPerFast <= 0) return fastDamage / fastSeconds;

  const cost = Math.abs(charged.energyDelta);
  const fastPerCycle = Math.ceil(cost / energyPerFast);

  const cycleDamage = fastDamage * fastPerCycle + chargedDamage;
  const cycleSeconds = fastSeconds * fastPerCycle + chargedSeconds;
  return cycleDamage / cycleSeconds;
}

/**
 * Dano por turno em PvP.
 *
 * O tempo em PvP e contado em TURNOS, nao em segundos, e a energia e o recurso
 * escasso. Um golpe de 100 de poder que custa 60 de energia perde para um de 50
 * que custa 35 — o segundo sai duas vezes antes de o primeiro sair uma.
 */
function pvpScore(fast: MoveWithPvp, charged: MoveWithPvp, input: ScoreInput): number {
  if (!fast.pvp || !charged.pvp) return 0;

  const multiplier = (type: string): number =>
    stab(type, input.attackerTypes, input.stabMultiplier) *
    (input.defenderTypes && input.defenderTypes.length > 0
      ? effectiveness(input.chart, input.order, type, input.defenderTypes)
      : 1);

  const turns = Math.max(1, fast.pvp.turns);
  const fastDpt = (fast.pvp.power * multiplier(fast.type)) / turns;
  const fastEpt = fast.pvp.energyDelta / turns;

  const cost = Math.abs(charged.pvp.energyDelta);
  if (cost <= 0 || fastEpt <= 0) return fastDpt;

  const chargedDamage = charged.pvp.power * multiplier(charged.type);
  const turnsToCharge = cost / fastEpt;

  // Dano medio por turno ao longo do ciclo completo.
  return (fastDpt * turnsToCharge + chargedDamage) / (turnsToCharge + 1);
}

/**
 * Ordena os movesets possiveis.
 *
 * "Geral" usa a MENOR das duas notas normalizadas, nao a media: um moveset
 * excelente em raide e pessimo em PvP nao e um bom moveset geral — e um bom
 * moveset de raide. Media premiaria o especialista; minimo premia o versatil,
 * que e o que "serve pra tudo" quer dizer.
 */
export function rankMovesets(
  fastMoves: readonly MoveWithPvp[],
  chargedMoves: readonly MoveWithPvp[],
  context: Context,
  input: ScoreInput,
): Moveset[] {
  const combos: Array<{ fast: MoveWithPvp; charged: MoveWithPvp; raid: number; pvp: number }> = [];

  for (const fast of fastMoves) {
    for (const charged of chargedMoves) {
      combos.push({
        fast,
        charged,
        raid: raidScore(fast, charged, input),
        pvp: pvpScore(fast, charged, input),
      });
    }
  }

  if (combos.length === 0) return [];

  const maxRaid = Math.max(...combos.map((c) => c.raid), 1);
  const maxPvp = Math.max(...combos.map((c) => c.pvp), 1);

  return combos
    .map((c) => {
      const raid = c.raid / maxRaid;
      const pvp = c.pvp / maxPvp;
      const score =
        context === "raid" ? raid : context === "pvp" ? pvp : Math.min(raid, pvp);

      return {
        fast: c.fast,
        charged: c.charged,
        score,
        needsElite: Boolean(c.fast.elite) || Boolean(c.charged.elite),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export const CONTEXT_LABELS: Record<Context, { title: string; detail: string }> = {
  general: {
    title: "Pra tudo",
    detail: "Vai bem nos dois. Escolha de quem não quer trocar de ataque depois.",
  },
  raid: {
    title: "Raide",
    detail: "Dano por segundo contra um alvo só, sem trocas.",
  },
  pvp: {
    title: "PvP",
    detail: "Turnos e energia. Golpe barato que sai rápido vence o forte que nunca carrega.",
  },
};
