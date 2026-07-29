import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { decide, formatTrace } from "./verdict.js";
import type { BaseStats } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");

interface Species {
  id: string;
  name: string;
  baseStats: BaseStats;
  evolvesInto: string[];
  candyToEvolve: Record<string, number>;
}

const data = JSON.parse(readFileSync(DATASET, "utf8")) as {
  cpm: number[];
  species: Species[];
  version: { levelCap: number };
};

function species(id: string): Species {
  const s = data.species.find((x) => x.id === id);
  if (!s) throw new Error(`especie ausente: ${id}`);
  return s;
}

function base(id: string, ivs: { atk: number; def: number; hp: number }, extra = {}) {
  const s = species(id);
  return decide({
    name: s.name,
    baseStats: s.baseStats,
    ivs,
    level: 20,
    cpm: data.cpm,
    levelCap: data.version.levelCap,
    evolvesInto: s.evolvesInto,
    candyToEvolve: s.evolvesInto[0] ? (s.candyToEvolve[s.evolvesInto[0]] ?? null) : null,
    ...extra,
  });
}

describe("motor de veredito", () => {
  it("manda evoluir quem ainda evolui", () => {
    // Nao adianta recomendar investir num Machoke: o que importa e o Machamp.
    expect(base("machoke", { atk: 15, def: 15, hp: 15 }).action).toBe("evoluir");
  });

  it("manda transferir IV fraco de especie fraca", () => {
    expect(base("rattata", { atk: 0, def: 1, hp: 2 }).action).toBe("transferir");
  });

  it("nao manda transferir shadow, mesmo com IV baixo", () => {
    // Shadow ganha 20% de ataque: um shadow medio bate mais que um normal alto.
    const v = base("rattata", { atk: 0, def: 1, hp: 2 }, { shadow: true });
    expect(v.action).not.toBe("transferir");
    expect(v.signals.some((s) => s.rule === "shadow.bonus")).toBe(true);
  });

  it("o Azumarill 0/15/15 vira investir pelo rank de PvP", () => {
    const v = base("azumarill", { atk: 0, def: 15, hp: 15 });
    expect(v.action).toBe("investir");
    expect(v.reason.key).toBe("verdict.pvp.top");
  });

  it("evolui o mediano, mas transfere o lixo — mesmo evoluivel", () => {
    // Precedencia de evolucao nao pode ser absoluta: ninguem gasta doce
    // evoluindo um Rattata de 3%.
    expect(base("rattata", { atk: 0, def: 0, hp: 0 }).action).toBe("transferir");
    expect(base("machoke", { atk: 10, def: 10, hp: 10 }).action).toBe("evoluir");
  });

  it("a confianca cai quando as regras discordam", () => {
    // Um caso com um sinal so contra um com varios sinais divididos.
    const umSinal = base("blissey", { atk: 10, def: 10, hp: 10 });
    const varios = base("azumarill", { atk: 0, def: 15, hp: 15 });
    expect(umSinal.confidence).toBeGreaterThanOrEqual(varios.confidence);
  });

  it("sempre devolve motivo e ao menos um sinal", () => {
    for (const id of ["machamp", "blissey", "magikarp", "mewtwo", "smeargle"]) {
      const v = base(id, { atk: 10, def: 10, hp: 10 });
      expect(v.reason.key.length).toBeGreaterThan(0);
      expect(v.signals.length).toBeGreaterThan(0);
      expect(v.confidence).toBeGreaterThan(0);
      expect(v.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("o rastro sai no formato do prototipo", () => {
    const v = base("machamp", { atk: 15, def: 15, hp: 15 });
    const trace = formatTrace("machamp", v);
    expect(trace).toMatch(/^decide\(machamp\)/);
    expect(trace).toMatch(/veredito/);
    for (const s of v.signals) expect(trace).toContain(s.rule);
  });
});
