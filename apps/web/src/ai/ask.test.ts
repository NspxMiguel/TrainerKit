import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { Dataset } from "../data/useDataset.ts";
import type { OwnedPokemon } from "../storage/collection.ts";
import { collectionFacts } from "./ask.ts";

/**
 * O recorte da colecao, que decidia a resposta sem ninguem ver.
 *
 * O modelo so enxerga o que `collectionFacts` deixa passar. Enquanto o corte
 * pegava os 60 de MAIOR IV, "o que eu transfiro?" — pergunta que o docstring do
 * proprio `ask.ts` lista como alvo — era respondida com o pior DOS MELHORES, com
 * toda a confianca e sem nenhum sinal de erro. Nao havia teste: o defeito nao
 * estava numa conta, estava em QUAIS linhas chegavam ao contexto.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "public", "dataset", "gamedata.json");
const data = JSON.parse(readFileSync(DATASET, "utf8")) as Dataset;

/** Um jogador com `n` bichos, IV crescente: o primeiro e o pior de todos. */
function colecao(n: number): OwnedPokemon[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    speciesId: "pidgey",
    nickname: null,
    // 0/45 ate 45/45, espalhado pelos tres atributos.
    ivs: { atk: i % 16, def: (i + 5) % 16, hp: (i + 11) % 16 },
    level: 20,
    cp: 500,
    hp: 60,
    lucky: false,
    shadow: false,
    addedAt: "2026-01-01",
    doneAction: null,
  }));
}

describe("o recorte que vai pro modelo", () => {
  it("colecao pequena vai inteira", () => {
    expect(collectionFacts(colecao(10), data)).toHaveLength(10);
  });

  it("colecao grande cabe no limite", () => {
    expect(collectionFacts(colecao(500), data)).toHaveLength(60);
  });

  it("o PIOR da colecao chega ao modelo, nao so os melhores", () => {
    /*
     * O teste que faltava. Com o corte antigo (60 melhores por IV), o menor IV
     * da colecao NUNCA chegava — e "o que eu transfiro?" era respondida em cima
     * de um conjunto do qual os candidatos reais tinham sido removidos.
     */
    const todos = colecao(500);
    const piorIv = Math.min(
      ...todos.map((o) => o.ivs.atk + o.ivs.def + o.ivs.hp),
    );

    const facts = collectionFacts(todos, data);
    expect(Math.min(...facts.map((f) => f.ivTotal))).toBe(piorIv);
  });

  it("o melhor tambem continua chegando", () => {
    const todos = colecao(500);
    const melhorIv = Math.max(
      ...todos.map((o) => o.ivs.atk + o.ivs.def + o.ivs.hp),
    );

    const facts = collectionFacts(todos, data);
    expect(Math.max(...facts.map((f) => f.ivTotal))).toBe(melhorIv);
  });

  it("a lista continua em ordem, mesmo colada dos dois extremos", () => {
    // O contexto e lido de cima pra baixo. Se o bloco do fundo entrasse fora de
    // ordem, o modelo leria "melhor, melhor, pior, melhor" e nao teria como
    // saber onde um acaba e o outro comeca.
    const facts = collectionFacts(colecao(500), data, 30);
    for (let i = 1; i < facts.length; i += 1) {
      expect(facts[i]!.ivTotal).toBeLessThanOrEqual(facts[i - 1]!.ivTotal);
    }
  });

  it("o meio da colecao e o que some", () => {
    // Com 500 bichos e limite 30, 470 ficam de fora. O que nao pode e sumir um
    // dos extremos — os dois testes acima cobrem isso; este garante que o corte
    // aconteceu mesmo, em vez de a colecao inteira passar por engano.
    const facts = collectionFacts(colecao(500), data, 30);
    expect(facts).toHaveLength(30);
  });
});
