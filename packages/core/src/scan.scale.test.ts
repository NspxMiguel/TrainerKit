import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { scanAppraisalBars, type Bitmap } from "./scan.js";

/**
 * O scanner nunca pode LER ERRADO em nenhuma resolucao.
 *
 * O print pode vir de um aparelho 4K ou de um celular velho, pode ter sido
 * reduzido pelo WhatsApp, cortado, ou tirado com o jogo em fonte grande. Se a
 * leitura depender do tamanho, ela vai mentir em silencio pra metade das
 * pessoas — que e o pior modo de falhar.
 *
 * Este teste reescala cada print real e exige que, quando o scanner responde,
 * o IV seja EXATAMENTE o mesmo do original. Nao "parecido": o mesmo. Recusar e
 * aceito; errar nao — um IV errado com cara de certo faz o jogador transferir o
 * especie bom.
 *
 * Foi este teste que revelou o erro de modelo: eu tratava a barra como 15
 * passos corridos, mas sao TRES BLOCOS com vaos entre eles. Os vaos ocupam
 * largura, entao os pontos de amostragem derivavam para a direita e o erro
 * CRESCIA junto com o IV.
 */
const DIR = process.env.TK_PRINTS ?? "";

const ARQUIVOS = [
  "p1", "p2", "p3", "p4",
  "novos/n1", "novos/n2", "novos/n3", "novos/n4", "novos/n5",
  "novos/n6", "novos/n7", "novos/n8", "novos/n9",
] as const;

/** Fracoes do tamanho original. 0.35 leva um print de 800 px para 280 px. */
const ESCALAS = [1, 0.75, 0.5, 0.35] as const;

function carregar(file: string): Bitmap {
  const buf = readFileSync(`${DIR}/${file}.raw`);
  const width = buf.readUInt32BE(0);
  const height = buf.readUInt32BE(4);
  const data = new Uint8ClampedArray(
    buf.buffer.slice(buf.byteOffset + 8, buf.byteOffset + 8 + width * height * 4),
  );
  return { data, width, height };
}

/**
 * Reducao por media de area, que e o que o navegador faz ao desenhar a imagem
 * menor num canvas. Amostragem simples (vizinho mais proximo) seria otimista:
 * preservaria bordas duras que a media borra, e o teste passaria por engano.
 */
function reduzir(src: Bitmap, factor: number): Bitmap {
  if (factor === 1) return src;

  const width = Math.max(1, Math.round(src.width * factor));
  const height = Math.max(1, Math.round(src.height * factor));
  const data = new Uint8ClampedArray(width * height * 4);

  const boxW = src.width / width;
  const boxH = src.height / height;

  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * boxH);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * boxH));

    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * boxW);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * boxW));

      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1 && sy < src.height; sy++) {
        for (let sx = x0; sx < x1 && sx < src.width; sx++) {
          const o = (sy * src.width + sx) * 4;
          r += src.data[o]!;
          g += src.data[o + 1]!;
          b += src.data[o + 2]!;
          a += src.data[o + 3]!;
          n++;
        }
      }

      const o = (y * width + x) * 4;
      data[o] = Math.round(r / n);
      data[o + 1] = Math.round(g / n);
      data[o + 2] = Math.round(b / n);
      data[o + 3] = Math.round(a / n);
    }
  }

  return { data, width, height };
}

const temFixtures = DIR !== "" && ARQUIVOS.every((f) => existsSync(`${DIR}/${f}.raw`));

describe.skipIf(!temFixtures)("leitura estavel em qualquer resolucao", () => {
  for (const file of ARQUIVOS) {
    it(`${file} sobrevive a reducao`, () => {
      const original = carregar(file);
      const base = scanAppraisalBars(original);
      expect(base.ok, `o print original ja falhou: ${base.ok ? "" : base.reason}`).toBe(true);
      if (!base.ok) return;

      const esperado = `${base.ivs.atk}/${base.ivs.def}/${base.ivs.hp}`;
      const falhas: string[] = [];

      for (const escala of ESCALAS) {
        if (escala === 1) continue;
        const menor = reduzir(original, escala);
        const r = scanAppraisalBars(menor);

        // Recusar e comportamento CORRETO: abaixo de um certo tamanho cada
        // ponto de IV vira ~5 px e a fronteira some no antialias. O contrato do
        // scanner e "ou acerta, ou diz que nao consegue" — nunca inventar.
        if (!r.ok) continue;
        const lido = `${r.ivs.atk}/${r.ivs.def}/${r.ivs.hp}`;
        if (lido !== esperado) {
          falhas.push(`${menor.width}x${menor.height}: leu ${lido}, esperava ${esperado}`);
        }
      }

      if (falhas.length > 0) {
        console.log(`  ${file} (${esperado}) — ${falhas.length} falha(s):`);
        for (const f of falhas) console.log(`     ${f}`);
      }
      expect(falhas, falhas.join(" | ")).toHaveLength(0);
    });
  }
});
