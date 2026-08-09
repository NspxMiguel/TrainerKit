import { describe, expect, it } from "vitest";

import { usos } from "./usos.js";

/** Uma lista de `n` posicoes onde `id` esta em `pos` (1-based). */
function lista(n: number, id: string, pos: number) {
  return Array.from({ length: n }, (_, i) => ({
    speciesId: i + 1 === pos ? id : `enchimento_${i}`,
  }));
}

const VAZIAS = { great: [], ultra: [], master: [] } as const;

describe("usos", () => {
  it("sem listas nao inventa serventia", () => {
    expect(usos("mewtwo", undefined)).toEqual([]);
    expect(usos("mewtwo", {})).toEqual([]);
  });

  it("quem nao aparece em lista nenhuma nao tem uso", () => {
    expect(
      usos("magikarp", {
        raidOverall: lista(800, "mewtwo", 1),
        statProductByLeague: VAZIAS,
      }),
    ).toEqual([]);
  });

  it("passar do corte de 60 e o mesmo que nao servir", () => {
    // A regra que mais importa aqui: o 61o melhor atacante do jogo nao entra
    // em raide nenhuma, e dizer "serve pra raide" seria mentira educada.
    expect(usos("azul", { raidOverall: lista(800, "azul", 61) })).toEqual([]);
    expect(usos("azul", { raidOverall: lista(800, "azul", 60) })).toEqual([
      { onde: "raide", nivel: "serve", posicao: 60, total: 800 },
    ]);
  });

  it("traduz posicao em nivel nos tres cortes", () => {
    const nivel = (pos: number) => usos("x", { raidOverall: lista(100, "x", pos) })[0]?.nivel;
    expect(nivel(1)).toBe("topo");
    expect(nivel(15)).toBe("topo");
    expect(nivel(16)).toBe("bom");
    expect(nivel(30)).toBe("bom");
    expect(nivel(31)).toBe("serve");
  });

  it("devolve as ligas que ele joga, e nao so uma", () => {
    const r = usos("azumarill", {
      statProductByLeague: {
        great: lista(500, "azumarill", 2),
        ultra: lista(500, "azumarill", 25),
        master: [],
      },
    });
    expect(r.map((u) => u.onde)).toEqual(["great", "ultra"]);
  });

  it("o melhor uso vem primeiro, e empate no nivel desempata pela posicao", () => {
    const r = usos("dialga", {
      raidOverall: lista(800, "dialga", 12),
      statProductByLeague: {
        great: [],
        ultra: lista(500, "dialga", 40),
        master: lista(500, "dialga", 3),
      },
    });
    expect(r.map((u) => `${u.onde}:${u.nivel}`)).toEqual([
      "master:topo", // 3 antes de 12: mesmo nivel, posicao melhor
      "raide:topo",
      "ultra:serve",
    ]);
  });

  it("carrega o tamanho da lista, pra tela poder dar escala a posicao", () => {
    const [u] = usos("x", { raidOverall: lista(812, "x", 14) });
    expect(u).toMatchObject({ posicao: 14, total: 812 });
  });
});
