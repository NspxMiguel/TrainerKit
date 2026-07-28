import { computeCP, cpmForLevel, effectiveStamina, type CpmTable } from "./cp.js";
import type { BaseStats, IVs } from "./types.js";
import { MAX_LEVEL, MIN_LEVEL } from "./types.js";

/**
 * Avaliacao do jogo — o sistema ATUAL.
 *
 * A tela de avaliacao mostra tres barras (Ataque, Defesa, PS) e cada uma vale
 * de 0 a 15. Elas nao dao "faixa": dao o IV EXATO. O jogador so precisa
 * replicar o que ve, e o app ja sabe tudo sobre os IV.
 *
 * Isso torna obsoleto o modelo antigo, de antes de 2018, em que o lider de
 * equipe falava frases ("Fantástico!", "Realmente forte") e o app deduzia
 * faixas. Aquilo existia porque o jogo escondia o numero. Hoje ele mostra.
 *
 * O que as barras NAO dao e o **nivel** — e e so por isso que PC e PS ainda
 * importam. Ver `solveLevel`.
 */

export const MAX_BAR = 15;

/** Quantos segmentos visuais a barra tem. Cada um vale 5 pontos de IV. */
export const BAR_SEGMENTS = 3;
export const IV_PER_SEGMENT = MAX_BAR / BAR_SEGMENTS;

/**
 * Estrelas do selo, pela soma dos tres IV.
 *
 * Diferente das barras, isto e derivado — o selo e so um resumo. Serve para
 * conferir se o jogador leu as barras direito: se as barras somam 40 mas o selo
 * mostra 2 estrelas, alguma coisa foi lida errado.
 */
export function starsFor(total: number): number {
  if (total >= 37) return 4;
  if (total >= 30) return 3;
  if (total >= 23) return 2;
  return 1;
}

/** Cor da barra no jogo: vermelha quando o stat e perfeito, laranja no resto. */
export function isBarPerfect(value: number): boolean {
  return value === MAX_BAR;
}

export interface LevelCandidate {
  level: number;
  cp: number;
  hp: number;
}

/**
 * Descobre o nivel a partir do que esta na tela.
 *
 * Com os IV ja conhecidos pelas barras, PC e PS sobredeterminam o nivel: basta
 * varrer os 109 niveis e ver qual produz exatamente aqueles dois numeros. Quase
 * sempre sobra um so.
 *
 * Lista vazia significa que os numeros nao existem juntos — barra lida errada,
 * PC digitado errado, ou especie errada. E um resultado util, nao uma falha.
 */
export function solveLevel(
  cpm: CpmTable,
  base: BaseStats,
  ivs: IVs,
  observed: { cp: number; hp: number },
  levelCap: number = MAX_LEVEL,
): LevelCandidate[] {
  const out: LevelCandidate[] = [];

  for (let level = MIN_LEVEL; level <= levelCap; level += 0.5) {
    const multiplier = cpmForLevel(cpm, level);
    const hp = effectiveStamina(base, ivs, multiplier);
    if (hp !== observed.hp) continue;

    const cp = computeCP(base, ivs, multiplier);
    if (cp !== observed.cp) continue;

    out.push({ level, cp, hp });
  }

  return out;
}

/**
 * Nivel a partir so do PS.
 *
 * Util enquanto o jogador ainda nao digitou o PC: o PS ja estreita bastante, e
 * a tela pode ir mostrando o que ja da pra saber em vez de esperar tudo.
 */
export function levelsMatchingHp(
  cpm: CpmTable,
  base: BaseStats,
  ivs: IVs,
  hp: number,
  levelCap: number = MAX_LEVEL,
): number[] {
  const out: number[] = [];
  for (let level = MIN_LEVEL; level <= levelCap; level += 0.5) {
    if (effectiveStamina(base, ivs, cpmForLevel(cpm, level)) === hp) out.push(level);
  }
  return out;
}

export function ivTotalOf(ivs: IVs): number {
  return ivs.atk + ivs.def + ivs.hp;
}

export function ivPercentOf(ivs: IVs): number {
  return (ivTotalOf(ivs) / 45) * 100;
}
