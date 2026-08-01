import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { allLevels, computeCP, computeCPAtLevel, cpmForLevel, effectiveStamina } from "./cp.js";
import { MAX_LEVEL, MAX_POWERUP_LEVEL, type BaseStats } from "./types.js";

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
  it("cobre do nivel 1 ao teto observavel, e o teto de power-up e 50", () => {
    expect(data.version.levelCap).toBe(MAX_POWERUP_LEVEL);
    expect(MAX_POWERUP_LEVEL).toBe(50);

    // A tabela vai um nivel ALEM do que se compra, por causa do Melhor Amigo.
    expect(cpm).toHaveLength(MAX_LEVEL);
    expect(MAX_LEVEL).toBe(51);
  });

  /*
   * ⚠️ O TESTE QUE TERIA PEGADO O ERRO DE CINCO NIVEIS.
   *
   * O ETL fixava o teto em 55 porque o `cpMultiplier` do GAME_MASTER sobe ate
   * 0.8653. Nenhum teste comparava o PC maximo com o mundo, entao o app anunciou
   * por meses um Mewtwo de 5009 — 6% acima do que o jogo permite.
   *
   * Estes dois numeros sao publicos, estaveis e conferiveis por qualquer pessoa
   * que jogue: sao o PC de um Mewtwo 15/15/15 no nivel 40 e no nivel 50. Ancorar
   * neles amarra a formula, a tabela de CPM E o teto de uma vez so.
   */
  it("o PC maximo de um Mewtwo perfeito bate com o que o jogo publica", () => {
    const mewtwo = data.species.find((s) => s.id === "mewtwo");
    expect(mewtwo, "mewtwo sumiu do dataset").toBeDefined();

    expect(computeCPAtLevel(cpm, mewtwo!.baseStats, PERFECT, 40)).toBe(4178);
    expect(computeCPAtLevel(cpm, mewtwo!.baseStats, PERFECT, MAX_POWERUP_LEVEL)).toBe(4724);
  });

  /*
   * A pista de que 51..55 era invencao, virada em teste.
   *
   * Do nivel 41 pra frente o CPM do GAME_MASTER sobe exatamente 0.005 por
   * nivel — uma reta. A curva real e nao-linear e termina no 40. Se um dia o
   * teto subir de verdade, isto aqui continua passando (a reta continua); o que
   * ele protege e a leitura contraria: enquanto o dataset parar em 50, o valor
   * do teto tem que ser o 0.8403 conhecido, e nao o 0.8653 do fim do padding.
   */
  it("o CPM do teto e o 0.8403 conhecido, nao o fim do padding", () => {
    expect(cpmForLevel(cpm, MAX_POWERUP_LEVEL)).toBeCloseTo(0.8403, 7);
    expect(cpmForLevel(cpm, MAX_LEVEL)).toBeCloseTo(0.8453, 7);
  });

  it("bate com os valores ancora conhecidos do jogo", () => {
    expect(cpmForLevel(cpm, 1)).toBeCloseTo(0.094, 6);
    expect(cpmForLevel(cpm, 15)).toBeCloseTo(0.51739395, 6);
    expect(cpmForLevel(cpm, 20)).toBeCloseTo(0.5974, 6);
    expect(cpmForLevel(cpm, 25)).toBeCloseTo(0.667934, 6);
    expect(cpmForLevel(cpm, 30)).toBeCloseTo(0.7317, 6);
    expect(cpmForLevel(cpm, 40)).toBeCloseTo(0.7903, 6);
    expect(cpmForLevel(cpm, 50)).toBeCloseTo(0.8403, 6);
    // 51 e o Melhor Amigo. Aqui havia uma ancora no nivel 55 com 0.8653 — o
    // valor existe mesmo no GAME_MASTER, e era exatamente essa existencia que
    // fazia o teto errado parecer conferido.
    expect(cpmForLevel(cpm, 51)).toBeCloseTo(0.8453, 6);
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
