import { describe, expect, it } from "vitest";

import { scanAppraisalBars, type Bitmap } from "./scan.js";

/**
 * Regressao de cor SEM print do jogo.
 *
 * `scan.realprints.test.ts` e o teste que pegou o laranja defasado do GoIV, mas
 * ele so roda com `TK_PRINTS` apontando para fixtures de 4 MB que estao fora do
 * repositorio de proposito. Sem eles o teste se ignora, entao a constante de cor
 * — a coisa que ja quebrou uma vez e quebra de novo quando o jogo repintar —
 * fica sem cobertura no dia a dia e em qualquer CI.
 *
 * `scanAppraisalBars` recebe pixels crus, entao da para desenhar um print em
 * memoria com a geometria da barra de avaliacao e nenhuma arte do jogo. Nao
 * substitui os prints reais (nao tem antialias, JPEG, nem HUD em volta); cobre a
 * parte que o teste real cobria e que hoje nao roda: as cores casam e a
 * contagem de pontos vira o IV certo.
 */

const LARANJA: [number, number, number] = [0xf3, 0xa7, 0x4c];
const VERMELHO: [number, number, number] = [0xe1, 0x7e, 0x84];
const VAZIO: [number, number, number] = [0xe2, 0xe2, 0xe2];
const FUNDO: [number, number, number] = [0x1c, 0x1c, 0x1e];

const PONTOS = 15;
const BLOCOS = 3;
const POR_BLOCO = PONTOS / BLOCOS;

interface Geometria {
  /** Largura de um ponto de IV, em pixels. */
  passo: number;
  /** Vao entre blocos, em pixels. */
  vao: number;
  /** Altura de cada barra. */
  altura: number;
  /** Espaco vertical entre barras. */
  entre: number;
  /** Margem esquerda ate o inicio do trilho. */
  margem: number;
}

/**
 * O vao precisa caber no que `longestFilledRuns` atravessa sem encerrar o
 * trilho: `max(2, round(width * 0.02))`. Com estas medidas a imagem sai com 352
 * px, o que da 7 px de vao tolerado — folga sobre os 6 desenhados aqui.
 */
const PADRAO: Geometria = { passo: 12, vao: 6, altura: 14, entre: 22, margem: 80 };

function pintar(
  data: Uint8ClampedArray,
  largura: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  cor: readonly [number, number, number],
): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const o = (y * largura + x) * 4;
      data[o] = cor[0];
      data[o + 1] = cor[1];
      data[o + 2] = cor[2];
      data[o + 3] = 255;
    }
  }
}

/**
 * Desenha uma tela de avaliacao com tres trilhos de 15 pontos.
 *
 * Cada trilho tem 3 blocos de 5 pontos separados por um vao, os primeiros `iv`
 * pontos pintados e o resto no cinza de trilho vazio. Um IV 15 e desenhado em
 * vermelho, como o jogo faz com stat perfeito.
 */
function tela(ivs: [number, number, number], g: Geometria = PADRAO): Bitmap {
  const trilho = PONTOS * g.passo + (BLOCOS - 1) * g.vao;
  const largura = g.margem * 2 + trilho;
  const altura = g.margem * 2 + ivs.length * g.altura + (ivs.length - 1) * g.entre;

  const data = new Uint8ClampedArray(largura * altura * 4);
  pintar(data, largura, 0, 0, largura, altura, FUNDO);

  ivs.forEach((iv, i) => {
    const y = g.margem + i * (g.altura + g.entre);
    const cheio = iv === PONTOS ? VERMELHO : LARANJA;

    for (let p = 0; p < PONTOS; p++) {
      const bloco = Math.floor(p / POR_BLOCO);
      const x = g.margem + p * g.passo + bloco * g.vao;
      pintar(data, largura, x, y, g.passo, g.altura, p < iv ? cheio : VAZIO);
    }
  });

  return { data, width: largura, height: altura };
}

