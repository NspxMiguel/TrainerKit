import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { custoDosMaxAtaques, fazGigantamax, papelNaBatalhaMax, type DadosDynamax } from "./dynamax.js";
import type { BaseStats } from "./types.js";
import { decide } from "./verdict.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");

interface Dataset {
  cpm: number[];
  dynamax?: DadosDynamax;
  species: Array<{ id: string; name: string; baseStats: BaseStats; maxGrupo?: string | null }>;
}

const data = JSON.parse(readFileSync(DATASET, "utf8")) as Dataset;

function especie(id: string) {
  const s = data.species.find((x) => x.id === id);
  if (!s) throw new Error(`especie ausente no dataset: ${id}`);
  return s;
}

describe("dynamax vindo do GAME_MASTER", () => {
  it("o bloco existe e a mecanica esta ligada", () => {
    expect(data.dynamax, "o ETL nao extraiu o bloco BREAD").toBeDefined();
    expect(data.dynamax!.ligado).toBe(true);
    expect(data.dynamax!.nivelMinimo).toBeGreaterThan(0);
  });

  /*
   * A lista de Gigantamax e o unico fato per-especie duro da mecanica inteira.
   * Estas quatro sao conferiveis por qualquer pessoa que jogue, e as duas
   * negativas valem tanto quanto as positivas: a lista e FECHADA, e um app que
   * dissesse "Mewtwo faz Gigantamax" estaria inventando.
   */
  it("a lista de Gigantamax e a do jogo, e nao um palpite", () => {
    expect(fazGigantamax("charizard", data.dynamax)).toBe(true);
    expect(fazGigantamax("snorlax", data.dynamax)).toBe(true);
    expect(fazGigantamax("mewtwo", data.dynamax)).toBe(false);
    expect(fazGigantamax("rattata", data.dynamax)).toBe(false);

    // Forma cosmetica ("_normal") tem que casar com a especie base.
    expect(fazGigantamax("venusaur_normal", data.dynamax)).toBe(true);
  });

  it("o custo dos Max Ataques sai do grupo da especie, e some quando nao ha grupo", () => {
    const custo = custoDosMaxAtaques(especie("charizard").maxGrupo, data.dynamax);
    expect(custo, "charizard sem grupo de custo").not.toBeNull();
    expect(custo!.ataque.doces).toBeGreaterThan(0);

    // Sem grupo, `null` — e nao um custo zerado. Zero e um numero; a tela que
    // mostrasse "0 doces" estaria afirmando algo que ninguem mediu.
    expect(custoDosMaxAtaques(null, data.dynamax)).toBeNull();
    expect(custoDosMaxAtaques("GROUP_1", undefined)).toBeNull();
  });

  it("o papel separa quem bate de quem segura", () => {
    // Deoxys Ataque: 414 de ataque, couro de papel.
    expect(papelNaBatalhaMax({ atk: 414, def: 46, hp: 137 })).toBe("atacante");
    // Blissey: 129 de ataque, 496 de PS.
    expect(papelNaBatalhaMax({ atk: 129, def: 169, hp: 496 })).toBe("guarda");
    expect(papelNaBatalhaMax({ atk: 118, def: 132, hp: 190 })).toBe("equilibrado");
  });
});

describe("o veredito deixou de ignorar a mecanica", () => {
  const base = {
    name: "Snorlax",
    baseStats: especie("snorlax").baseStats,
    ivs: { atk: 10, def: 10, hp: 10 },
    level: 25,
    cpm: data.cpm,
    levelCap: 50,
    evolvesInto: [] as string[],
  };

  it("Gigantamax entra no rastro com o nome da regra", () => {
    const v = decide({ ...base, gigantamax: true });
    expect(v.signals.map((s) => s.rule)).toContain("dynamax.gigantamax");
    expect(v.signals.find((s) => s.rule === "dynamax.gigantamax")!.towards).toBe("guardar");
  });

  it("sem a marca, nada muda — quem nao passar o campo continua como antes", () => {
    const antes = decide(base);
    expect(antes.signals.map((s) => s.rule)).not.toContain("dynamax.gigantamax");
  });

  /*
   * ⚠️ O LIMITE DA REGRA, e ele e de proposito.
   *
   * Gigantamax e da ESPECIE. Ela nao pode salvar um individuo ruim da
   * transferencia — senao o app viraria "guarde tudo que for Charizard", que e
   * o oposto de decidir. Peso 0.7 contra o 0.8 do `iv.fraco`: o IV ruim
   * continua vencendo, e o Gigantamax continua aparecendo no rastro pra pessoa
   * saber o que esta soltando.
   */
  it("nao transforma um IV ruim em Pokemon bom", () => {
    const ruim = decide({ ...base, ivs: { atk: 2, def: 3, hp: 4 }, gigantamax: true });
    expect(ruim.action).toBe("transferir");
    expect(ruim.signals.map((s) => s.rule)).toContain("dynamax.gigantamax");
  });
});
