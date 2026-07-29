import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { computeCPAtLevel } from "./cp.js";
import { ivPercent, solveIVs, summarize } from "./iv.js";
import {
  GREAT_LEAGUE,
  MASTER_LEAGUE,
  ULTRA_LEAGUE,
  maxLevelForCap,
  rankIVSpreads,
  rankOf,
  topSpreads,
} from "./pvp.js";
import { equivalentRating } from "./raid.js";
import type { BaseStats, IVs } from "./types.js";
import { MAX_LEVEL } from "./types.js";
import {
  DOUBLE_RESISTED,
  NEUTRAL,
  RESISTED,
  SUPER_EFFECTIVE,
  effectiveness,
} from "./types-chart.js";

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

function base(id: string): BaseStats {
  const s = data.species.find((x) => x.id === id);
  if (!s) throw new Error(`especie ausente: ${id}`);
  return s.baseStats;
}

describe("efetividade de tipo", () => {
  // Esta suite existe para travar a ORDEM do enum de tipos, que nao esta em
  // lugar nenhum do GAME_MASTER e teve de ser fixada no ETL. Se ela derrapar,
  // todo ranking de raide e de PvP fica errado sem dar sinal na tela.
  const eff = (atk: string, def: string[]) => effectiveness(chart, order, atk, def);

  it("tem os 18 tipos na ordem do enum", () => {
    expect(order).toHaveLength(18);
    expect(order[0]).toBe("normal");
    expect(order[17]).toBe("fairy");
  });

  it("acerta confrontos elementares", () => {
    expect(eff("water", ["fire"])).toBeCloseTo(SUPER_EFFECTIVE, 6);
    expect(eff("fire", ["grass"])).toBeCloseTo(SUPER_EFFECTIVE, 6);
    expect(eff("grass", ["water"])).toBeCloseTo(SUPER_EFFECTIVE, 6);
    expect(eff("electric", ["water"])).toBeCloseTo(SUPER_EFFECTIVE, 6);

    expect(eff("fire", ["water"])).toBeCloseTo(RESISTED, 6);
    expect(eff("water", ["grass"])).toBeCloseTo(RESISTED, 6);
    expect(eff("grass", ["fire"])).toBeCloseTo(RESISTED, 6);
  });

  it("acerta confrontos que dependem da posicao no meio do array", () => {
    // Se a ordem estivesse deslocada, estes seriam os primeiros a quebrar.
    expect(eff("fighting", ["normal"])).toBeCloseTo(SUPER_EFFECTIVE, 6);
    expect(eff("ghost", ["psychic"])).toBeCloseTo(SUPER_EFFECTIVE, 6);
    expect(eff("dark", ["ghost"])).toBeCloseTo(SUPER_EFFECTIVE, 6);
    expect(eff("fairy", ["dragon"])).toBeCloseTo(SUPER_EFFECTIVE, 6);
    expect(eff("steel", ["fairy"])).toBeCloseTo(SUPER_EFFECTIVE, 6);
    expect(eff("ground", ["electric"])).toBeCloseTo(SUPER_EFFECTIVE, 6);
  });

  it("multiplica os dois tipos do defensor", () => {
    // Charizard (fogo/voador) tomando pedra: super efetivo nos dois.
    expect(eff("rock", ["fire", "flying"])).toBeCloseTo(SUPER_EFFECTIVE ** 2, 6);
    // Skarmory (aco/voador) tomando eletrico: neutro no aco, super no voador.
    expect(eff("electric", ["steel", "flying"])).toBeCloseTo(SUPER_EFFECTIVE, 6);
  });

  it("usa 0.390625 no lugar de imunidade — o jogo nao zera dano", () => {
    expect(eff("normal", ["ghost"])).toBeCloseTo(DOUBLE_RESISTED, 6);
    expect(eff("ground", ["flying"])).toBeCloseTo(DOUBLE_RESISTED, 6);
    expect(eff("electric", ["ground"])).toBeCloseTo(DOUBLE_RESISTED, 6);
    expect(eff("normal", ["ghost"])).toBeGreaterThan(0);
  });

  it("devolve neutro para tipo desconhecido em vez de quebrar", () => {
    expect(eff("tipo-que-nao-existe", ["fire"])).toBe(NEUTRAL);
    expect(eff("fire", ["tipo-que-nao-existe"])).toBe(NEUTRAL);
  });
});

