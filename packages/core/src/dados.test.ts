import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { computeCPAtLevel } from "./cp.js";
import { rankDefenders } from "./gym.js";
import { isObtainable } from "./rankings.js";
import { MAX_LEVEL, MAX_POWERUP_LEVEL } from "./types.js";
import {
  DOUBLE_RESISTED,
  NEUTRAL,
  RESISTED,
  SUPER_EFFECTIVE,
  effectiveness,
} from "./types-chart.js";
import type { BaseStats } from "./types.js";

/**
 * Auditoria dos dados que o app AFIRMA.
 *
 * "verifica se todos os dados estao corretos por favor."
 *
 * A pergunta e justa e tem historia: nesta semana eu inventei o tamanho de um
 * download (879 MB pra 1,7 GB), inventei o aguento do Blissey (5.100.000 pra
 * 58.602) e inventei um modelo de visao que nao existe. Nenhum dos tres tinha
 * teste. Todo numero que apareceu nas telas novas passa a ter uma amarra aqui.
 *
 * O CRITERIO: cada valor e conferido contra algo VERIFICAVEL FORA deste
 * repositorio — PC maximo publicado pela comunidade, altura e peso da ficha
 * oficial, constantes da tabela de tipos do jogo. Teste que so compara o codigo
 * com ele mesmo nao prova nada.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");

interface Especie {
  id: string;
  name: string;
  dex: number;
  types: string[];
  baseStats: BaseStats;
  heightDm?: number | null;
  weightHg?: number | null;
  cosmeticOf: string | null;
  evolvesInto: string[];
  candyToEvolve: Record<string, number>;
}

interface Dataset {
  cpm: number[];
  typeOrder: string[];
  typeChart: Record<string, number[]>;
  species: Especie[];
  version: { levelCap: number; observableLevelCap: number };
}

const data = JSON.parse(readFileSync(DATASET, "utf8")) as Dataset;
const { cpm, typeChart: chart, typeOrder: order } = data;
const PERFEITO = { atk: 15, def: 15, hp: 15 };

function especie(id: string): Especie {
  const s = data.species.find((x) => x.id === id);
  if (!s) throw new Error(`especie ausente: ${id}`);
  return s;
}

describe("PC maximo, contra valores publicados", () => {
  /*
   * Ancoras adicionais as que `cp.test.ts` ja tinha.
   *
   * Escolhidas nos extremos de propósito: Slaking e o maior PC do jogo entre os
   * comuns, Shedinja tem 1 de vida (o piso do calculo), e Chansey e o oposto de
   * Slaking. Se a tabela de CPM ou a formula derraparem, os extremos denunciam
   * antes da media.
   */
  const ANCORAS: ReadonlyArray<readonly [string, number]> = [
    ["slaking", 4431],
    ["mewtwo", 4178],
    ["snorlax", 3225],
    ["gyarados", 3391],
    ["charizard", 2889],
    // 1255, nao 675. Eu escrevi 675 de cabeça e o dataset me corrigiu: com base
    // 60/128/487, a formula da 1255 no nivel 40 — conferido na mao.
    ["chansey", 1255],
  ];

  for (const [id, esperado] of ANCORAS) {
    it(`${id} no nivel 40 com IV perfeito da ${esperado}`, () => {
      expect(computeCPAtLevel(cpm, especie(id).baseStats, PERFEITO, 40)).toBe(esperado);
    });
  }
});

describe("tabela de tipos", () => {
  it("usa as constantes do Pokemon GO, nao as da serie principal", () => {
    // 1.6 e 0.625, nao 2 e 0.5. Errar isto mudaria TODO ranking de raide, todo
    // counter e a tela de ginasio inteira, sem quebrar nada visivelmente.
    expect(SUPER_EFFECTIVE).toBeCloseTo(1.6, 6);
    expect(RESISTED).toBeCloseTo(0.625, 6);
    expect(DOUBLE_RESISTED).toBeCloseTo(0.625 * 0.625, 6);
    expect(NEUTRAL).toBe(1);
  });

  it("os confrontos que todo jogador sabe de cor batem", () => {
    expect(effectiveness(chart, order, "water", ["fire"])).toBeCloseTo(SUPER_EFFECTIVE, 6);
    expect(effectiveness(chart, order, "fire", ["water"])).toBeCloseTo(RESISTED, 6);
    expect(effectiveness(chart, order, "fighting", ["normal"])).toBeCloseTo(SUPER_EFFECTIVE, 6);

    /*
     * NAO EXISTE IMUNIDADE no Pokemon GO.
     *
     * Eu escrevi este teste esperando zero em Eletrico contra Terrestre, do jeito
     * que funciona na serie principal, e o dataset me corrigiu com 0.390625. Esta
     * certo: o GO converteu todas as imunidades em DUPLA RESISTENCIA. Um
     * Pikachu ainda arranha um Golem.
     *
     * Vale mais como documentacao que como teste — e a diferenca que faz alguem
     * conferir a conta do app contra a wiki da serie e achar que ha um erro.
     */
    expect(effectiveness(chart, order, "electric", ["ground"])).toBeCloseTo(DOUBLE_RESISTED, 6);
    expect(effectiveness(chart, order, "ghost", ["normal"])).toBeCloseTo(DOUBLE_RESISTED, 6);
    expect(effectiveness(chart, order, "normal", ["ghost"])).toBeCloseTo(DOUBLE_RESISTED, 6);
    // Duplo: Pedra bate 1.6 no Fogo E 1.6 no Voador.
    expect(effectiveness(chart, order, "rock", ["fire", "flying"])).toBeCloseTo(
      SUPER_EFFECTIVE ** 2,
      6,
    );
    // Dupla resistencia: Lutador contra Fantasma/Sombrio? Nao — contra Voador/Psiquico.
    expect(effectiveness(chart, order, "fighting", ["flying", "psychic"])).toBeCloseTo(
      RESISTED ** 2,
      6,
    );
  });

  it("toda linha da tabela tem uma entrada por tipo", () => {
    for (const [tipo, linha] of Object.entries(chart)) {
      expect(linha.length, `linha de ${tipo}`).toBe(order.length);
    }
    expect(Object.keys(chart).length).toBe(order.length);
  });
});

