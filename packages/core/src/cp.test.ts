import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { allLevels, computeCP, computeCPAtLevel, cpmForLevel, effectiveStamina } from "./cp.js";
import type { BaseStats } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");

interface Dataset {
  version: { levelCap: number };
  cpm: number[];
  species: Array<{ id: string; name: string; baseStats: BaseStats }>;
}

const data = JSON.parse(readFileSync(DATASET, "utf8")) as Dataset;
const cpm = data.cpm;

function speciesById(id: string): { baseStats: BaseStats } {
  const s = data.species.find((x) => x.id === id);
  if (!s) throw new Error(`especie ausente no dataset: ${id}`);
  return s;
}

const PERFECT = { atk: 15, def: 15, hp: 15 };

describe("tabela de CPM", () => {
  it("cobre exatamente 55 niveis", () => {
    expect(cpm).toHaveLength(55);
    expect(data.version.levelCap).toBe(55);
  });

  it("bate com os valores ancora conhecidos do jogo", () => {
    expect(cpmForLevel(cpm, 1)).toBeCloseTo(0.094, 6);
    expect(cpmForLevel(cpm, 15)).toBeCloseTo(0.51739395, 6);
    expect(cpmForLevel(cpm, 20)).toBeCloseTo(0.5974, 6);
    expect(cpmForLevel(cpm, 25)).toBeCloseTo(0.667934, 6);
    expect(cpmForLevel(cpm, 30)).toBeCloseTo(0.7317, 6);
    expect(cpmForLevel(cpm, 40)).toBeCloseTo(0.7903, 6);
    expect(cpmForLevel(cpm, 50)).toBeCloseTo(0.8403, 6);
    expect(cpmForLevel(cpm, 55)).toBeCloseTo(0.8653, 6);
  });

  it("cresce monotonicamente", () => {
    for (const level of allLevels()) {
      if (level === 1) continue;
      expect(cpmForLevel(cpm, level)).toBeGreaterThan(cpmForLevel(cpm, level - 0.5));
    }
  });

  it("interpola meio nivel pela media quadratica, nao pela aritmetica", () => {
    const a = cpmForLevel(cpm, 30);
    const b = cpmForLevel(cpm, 31);
    const half = cpmForLevel(cpm, 30.5);

    expect(half).toBeCloseTo(Math.sqrt((a * a + b * b) / 2), 9);
    // A diferenca entre as duas medias e pequena mas real: se um dia alguem
    // "simplificar" pra media aritmetica, este teste pega.
    expect(half).not.toBeCloseTo((a + b) / 2, 9);
  });

  it("recusa nivel fora do intervalo", () => {
    expect(() => cpmForLevel(cpm, 0.5)).toThrow(RangeError);
    expect(() => cpmForLevel(cpm, 56)).toThrow(RangeError);
  });
});

describe("formula de PC", () => {
  // Estes sao os PC maximos conhecidos publicamente para nivel 40 com IV
  // perfeito. Se a formula, a tabela de CPM ou os stats base derraparem, estes
  // numeros deixam de bater — e sao a nossa unica amarra com a realidade do
  // jogo, ja que nada aqui e verificavel so por inspecao.
  const KNOWN_MAX_CP_AT_40: ReadonlyArray<readonly [string, number]> = [
    ["machamp", 3056],
    ["dragonite", 3792],
    ["tyranitar", 3834],
    ["rhydon", 3179],
    ["gengar", 2878],
    ["blissey", 2757],
  ];

  for (const [id, expected] of KNOWN_MAX_CP_AT_40) {
    it(`${id} com IV perfeito no nivel 40 da ${expected}`, () => {
      const { baseStats } = speciesById(id);
      expect(computeCPAtLevel(cpm, baseStats, PERFECT, 40)).toBe(expected);
    });
  }

  it("aplica o piso de 10", () => {
    const tiny: BaseStats = { atk: 1, def: 1, hp: 1 };
    expect(computeCP(tiny, { atk: 0, def: 0, hp: 0 }, cpmForLevel(cpm, 1))).toBe(10);
  });

  it("cresce com o nivel", () => {
    const { baseStats } = speciesById("machamp");
    let previous = 0;
    for (const level of allLevels()) {
      const cp = computeCPAtLevel(cpm, baseStats, PERFECT, level);
      expect(cp).toBeGreaterThanOrEqual(previous);
      previous = cp;
    }
  });

  it("cresce com o IV", () => {
    const { baseStats } = speciesById("machamp");
    const low = computeCPAtLevel(cpm, baseStats, { atk: 0, def: 0, hp: 0 }, 40);
    const high = computeCPAtLevel(cpm, baseStats, PERFECT, 40);
    expect(high).toBeGreaterThan(low);
  });
});

describe("PS efetivo", () => {
  it("aplica o piso de 10 que o jogo aplica", () => {
    const frail: BaseStats = { atk: 10, def: 10, hp: 10 };
    expect(effectiveStamina(frail, { atk: 0, def: 0, hp: 0 }, cpmForLevel(cpm, 1))).toBe(10);
  });

  it("e inteiro, sempre", () => {
    const { baseStats } = speciesById("machamp");
    for (const level of allLevels()) {
      const hp = effectiveStamina(baseStats, PERFECT, cpmForLevel(cpm, level));
      expect(Number.isInteger(hp)).toBe(true);
    }
  });
});

describe("integridade do dataset", () => {
  it("tem especies de sobra", () => {
    expect(data.species.length).toBeGreaterThan(1000);
  });

  // Verificacao INDEPENDENTE dos stats base. Tudo o mais neste arquivo confere
  // o dataset contra o mesmo codigo que o consome; isto confere contra uma
  // formula externa. O Pokemon GO deriva a stamina do HP da serie principal por
  //     baseStamina = floor(1.75 * HP + 50)
  // Se o ETL um dia ler o campo errado do GAME_MASTER, este teste pega — os
  // outros nao pegariam, porque continuariam internamente consistentes.
  it("deriva a stamina do HP da serie principal", () => {
    const MAIN_SERIES_HP: ReadonlyArray<readonly [string, number]> = [
      ["machamp", 90],
      ["dragonite", 91],
      ["tyranitar", 100],
      ["rhydon", 105],
      ["gengar", 60],
      ["blissey", 255],
      ["snorlax", 160],
      ["chansey", 250],
    ];

    for (const [id, mainHp] of MAIN_SERIES_HP) {
      const { baseStats } = speciesById(id);
      expect(baseStats.hp, id).toBe(Math.floor(1.75 * mainHp + 50));
    }
  });

  it("nenhuma especie tem stat base zerado", () => {
    for (const s of data.species) {
      expect(s.baseStats.atk, s.id).toBeGreaterThan(0);
      expect(s.baseStats.def, s.id).toBeGreaterThan(0);
      expect(s.baseStats.hp, s.id).toBeGreaterThan(0);
    }
  });
});
