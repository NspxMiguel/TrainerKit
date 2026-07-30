import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { MOEDAS_POR_DIA, coinMath, pickDefenders, rankDefenders } from "./gym.js";
import { isObtainable } from "./rankings.js";
import type { DefenderInput } from "./gym.js";
import type { BaseStats } from "./types.js";

/**
 * O que estes testes protegem.
 *
 * A tela de ginasio afirma duas coisas ao usuario, e as duas sao afirmacoes
 * fortes: que o ATAQUE nao importa num defensor, e que aguentar pancada e
 * resistir a tipos se multiplicam. Se a conta nao sustentar isso, o app esta
 * dando conselho errado com confianca — o pior defeito que ele pode ter.
 *
 * Entao aqui se verifica contra especies reais do dataset, com os casos que a
 * comunidade ja conhece de cor: Blissey aguenta mais que qualquer atacante, e
 * um Machamp de 100% perde de um Blissey de IV baixo.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");

interface Dataset {
  cpm: number[];
  typeOrder: string[];
  typeChart: Record<string, number[]>;
  species: Array<{ id: string; name: string; baseStats: BaseStats; types: string[] }>;
}

const data = JSON.parse(readFileSync(DATASET, "utf8")) as Dataset;
const { cpm, typeChart: chart, typeOrder: order } = data;

const PERFEITO = { atk: 15, def: 15, hp: 15 };

function bicho(id: string, ivs = PERFEITO, level = 40): DefenderInput {
  const sp = data.species.find((s) => s.id === id);
  if (!sp) throw new Error(`especie ausente no dataset: ${id}`);
  return {
    id,
    speciesId: sp.id,
    name: sp.name,
    types: sp.types,
    baseStats: sp.baseStats,
    ivs,
    level,
  };
}

describe("coinMath", () => {
  it("o teto de 50 moedas sao 500 minutos de ginasio", () => {
    expect(coinMath(1).minutesForCap).toBe(500);
    expect(MOEDAS_POR_DIA).toBe(50);
  });

  it("mais ginasios batem o teto mais rapido, na mesma proporcao", () => {
    // A frase que a tela usa pra convencer alguem a espalhar em vez de caprichar
    // num ginasio so. Se a conta estiver errada, o conselho e errado.
    expect(coinMath(1).minutesOfClock).toBe(500);
    expect(coinMath(10).minutesOfClock).toBe(50);
    expect(coinMath(20).minutesOfClock).toBe(25);
  });

  it("seis moedas por hora por ginasio", () => {
    expect(coinMath(1).coinsPerHour).toBe(6);
    expect(coinMath(4).coinsPerHour).toBe(24);
  });

  it("zero ou negativo vira um, e nao divide por zero", () => {
    expect(coinMath(0).minutesOfClock).toBe(500);
    expect(coinMath(-3).minutesOfClock).toBe(500);
  });
});

describe("rankDefenders", () => {
  it("Blissey aguenta mais que qualquer atacante conhecido", () => {
    const lista = rankDefenders(
      [bicho("blissey"), bicho("machamp"), bicho("dragonite"), bicho("tyranitar")],
      cpm,
      chart,
      order,
    );
    expect(lista[0]!.speciesId).toBe("blissey");
  });

  it("ATAQUE nao muda a nota de um defensor", () => {
    // E a afirmacao central da tela: guarde o 100% pra raide, ponha o gordo no
    // ginasio. Se o ataque entrasse na conta, o conselho cairia.
    const semAtaque = rankDefenders([bicho("blissey", { atk: 0, def: 15, hp: 15 })], cpm, chart, order);
    const comAtaque = rankDefenders([bicho("blissey", { atk: 15, def: 15, hp: 15 })], cpm, chart, order);
    expect(semAtaque[0]!.bulk).toBeCloseTo(comAtaque[0]!.bulk, 6);
  });

  it("um Blissey de IV baixo ainda ganha de um Machamp perfeito", () => {
    const lista = rankDefenders(
      [
        bicho("machamp", { atk: 15, def: 15, hp: 15 }),
        bicho("blissey", { atk: 0, def: 5, hp: 5 }),
      ],
      cpm,
      chart,
      order,
    );
    expect(lista[0]!.speciesId).toBe("blissey");
  });

  it("nomeia as fraquezas certas, e Blissey so teme Lutador", () => {
    const [b] = rankDefenders([bicho("blissey")], cpm, chart, order);
    expect(b!.weakTo).toEqual(["fighting"]);
  });

  it("quem resiste a mais coisa tem media de dano recebido abaixo de 1", () => {
    // Steelix e Aco/Terra: uma pilha de resistencias. A media tem que refletir
    // isso, senao a divisao no score nao significa nada.
    const [aco] = rankDefenders([bicho("steelix")], cpm, chart, order);
    expect(aco!.incomingAverage).toBeLessThan(1);
    expect(aco!.resists.length).toBeGreaterThan(aco!.weakTo.length);
  });

  it("o primeiro sempre pontua 100, e ninguem passa disso", () => {
    const lista = rankDefenders(
      [bicho("blissey"), bicho("snorlax"), bicho("chansey")],
      cpm,
      chart,
      order,
    );
    expect(lista[0]!.score).toBeCloseTo(100, 6);
    for (const d of lista) expect(d.score).toBeLessThanOrEqual(100.000001);
  });

  it("nivel maior aguenta mais", () => {
    const baixo = rankDefenders([bicho("blissey", PERFEITO, 20)], cpm, chart, order);
    const alto = rankDefenders([bicho("blissey", PERFEITO, 40)], cpm, chart, order);
    expect(alto[0]!.bulk).toBeGreaterThan(baixo[0]!.bulk);
  });

  it("lista vazia nao explode", () => {
    expect(rankDefenders([], cpm, chart, order)).toEqual([]);
  });
});

describe("pickDefenders", () => {
  it("nao repete tipo primario enquanto houver alternativa", () => {
    // Blissey e Chansey sao as duas melhores paredes do jogo e as duas sao
    // Normal — um Machamp limparia as duas. A regra existe pra isso.
    const ranked = rankDefenders(
      [bicho("blissey"), bicho("chansey"), bicho("steelix"), bicho("umbreon")],
      cpm,
      chart,
      order,
    );
    const escolhidos = pickDefenders(ranked, 3);
    const primarios = escolhidos.map((d) => d.types[0]);
    expect(new Set(primarios).size).toBe(primarios.length);
  });

  it("completa pela nota quando os tipos acabam", () => {
    const ranked = rankDefenders([bicho("blissey"), bicho("chansey")], cpm, chart, order);
    const escolhidos = pickDefenders(ranked, 2);
    expect(escolhidos).toHaveLength(2);
    expect(escolhidos[0]!.speciesId).toBe("blissey");
  });

  it("nunca passa do tamanho pedido nem repete o mesmo bicho", () => {
    const ranked = rankDefenders(
      [bicho("blissey"), bicho("chansey"), bicho("snorlax"), bicho("steelix")],
      cpm,
      chart,
      order,
    );
    const escolhidos = pickDefenders(ranked, 2);
    expect(escolhidos).toHaveLength(2);
    expect(new Set(escolhidos.map((d) => d.id)).size).toBe(2);
  });
});

describe("isObtainable", () => {
  it("Eternamax fica fora, e o resto passa", () => {
    // A tela de ginasio anunciava Eternatus (Eternamax) como o melhor defensor
    // do jogo — 505 de defesa base num bicho que so existe como chefe de
    // Dynamax. A regra estava no core e a tela tinha a propria lista (vazia).
    expect(isObtainable("eternatus_eternamax")).toBe(false);
    expect(isObtainable("blissey")).toBe(true);
    expect(isObtainable("eternatus")).toBe(true);
  });

  it("a lista geral de defensores nao tem forma inobtenivel no topo", () => {
    const reais = data.species
      .filter((s) => isObtainable(s.id))
      .map((s) => bicho(s.id));
    const lista = rankDefenders(reais, cpm, chart, order);
    expect(lista[0]!.speciesId).not.toBe("eternatus_eternamax");
    expect(lista[0]!.speciesId).toBe("blissey");
  });
});
