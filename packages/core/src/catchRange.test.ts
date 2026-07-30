import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { bossCatchRange, type RaidBossInput } from "./counters.js";

/**
 * A faixa de captura, conferida contra valores PUBLICOS.
 *
 * Estes numeros nao sao invencao do app: sao os PCs que a comunidade inteira
 * conhece de cabeca, publicados em todo guia de raide desde 2017. Se a conta
 * daqui divergir de um deles, quem esta errado e o app — e o erro seria do tipo
 * caro, porque a tela promete "no maximo da faixa e 100%".
 *
 * Kyogre e Groudon dao o MESMO PC de propósito: os stats base dos dois sao
 * espelhados, e PC nao distingue ataque de defesa nessa combinacao. Um teste
 * que "corrigisse" isso estaria corrigindo o jogo.
 *
 * Os stats base saem do DATASET, e nao de numeros copiados pra ca — do mesmo
 * jeito que `cp.test.ts` ja faz. Fixar stats na mao passaria a testar a minha
 * digitacao em vez do GAME_MASTER.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const DATASET = join(AQUI, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");
const dados = JSON.parse(readFileSync(DATASET, "utf8")) as {
  cpm: number[];
  species: Array<{ id: string; baseStats: { atk: number; def: number; hp: number } }>;
};
const CPM = dados.cpm;

function statsDe(id: string): { atk: number; def: number; hp: number } {
  const s = dados.species.find((x) => x.id === id);
  if (!s) throw new Error(`${id} sumiu do dataset`);
  return s.baseStats;
}

const chefe = (baseStats: { atk: number; def: number; hp: number }): RaidBossInput => ({
  name: "x",
  types: ["normal"],
  baseStats,
  tier: 5,
  fastMoves: [],
  chargedMoves: [],
});

describe("faixa de captura do chefe", () => {
  const casos = [
    { id: "mewtwo", min: 2294, max: 2387 },
    { id: "rayquaza", min: 2102, max: 2191 },
    { id: "groudon", min: 2260, max: 2351 },
    { id: "kyogre", min: 2260, max: 2351 },
  ];

  for (const c of casos) {
    it(`${c.id} sai entre ${c.min} e ${c.max}`, () => {
      const f = bossCatchRange(chefe(statsDe(c.id)), CPM);
      expect(f.normal.min).toBe(c.min);
      expect(f.normal.max).toBe(c.max);
    });
  }

  it("com clima favoravel a faixa inteira sobe", () => {
    // Nivel 25 em vez de 20. Mewtwo: 2868–2984, tambem publico.
    const f = bossCatchRange(chefe(statsDe("mewtwo")), CPM);
    expect(f.comClima.min).toBe(2868);
    expect(f.comClima.max).toBe(2984);
    expect(f.comClima.min).toBeGreaterThan(f.normal.max);
  });

  it("o maximo e sempre maior que o minimo", () => {
    // Trivial, e existe porque um piso de IV trocado inverteria os dois em
    // silencio e a tela passaria a dizer que o 100% e o PC mais BAIXO.
    for (const c of casos) {
      const f = bossCatchRange(chefe(statsDe(c.id)), CPM);
      expect(f.normal.max).toBeGreaterThan(f.normal.min);
      expect(f.comClima.max).toBeGreaterThan(f.comClima.min);
    }
  });
});
