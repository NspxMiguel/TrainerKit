import { describe, expect, it } from "vitest";

import { checkUrl, looksLikeDataset } from "./source.ts";

/**
 * O portao que impede o pior erro possivel.
 *
 * Apontar a fonte de dados pra um JSON qualquer nao pode resultar em numeros
 * calculados sobre lixo — um app que decide errado com confianca e pior que um
 * app que nao decide. Estes testes cobrem as formas de "quase certo" que
 * passariam por uma checagem preguiçosa.
 */

const valido = {
  cpm: [0.094, 0.135],
  species: [{ id: "bulbasaur", name: "Bulbasaur", baseStats: { atk: 1, def: 1, hp: 1 }, types: ["grass"] }],
  fastMoves: [],
  chargedMoves: [],
  typeChart: { normal: [] },
  typeOrder: Array.from({ length: 18 }, (_, i) => `t${i}`),
  settings: { battle: {} },
  version: { levelCap: 50 },
};

describe("validacao do dataset", () => {
  it("aceita o formato completo", () => {
    expect(looksLikeDataset(valido)).toBeNull();
  });

  it("recusa o que nem e objeto", () => {
    expect(looksLikeDataset(null)).not.toBeNull();
    expect(looksLikeDataset(42)).not.toBeNull();
    // Uma pagina de erro HTML servida com 200 chega como texto: o caso mais
    // comum de "apontei pro link errado".
    expect(looksLikeDataset("<!doctype html>")).not.toBeNull();
  });

  it("recusa campo faltando, e diz qual", () => {
    for (const campo of ["cpm", "species", "typeChart", "typeOrder", "settings", "version"]) {
      const parcial = { ...valido };
      delete (parcial as Record<string, unknown>)[campo];
      const erro = looksLikeDataset(parcial);
      expect(erro, campo).toContain(campo);
    }
  });

  it("recusa formato errado no campo certo", () => {
    // Estes sao os perigosos: o campo EXISTE, entao uma checagem por presenca
    // passaria e o app quebraria depois, longe da causa.
    expect(looksLikeDataset({ ...valido, cpm: [] })).not.toBeNull();
    expect(looksLikeDataset({ ...valido, cpm: ["a"] })).not.toBeNull();
    expect(looksLikeDataset({ ...valido, species: [] })).not.toBeNull();
    expect(looksLikeDataset({ ...valido, typeOrder: ["so-um"] })).not.toBeNull();
  });

  it("recusa especie sem o minimo pra calcular", () => {
    const semStats = { ...valido, species: [{ id: "x", name: "X", types: [] }] };
    expect(looksLikeDataset(semStats)).toContain("baseStats");
  });
});

describe("validacao do endereco", () => {
  it("aceita https", () => {
    expect(checkUrl("https://exemplo.com/gamedata.json")).toBeNull();
  });

  it("recusa o que nao e URL", () => {
    expect(checkUrl("nao é url")).not.toBeNull();
    expect(checkUrl("")).not.toBeNull();
  });

  it("recusa protocolo que o fetch nao serve", () => {
    expect(checkUrl("ftp://exemplo.com/x.json")).not.toBeNull();
    expect(checkUrl("file:///tmp/x.json")).not.toBeNull();
  });
});