describe("altura e peso", () => {
  /*
   * Da ficha oficial, e sao os numeros que a Pokedex fala.
   *
   * O ETL guarda em decimetros e hectogramas (como o jogo), e a tela divide por
   * dez. Errar a unidade daria "17 metros de altura" sem quebrar nada.
   */
  const MEDIDAS: ReadonlyArray<readonly [string, number, number]> = [
    ["charizard", 17, 905],
    ["machamp", 16, 1300],
    ["pikachu", 4, 60],
    ["onix", 88, 2100],
    ["wailord", 145, 3980],
  ];

  for (const [id, dm, hg] of MEDIDAS) {
    it(`${id} tem ${dm / 10} m e ${hg / 10} kg`, () => {
      const s = especie(id);
      expect(s.heightDm).toBe(dm);
      expect(s.weightHg).toBe(hg);
    });
  }

  it("a grande maioria das especies tem medida", () => {
    const reais = data.species.filter((s) => s.cosmeticOf === null);
    const com = reais.filter((s) => s.heightDm != null && s.weightHg != null);
    expect(com.length / reais.length).toBeGreaterThan(0.95);
  });

  it("nenhuma medida e absurda", () => {
    for (const s of data.species) {
      if (s.heightDm == null || s.weightHg == null) continue;
      /*
       * O limite e 100 m por causa de UM bicho, e ele e real.
       *
       * Eu tinha posto 30 m como teto ("nada passa disso") e o dataset me
       * corrigiu de novo: Eternatus Eternamax tem 1.000 decimetros — cem metros
       * — e esse numero e canonico. A forma nao e pegavel, mas a medida esta
       * certa, entao o teste sobe o teto em vez de acusar o dado.
       */
      expect(s.heightDm, `${s.id} altura`).toBeGreaterThan(0);
      expect(s.heightDm, `${s.id} altura`).toBeLessThanOrEqual(1000);
      expect(s.weightHg, `${s.id} peso`).toBeGreaterThan(0);
      expect(s.weightHg, `${s.id} peso`).toBeLessThan(100_000);
    }
  });
});

describe("aguento de ginasio", () => {
  /*
   * O numero que eu inventei uma vez.
   *
   * Escrevi "Blissey tem aguento perto de 5.100.000" de cabeça, num contexto que
   * ia pra IA, e ela concluiu errado em cima disso. O valor real, pela formula:
   * defesa efetiva x vida efetiva no nivel 40 com IV perfeito.
   *
   *   defesa = (128 + 15) x 0.7903 = 113,0 ... e a base de Blissey e 128
   *   vida   = floor((496 + 15) x 0.7903) = 403
   *
   * Este teste trava a ORDEM DE GRANDEZA, que foi o que eu errei: dezenas de
   * milhares, nao milhoes.
   */
  function aguento(id: string): number {
    const s = especie(id);
    const [d] = rankDefenders(
      [
        {
          id: s.id,
          speciesId: s.id,
          name: s.name,
          types: s.types,
          baseStats: s.baseStats,
          ivs: PERFEITO,
          level: 40,
        },
      ],
      cpm,
      chart,
      order,
    );
    return d!.bulk;
  }

  it("Blissey fica na casa das dezenas de milhares, nao dos milhoes", () => {
    const b = aguento("blissey");
    expect(b).toBeGreaterThan(50_000);
    expect(b).toBeLessThan(70_000);
  });

  it("Blissey aguenta mais que Chansey, que aguenta mais que Dragonite", () => {
    expect(aguento("blissey")).toBeGreaterThan(aguento("chansey"));
    expect(aguento("chansey")).toBeGreaterThan(aguento("dragonite"));
  });

  it("Dragonite fica entre 40% e 60% do Blissey", () => {
    // A frase que a Pokedex fala hoje: "51% do aguento do Blissey". Se a conta
    // mudar, esta faixa denuncia antes de a tela mentir.
    const razao = aguento("dragonite") / aguento("blissey");
    expect(razao).toBeGreaterThan(0.4);
    expect(razao).toBeLessThan(0.6);
  });
});

