import { cpmForLevel, type CpmTable } from "./cp.js";
import { computeRaidPerformance, type BattleSettings, type Move } from "./raid.js";
import { topSpreads, type League } from "./pvp.js";
import { rankMovesets, type MoveWithPvp } from "./moves.js";
import type { TypeChart, TypeOrder } from "./types-chart.js";
import type { BaseStats, IVs } from "./types.js";

/**
 * Os melhores do jogo, por objetivo.
 *
 * Duas listas que respondem perguntas diferentes e sao construidas de formas
 * diferentes — e o app diz qual e qual, porque vender uma como a outra seria
 * mentira:
 *
 *   RAIDE  ranking de verdade. "Melhor atacante de fogo" e uma pergunta com
 *          resposta calculavel: DPS e aguente contra um alvo, e a formula esta
 *          fechada. E assim que toda lista de counters seria feita.
 *
 *   PVP    NAO e tier list. Uma tier list de PvP exige simular o meta —
 *          quem enfrenta quem, quem escuda quando —, e isso este app nao faz.
 *          O que da pra calcular e o stat product no teto da liga, que mede
 *          quanto de atributo a especie espreme sob o limite de PC. E util e e
 *          objetivo, mas nao e "o melhor da Great League": Azumarill e
 *          Medicham vivem no topo do meta real por motivos que nenhum numero
 *          de atributo captura.
 */

const PERFECT: IVs = { atk: 15, def: 15, hp: 15 };

/**
 * Formas que existem no GAME_MASTER mas nao existem pra pegar.
 *
 * Eternamax e forma de chefe de Dynamax: stats de 251/505/452 que dao quase
 * 10.000 de PC e liderariam qualquer ranking do jogo, sendo que ninguem tem um.
 * O GAME_MASTER nao marca obtenibilidade, entao a exclusao e por id — pequena e
 * documentada, que e melhor do que uma regra estatistica que um dia excluiria
 * um lendario legitimo por ser forte demais.
 */
const UNOBTAINABLE = new Set(["eternatus_eternamax"]);

/**
 * Da pra pegar este?
 *
 * Exportado porque a lista precisa ser UMA. A tela de ginasio montava os
 * candidatos direto do dataset e por isso anunciava Eternatus (Eternamax) como o
 * melhor defensor do jogo — um bicho de 505 de defesa que so existe como chefe
 * de Dynamax. Duas copias da mesma regra viram duas telas que discordam.
 */
export function isObtainable(speciesId: string): boolean {
  return !UNOBTAINABLE.has(speciesId);
}

/**
 * Especie que so tem Struggle nao entra em ranking nenhum.
 *
 * Struggle e o carregado que o jogo poe em quem nao tem carregado — na pratica,
 * formas que existem no GAME_MASTER mas ainda nao sairam. Scream Tail hoje esta
 * assim: `splash_fast` + `struggle`, e como o ranking de liga mede so atributo
 * ela aparecia entre as melhores da Great. O app entao mandava a pessoa caçar um
 * especie que literalmente nao consegue atacar.
 *
 * Nao e filtro de "moveset ruim", e filtro de "nao luta". Quem tem qualquer
 * outro carregado passa.
 */
const STRUGGLE = "struggle";

function podeLutar(s: SpeciesForRanking): boolean {
  return s.chargedMoves.some((m) => m.id !== STRUGGLE);
}

export interface RankedSpecies {
  speciesId: string;
  name: string;
  /** Nota de 0 a 100, relativa ao primeiro colocado da lista. */
  score: number;
  /** O numero cru por tras da nota, pra tela poder mostrar. */
  value: number;
  /** Melhor moveset encontrado, quando o ranking depende de golpe. */
  fast?: Move;
  charged?: Move;
}

export interface SpeciesForRanking {
  id: string;
  name: string;
  types: readonly string[];
  baseStats: BaseStats;
  fastMoves: readonly MoveWithPvp[];
  chargedMoves: readonly MoveWithPvp[];
  /** Formas cosmeticas ficam fora: mesmos stats, so poluiriam a lista. */
  cosmetic: boolean;
}

/**
 * Alvo neutro de referencia para o ranking de raide.
 *
 * Um chefe generico: nem resistente nem fraco a nada, com defesa tipica de
 * tier 5. Assim a lista mede o ATACANTE, e nao a sorte do confronto. Quem quer
 * a resposta contra um chefe especifico usa a tela de counters, que cruza com
 * a colecao.
 */