function ler(ivs: [number, number, number], g?: Geometria) {
  const r = scanAppraisalBars(tela(ivs, g));
  if (!r.ok) throw new Error(`scan falhou: ${r.reason}`);
  return r;
}

describe("print sintetico", () => {
  it("le um 15/15/15", () => {
    expect(ler([15, 15, 15]).ivs).toEqual({ atk: 15, def: 15, hp: 15 });
  });

  it("preserva a ordem dos tres atributos", () => {
    expect(ler([2, 9, 14]).ivs).toEqual({ atk: 2, def: 9, hp: 14 });
  });

  /**
   * Uma barra zerada nao tem pixel pintado, entao nao e detectada e precisa ser
   * DEDUZIDA a partir das outras duas. Antes disso ser corrigido a deducao so
   * olhava para cima, e o zero em HP — a barra de baixo — recusava o print
   * inteiro com "barras-insuficientes".
   */
  it.each([
    [[0, 9, 9], { atk: 0, def: 9, hp: 9 }],
    [[9, 0, 9], { atk: 9, def: 0, hp: 9 }],
    [[9, 9, 0], { atk: 9, def: 9, hp: 0 }],
  ] as const)("le um zero em qualquer posicao: %j", (ivs, esperado) => {
    expect(ler([...ivs] as [number, number, number]).ivs).toEqual(esperado);
  });

  it("marca perfect apenas na barra vermelha", () => {
    const r = ler([15, 7, 15]);
    expect(r.bars.map((b) => b.perfect)).toEqual([true, false, true]);
  });

  it("cobre todo o intervalo de 1 a 15", () => {
    for (let iv = 1; iv <= PONTOS; iv++) {
      expect(ler([iv, iv, iv]).ivs.atk).toBe(iv);
    }
  });

  /**
   * 0/0/0 nao e legivel, e isso e por construcao, nao um descuido: a deteccao
   * ancora em pixel PINTADO, e um print 0/0/0 nao tem nenhum. Deduzir exigiria
   * ancorar so no cinza do trilho vazio, o que casaria com qualquer retangulo
   * cinza da tela e traria falso positivo — troca pior, porque IV errado com
   * cara de certo faz o jogador transferir a especie bom.
   *
   * Fica registrado para que a recusa seja uma decisao visivel e nao uma
   * surpresa. Um 0/0/0 e ~1 em 4096.
   */
  it("recusa um 0/0/0, que nao tem pixel pintado para ancorar", () => {
    const r = scanAppraisalBars(tela([0, 0, 0]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("sem-barras");
  });

  /**
   * Este e o teste que a constante defasada do GoIV nao passaria: `#EE9219`
   * esta a ~55 de distancia do laranja atual, acima da tolerancia de 46, entao
   * o detector nao acharia barra nenhuma numa tela perfeitamente legivel.
   */
  it("nao le uma tela pintada com o laranja antigo do GoIV", () => {
    const g = PADRAO;
    const b = tela([9, 9, 9], g);
    const GOIV_ANTIGO: [number, number, number] = [0xee, 0x92, 0x19];

    for (let i = 0; i < b.data.length; i += 4) {
      if (b.data[i] === LARANJA[0] && b.data[i + 1] === LARANJA[1] && b.data[i + 2] === LARANJA[2]) {
        b.data[i] = GOIV_ANTIGO[0];
        b.data[i + 1] = GOIV_ANTIGO[1];
        b.data[i + 2] = GOIV_ANTIGO[2];
      }
    }

    expect(scanAppraisalBars(b).ok).toBe(false);
  });

  it("recusa em vez de chutar quando o ponto fica estreito demais", () => {
    // MIN_STEP_PX e 6: abaixo disso o antialias come a fronteira e a leitura
    // erra, entao o scanner deve recusar.
    const r = scanAppraisalBars(tela([9, 9, 9], { ...PADRAO, passo: 3, vao: 2 }));
    expect(r.ok).toBe(false);
  });
});
