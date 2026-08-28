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
 * Selo de avaliacao.
 *
 * O selo tem SEMPRE **tres** slots de estrela — o que muda e quantos estao
 * acesos e a cor do fundo. Nao existe "4 estrelas": o tier de 100% e tres
 * estrelas com o fundo ROSA em vez de laranja.
 *
 * Verificado contra as cinco imagens oficiais (`GO Appraisal 0` a `4`) e a
 * tabela do Bulbapedia. Note que 37–44 e 45 sao tiers SEPARADOS — juntar os
 * dois esconde do jogador justamente o caso que ele mais quer ver.
 */
export interface AppraisalBadge {
  /** 0 a 4. */
  tier: number;
  /** Quantas das tres estrelas ficam acesas. */
  litStars: number;
  /** O tier de 100%, que o jogo pinta de rosa. */
  pink: boolean;
  label: string;
}

export const BADGE_TIERS: readonly AppraisalBadge[] = [
  { tier: 0, litStars: 0, pink: false, label: "Nenhuma estrela" },
  { tier: 1, litStars: 1, pink: false, label: "Uma estrela" },
  { tier: 2, litStars: 2, pink: false, label: "Duas estrelas" },
  { tier: 3, litStars: 3, pink: false, label: "Três estrelas" },
  { tier: 4, litStars: 3, pink: true, label: "Perfeito" },
];

/**
 * Total de IV → selo.
 *
 * ⚠️ ESTES QUATRO NUMEROS NAO ESTAO NO GAME_MASTER, e agora estao MEDIDOS.
 *
 * O jogo publica so o rotulo de busca ("3*,4*"); onde cada tier corta e
 * client-side. Ate hoje eles eram o que a comunidade repete. Foram conferidos
 * contra 13 especie reais do dono, com as quatro bordas batendo exatamente —
 * ver `appraisal.selo.test.ts`, que tem a tabela e o metodo.
 *
 * ⚠️ E POR ISSO QUE O APP LE A BARRA, E NUNCA A ESTRELA.
 *
 * A medicao achou de graca uma coisa que vale registrar: num dos prints a
 * roseta mostrava DUAS estrelas para uma especie de 42 (que sao tres), e o
 * apelido escrito pelo dono confirmava os 93%. As estrelas acendem uma a uma, e
 * um print tirado no meio da animacao pega menos do que o bicho tem.
 *
 * O erro so acontece nessa direcao — menos, nunca mais. Um leitor que tentasse
 * deduzir IV pela estrela subestimaria em silencio; as barras nao tem esse
 * problema porque `scanAppraisalBars` mede geometria acabada e RECUSA o que nao
 * bate. Se um dia alguem quiser ler a roseta pra conferir a barra, tem que
 * tratar divergencia pra menos como "print cedo demais", nao como erro de
 * leitura.
 */
export function badgeFor(total: number): AppraisalBadge {
  if (total >= 45) return BADGE_TIERS[4]!;
  if (total >= 37) return BADGE_TIERS[3]!;
  if (total >= 30) return BADGE_TIERS[2]!;
  if (total >= 23) return BADGE_TIERS[1]!;
  return BADGE_TIERS[0]!;
}

export const BAR_COLOR_FILLED = "#EE9219";
export const BAR_COLOR_PERFECT = "#E18079";

/**
 * A cor vermelha e por STAT, nao por especie: um 12/15/9 tem UMA barra vermelha
 * (a defesa) e duas laranjas. As tres so ficam vermelhas quando as tres sao 15.
 */
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
