import { describe, expect, it } from "vitest";

import tabela from "./paleta.json" with { type: "json" };
import { VEU_DO_HEROI, contraste, degradeDoHeroi, misturar, tintaDoHeroi } from "./cores.js";

/**
 * O TEXTO DO HERÓI TEM QUE SER LEGÍVEL EM TODA ESPÉCIE, NOS DOIS TEMAS.
 *
 * ⚠️ Este teste varria os DEZOITO TIPOS, e isso deixou de ser o que a tela
 * desenha: o herói agora usa a cor da ESPÉCIE, como o app web sempre usou —
 * são mais de mil degradês diferentes, não dezoito. Varrer os tipos passaria
 * enquanto uma espécie amarela reprovava, que é exatamente o modo de falha que
 * a varredura do web já tinha encontrado (152 espécies, Bellsprout em 1,73:1).
 *
 * A conta é feita sobre o pixel de verdade: a parada de baixo do degradê,
 * misturada com o véu na força daquele tema, que é o que fica atrás da letra.
 */
const CORES = tabela as unknown as Record<string, { c: string[] }>;
const IDS = Object.keys(CORES);

/** O que fica atrás da letra: a parada de baixo já com o véu por cima. */
function sobOTexto(spriteId: number, escuro: boolean): string {
  const { cor, forca } = escuro ? VEU_DO_HEROI.escuro : VEU_DO_HEROI.claro;
  return misturar(degradeDoHeroi(spriteId, "#888888", escuro)[2], cor, forca);
}

describe("contraste do herói", () => {
  it("a tabela de cores tem espécie de sobra para a varredura valer alguma coisa", () => {
    expect(IDS.length).toBeGreaterThan(1000);
  });

  for (const escuro of [true, false]) {
    const tema = escuro ? "escuro" : "claro";

    it(`toda espécie passa em 4,5:1 no tema ${tema}`, () => {
      const ruins: string[] = [];
      for (const id of IDS) {
        const n = Number(id);
        if (!Number.isFinite(n)) continue;
        const fundo = sobOTexto(n, escuro);
        const razao = contraste(fundo, tintaDoHeroi(degradeDoHeroi(n, "#888888", escuro), escuro));
        if (razao < 4.5) ruins.push(`${id} ${fundo} ${razao.toFixed(2)}:1`);
      }
      expect(ruins, ruins.slice(0, 10).join(" | ")).toEqual([]);
    });

    it(`a tinta escolhida é a MELHOR das duas no tema ${tema}`, () => {
      /* Sem isto o teste passaria com uma tinta pior desde que ela alcançasse
         4,5:1 — e a escolha deixaria de ser uma escolha. */
      for (const id of IDS.slice(0, 200)) {
        const n = Number(id);
        const fundo = sobOTexto(n, escuro);
        const escolhida = tintaDoHeroi(degradeDoHeroi(n, "#888888", escuro), escuro);
        const outra = escolhida === "#FFFFFF" ? "#141920" : "#FFFFFF";
        expect(contraste(fundo, escolhida)).toBeGreaterThanOrEqual(contraste(fundo, outra));
      }
    });
  }

  it("o véu do tema claro CLAREIA, e o do escuro escurece", () => {
    /* ⚠️ Aplicar preto nos dois foi o que fez a listra cinza que ele
       fotografou: 45% de preto sobre um fundo quase branco dá cinza. */
    expect(VEU_DO_HEROI.escuro.cor).toBe("#0a0c10");
    expect(VEU_DO_HEROI.claro.cor).toBe("#fafbfd");
  });
});
