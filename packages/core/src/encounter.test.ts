import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { computeCPAtLevel } from "./cp.js";
import { bossCatchRange, type RaidBossInput } from "./counters.js";
import { faixaDePC, lerEncontro, niveisDaOrigem } from "./encounter.js";
import { ivTotal } from "./iv.js";
import { MAX_IV } from "./types.js";

/**
 * O que estes testes protegem.
 *
 * A tela promete uma coisa forte: "com esse PC, o IV so pode ser este". Se a
 * conta derrapar, o app manda gastar bola dourada num bicho errado — e com toda
 * a confianca, que e o pior jeito de errar.
 *
 * A ancora e o `bossCatchRange`, que ja e conferido em `catchRange.test.ts`
 * contra PCs publicos que a comunidade conhece de cabeca desde 2017. Amarrar o
 * modulo novo NELE, em vez de copiar os mesmos numeros pra ca, faz com que
 * qualquer divergencia entre os dois apareça: sao dois caminhos independentes
 * pro mesmo valor.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const DATASET = join(AQUI, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");
const dados = JSON.parse(readFileSync(DATASET, "utf8")) as {
  cpm: number[];
  species: Array<{ id: string; baseStats: { atk: number; def: number; hp: number } }>;
};
const CPM = dados.cpm;

function statsDe(id: string) {
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

const ESPECIES = ["mewtwo", "rayquaza", "groudon", "bulbasaur", "blissey", "shuckle"];

describe("faixa de PC por origem", () => {
  it("a raide bate com o bossCatchRange, que ja e conferido contra valores publicos", () => {
    for (const id of ESPECIES) {
      const base = statsDe(id);
      expect(faixaDePC(base, "raide", CPM)).toEqual(bossCatchRange(chefe(base), CPM).normal);
      expect(faixaDePC(base, "raide", CPM, true)).toEqual(bossCatchRange(chefe(base), CPM).comClima);
    }
  });

  it("ovo sai na mesma faixa da raide — os dois chocam no nivel 20", () => {
    for (const id of ESPECIES) {
      expect(faixaDePC(statsDe(id), "ovo", CPM)).toEqual(faixaDePC(statsDe(id), "raide", CPM));
    }
  });

  it("pesquisa sai mais baixo que raide, porque o nivel e 15 e nao 20", () => {
    for (const id of ESPECIES) {
      const pesquisa = faixaDePC(statsDe(id), "pesquisa", CPM);
      const raide = faixaDePC(statsDe(id), "raide", CPM);
      expect(pesquisa.max).toBeLessThan(raide.min);
    }
  });

  it("o clima nao alcanca ovo nem pesquisa", () => {
    for (const origem of ["ovo", "pesquisa"] as const) {
      expect(faixaDePC(statsDe("mewtwo"), origem, CPM, true)).toEqual(
        faixaDePC(statsDe("mewtwo"), origem, CPM),
      );
      expect(niveisDaOrigem(origem, true)).toEqual(niveisDaOrigem(origem, false));
    }
  });
});

describe("PC no extremo da faixa responde sozinho", () => {
  /*
   * E a promessa central da tela, e a razao de a feature existir: quem derruba
   * uma raide olha UM numero e decide. No topo da faixa a resposta e exata.
   */
  it("nos chefes de raide de verdade, o PC maximo e 15/15/15 e so ele", () => {
    // Estes SAO chefes. A afirmacao "no maximo da faixa e 100%" vale aqui.
    for (const id of ["mewtwo", "rayquaza", "groudon"]) {
      const base = statsDe(id);
      const { max } = faixaDePC(base, "raide", CPM);
      const r = lerEncontro({ base, cp: max, origem: "raide" }, CPM);
      expect(r.exato).toEqual({ atk: MAX_IV, def: MAX_IV, hp: MAX_IV });
      expect(r.totalMin).toBe(45);
    }
  });

  /*
   * ⚠️ E NAO VALE PRA TODA ESPECIE — medido, nao suposto.
   *
   * Varrendo as 2.466 do dataset, o PC maximo identifica o IV sozinho em 2.455
   * (99,6%); nas outras 11 o `floor` da formula junta 15/15/14 com 15/15/15 no
   * mesmo PC. Sao todas de stat baixo — Caterpie, Kakuna, Jigglypuff, Marill —
   * e nenhuma e chefe de raide, mas TODAS chocam em ovo, que usa a mesma conta.
   *
   * O teste existe pra travar o comportamento certo nesse caso: duas
   * combinacoes e `exato: null`. Uma versao que "arredondasse" pra 15/15/15
   * estaria escondendo um resultado possivel.
   */
  it("quando o floor empata dois IV no mesmo PC, sao dois — e exato fica null", () => {
    const base = statsDe("caterpie");
    const { max } = faixaDePC(base, "ovo", CPM);
    const r = lerEncontro({ base, cp: max, origem: "ovo" }, CPM);
    expect(r.ivs).toHaveLength(2);
    expect(r.exato).toBeNull();
    expect(r.ivs).toContainEqual({ atk: 15, def: 15, hp: 15 });
    expect(r.ivs).toContainEqual({ atk: 15, def: 15, hp: 14 });
    expect(r.totalMax).toBe(45);
  });

  it("no minimo da raide o IV e 10/10/10, e so ele", () => {
    for (const id of ["mewtwo", "rayquaza", "groudon"]) {
      const base = statsDe(id);
      const { min } = faixaDePC(base, "raide", CPM);
      const r = lerEncontro({ base, cp: min, origem: "raide" }, CPM);
      expect(r.exato).toEqual({ atk: 10, def: 10, hp: 10 });
    }
  });

  it("um PC fora da faixa e impossivel, e nao um IV qualquer", () => {
    const base = statsDe("mewtwo");
    const { min, max } = faixaDePC(base, "raide", CPM);
    for (const cp of [min - 1, max + 1, 10, 99999]) {
      const r = lerEncontro({ base, cp, origem: "raide" }, CPM);
      expect(r.impossivel).toBe(true);
      expect(r.ivs).toHaveLength(0);
    }
  });
});