describe("ranking de PvP", () => {
  it("respeita o teto de PC da liga", () => {
    const azumarill = base("azumarill");
    const spreads = rankIVSpreads(cpm, azumarill, GREAT_LEAGUE);
    for (const s of spreads) expect(s.cp).toBeLessThanOrEqual(1500);
  });

  it("o melhor de IV nao e o melhor de liga — e por isso que o ranking existe", () => {
    // O caso classico: em liga com teto, ataque alto infla o PC e obriga a
    // parar num nivel mais baixo, custando defesa e PS. O 15/15/15 perde.
    const azumarill = base("azumarill");
    const perfect = rankOf(cpm, azumarill, { atk: 15, def: 15, hp: 15 }, GREAT_LEAGUE);
    const lowAttack = rankOf(cpm, azumarill, { atk: 0, def: 15, hp: 15 }, GREAT_LEAGUE);

    expect(perfect).not.toBeNull();
    expect(lowAttack).not.toBeNull();
    expect(lowAttack!.rank).toBeLessThan(perfect!.rank);
    expect(lowAttack!.statProduct).toBeGreaterThan(perfect!.statProduct);
  });

  it("na Master, sem teto, o 100% e o melhor", () => {
    const dragonite = base("dragonite");
    const perfect = rankOf(cpm, dragonite, { atk: 15, def: 15, hp: 15 }, MASTER_LEAGUE);
    expect(perfect?.rank).toBe(1);
    expect(perfect?.percent).toBeCloseTo(1, 9);
  });

  it("ranqueia todas as 4096 combinacoes quando todas cabem", () => {
    const azumarill = base("azumarill");
    expect(rankIVSpreads(cpm, azumarill, GREAT_LEAGUE)).toHaveLength(16 ** 3);
  });

  it("o piso de IV reduz o universo considerado", () => {
    const azumarill = base("azumarill");
    const raidFloor = rankIVSpreads(cpm, azumarill, GREAT_LEAGUE, { floorIV: 10 });
    expect(raidFloor).toHaveLength(6 ** 3);
    for (const s of raidFloor) {
      expect(s.ivs.atk).toBeGreaterThanOrEqual(10);
      expect(s.ivs.def).toBeGreaterThanOrEqual(10);
      expect(s.ivs.hp).toBeGreaterThanOrEqual(10);
    }
  });

  it("rank 1 tem percent 1 e a lista sai ordenada", () => {
    const spreads = rankIVSpreads(cpm, base("medicham"), ULTRA_LEAGUE);
    expect(spreads[0]!.rank).toBe(1);
    expect(spreads[0]!.percent).toBeCloseTo(1, 9);
    for (let i = 1; i < spreads.length; i++) {
      expect(spreads[i]!.statProduct).toBeLessThanOrEqual(spreads[i - 1]!.statProduct);
    }
  });

  it("devolve null so quando nem o nivel 1 cabe", () => {
    // Este caso quase nunca acontece na pratica, e vale registrar por que: no
    // nivel 1 o CPM e 0,094, entao ate o Slaking — o maior ataque base do jogo —
    // fica em 62 de PC, e o Mewtwo em 59. Ou seja, QUALQUER liga real (500 pra
    // cima) cabe todo mundo no nivel 1, e o ranking nunca perde candidato por
    // aqui. So um teto artificialmente baixo dispara o `null`.
    const slaking = base("slaking");
    const perfect = { atk: 15, def: 15, hp: 15 };

    expect(computeCPAtLevel(cpm, slaking, perfect, 1)).toBe(62);
    expect(maxLevelForCap(cpm, slaking, perfect, 500)).not.toBeNull();
    expect(maxLevelForCap(cpm, slaking, perfect, 61)).toBeNull();
  });

  it("a busca binaria da o mesmo nivel que a varredura linear", () => {
    // `maxLevelForCap` foi de varredura linear para busca binaria por causa do
    // custo (4.096 chamadas por liga, uma vez por Pokemon da colecao). A troca
    // so e valida porque o PC cresce junto com o nivel; se algum dia a formula
    // deixar de ser monotona, e este teste que avisa.
    const linear = (b: BaseStats, ivs: IVs, cap: number): number | null => {
      for (let level = MAX_LEVEL; level >= 1; level -= 0.5) {
        if (computeCPAtLevel(cpm, b, ivs, level) <= cap) return level;
      }
      return null;
    };

    for (const nome of ["azumarill", "medicham", "dragonite", "slaking"]) {
      const b = base(nome);
      for (const cap of [500, 1500, 2500]) {
        for (const ivs of [
          { atk: 0, def: 0, hp: 0 },
          { atk: 15, def: 15, hp: 15 },
          { atk: 0, def: 15, hp: 15 },
          { atk: 7, def: 3, hp: 12 },
        ]) {
          expect(maxLevelForCap(cpm, b, ivs, cap)).toBe(linear(b, ivs, cap));
        }
      }
    }
  });

  it("o topo da liga bate com o ranking completo", () => {
    // `topSpreads` pega um atalho pela tabela cacheada; se ele divergir da
    // enumeracao completa, a tela de "melhores IV" mente.
    const azumarill = base("azumarill");
    const completo = rankIVSpreads(cpm, azumarill, GREAT_LEAGUE).slice(0, 10);
    const topo = topSpreads(cpm, azumarill, GREAT_LEAGUE, 10);

    expect(topo).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(topo[i]!.ivs).toEqual(completo[i]!.ivs);
      expect(topo[i]!.level).toBe(completo[i]!.level);
      expect(topo[i]!.cp).toBe(completo[i]!.cp);
      expect(topo[i]!.rank).toBe(i + 1);
      expect(topo[i]!.percent).toBeCloseTo(completo[i]!.percent, 9);
    }
  });

  it("na Master o topo e o 100%, porque nao ha teto pra punir ataque alto", () => {
    const topo = topSpreads(cpm, base("dragonite"), MASTER_LEAGUE, 3);
    expect(topo[0]!.ivs).toEqual({ atk: 15, def: 15, hp: 15 });
    expect(topo[0]!.percent).toBeCloseTo(1, 9);
  });

  it("empate divide a mesma posicao", () => {
    // A versao antiga ordenava e lia o indice, entao dois IV com stat product
    // identico recebiam posicoes diferentes conforme a ordem da ordenacao.
    // Posicao e "quantos sao melhores que voce", e empate nao torna ninguem
    // melhor.
    const azumarill = base("azumarill");
    const spreads = rankIVSpreads(cpm, azumarill, GREAT_LEAGUE);

    const empatados = spreads.filter(
      (s) => s.statProduct === spreads[0]!.statProduct,
    );
    for (const s of empatados) {
      expect(rankOf(cpm, azumarill, s.ivs, GREAT_LEAGUE)!.rank).toBe(1);
    }
  });
});

