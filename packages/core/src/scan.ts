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

    // Limiar deliberadamente BAIXO.
    //
    // Filtrar aqui pelo tamanho do preenchimento apagaria justamente as barras
    // que mais importam: um IV 1 pinta ~1/15 do trilho, o que num print de 688
    // px de largura da uns 14 px. Com o corte antigo de 4% da largura, todo
    // Pokemon de ataque baixo era lido errado — e sao exatamente os que o
    // jogador quer achar pra transferir.
    //
    // A separacao entre barra e enfeite fica para o filtro de LARGURA DE
    // TRILHO, mais adiante: barra e cor seguida de trilho cinza ate uma borda
    // definida; selo e carimbo nao tem trilho.
    if (best && best.end - best.start >= 4) runs.push(best);
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

    // Teste de PUREZA — o que separa barra de enfeite.
    //
    // Um trilho de avaliacao e feito exclusivamente de duas coisas: a cor de
    // preenchimento e o cinza do vazio. Qualquer outra coisa laranja no print
    // (o selo de estrelas, o carimbo de data, o brilho do fundo) tem pixels de
    // outras cores no meio do caminho e cai aqui.
    //
    // Sem este teste eu precisaria de um limiar alto de preenchimento, e ai
    // barras de IV baixo — as que mais importam pra decidir o que transferir —
    // seriam descartadas como ruido.
    if (!looksLikeTrack(bmp, middle.y, left, barLength)) continue;

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

  // Uma barra que escapou da deteccao pode ser DEDUZIDA.
  //
  // As tres sao empilhadas com espacamento regular e dividem o mesmo trilho.
  // Entao, com duas encontradas, a terceira nao e adivinhacao: ou o intervalo
  // entre elas veio dobrado, e a que falta esta exatamente no meio, ou ela esta
  // numa das pontas, a um intervalo de distancia.
  //
  // Isto salva o caso real de uma barra reprovada no teste de pureza por um
  // detalhe da tela passando por cima dela.
  if (bars.length === 2) {
    const inferred = inferMissingBar(bmp, bars[0]!, bars[1]!);
    if (inferred) bars.splice(inferred.index, 0, inferred.bar);
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

  // Remede as tres com a MESMA geometria.
  //
  // Detectar cada barra isoladamente deixa uma leitura ruim contaminar so ela:
  // numa amostra real uma barra saiu com x=263/larg=141 enquanto as vizinhas
  // tinham x=190/larg=215 — mesma borda direita, esquerda perdida. Como as tres
  // dividem o mesmo trilho por construcao, usar a mediana das tres corrige a
  // que escorregou sem estragar as que estavam certas.
  const left = median(chosen.map((b) => b.rect.x));
  const width = median(chosen.map((b) => b.rect.width));

  const remeasured = chosen.map((bar) => {
    const centerY = bar.rect.y + Math.floor(bar.rect.height / 2);
    const value = measureAt(bmp, centerY, left, width);
    return {
      ...bar,
      value: value.value,
      perfect: value.perfect,
      rect: { ...bar.rect, x: left, width },
    };
  }) as [ScanBar, ScanBar, ScanBar];

  return {
    ok: true,
    ivs: {
      atk: remeasured[0].value,
      def: remeasured[1].value,
      hp: remeasured[2].value,
    },
    bars: remeasured,
  };
}

/**
 * Deduz a terceira barra a partir das duas encontradas.
 *
 * Devolve tambem em que posicao ela entra, para a ordem Ataque/Defesa/PS
 * continuar correta — inserir no lugar errado trocaria os stats de nome, que e
 * pior que nao ler.
 */
function inferMissingBar(
  bmp: Bitmap,
  first: ScanBar,
  second: ScanBar,
): { bar: ScanBar; index: number } | null {
  // Precisam dividir o mesmo trilho para que a deducao faca sentido.
  if (Math.abs(first.rect.width - second.rect.width) > first.rect.width * 0.1) return null;

  const left = Math.min(first.rect.x, second.rect.x);
  const width = Math.max(first.rect.width, second.rect.width);
  const height = Math.max(first.rect.height, second.rect.height);
  const gap = second.rect.y - first.rect.y;

  // Intervalo dobrado: a que falta e a do MEIO.
  const doubled = gap > height * 3.5;
  const y = doubled
    ? Math.round((first.rect.y + second.rect.y) / 2)
    : // Caso contrario ela esta numa ponta. Tento acima primeiro; a de baixo
      // costuma estar coberta pelo texto de captura.
      first.rect.y - gap;

  if (y < 0 || y + height >= bmp.height) return null;

  const centerY = y + Math.floor(height / 2);
  if (!looksLikeTrack(bmp, centerY, left, width)) return null;

  const measured = measureAt(bmp, centerY, left, width);
  return {
    bar: {
      value: measured.value,
      perfect: measured.perfect,
      rect: { x: left, y, width, height },
    },
    index: doubled ? 1 : 0,
  };
}

