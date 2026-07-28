import { computeCP, cpmForLevel, effectiveStamina, type CpmTable } from "./cp.js";
import type { BaseStats, IVs } from "./types.js";
import { MAX_IV, MAX_LEVEL, MIN_IV, MIN_LEVEL } from "./types.js";

/**
 * Solver de IV.
 *
 * Dado o que o jogador ve na tela — especie, PC, PS — descobre quais
 * combinacoes de (nivel, IV de ataque, defesa e PS) produzem exatamente aqueles
 * numeros. Costuma sobrar mais de uma; a avaliacao do lider estreita, e as
 * barras da tela de avaliacao resolvem de vez.
 *
 * O espaco de busca e pequeno: ~109 niveis x 16^3 IVs. Forca bruta roda em
 * milissegundos e nao erra.
 */

export interface AppraisalRange {
  /** Faixa da soma dos tres IV, das estrelas da avaliacao. */
  totalMin: number;
  totalMax: number;
  /** Quais stats o lider destacou como os maiores. Vazio = nao informado. */
  bestStats?: readonly ("atk" | "def" | "hp")[];
  /** Faixa do maior stat individual, da frase do lider. */
  maxStatMin?: number;
  maxStatMax?: number;
}

export interface IVCandidate {
  level: number;
  ivs: IVs;
  cp: number;
  hp: number;
  /** Soma dos tres IV, de 0 a 45. */
  total: number;
  /** Percentual de perfeicao, de 0 a 100. */
  percent: number;
}

export interface SolveInput {
  base: BaseStats;
  cp: number;
  hp: number;
  /** Niveis possiveis. Sem isto, considera todos. */
  levels?: readonly number[];
  appraisal?: AppraisalRange;
  /** Piso de IV da origem: 10 para raide/ovo/pesquisa, 1 para lendario. */
  floorIV?: number;
}

export function ivTotal(ivs: IVs): number {
  return ivs.atk + ivs.def + ivs.hp;
}

export function ivPercent(ivs: IVs): number {
  return (ivTotal(ivs) / 45) * 100;
}

/** Todos os niveis validos, em passos de 0,5. */
function defaultLevels(levelCap: number): number[] {
  const levels: number[] = [];
  for (let l = MIN_LEVEL; l <= levelCap; l += 0.5) levels.push(l);
  return levels;
}

function matchesAppraisal(ivs: IVs, appraisal: AppraisalRange): boolean {
  const total = ivTotal(ivs);
  if (total < appraisal.totalMin || total > appraisal.totalMax) return false;

  const max = Math.max(ivs.atk, ivs.def, ivs.hp);

  if (appraisal.maxStatMin !== undefined && max < appraisal.maxStatMin) return false;
  if (appraisal.maxStatMax !== undefined && max > appraisal.maxStatMax) return false;

  if (appraisal.bestStats && appraisal.bestStats.length > 0) {
    // Os stats destacados tem que ser exatamente os que empatam no topo: se o
    // lider apontou so o ataque, defesa nao pode empatar com ele.
    const highlighted = new Set(appraisal.bestStats);
    for (const stat of ["atk", "def", "hp"] as const) {
      const isMax = ivs[stat] === max;
      if (isMax !== highlighted.has(stat)) return false;
    }
  }

  return true;
}

/**
 * Combinacoes compativeis com o que foi observado.
 *
 * Lista vazia significa entrada IMPOSSIVEL — nenhum nivel e IV produzem aquele
 * PC com aquele PS para aquela especie. E um resultado util, nao uma falha: e
 * assim que o app percebe que o OCR leu errado, ou que o jogador digitou um
 * numero trocado, em vez de inventar um veredito em cima de dado furado.
 */
export function solveIVs(input: SolveInput, cpm: CpmTable): IVCandidate[] {
  const floor = Math.max(MIN_IV, input.floorIV ?? MIN_IV);
  const levels = input.levels ?? defaultLevels(MAX_LEVEL);
  const out: IVCandidate[] = [];

  for (const level of levels) {
    if (level < MIN_LEVEL || level > MAX_LEVEL) continue;
    const multiplier = cpmForLevel(cpm, level);

    // O PS depende SO do IV de PS e do nivel. Resolver por ele primeiro corta
    // o espaco em 16x antes de tocar em ataque e defesa.
    for (let hpIv = floor; hpIv <= MAX_IV; hpIv++) {
      if (effectiveStamina(input.base, { atk: 0, def: 0, hp: hpIv }, multiplier) !== input.hp) {
        continue;
      }

      for (let atk = floor; atk <= MAX_IV; atk++) {
        for (let def = floor; def <= MAX_IV; def++) {
          const ivs: IVs = { atk, def, hp: hpIv };
          if (computeCP(input.base, ivs, multiplier) !== input.cp) continue;
          if (input.appraisal && !matchesAppraisal(ivs, input.appraisal)) continue;

          out.push({
            level,
            ivs,
            cp: input.cp,
            hp: input.hp,
            total: ivTotal(ivs),
            percent: ivPercent(ivs),
          });
        }
      }
    }
  }

  return out;
}

export interface SolveSummary {
  candidates: IVCandidate[];
  /** `true` quando nada bate — leitura ou digitacao errada. */
  impossible: boolean;
  /** Preenchido so quando sobra exatamente uma combinacao. */
  exact: IVCandidate | null;
  percentMin: number;
  percentMax: number;
}

export function summarize(candidates: IVCandidate[]): SolveSummary {
  if (candidates.length === 0) {
    return { candidates, impossible: true, exact: null, percentMin: 0, percentMax: 0 };
  }

  let min = Infinity;
  let max = -Infinity;
  for (const c of candidates) {
    if (c.percent < min) min = c.percent;
    if (c.percent > max) max = c.percent;
  }

  return {
    candidates,
    impossible: false,
    exact: candidates.length === 1 ? candidates[0]! : null,
    percentMin: min,
    percentMax: max,
  };
}
