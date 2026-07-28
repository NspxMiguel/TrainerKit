import type { AppraisalRange } from "./iv.js";

/**
 * Faixas da avaliacao do lider de equipe.
 *
 * ATENCAO: estes numeros **nao estao no GAME_MASTER**. Varri os 18.670
 * templates procurando qualquer chave com "appraisal" e nao ha nenhuma — os
 * limites sao do cliente do jogo e so se conhecem por engenharia reversa da
 * comunidade.
 *
 * Ou seja: sao a unica parte do app que nao pode ser conferida contra uma fonte
 * primaria. Precisam ser validados contra Pokemon reais, comparando o resultado
 * do solver com o IV que o jogador ja conhece. Ate la, tratar com desconfianca.
 */

/** Estrelas da avaliacao, pela soma dos tres IV. */
export const STAR_RANGES = [
  { stars: 4, label: "Melhores que já vi", totalMin: 37, totalMax: 45 },
  { stars: 3, label: "Realmente fortes", totalMin: 30, totalMax: 36 },
  { stars: 2, label: "Acima da média", totalMin: 23, totalMax: 29 },
  { stars: 1, label: "Comuns", totalMin: 0, totalMax: 22 },
] as const;

/** Faixa do maior stat individual, pela frase do lider. */
export const MAX_STAT_RANGES = [
  { label: "Fantástico (barra vermelha)", min: 15, max: 15 },
  { label: "Muito bom", min: 13, max: 14 },
  { label: "Bom", min: 8, max: 12 },
  { label: "Fraco", min: 0, max: 7 },
] as const;

export type StatKey = "atk" | "def" | "hp";

export interface AppraisalInput {
  /** 1 a 4. `null` quando o jogador nao avaliou. */
  stars: number | null;
  /** Quais stats o lider destacou. */
  bestStats: readonly StatKey[];
  /** Indice em MAX_STAT_RANGES. `null` quando nao informado. */
  maxStatTier: number | null;
}

export const EMPTY_APPRAISAL: AppraisalInput = {
  stars: null,
  bestStats: [],
  maxStatTier: null,
};

/** Converte o que o jogador marcou na tela para restricoes do solver. */
export function toRange(input: AppraisalInput): AppraisalRange | undefined {
  const star = input.stars === null ? null : STAR_RANGES.find((r) => r.stars === input.stars);
  const tier = input.maxStatTier === null ? null : MAX_STAT_RANGES[input.maxStatTier];

  // Sem nenhuma informacao nao ha o que restringir.
  if (!star && !tier && input.bestStats.length === 0) return undefined;

  const range: AppraisalRange = {
    totalMin: star?.totalMin ?? 0,
    totalMax: star?.totalMax ?? 45,
  };

  if (input.bestStats.length > 0) {
    return {
      ...range,
      bestStats: input.bestStats,
      ...(tier ? { maxStatMin: tier.min, maxStatMax: tier.max } : {}),
    };
  }

  return tier ? { ...range, maxStatMin: tier.min, maxStatMax: tier.max } : range;
}