/**
 * Confere se o intervalo se comporta como trilho de avaliacao.
 *
 * Amostra ao longo da faixa e exige que quase tudo seja preenchimento ou vazio.
 * As bordas ficam de fora da amostragem porque o antialias mistura a cor do
 * trilho com a do cartao branco.
 */
function looksLikeTrack(bmp: Bitmap, y: number, left: number, width: number): boolean {
  const SAMPLES = 24;
  let belong = 0;
  let seen = 0;

  for (let i = 0; i < SAMPLES; i++) {
    const x = Math.round(left + ((i + 0.5) / SAMPLES) * width);
    if (x < 0 || x >= bmp.width) continue;
    seen++;

    const offset = (y * bmp.width + x) * 4;
    if (
      near(bmp.data, offset, ORANGE) ||
      near(bmp.data, offset, RED) ||
      near(bmp.data, offset, EMPTY, 34)
    ) {
      belong++;
    }
  }

  return seen > 0 && belong / seen >= 0.85;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Conta os passos pintados de uma barra com geometria ja conhecida. */
function measureAt(
  bmp: Bitmap,
  y: number,
  left: number,
  width: number,
): { value: number; perfect: boolean } {
  const stepWidth = width / MAX_BAR;
  let value = 0;
  let perfect = false;

  for (let step = 0; step < MAX_BAR; step++) {
    const x = Math.round(left + (step + 0.5) * stepWidth);
    if (x < 0 || x >= bmp.width) break;
    const offset = (y * bmp.width + x) * 4;

    const isRed = near(bmp.data, offset, RED);
    if (isRed || near(bmp.data, offset, ORANGE)) {
      value++;
      if (isRed) perfect = true;
    } else {
      break;
    }
  }

  return { value: perfect ? MAX_BAR : value, perfect };
}

/**
 * Escolhe as tres barras de verdade entre as candidatas.
 *
 * O print inteiro tem laranja: o selo de estrelas, o carimbo de data, enfeites
 * de fundo. Testar apenas trios CONSECUTIVOS mordia esse ruido, porque o selo
 * gera varias faixas parecidas entre si logo acima das barras reais.
 *
 * O que distingue as barras de verdade nao e a cor — e a GEOMETRIA: as tres
 * comecam na mesma coluna, tem exatamente a mesma largura de trilho e ficam
 * empilhadas com espacamento regular. Nada mais no print faz isso.
 */
function pickThree(bars: ScanBar[]): [ScanBar, ScanBar, ScanBar] | null {
  if (bars.length < 3) return null;

  // Primeiro corte: LARGURA. O trilho da avaliacao e de longe o elemento
  // laranja mais largo do print — o selo de estrelas e o carimbo de data ficam
  // na casa dos 40 a 140 px contra 215 do trilho. Este corte sozinho limpa
  // quase todo o ruido, e sem depender de posicao na tela.
  const widest = Math.max(...bars.map((b) => b.rect.width));
  const candidates = bars.filter((b) => b.rect.width >= widest * 0.6);
  if (candidates.length < 3) return null;

  // Segundo corte: ESPACAMENTO REGULAR. As tres barras sao empilhadas com o
  // mesmo intervalo. Nao exijo alinhamento perfeito a esquerda de proposito —
  // uma barra pode ter a borda esquerda mal detectada, e e justamente isso que
  // a remedicao por mediana conserta depois. Exigir alinhamento aqui derrubaria
  // o trio certo por causa de uma leitura ruim.
  let best: [ScanBar, ScanBar, ScanBar] | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      for (let k = j + 1; k < candidates.length; k++) {
        const trio = [candidates[i]!, candidates[j]!, candidates[k]!] as [
          ScanBar,
          ScanBar,
          ScanBar,
        ];
        const tops = trio.map((b) => b.rect.y);

        const gap1 = tops[1]! - tops[0]!;
        const gap2 = tops[2]! - tops[1]!;
        if (gap1 <= 0 || gap2 <= 0) continue;

        const irregularity = Math.abs(gap1 - gap2) / Math.max(gap1, gap2);
        if (irregularity > 0.25) continue;

        if (irregularity < bestScore) {
          bestScore = irregularity;
          best = trio;
        }
      }
    }
  }

  return best;
}