describe("integridade do dataset", () => {
  it("o teto de nivel do dataset e o mesmo que as telas anunciam", () => {
    // O teto de power-up e o do core; a tabela vai um nivel alem por causa do
    // Melhor Amigo. Ver a nota em `types.ts` — sao dois numeros, nao um.
    expect(data.version.levelCap).toBe(MAX_POWERUP_LEVEL);
    expect(cpm.length).toBe(MAX_LEVEL);
    expect(data.version.observableLevelCap).toBe(MAX_LEVEL);
  });

  it("nenhuma especie real fica sem nome, tipo ou stat", () => {
    for (const s of data.species) {
      expect(s.name.trim(), s.id).not.toBe("");
      expect(s.types.length, s.id).toBeGreaterThan(0);
      expect(s.types.length, s.id).toBeLessThanOrEqual(2);
      for (const t of s.types) expect(order, `${s.id} tipo ${t}`).toContain(t);
      expect(s.baseStats.atk, s.id).toBeGreaterThan(0);
      expect(s.baseStats.def, s.id).toBeGreaterThan(0);
      expect(s.baseStats.hp, s.id).toBeGreaterThan(0);
    }
  });

  it("nao ha numero de Pokedex negativo nem duplicidade de id", () => {
    const ids = new Set<string>();
    for (const s of data.species) {
      expect(s.dex, s.id).toBeGreaterThan(0);
      expect(ids.has(s.id), `id repetido: ${s.id}`).toBe(false);
      ids.add(s.id);
    }
  });

  it("a forma inobtenivel nao lidera nenhuma lista", () => {
    // Eternamax tem 505 de defesa base e ja apareceu como "melhor defensor do
    // jogo" numa tela minha.
    expect(isObtainable("eternatus_eternamax")).toBe(false);
    const eternamax = data.species.find((s) => s.id === "eternatus_eternamax");
    if (eternamax) expect(eternamax.baseStats.def).toBeGreaterThan(400);
  });
});

/*
 * ⚠️ A LINHA DE EVOLUCAO NAO PODE APONTAR PRA FORMA COSMETICA.
 *
 * O GAME_MASTER cita a FORMA no `evolutionBranch`, nao a especie: cru, o
 * `ivysaur.evolvesInto` sai como `["venusaur_normal"]`. E dai que saiam os ids
 * cosmeticos na colecao de quem usa o app — evoluir grava `evolvesInto[0]`,
 * entao quem evoluiu um Ivysaur ficava com um `venusaur_normal` guardado, e a
 * ficha aberta pela Pokedex (que navega `venusaur`) nao reconhecia o proprio
 * Pokemon da pessoa.
 *
 * O ETL reescreve isso pro canonico. Este teste e a torneira: se alguem mexer
 * ali e a reescrita sumir, o defeito volta em silencio, uma evolucao por vez.
 */
describe("linha de evolucao", () => {
  const cosmeticas = new Set(
    data.species.filter((s) => s.cosmeticOf !== null).map((s) => s.id),
  );
  const porId = new Map(data.species.map((s) => [s.id, s]));

  it("ninguem evolui PARA uma forma cosmetica", () => {
    for (const s of data.species) {
      for (const alvo of s.evolvesInto) {
        expect(cosmeticas.has(alvo), `${s.id} evolui pra ${alvo}, que e cosmetica`).toBe(false);
      }
    }
  });

  it("o custo em doce usa a mesma chave que o alvo da evolucao", () => {
    for (const s of data.species) {
      for (const alvo of s.evolvesInto) {
        // Uma chave que nao case com o alvo faz a tela mostrar "evoluir" sem
        // custo, ou pior, cobrar o doce de outra especie.
        if (Object.keys(s.candyToEvolve).length === 0) continue;
        expect(
          Object.prototype.hasOwnProperty.call(s.candyToEvolve, alvo),
          `${s.id}: doce sem entrada pra ${alvo}`,
        ).toBe(true);
      }
    }
  });

  it("todo alvo de evolucao existe no dataset", () => {
    for (const s of data.species) {
      for (const alvo of s.evolvesInto) {
        expect(porId.has(alvo), `${s.id} evolui pra ${alvo}, que nao existe`).toBe(true);
      }
    }
  });
});
