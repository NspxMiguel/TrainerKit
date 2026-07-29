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

export type Context = "raid" | "pvp" | "rocket" | "general";

export interface MoveWithPvp extends Move {
  name: string;
  pvp: { power: number; energyDelta: number; turns: number } | null;
  /** Aprendido so por TM Elite: nao aparece em captura normal. */
  elite?: boolean;
  /**
   * Frustracao — o golpe que todo sombroso traz e que TM comum nao remove.
   * Marcado para a UI poder explicar por que ele aparece e por que e tao ruim.
   */
  frustration?: boolean;
}

export interface Moveset {
  fast: MoveWithPvp;
  charged: MoveWithPvp;
  /**
   * Segundo carregado, usado so para queimar escudo. So o contexto Rocket
   * preenche; `null` quando a isca e o proprio finalizador ou nao se aplica.
   */
  bait?: MoveWithPvp | null;
  /** Nota do conjunto no contexto pedido. So compara com outros do mesmo Pokemon. */
  score: number;
  /** `true` quando algum dos golpes exige TM Elite. */
  needsElite: boolean;
  /** `true` quando a Frustracao esta no conjunto. */
  isFrustration: boolean;
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
 * Quantos escudos o chefe de Rocket levanta.
 *
 * Confirmado em duas fontes independentes: os LIDERES (Arlo, Cliff, Sierra e
 * Giovanni) sempre bloqueiam os dois primeiros golpes carregados do treinador;
 * os grunts nao usam escudo nenhum. Modelamos o lider porque e a luta que pede
 * conselho — contra grunt qualquer moveset decente serve.
 */
const ROCKET_SHIELDS = 2;

/**
 * Dano por turno contra um lider de Rocket.
 *
 * A diferenca para o PvP comum e o motivo de este contexto existir. Contra
 * humano, escudar e uma DECISAO do oponente e a isca serve para engana-lo. O
 * lider nao decide nada: ele bloqueia os dois primeiros carregados, sempre.
 * Isso torna a isca aritmetica em vez de blefe — voce sabe de antemao que dois
 * golpes serao desperdicados, entao desperdice os BARATOS.
 *
 * Por isso este contexto pontua um TRIO (rapido + isca + finalizador) e nao um
 * par. Foi so ao rodar os numeros que isso ficou claro: com um carregado so, o
 * modelo de "tres arremessos" continuava elegendo o golpe mais forte, porque
 * dano por energia nao muda com escudo. O que muda e poder gastar pouco nos
 * dois arremessos que nao contam.
 *
 * Quando `bait` e o proprio finalizador, a conta vira o caso de quem so tem um
 * carregado — tres arremessos do mesmo golpe.
 */
function rocketScore(
  fast: MoveWithPvp,
  bait: MoveWithPvp,
  closer: MoveWithPvp,
  input: ScoreInput,
): number {
  if (!fast.pvp || !bait.pvp || !closer.pvp) return 0;

  const multiplier = (type: string): number =>
    stab(type, input.attackerTypes, input.stabMultiplier) *
    (input.defenderTypes && input.defenderTypes.length > 0
      ? effectiveness(input.chart, input.order, type, input.defenderTypes)
      : 1);

  const turns = Math.max(1, fast.pvp.turns);
  const fastDpt = (fast.pvp.power * multiplier(fast.type)) / turns;
  const fastEpt = fast.pvp.energyDelta / turns;

  const baitCost = Math.abs(bait.pvp.energyDelta);
  const closerCost = Math.abs(closer.pvp.energyDelta);
  if (baitCost <= 0 || closerCost <= 0 || fastEpt <= 0) return fastDpt;

  // Carregar a isca duas vezes queima os dois escudos; so o terceiro golpe
  // machuca. O rapido continua entrando esse tempo todo — e ele que carrega.
  const fastTurns = (baitCost * ROCKET_SHIELDS + closerCost) / fastEpt;
  const throws = ROCKET_SHIELDS + 1;
  const landed = closer.pvp.power * multiplier(closer.type);

  return (fastDpt * fastTurns + landed) / (fastTurns + throws);
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
  if (context === "rocket") return rankForRocket(fastMoves, chargedMoves, input);

  const combos: Array<{
    fast: MoveWithPvp;
    charged: MoveWithPvp;
    raid: number;
    pvp: number;
  }> = [];

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
      const score = context === "raid" ? raid : context === "pvp" ? pvp : Math.min(raid, pvp);

      return {
        fast: c.fast,
        charged: c.charged,
        score,
        needsElite: Boolean(c.fast.elite) || Boolean(c.charged.elite),
        isFrustration: Boolean(c.charged.frustration),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Rocket ranqueia TRIOS, porque a isca faz parte da resposta.
 *
 * O segundo golpe carregado custa doce e poeira, entao a recomendacao precisa
 * dizer qual e a isca e nao so "use estes dois". Quando os dois campos vem
 * iguais, e porque o Pokemon so tem um carregado — e ai a isca e ele mesmo.
 */
function rankForRocket(
  fastMoves: readonly MoveWithPvp[],
  chargedMoves: readonly MoveWithPvp[],
  input: ScoreInput,
): Moveset[] {
  const combos: Array<{
    fast: MoveWithPvp;
    bait: MoveWithPvp;
    closer: MoveWithPvp;
    score: number;
  }> = [];

  for (const fast of fastMoves) {
    for (const closer of chargedMoves) {
      for (const bait of chargedMoves) {
        combos.push({ fast, bait, closer, score: rocketScore(fast, bait, closer, input) });
      }
    }
  }

  if (combos.length === 0) return [];
  const max = Math.max(...combos.map((c) => c.score), 1);

  const ranked = combos
    .map((c) => ({
      fast: c.fast,
      charged: c.closer,
      bait: c.bait.id === c.closer.id ? null : c.bait,
      score: c.score / max,
      needsElite: Boolean(c.fast.elite) || Boolean(c.closer.elite) || Boolean(c.bait.elite),
      isFrustration: Boolean(c.closer.frustration) || Boolean(c.bait.frustration),
    }))
    .sort((a, b) => b.score - a.score);

  // So a MELHOR isca de cada dupla rapido+finalizador.
  //
  // Sem isto a lista vira cinco linhas de "Counter + Close Combat" variando so
  // a isca, com notas quase iguais. Quem le nao esta escolhendo entre iscas —
  // esta escolhendo o conjunto. A isca e detalhe da resposta, nao alternativa.
  const seen = new Set<string>();
  return ranked.filter((m) => {
    const key = `${m.fast.id}/${m.charged.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * O golpe carregado que todo sombroso carrega ate um evento deixar troca-lo.
 *
 * Nao vem no moveset da especie no GAME_MASTER — o jogo o adiciona em tempo de
 * execucao a qualquer sombroso —, entao a lista de golpes precisa injeta-lo
 * quando o jogador diz que o Pokemon dele e sombroso. Sem isso o app mostraria
 * o moveset ideal de um Pokemon que nao pode usa-lo.
 *
 * `null` quando o dataset nao traz a Frustracao, para nao inventar um golpe.
 */
export function withFrustration(
  chargedMoves: readonly MoveWithPvp[],
  frustration: MoveWithPvp | null,
): MoveWithPvp[] {
  if (!frustration) return [...chargedMoves];
  return [{ ...frustration, frustration: true }, ...chargedMoves];
}

/**
 * Quanto um sombroso bate a mais.
 *
 * Existe como numero separado, e nao embutido na nota, porque o bonus e
 * UNIFORME: multiplicar todos os golpes por 1,2 nao muda qual e o melhor. A
 * nota compara movesets entre si, entao ela ficaria identica e o app estaria
 * fingindo que calculou algo. O que muda de verdade e o dano absoluto — e a
 * Frustracao ocupando o slot.
 */
export function shadowDamageMultiplier(settings: {
  shadowPokemonAttackBonusMultiplier: number;
}): number {
  return settings.shadowPokemonAttackBonusMultiplier;
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
  rocket: {
    title: "Rocket",
    detail:
      "Os líderes bloqueiam seus dois primeiros carregados. Vence quem atravessa os escudos, não quem bate mais forte.",
  },
};
