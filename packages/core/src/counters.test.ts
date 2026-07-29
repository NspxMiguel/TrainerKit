import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  RAID_TIERS,
  bossCP,
  estimateRaid,
  rankCounters,
  type CounterInput,
  type RaidBossInput,
} from "./counters.js";
import type { Move } from "./raid.js";
import type { BaseStats } from "./types.js";
import type { TypeChart, TypeOrder } from "./types-chart.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");

interface Dataset {
  cpm: number[];
  typeOrder: TypeOrder;
  typeChart: TypeChart;
  species: Array<{
    id: string;
    name: string;
    types: string[];
    baseStats: BaseStats;
    fastMoves: string[];
    chargedMoves: string[];
  }>;
  fastMoves: Move[];
  chargedMoves: Move[];
  settings: { battle: Parameters<typeof rankCounters>[5] };
}

const data = JSON.parse(readFileSync(DATASET, "utf8")) as Dataset;
const settings = data.settings.battle;

const species = (id: string) => {
  const s = data.species.find((x) => x.id === id);
  if (!s) throw new Error(`especie ausente: ${id}`);
  return s;
};
const move = (id: string): Move => {
  const m = [...data.fastMoves, ...data.chargedMoves].find((x) => x.id === id);
  if (!m) throw new Error(`golpe ausente: ${id}`);
  return m;
};

function boss(id: string, tier: RaidBossInput["tier"]): RaidBossInput {
  const s = species(id);
  return {
    name: s.name,
    types: s.types,
    baseStats: s.baseStats,
    tier,
    fastMoves: s.fastMoves.map(move),
    chargedMoves: s.chargedMoves.map(move),
  };
}

describe("PC do chefe", () => {
  /**
   * Esta e a ancora dos numeros de vida por tier.
   *
   * A vida do chefe NAO esta no GAME_MASTER — e client-side, como os limiares
   * da avaliacao. Mas a formula de PC publicada usa a vida do tier, entao se a
   * vida estiver errada o PC nao fecha com o que o jogo mostra. Ou seja: este
   * teste valida indiretamente uma constante que nao tem fonte primaria.
   */
  it("reproduz o PC que o jogo mostra nos chefes conhecidos", () => {
    // Valores exibidos no jogo, conferidos contra listas publicas.
    //
    // O do Machamp eu escrevi errado de memoria na primeira versao (21.473) e
    // o teste acusou. Conferido: 19.707 e o valor real. Vale registrar porque
    // a tentacao, quando um teste falha, e mexer no codigo — e aqui o codigo
    // estava certo, junto com a vida de 3.600 do tier 3.
    expect(bossCP(boss("mewtwo", 5))).toBeCloseTo(54148, -2);
    expect(bossCP(boss("machamp", 3))).toBeCloseTo(19707, -2);
  });

  it("a vida do tier 5 e maior que a do tier 3, e a do 3 maior que a do 1", () => {
    expect(RAID_TIERS[5].hp).toBeGreaterThan(RAID_TIERS[3].hp);
    expect(RAID_TIERS[3].hp).toBeGreaterThan(RAID_TIERS[1].hp);
    // Tier 5 dura mais que os menores: 300s contra 180s.
    expect(RAID_TIERS[5].seconds).toBeGreaterThan(RAID_TIERS[3].seconds);
  });
});

describe("counters da colecao", () => {
  const mewtwo = boss("mewtwo", 5);

  const owned = (id: string, speciesId: string, fast: string, charged: string): CounterInput => {
    const s = species(speciesId);
    return {
      id,
      name: s.name,
      speciesId,
      types: s.types,
      baseStats: s.baseStats,
      ivs: { atk: 15, def: 15, hp: 15 },
      level: 40,
      fast: move(fast),
      charged: move(charged),
    };
  };

  it("poe o counter certo na frente do errado", () => {
    // Mewtwo e psiquico: Tyranitar (sombrio) resiste ao ataque dele e bate
    // super efetivo. Um Machamp de lutador toma dano neutro e nao resiste.
    const ranked = rankCounters(
      [
        owned("a", "machamp", "counter_fast", "dynamic_punch"),
        owned("b", "tyranitar", "bite_fast", "crunch"),
      ],
      mewtwo,
      data.cpm,
      data.typeChart,
      data.typeOrder,
      settings,
    );
    expect(ranked[0]!.speciesId).toBe("tyranitar");
  });

  it("sai ordenado por ER, e todo counter tem numero", () => {
    const ranked = rankCounters(
      [
        owned("a", "tyranitar", "bite_fast", "crunch"),
        owned("b", "machamp", "counter_fast", "dynamic_punch"),
        owned("c", "gyarados", "dragon_tail_fast", "crunch"),
      ],
      mewtwo,
      data.cpm,
      data.typeChart,
      data.typeOrder,
      settings,
    );
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i]!.er).toBeLessThanOrEqual(ranked[i - 1]!.er);
    }
    for (const c of ranked) {
      expect(c.dps).toBeGreaterThan(0);
      expect(c.tdo).toBeGreaterThan(0);
      expect(c.survivalSeconds).toBeGreaterThan(0);
    }
  });
});

