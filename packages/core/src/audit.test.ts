import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { opine } from "./assistant.js";
import { computeCPAtLevel } from "./cp.js";
import { rankMovesets, type MoveWithPvp } from "./moves.js";
import { GREAT_LEAGUE, MASTER_LEAGUE, ULTRA_LEAGUE, rankIVSpreads } from "./pvp.js";
import type { BaseStats } from "./types.js";

/**
 * Auditoria: roda o codigo de verdade em TODAS as especies.
 *
 * Os outros testes conferem casos escolhidos a dedo — Machamp, Azumarill,
 * Dragonite. Isso pega erro de formula, mas nao pega o erro que so aparece na
 * especie estranha: a que nao tem ataque, a que tem stat base absurdo, a que
 * so existe numa forma. Sao 1.182; nenhuma pode quebrar o app.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");

interface Species {
  id: string;
  dex: number;
  name: string;
  types: string[];
  baseStats: BaseStats;
  fastMoves: string[];
  chargedMoves: string[];
  eliteFastMoves: string[];
  eliteChargedMoves: string[];
  cosmeticOf: string | null;
}

interface Dataset {
  cpm: number[];
  typeOrder: string[];
  typeChart: Record<string, number[]>;
  species: Species[];
  fastMoves: MoveWithPvp[];
  chargedMoves: MoveWithPvp[];
  version: { levelCap: number };
}

const data = JSON.parse(readFileSync(DATASET, "utf8")) as Dataset;
const real = data.species.filter((s) => s.cosmeticOf === null);
const byId = new Map<string, MoveWithPvp>(
  [...data.fastMoves, ...data.chargedMoves].map((m) => [m.id, m]),
);

const PERFECT = { atk: 15, def: 15, hp: 15 };

describe("auditoria de todas as especies", () => {
  it("tem a quantidade esperada", () => {
    expect(real.length).toBeGreaterThan(1100);
  });

  it("nenhuma produz PC invalido", () => {
    const ruins: string[] = [];
    for (const s of real) {
      for (const level of [1, 20, 40, data.version.levelCap]) {
        const cp = computeCPAtLevel(data.cpm, s.baseStats, PERFECT, level);
        // O teto e 10.000, nao 6.000 como eu tinha chutado.
        //
        // Eternatus Eternamax existe no GAME_MASTER com defesa 505 e PS 452 —
        // e a forma de chefe Dynamax, e da PC 9.814 no nivel 55. O numero esta
        // certo; o limite anterior e que estava errado. Vale registrar porque a
        // tentacao e "consertar" o codigo quando o teste acusa um outlier real.
        if (!Number.isInteger(cp) || cp < 10 || cp > 10_000) {
          ruins.push(`${s.id} nv${level} -> ${cp}`);
        }
      }
    }
    expect(ruins, ruins.slice(0, 10).join(" | ")).toHaveLength(0);
  });

  it("o PC cresce com o nivel em todas", () => {
    const ruins: string[] = [];
    for (const s of real) {
      const a = computeCPAtLevel(data.cpm, s.baseStats, PERFECT, 20);
      const b = computeCPAtLevel(data.cpm, s.baseStats, PERFECT, 40);
      if (b <= a) ruins.push(`${s.id}: nv20=${a} nv40=${b}`);
    }
    expect(ruins, ruins.slice(0, 10).join(" | ")).toHaveLength(0);
  });

  it("o ranking de moveset nao quebra em nenhuma", () => {
    const ruins: string[] = [];
    for (const s of real) {
      const collect = (ids: string[], elite: string[]): MoveWithPvp[] => [
        ...ids.map((id) => byId.get(id)).filter((m): m is MoveWithPvp => !!m),
        ...elite
          .map((id) => byId.get(id))
          .filter((m): m is MoveWithPvp => !!m)
          .map((m) => ({ ...m, elite: true })),
      ];

      try {
        const sets = rankMovesets(
          collect(s.fastMoves, s.eliteFastMoves),
          collect(s.chargedMoves, s.eliteChargedMoves),
          "general",
          {
            attackerTypes: s.types,
            chart: data.typeChart,
            order: data.typeOrder,
            stabMultiplier: 1.2,
          },
        );
        for (const set of sets) {
          if (!Number.isFinite(set.score) || set.score < 0 || set.score > 1.0001) {
            ruins.push(`${s.id}: nota ${set.score}`);
            break;
          }
        }
      } catch (err) {
        ruins.push(`${s.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    expect(ruins, ruins.slice(0, 10).join(" | ")).toHaveLength(0);
  });

  it("o assistente nunca fica mudo nem se contradiz", () => {
    const ruins: string[] = [];
    for (const s of real) {
      const o = opine({
        name: s.name,
        baseStats: s.baseStats,
        cpm: data.cpm,
        levelCap: data.version.levelCap,
      });

      if (!o.headline.key) ruins.push(`${s.id}: sem manchete`);
      if (o.observations.length === 0) ruins.push(`${s.id}: sem observacao`);

      const tem = (k: string) => o.observations.some((x) => x.text.key === k);

      // "fraco em tudo" e "bom pra X" nao podem sair juntos.
      const fraco = tem("assistant.profile.weak");
      const bom = o.observations.some((x) => x.tone === "bom");
      if (fraco && bom) ruins.push(`${s.id}: diz fraco e bom ao mesmo tempo`);

      /*
       * Aguentar pancada e cair rapido sao a MESMA pergunta com respostas
       * opostas. O Eternatus recebia as duas na mesma tela, uma embaixo da
       * outra: "Aguenta pancada (192/268)" e logo abaixo "Da dano, mas cai
       * rapido". Vinha de misturar leitura absoluta com leitura de proporcao —
       * ataque 278 e defesa+PS 460 sao absolutos, a razao 1.21 e relativa.
       */
      if (tem("assistant.profile.tanky") && tem("assistant.profile.attacker")) {
        ruins.push(`${s.id}: diz que aguenta pancada e que cai rapido`);
      }
      if (tem("assistant.profile.hitsHard") && tem("assistant.profile.wall")) {
        ruins.push(`${s.id}: diz que bate forte e que quase nao ataca`);
      }

      for (const obs of o.observations) {
        if (!obs.evidence.key) ruins.push(`${s.id}: observacao sem dado`);
      }
    }
    expect(ruins, ruins.slice(0, 10).join(" | ")).toHaveLength(0);
  });

  it("o ranking de PvP produz 1 em primeiro lugar numa amostra", () => {
    // Ranquear as 4096 combinacoes de 1.182 especies levaria minutos, entao a
    // amostra e por passo fixo — cobre a faixa toda sem custar o tempo todo.
    const ruins: string[] = [];
    for (let i = 0; i < real.length; i += 60) {
      const s = real[i]!;
      for (const league of [GREAT_LEAGUE, ULTRA_LEAGUE, MASTER_LEAGUE]) {
        const spreads = rankIVSpreads(data.cpm, s.baseStats, league);
        if (spreads.length === 0) {
          ruins.push(`${s.id} ${league.id}: nenhuma combinacao cabe`);
          continue;
        }
        if (spreads[0]!.rank !== 1) ruins.push(`${s.id} ${league.id}: primeiro nao e rank 1`);
        if (league.cpCap !== null && spreads.some((x) => x.cp > league.cpCap!)) {
          ruins.push(`${s.id} ${league.id}: estourou o teto de PC`);
        }
      }
    }
    expect(ruins, ruins.slice(0, 10).join(" | ")).toHaveLength(0);
  });

  it("so o Smeargle fica sem moveset — e isso e do jogo", () => {
    // Smeargle aprende por Sketch e nao tem moveset fixo no GAME_MASTER. Se
    // aparecer outro nesta lista, e sinal de extracao quebrada.
    const semMoves = real.filter((s) => s.fastMoves.length === 0 || s.chargedMoves.length === 0);
    expect(semMoves.map((s) => s.id)).toEqual(["smeargle"]);
  });
});
