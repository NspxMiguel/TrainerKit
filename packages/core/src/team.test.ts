import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { attackTypesAgainst, countDistinctTypes, pickTeam, type Candidate } from "./team.js";
import { SUPER_EFFECTIVE, effectiveness } from "./types-chart.js";

/**
 * O que estes testes protegem.
 *
 * O montador de time carregava um erro que PARECIA funcionar: ele pedia o tipo
 * do chefe e ia buscar os melhores atacantes daquele tipo. Pra um chefe de
 * Dragao dava certo por acidente — Dragao bate forte em Dragao. Pra um chefe de
 * Fogo montava um time de atacantes de Fogo, o pior time possivel, e nenhum
 * teste reclamaria porque o codigo fazia exatamente o que estava escrito.
 *
 * Entao o teste nao verifica "a funcao devolve uma lista": verifica a REGRA do
 * jogo, contra a tabela de tipos de verdade que veio do GAME_MASTER.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");

interface Dataset {
  typeOrder: string[];
  typeChart: Record<string, number[]>;
}

const data = JSON.parse(readFileSync(DATASET, "utf8")) as Dataset;
const { typeChart: chart, typeOrder: order } = data;

const cand = (id: string, types: string[], score: number): Candidate => ({
  speciesId: id,
  name: id,
  score,
  types,
});

describe("attackTypesAgainst", () => {
  it("nunca devolve um tipo que o alvo resiste", () => {
    // A garantia central: se um tipo entra na lista, bater com ele e vantagem.
    for (const alvo of order) {
      for (const tipo of attackTypesAgainst([alvo], chart, order)) {
        expect(effectiveness(chart, order, tipo, [alvo]), `${tipo} contra ${alvo}`).toBeGreaterThan(
          1,
        );
      }
    }
  });

  it("todo tipo do jogo tem pelo menos uma fraqueza", () => {
    for (const alvo of order) {
      expect(attackTypesAgainst([alvo], chart, order).length, alvo).toBeGreaterThan(0);
    }
  });

  it("Fogo nao esta na lista contra um chefe de Fogo", () => {
    // Era exatamente o time que o app montava antes: atacantes de Fogo contra um
    // chefe de Fogo, que resiste a Fogo.
    expect(attackTypesAgainst(["fire"], chart, order)).not.toContain("fire");
    expect(attackTypesAgainst(["fire"], chart, order)).toContain("water");
  });

  it("multiplica os dois tipos do chefe, e Pedra vem na frente contra Charizard", () => {
    // Fogo/Voador: Pedra e super efetivo contra os DOIS, entao vale
    // SUPER_EFFECTIVE ao quadrado — mais que Agua ou Eletrico, que pegam so o
    // Fogo e o Voador respectivamente. Uma conta feita so no primeiro tipo
    // deixaria os tres empatados e o time sairia pior.
    //
    // O fator do o jogo e 1.6, nao 2 como na serie principal: 1.6² = 2.56.
    const tipos = attackTypesAgainst(["fire", "flying"], chart, order);
    expect(tipos[0]).toBe("rock");
    expect(effectiveness(chart, order, "rock", ["fire", "flying"])).toBeCloseTo(
      SUPER_EFFECTIVE ** 2,
      5,
    );
    expect(effectiveness(chart, order, "water", ["fire", "flying"])).toBeCloseTo(
      SUPER_EFFECTIVE,
      5,
    );
  });

  it("um alvo que nao existe na tabela devolve lista vazia, e nao chuta", () => {
    expect(attackTypesAgainst(["nao_existe"], chart, order)).toEqual([]);
    expect(attackTypesAgainst([], chart, order)).toEqual([]);
  });
});

describe("pickTeam", () => {
  it("nao repete tipo primario enquanto houver alternativa", () => {
    const time = pickTeam(
      [
        cand("a", ["dragon"], 100),
        cand("b", ["dragon"], 99),
        cand("c", ["ice"], 90),
        cand("d", ["rock"], 80),
      ],
      3,
    );
    expect(time.map((p) => p.speciesId)).toEqual(["a", "c", "d"]);
  });

  it("completa pela nota quando os tipos acabam, e marca o motivo", () => {
    // Tres vagas, dois tipos: a terceira tem que ser preenchida, e a tela precisa
    // poder dizer que ela entrou por nota e nao por variedade.
    const time = pickTeam([cand("a", ["dragon"], 100), cand("b", ["dragon"], 99)], 3);
    expect(time.map((p) => p.speciesId)).toEqual(["a", "b"]);
    expect(time.map((p) => p.reason)).toEqual(["melhor", "melhor"]);
  });

  it("nao repete a mesma especie", () => {
    const time = pickTeam([cand("a", ["dragon"], 100), cand("a", ["dragon"], 100)], 6);
    expect(time).toHaveLength(1);
  });

  it("nunca passa do tamanho pedido", () => {
    const muitos = order.map((tp, i) => cand(`s${i}`, [tp], 100 - i));
    expect(pickTeam(muitos, 6)).toHaveLength(6);
  });
});

describe("countDistinctTypes", () => {
  it("conta o tipo primario, nao o secundario", () => {
    const time = pickTeam(
      [cand("a", ["dragon", "flying"], 100), cand("b", ["ice", "flying"], 90)],
      2,
    );
    expect(countDistinctTypes(time)).toBe(2);
  });
});