describe("da pra solar?", () => {
  const mewtwo = boss("mewtwo", 5);
  const magikarp = boss("magikarp", 1);

  const team = (speciesId: string, fast: string, charged: string, n: number): CounterInput[] =>
    Array.from({ length: n }, (_, i) => {
      const s = species(speciesId);
      return {
        id: `${speciesId}-${i}`,
        name: s.name,
        speciesId,
        types: s.types,
        baseStats: s.baseStats,
        ivs: { atk: 15, def: 15, hp: 15 },
        level: 40,
        fast: move(fast),
        charged: move(charged),
      };
    });

  const rank = (t: CounterInput[], b: RaidBossInput) =>
    rankCounters(t, b, data.cpm, data.typeChart, data.typeOrder, settings);

  it("seis Tyranitar nao solam um Mewtwo tier 5", () => {
    // O caso que interessa: um time BOM ainda assim nao da conta sozinho de um
    // lendario. Se este teste passar a dizer que da, o modelo quebrou.
    const e = estimateRaid(rank(team("tyranitar", "bite_fast", "crunch", 6), mewtwo), mewtwo);
    expect(e.canSolo).toBe(false);
    expect(e.trainers).toBeGreaterThan(1);
  });

  it("um Tyranitar sola um Magikarp tier 1", () => {
    const e = estimateRaid(rank(team("tyranitar", "bite_fast", "crunch", 1), magikarp), magikarp);
    expect(e.canSolo).toBe(true);
    expect(e.trainers).toBe(1);
  });

  it("defesa alta aguenta mais que defesa baixa contra o mesmo chefe", () => {
    // Regressao de um bug que so apareceu na tela: `bossDpsAgainst` embutia a
    // defesa do atacante E o `computeRaidPerformance` reescalava por ela de
    // novo, contando defesa duas vezes.
    //
    // A comparacao e a MESMA especie em dois niveis, de proposito. A primeira
    // versao comparava Bastiodon com Gyarados e falhava — mas falhava CERTO:
    // Bastiodon e Aco/Pedra e o Mewtwo tem Focus Blast, que bate nele em 4x.
    // Com especies diferentes o tipo domina o resultado e o teste nao mede o
    // que diz medir.
    const at = (level: number): CounterInput => {
      const sp = species("tyranitar");
      return {
        id: `lv${level}`,
        name: sp.name,
        speciesId: "tyranitar",
        types: sp.types,
        baseStats: sp.baseStats,
        ivs: { atk: 15, def: 15, hp: 15 },
        level,
        fast: move("bite_fast"),
        charged: move("crunch"),
      };
    };

    const [forte] = rank([at(40)], mewtwo);
    const [fraco] = rank([at(20)], mewtwo);
    expect(forte!.survivalSeconds).toBeGreaterThan(fraco!.survivalSeconds);

    // E a sobrevivencia tem que ser plausivel, nao 2,5 segundos: numa raide de
    // 300s um bom counter aguenta dezenas de segundos.
    expect(forte!.survivalSeconds).toBeGreaterThan(10);
  });

  it("bate com o que se sabe da pratica", () => {
    /**
     * Calibracao contra respostas conhecidas da comunidade.
     *
     * Foi este conjunto que mostrou o modelo errado: a primeira versao exigia
     * que o dano total do time antes de cair inteiro cobrisse a vida do chefe,
     * e com isso seis Alakazam de nivel 40 "nao solavam" um Machamp tier 3 —
     * que se sola tranquilo. Numa raide voce revive e volta; o aguente nao e um
     * teto de dano.
     */
    const six = (id: string, f: string, c: string) => team(id, f, c, 6);
    const machamp = boss("machamp", 3);
    const mewtwo5 = boss("mewtwo", 5);

    // Psiquico contra lutador: o counter de manual, e sola.
    expect(estimateRaid(rank(six("alakazam", "confusion_fast", "psychic"), machamp), machamp).canSolo).toBe(true);

    // Tyranitar e Pedra/Sombrio: 4x fraco a lutador, e sombrio e resistido por
    // lutador. Pior matchup possivel — nao sola nem sendo forte.
    expect(estimateRaid(rank(six("tyranitar", "bite_fast", "crunch"), machamp), machamp).canSolo).toBe(false);

    // Mewtwo tier 5 com bons counters: duas a tres pessoas, nao uma nem vinte.
    const comGengar = estimateRaid(rank(six("gengar", "shadow_claw_fast", "shadow_ball"), mewtwo5), mewtwo5);
    expect(comGengar.trainers).toBeGreaterThanOrEqual(2);
    expect(comGengar.trainers).toBeLessThanOrEqual(4);
  });

  it("time vazio nao inventa resposta", () => {
    const e = estimateRaid([], mewtwo);
    expect(e.canSolo).toBe(false);
    expect(e.teamDps).toBe(0);
  });

  it("o DPS do time e o do melhor, nao a soma dos seis", () => {
    // Numa raide voce luta com UM por vez; os outros cinco sao reserva. Somar
    // os seis daria um numero seis vezes otimista — e o erro classico.
    const ranked = rank(team("tyranitar", "bite_fast", "crunch", 6), mewtwo);
    const e = estimateRaid(ranked, mewtwo);
    expect(e.teamDps).toBeCloseTo(ranked[0]!.dps, 6);
    // O aguente, ao contrario, SOMA: cada um entrega o dano dele antes de cair.
    expect(e.teamTdo).toBeCloseTo(
      ranked.slice(0, 6).reduce((s, c) => s + c.tdo, 0),
      6,
    );
  });
});
