import { MAX_BAR } from "./appraisal.js";
import type { IVs } from "./types.js";

/**
 * Leitura das barras de avaliacao a partir de um print.
 *
 * A ideia central: **isto nao e OCR**. As tres barras sao geometria. Cada uma
 * tem 15 passos e o preenchimento avanca um passo por ponto de IV, entao contar
 * quantos passos estao pintados da o IV EXATO — deterministico, sem modelo, sem
 * chute.
 *
 * A tecnica vem do GoIV, o leitor de tela mais maduro que existiu, e as cores
 * batem hex a hex entre as constantes dele e a amostragem das imagens oficiais.
 *
 * Funcao pura de proposito: recebe pixels e devolve numeros. Sem canvas, sem
 * DOM, sem rede — assim da pra testar com bitmap sintetico e, um dia, rodar
 * igual num app nativo.
 */

export interface Bitmap {
  /** RGBA, 4 bytes por pixel, como `ImageData.data`. */
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScanBar {
  /** IV lido, de 0 a 15. */
  value: number;
  /** Onde a barra foi encontrada — usado para desenhar a conferencia na tela. */
  rect: Rect;
  /** `true` quando a barra estava na cor de stat perfeito. */
  perfect: boolean;
}

export type ScanFailure =
  | "sem-barras"
  | "barras-insuficientes"
  | "barra-curta-demais"
  | "larguras-divergentes";

export type ScanResult =
  | { ok: true; ivs: IVs; bars: [ScanBar, ScanBar, ScanBar] }
  | { ok: false; reason: ScanFailure; detail: string; bars: ScanBar[] };

/**
 * Cores das barras, MEDIDAS em prints reais de 2026.
 *
 * Nao sao as constantes do GoIV (`#EE9219` laranja, `#E18079` vermelho). Aquele
 * projeto foi arquivado em 2022 e o jogo repintou o laranja desde entao: a
 * distancia entre `#EE9219` e o laranja atual e ~55 em RGB, ou seja, MAIOR que
 * qualquer tolerancia sa. Usar a constante velha faz o detector nao achar nada
 * num print perfeitamente legivel.
 *
 * O laranja aqui foi amostrado em tres prints independentes (Dragonite, Mewtwo
 * e Hariyama), todos convergindo em `#F3A74C`. O vermelho veio do print de um
 * 100% e quase nao mudou.
 */
const ORANGE = [0xf3, 0xa7, 0x4c] as const;
const RED = [0xe1, 0x7e, 0x84] as const;
const EMPTY = [0xe2, 0xe2, 0xe2] as const;

/**
 * Tolerancia de cor, em distancia euclidiana RGB.
 *
 * Generosa de proposito: o print passa por compressao JPEG, reescala do
 * sistema e as vezes por um "mockup" que reamostra tudo. Apertar demais faz o
 * detector nao achar nada num print perfeitamente legivel.
 */
const TOLERANCE = 46;

/** Cada passo precisa ter largura util; abaixo disso a leitura vira chute. */
const MIN_STEP_PX = 2;

function near(
  data: Bitmap["data"],
  offset: number,
  color: readonly [number, number, number],
  tolerance = TOLERANCE,
): boolean {
  const dr = data[offset]! - color[0];
  const dg = data[offset + 1]! - color[1];
  const db = data[offset + 2]! - color[2];
  return dr * dr + dg * dg + db * db <= tolerance * tolerance;
}

interface Run {
  y: number;
  start: number;
  end: number;
  perfect: boolean;
}

/**
 * Maior sequencia horizontal de cor de preenchimento em cada linha.
 *
 * Varre linha a linha porque a barra e sempre horizontal e continua. Guardar so
 * a maior sequencia por linha ja descarta a maior parte do ruido — icone,
 * texto, borda de card.
 */
function longestFilledRuns(bmp: Bitmap): Run[] {
  const runs: Run[] = [];

  for (let y = 0; y < bmp.height; y++) {
    let best: Run | null = null;
    let start = -1;
    let sawRed = false;

    for (let x = 0; x <= bmp.width; x++) {
      const offset = (y * bmp.width + x) * 4;
      const isRed = x < bmp.width && near(bmp.data, offset, RED);
      const filled = x < bmp.width && (isRed || near(bmp.data, offset, ORANGE));

      if (filled) {
        if (start < 0) {
          start = x;
          sawRed = false;
        }
        if (isRed) sawRed = true;
      } else if (start >= 0) {
        const length = x - start;
        if (!best || length > best.end - best.start) {
          best = { y, start, end: x, perfect: sawRed };
        }
        start = -1;
      }
    }

    // Ignora sequencias curtas: sao texto laranja, icone, borda.
    if (best && best.end - best.start >= bmp.width * 0.04) runs.push(best);
  }

  return runs;
}

/** Agrupa linhas vizinhas: cada grupo e uma barra. */
function clusterRows(runs: Run[]): Run[][] {
  const groups: Run[][] = [];
  let current: Run[] = [];

  for (const run of runs) {
    const previous = current[current.length - 1];
    // Duas linhas da mesma barra sao contiguas (ou quase, com antialias).
    if (previous && run.y - previous.y <= 2) current.push(run);
    else {
      if (current.length > 0) groups.push(current);
      current = [run];
    }
  }
  if (current.length > 0) groups.push(current);

  // Barra tem altura; um grupo de 1-2 linhas e ruido.
  return groups.filter((g) => g.length >= 3);
}

/**
 * Extremidade DIREITA da barra, incluindo a parte vazia.
 *
 * O preenchimento so diz onde ele acaba; o comprimento total da barra vem de
 * continuar andando pelo cinza do trilho. Sem isso nao da para saber que fracao
 * dos 15 passos esta pintada.
 */
function trackEnd(bmp: Bitmap, y: number, fromX: number): number {
  let end = fromX;
  let gap = 0;

  for (let x = fromX; x < bmp.width; x++) {
    const offset = (y * bmp.width + x) * 4;
    if (
      near(bmp.data, offset, EMPTY) ||
      near(bmp.data, offset, ORANGE) ||
      near(bmp.data, offset, RED)
    ) {
      end = x + 1;
      gap = 0;
    } else if (++gap > bmp.width * 0.02) {
      // Divisorias entre os tres blocos sao gaps curtos e nao encerram a barra;
      // um gap largo significa que a barra acabou de verdade.
      break;
    }
  }

  return end;
}

/**
 * Le as tres barras.
 *
 * Amostra o CENTRO de cada um dos 15 passos, em vez de medir a largura total e
 * dividir — assim o pixel de fronteira, que sai borrado pelo antialias, nunca
 * decide o resultado.
 */
export function scanAppraisalBars(bmp: Bitmap): ScanResult {
  const groups = clusterRows(longestFilledRuns(bmp));

  if (groups.length === 0) {
    return {
      ok: false,
      reason: "sem-barras",
      detail: "Não encontrei nenhuma barra laranja ou vermelha na imagem.",
      bars: [],
    };
  }

  const bars: ScanBar[] = [];

  for (const group of groups) {
    // A linha do meio do grupo e a mais limpa: longe do antialias das bordas.
    const middle = group[Math.floor(group.length / 2)]!;
    const left = Math.min(...group.map((r) => r.start));
    const right = trackEnd(bmp, middle.y, Math.max(...group.map((r) => r.end)));

    const barLength = right - left;
    const stepWidth = barLength / MAX_BAR;
    if (stepWidth < MIN_STEP_PX) continue;

    let value = 0;
    let perfect = false;
    for (let step = 0; step < MAX_BAR; step++) {
      const x = Math.round(left + (step + 0.5) * stepWidth);
      if (x >= bmp.width) break;
      const offset = (middle.y * bmp.width + x) * 4;

      const isRed = near(bmp.data, offset, RED);
      if (isRed || near(bmp.data, offset, ORANGE)) {
        value++;
        if (isRed) perfect = true;
      } else {
        break;
      }
    }

    // Barra vermelha e o stat perfeito: o jogo troca a cor exatamente em 15.
    if (perfect) value = MAX_BAR;

    bars.push({
      value,
      perfect,
      rect: {
        x: left,
        y: group[0]!.y,
        width: barLength,
        height: group[group.length - 1]!.y - group[0]!.y + 1,
      },
    });
  }

  if (bars.length < 3) {
    return {
      ok: false,
      reason: bars.length === 0 ? "barra-curta-demais" : "barras-insuficientes",
      detail:
        bars.length === 0
          ? "As barras ficaram pequenas demais na imagem para uma leitura confiável."
          : `Achei ${bars.length} barra(s), preciso das três (Ataque, Defesa e PS).`,
      bars,
    };
  }

  // Com mais de tres candidatas, as certas sao as tres de mesma largura e
  // empilhadas — o resto e texto laranja ou selo.
  const chosen = pickThree(bars);
  if (!chosen) {
    return {
      ok: false,
      reason: "larguras-divergentes",
      detail: "Achei barras, mas com larguras diferentes demais para serem as três da avaliação.",
      bars,
    };
  }

  return {
    ok: true,
    ivs: { atk: chosen[0].value, def: chosen[1].value, hp: chosen[2].value },
    bars: chosen,
  };
}

/** Escolhe as tres barras consecutivas mais parecidas em largura e alinhamento. */
function pickThree(bars: ScanBar[]): [ScanBar, ScanBar, ScanBar] | null {
  if (bars.length === 3) return [bars[0]!, bars[1]!, bars[2]!];

  let best: [ScanBar, ScanBar, ScanBar] | null = null;
  let bestScore = Infinity;

  for (let i = 0; i + 2 < bars.length; i++) {
    const trio = [bars[i]!, bars[i + 1]!, bars[i + 2]!] as [ScanBar, ScanBar, ScanBar];
    const widths = trio.map((b) => b.rect.width);
    const lefts = trio.map((b) => b.rect.x);

    const widthSpread = Math.max(...widths) - Math.min(...widths);
    const leftSpread = Math.max(...lefts) - Math.min(...lefts);
    const score = widthSpread + leftSpread;

    // As tres barras compartilham a mesma coluna e a mesma largura de trilho.
    if (score < bestScore && widthSpread <= Math.max(...widths) * 0.15) {
      bestScore = score;
      best = trio;
    }
  }

  return best;
}
