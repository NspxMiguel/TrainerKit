import { describe, expect, it } from "vitest";

import { contraste, degradeDoTipo } from "./cores.js";

/**
 * O TEXTO DO HERÓI TEM QUE SER LEGÍVEL EM TODOS OS DEZOITO TIPOS.
 *
 * ⚠️ Este teste nasceu de um defeito meu. O herói do Início desenha texto
 * BRANCO CRAVADO sobre o degradê do tipo, e eu tirei o scrim para a cor não
 * ficar lavada. Medido depois: branco sobre a parada clara do Gelo dá 1,49:1 e
 * sobre a do Elétrico 1,48:1 — o projeto exige 4,5:1.
 *
 * O scrim voltou em `rgba(0,0,0,0.45)`, que é o MENOR alfa que passa nos
 * dezoito. Este teste refaz a conta e falha se alguém mexer na saturação do
 * degradê, na luminosidade das paradas ou naquele número.
 *
 * ⚠️ ELE NÃO COBRE O HERÓI INTEIRO, e não precisa. Ele vale de 56% a 78% da
 * altura — a faixa onde o texto está — e some antes do pé, porque 45% de preto
 * na borda de baixo é o que fazia a listra cinza no tema claro. O que este
 * teste garante é o contraste NAQUELA faixa, que é onde o texto mora.
 */
const SCRIM = 0.45;

/** As dezoito cores de tipo, como `Selo.tsx` as define. */
const TIPOS: Record<string, string> = {
  normal: "#B4AFA3",
  fighting: "#D4633F",
  flying: "#9FB6E8",
  poison: "#B173C4",
  ground: "#D9A65E",
  rock: "#B8A583",
  bug: "#A9BE4A",
  ghost: "#8A7CC4",
  steel: "#A9B4C0",
  fire: "#F0813F",
  water: "#5BA8EE",
  grass: "#6FC163",
  electric: "#F0C63F",
  psychic: "#EE7FA6",
  ice: "#79D2DC",
  dragon: "#8274E2",
  dark: "#7C6D62",
  fairy: "#EE9DC6",
};

/** Preto com alfa por cima, do jeito que o `LinearGradient` compõe. */
function comScrim(cor: string, alfa: number): string {
  const n = parseInt(cor.slice(1), 16);
  const canal = (v: number) => Math.round(v * (1 - alfa));
  const r = canal((n >> 16) & 255);
  const g = canal((n >> 8) & 255);
  const b = canal(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

describe("o texto branco do herói passa em 4,5:1", () => {
  for (const [tipo, cor] of Object.entries(TIPOS)) {
    it(`${tipo}`, () => {
      const [, meio, claro] = degradeDoTipo(cor);
      /* As duas paradas que ficam ATRÁS do texto. A escura está no topo, onde
         não há texto nenhum. */
      for (const parada of [meio, claro]) {
        expect(contraste(comScrim(parada, SCRIM), "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("o scrim é o MENOR que passa — 0,40 já reprova", () => {
    const [, , claro] = degradeDoTipo(TIPOS.electric!);
    expect(contraste(comScrim(claro, 0.4), "#FFFFFF")).toBeLessThan(4.5);
  });
});
