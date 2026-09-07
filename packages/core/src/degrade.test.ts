import { describe, expect, it } from "vitest";

import { degradeDoTipo, PARADAS_DO_DEGRADE } from "./cores.js";

/** `#RRGGBB` → HSL em graus e frações, para medir a relação entre as paradas. */
function hsl(hexa: string): [number, number, number] {
  const n = parseInt(hexa.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

/** A menor distância entre duas matizes, em graus (o círculo fecha em 360). */
function distanciaDeMatiz(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/*
 * O degradê do pacote do Claude Design, e o que ele tem que continuar sendo.
 *
 * Ele foi pedido de volta por nome — "kd o degrade q ia subindo? era mo lindo" —
 * depois de eu ter trocado por um degradê de duas paradas que só apagava a cor.
 * O teste trava a RELAÇÃO entre as paradas, que é o que produz o efeito, e não
 * os hexadecimais: as cores de tipo do app podem ser corrigidas, a relação não.
 */
const TIPOS = [
  "#F0813F", // fogo
  "#8274E2", // dragão
  "#79D2DC", // gelo
  "#5BA8EE", // água
  "#6FC163", // planta
  "#B4AFA3", // normal — o menos saturado, e o que mais estressa a conta
];

describe("o degradê que sobe", () => {
  it("tem três paradas, e a última não é 100%", () => {
    expect(PARADAS_DO_DEGRADE).toHaveLength(3);
    expect(PARADAS_DO_DEGRADE[0]).toBe(0);
    /* A folga no pé é o que deixa uma FAIXA da cor clara em vez de um ponto.
       Chegar a 1 achata o efeito — é a diferença que ele viu de longe. */
    expect(PARADAS_DO_DEGRADE[2]).toBeLessThan(1);
  });

  for (const cor of TIPOS) {
    it(`${cor}: escurece, clareia e mantém a matiz`, () => {
      const [escuro, meio, claro] = degradeDoTipo(cor);
      const [hE, sE, lE] = hsl(escuro);
      const [hM, , lM] = hsl(meio);
      const [hC, sC, lC] = hsl(claro);

      // A LUZ SOBE, que é o ponto inteiro do efeito.
      expect(lE).toBeLessThan(lM);
      expect(lM).toBeLessThan(lC);

      // A matiz quase não anda: é a MESMA cor, com mais ou menos luz.
      expect(distanciaDeMatiz(hE, hM)).toBeLessThan(12);
      expect(distanciaDeMatiz(hM, hC)).toBeLessThan(12);

      // A saturação acompanha a luz — escurecer sem dessaturar suja a sombra.
      expect(sE).toBeLessThanOrEqual(sC + 0.001);

      // Nada estoura nem some: os dois extremos continuam sendo cor.
      expect(lE).toBeGreaterThan(0.1);
      expect(lC).toBeLessThan(0.85);
    });
  }

  it("a parada do meio é praticamente a cor do tipo", () => {
    const [, meio] = degradeDoTipo("#F0813F");
    const [h] = hsl(meio);
    expect(distanciaDeMatiz(h, hsl("#F0813F")[0])).toBeLessThan(3);
  });
});