const NEUTRAL_TARGET = {
  types: [] as readonly string[],
  baseStats: { atk: 200, def: 200, hp: 200 },
  cpm: 0.79,
  incomingDps: 35,
};

/**
 * Melhores atacantes de raide, opcionalmente filtrados por tipo de ataque.
 *
 * `attackType` filtra pelo tipo do GOLPE, nao da especie: quem quer "melhor
 * atacante de fogo" quer quem entrega dano de fogo, e um Dragonite com Fire
 * Blast entra nessa conta mesmo nao sendo de fogo.
 */
export function rankRaidAttackers(
  species: readonly SpeciesForRanking[],
  cpm: CpmTable,
  chart: TypeChart,
  order: TypeOrder,
  settings: BattleSettings,
  options: { level?: number; attackType?: string; limit?: number } = {},
): RankedSpecies[] {
  const level = options.level ?? 40;
  const multiplier = cpmForLevel(cpm, level);
  const limit = options.limit ?? 25;

  const scored: RankedSpecies[] = [];

  for (const s of species) {
    if (s.cosmetic || UNOBTAINABLE.has(s.id)) continue;
    if (s.fastMoves.length === 0 || !podeLutar(s)) continue;

    const fastPool = options.attackType
      ? s.fastMoves.filter((m) => m.type === options.attackType)
      : s.fastMoves;
    const chargedPool = options.attackType
      ? s.chargedMoves.filter((m) => m.type === options.attackType)
      : s.chargedMoves;

    // Filtrando por tipo, exigimos o CARREGADO daquele tipo: e ele que entrega
    // o grosso do dano. Rapido de outro tipo ainda serve pra gerar energia.
    if (chargedPool.length === 0) continue;
    const usableFast = fastPool.length > 0 ? fastPool : s.fastMoves;

    const best = rankMovesets(usableFast, chargedPool, "raid", {
      attackerTypes: s.types,
      chart,
      order,
      stabMultiplier: settings.sameTypeAttackBonusMultiplier,
    })[0];
    if (!best) continue;

    const perf = computeRaidPerformance(
      {
        types: s.types,
        baseStats: s.baseStats,
        ivs: PERFECT,
        cpm: multiplier,
        fast: best.fast,
        charged: best.charged,
      },
      NEUTRAL_TARGET,
      chart,
      order,
      settings,
    );

    scored.push({
      speciesId: s.id,
      name: s.name,
      score: 0,
      value: perf.er,
      fast: best.fast,
      charged: best.charged,
    });
  }

  scored.sort((a, b) => b.value - a.value);
  const top = scored.slice(0, limit);
  const best = top[0]?.value ?? 1;
  return top.map((x) => ({ ...x, score: (x.value / best) * 100 }));
}

/**
 * Melhores em stat product por liga.
 *
 * ⚠️ Isto NAO e uma tier list. Mede quanto de atributo a especie espreme sob o
 * teto de PC da liga, com o melhor IV possivel. E um bom indicador de quem
 * aguenta e bate ao mesmo tempo, e e completamente cego a tipo, moveset e
 * meta — que e onde PvP se decide. A tela precisa dizer isso.
 */
export function rankStatProduct(
  species: readonly SpeciesForRanking[],
  cpm: CpmTable,
  league: League,
  options: { levelCap?: number; limit?: number } = {},
): RankedSpecies[] {
  const limit = options.limit ?? 25;
  const scored: RankedSpecies[] = [];

  for (const s of species) {
    if (s.cosmetic || UNOBTAINABLE.has(s.id) || !podeLutar(s)) continue;

    // O melhor IV da especie NAQUELA liga, nao o 15/15/15: em liga com teto o
    // 100% quase sempre perde, e ranquear por ele daria a lista errada.
    //
    // `topSpreads` ja faz essa busca com busca binaria e cache; refazer o laco
    // triplo aqui seria repetir trabalho que o `pvp.ts` ja otimizou.
    const spread = topSpreads(cpm, s.baseStats, league, 1, {
      ...(options.levelCap === undefined ? {} : { levelCap: options.levelCap }),
    })[0];
    const best = spread?.statProduct ?? 0;

    if (best > 0) {
      scored.push({ speciesId: s.id, name: s.name, score: 0, value: best });
    }
  }

  scored.sort((a, b) => b.value - a.value);
  const top = scored.slice(0, limit);
  const head = top[0]?.value ?? 1;
  return top.map((x) => ({ ...x, score: (x.value / head) * 100 }));
}