describe("toda combinacao possivel e encontravel a partir do proprio PC", () => {
  /*
   * A propriedade que importa, e a unica varredura exaustiva daqui: pra CADA um
   * dos 216 IV que uma raide pode dar, calcular o PC e pedir a volta. Se o
   * solver perder alguma combinacao, o app diria "so pode ser X" escondendo um
   * Y que existe — erro silencioso e caro.
   */
  for (const id of ["mewtwo", "shuckle", "blissey"]) {
    it(`${id}: as 216 combinacoes de raide voltam pelo PC`, () => {
      const base = statsDe(id);
      for (let atk = 10; atk <= MAX_IV; atk++) {
        for (let def = 10; def <= MAX_IV; def++) {
          for (let hp = 10; hp <= MAX_IV; hp++) {
            const ivs = { atk, def, hp };
            const cp = computeCPAtLevel(CPM, base, ivs, 20);
            const r = lerEncontro({ base, cp, origem: "raide" }, CPM);
            expect(r.impossivel).toBe(false);
            expect(r.ivs).toContainEqual(ivs);
            expect(r.totalMin).toBeLessThanOrEqual(ivTotal(ivs));
            expect(r.totalMax).toBeGreaterThanOrEqual(ivTotal(ivs));
          }
        }
      }
    });
  }

  it("nenhum candidato de raide fica abaixo do piso de 10", () => {
    const base = statsDe("mewtwo");
    const { min, max } = faixaDePC(base, "raide", CPM);
    for (let cp = min; cp <= max; cp++) {
      for (const iv of lerEncontro({ base, cp, origem: "raide" }, CPM).ivs) {
        expect(Math.min(iv.atk, iv.def, iv.hp)).toBeGreaterThanOrEqual(10);
      }
    }
  });
});

describe("selvagem: o PC estreita mas nao decide, e a tela precisa saber disso", () => {
  /*
   * O numero que sustenta a frase da tela. Se um dia o selvagem passar a
   * resolver sozinho, este teste quebra e a frase tem que mudar junto.
   */
  it("um PC do meio da faixa deixa dezenas de combinacoes de pe", () => {
    const base = statsDe("bulbasaur");
    // Nivel 15 com IV medio: bem dentro do que qualquer nivel de 1 a 30 alcanca.
    const cp = computeCPAtLevel(CPM, base, { atk: 7, def: 7, hp: 7 }, 15);
    const r = lerEncontro({ base, cp, origem: "selvagem" }, CPM);
    expect(r.combinacoesDaOrigem).toBe(4096);
    expect(r.ivs.length).toBeGreaterThan(50);
    expect(r.exato).toBeNull();
    // Estreitou de verdade — so nao o bastante pra decidir.
    expect(r.totalMax - r.totalMin).toBeLessThan(45);
  });

  it("a raide parte de 216, e nao de 4.096 — e por isso ela responde", () => {
    const base = statsDe("mewtwo");
    const cp = computeCPAtLevel(CPM, base, { atk: 12, def: 13, hp: 11 }, 20);
    const r = lerEncontro({ base, cp, origem: "raide" }, CPM);
    expect(r.combinacoesDaOrigem).toBe(216);
    expect(r.piso).toBe(10);
  });

  it("no teto da faixa ele OBRIGA um IV minimo — e por isso vale oferecer", () => {
    const base = statsDe("bulbasaur");
    // O maior PC que um selvagem sem clima pode ter: nivel 30, 15/15/15.
    const cp = computeCPAtLevel(CPM, base, { atk: 15, def: 15, hp: 15 }, 30);
    const r = lerEncontro({ base, cp, origem: "selvagem" }, CPM);
    expect(r.impossivel).toBe(false);
    expect(r.totalMin).toBe(45);
    expect(r.exato).toEqual({ atk: 15, def: 15, hp: 15 });
  });

  it("com clima o piso sobe pra 4 e o nivel comeca em 6", () => {
    expect(niveisDaOrigem("selvagem", true)[0]).toBe(6);
    expect(niveisDaOrigem("selvagem", true).at(-1)).toBe(35);
    const base = statsDe("bulbasaur");
    const cp = computeCPAtLevel(CPM, base, { atk: 7, def: 7, hp: 7 }, 20);
    const r = lerEncontro({ base, cp, origem: "selvagem", clima: true }, CPM);
    for (const iv of r.ivs) expect(Math.min(iv.atk, iv.def, iv.hp)).toBeGreaterThanOrEqual(4);
  });

  it("a lista nao repete a mesma combinacao uma vez por nivel", () => {
    const base = statsDe("bulbasaur");
    const cp = computeCPAtLevel(CPM, base, { atk: 7, def: 7, hp: 7 }, 15);
    const r = lerEncontro({ base, cp, origem: "selvagem" }, CPM);
    const chaves = new Set(r.ivs.map((i) => `${i.atk}/${i.def}/${i.hp}`));
    expect(chaves.size).toBe(r.ivs.length);
  });
});