describe("ER de raide", () => {
  it("aplica ER = DPS^0,75 x TDO^0,25", () => {
    // Amostras publicadas, usadas na pesquisa para validar a formula.
    expect(equivalentRating(30.71, 702)).toBeCloseTo(67.14, 1);
    expect(equivalentRating(29.84, 1128)).toBeCloseTo(73.98, 1);
    expect(equivalentRating(28.33, 1137)).toBeCloseTo(71.31, 1);
    expect(equivalentRating(26.99, 1206)).toBeCloseTo(69.79, 1);
  });

  it("pesa DPS mais que TDO", () => {
    // Mesmo produto, distribuicao diferente: quem tem DPS maior ganha.
    const glassCannon = equivalentRating(40, 500);
    const tank = equivalentRating(20, 1000);
    expect(glassCannon).toBeGreaterThan(tank);
  });

  it("e zero quando nao ha dano ou nao ha sobrevivencia", () => {
    expect(equivalentRating(0, 1000)).toBe(0);
    expect(equivalentRating(30, 0)).toBe(0);
  });
});

describe("solver de IV", () => {
  it("encontra a combinacao que gerou os numeros", () => {
    const machamp = base("machamp");
    const level = 30;
    const ivs = { atk: 14, def: 12, hp: 15 };
    const cp = computeCPAtLevel(cpm, machamp, ivs, level);
    const hp = Math.floor(
      (machamp.hp + ivs.hp) * cpmForLevelForTest(level),
    );

    const found = solveIVs({ base: machamp, cp, hp, levels: [level] }, cpm);
    expect(found.some((c) => c.ivs.atk === 14 && c.ivs.def === 12 && c.ivs.hp === 15)).toBe(true);
  });

  it("marca como impossivel um PC que nenhuma combinacao produz", () => {
    const machamp = base("machamp");
    const result = summarize(solveIVs({ base: machamp, cp: 9999, hp: 50 }, cpm));
    expect(result.impossible).toBe(true);
    expect(result.exact).toBeNull();
  });

  it("a avaliacao estreita o resultado", () => {
    const machamp = base("machamp");
    const ivs = { atk: 15, def: 15, hp: 15 };
    const cp = computeCPAtLevel(cpm, machamp, ivs, 25);
    const hp = Math.floor((machamp.hp + 15) * cpmForLevelForTest(25));

    const semAvaliacao = solveIVs({ base: machamp, cp, hp, levels: [25] }, cpm);
    const comAvaliacao = solveIVs(
      {
        base: machamp,
        cp,
        hp,
        levels: [25],
        appraisal: { totalMin: 45, totalMax: 45, maxStatMin: 15, maxStatMax: 15 },
      },
      cpm,
    );

    expect(comAvaliacao.length).toBeLessThanOrEqual(semAvaliacao.length);
    expect(comAvaliacao.every((c) => c.total === 45)).toBe(true);
  });

  it("calcula a porcentagem do jeito que o jogo mostra", () => {
    expect(ivPercent({ atk: 15, def: 15, hp: 15 })).toBeCloseTo(100, 6);
    expect(ivPercent({ atk: 0, def: 0, hp: 0 })).toBeCloseTo(0, 6);
    expect(ivPercent({ atk: 14, def: 14, hp: 15 })).toBeCloseTo((43 / 45) * 100, 6);
  });

  it("respeita o piso de IV da origem", () => {
    const machamp = base("machamp");
    const ivs = { atk: 15, def: 15, hp: 15 };
    const cp = computeCPAtLevel(cpm, machamp, ivs, 20);
    const hp = Math.floor((machamp.hp + 15) * cpmForLevelForTest(20));

    const found = solveIVs({ base: machamp, cp, hp, levels: [20], floorIV: 10 }, cpm);
    for (const c of found) {
      expect(c.ivs.atk).toBeGreaterThanOrEqual(10);
      expect(c.ivs.def).toBeGreaterThanOrEqual(10);
      expect(c.ivs.hp).toBeGreaterThanOrEqual(10);
    }
  });
});

/** Atalho local — o teste precisa do CPM para montar o PS esperado. */
function cpmForLevelForTest(level: number): number {
  const lower = Math.floor(level);
  const a = cpm[lower - 1]!;
  if (lower === level) return a;
  const b = cpm[lower]!;
  return Math.sqrt((a * a + b * b) / 2);
}
