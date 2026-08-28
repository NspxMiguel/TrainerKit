import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  rankMovesets,
  shadowDamageMultiplier,
  withFrustration,
  type MoveWithPvp,
} from "./moves.js";
import type { TypeChart, TypeOrder } from "./types-chart.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");

interface Dataset {
  typeChart: TypeChart;
  typeOrder: TypeOrder;
  species: Array<{
    name: string;
    types: string[];
    fastMoves: string[];
    chargedMoves: string[];
    eliteFastMoves: string[];
    eliteChargedMoves: string[];
  }>;
  fastMoves: MoveWithPvp[];
  chargedMoves: MoveWithPvp[];
  settings: { battle: { shadowPokemonAttackBonusMultiplier: number } };
}

const data = JSON.parse(readFileSync(DATASET, "utf8")) as Dataset;

const move = (id: string): MoveWithPvp => {
  const found =
    data.fastMoves.find((m) => m.id === id) ?? data.chargedMoves.find((m) => m.id === id);
  if (!found) throw new Error(`golpe inexistente no dataset: ${id}`);
  return found;
};

const input = (types: readonly string[]) => ({
  attackerTypes: types,
  chart: data.typeChart,
  order: data.typeOrder,
  stabMultiplier: 1.2,
});

describe("contexto Rocket", () => {
  /**
   * A pergunta que o contexto responde: contra um lider, que bloqueia os dois
   * primeiros carregados, o que fazer? A resposta tem que ser DIFERENTE da do
   * PvP normal, senao o contexto nao precisaria existir.
   *
   * A primeira versao deste teste esperava que o carregado BARATO vencesse
   * sozinho, e ele nao vence: dano por energia nao muda por causa de escudo, e
   * o Close Combat tem 2,2 de dano por energia contra 1,6 do Cross Chop. O que
   * o escudo muda e poder gastar pouco nos dois arremessos que serao perdidos
   * — ou seja, a resposta e um PAR, nao um golpe.
   */
  it("recomenda isca barata + finalizador forte, e o PvP comum nao", () => {
    const fast = [move("counter_fast")];
    const barato = move("cross_chop"); // 35 de energia em PvP
    const caro = move("close_combat"); // 45, mas quase o dobro do poder

    expect(Math.abs(barato.pvp!.energyDelta)).toBeLessThan(Math.abs(caro.pvp!.energyDelta));

    const rocket = rankMovesets(fast, [barato, caro], "rocket", input(["fighting"]));
    const pvp = rankMovesets(fast, [barato, caro], "pvp", input(["fighting"]));

    // Em PvP o app recomenda um carregado so, e e o mais forte.
    expect(pvp[0]!.charged.id).toBe("close_combat");
    expect(pvp[0]!.bait ?? null).toBeNull();

    // Contra o lider, o mesmo finalizador — mas agora com isca na frente.
    expect(rocket[0]!.charged.id).toBe("close_combat");
    expect(rocket[0]!.bait?.id).toBe("cross_chop");
  });

  it("sem isca disponivel, o trio degenera no golpe unico", () => {
    const somente = rankMovesets(
      [move("counter_fast")],
      [move("close_combat")],
      "rocket",
      input(["fighting"]),
    );
    expect(somente).toHaveLength(1);
    expect(somente[0]!.bait).toBeNull();
    expect(somente[0]!.charged.id).toBe("close_combat");
  });

  it("mostra uma linha por dupla, com a melhor isca — nao uma por isca", () => {
    // Sem isto a lista vira cinco "Counter + Close Combat" variando so a isca,
    // com notas quase iguais. Quem le escolhe o conjunto, nao a isca.
    const machamp = data.species.find((s) => s.name === "Machamp")!;
    const ranked = rankMovesets(
      machamp.fastMoves.map(move),
      machamp.chargedMoves.map(move),
      "rocket",
      input(machamp.types),
    );

    const duplas = ranked.map((m) => `${m.fast.id}/${m.charged.id}`);
    expect(new Set(duplas).size).toBe(duplas.length);
    expect(ranked).toHaveLength(machamp.fastMoves.length * machamp.chargedMoves.length);

    // E a que sobrou de cada dupla e a de melhor nota, o que so vale se a
    // sobrevivente do Close Combat for a com isca barata.
    const melhor = ranked.find((m) => m.charged.id === "close_combat")!;
    expect(melhor.bait?.id).toBe("cross_chop");
  });

  it("nota 1 e do melhor do proprio especie, nao do jogo", () => {
    const machamp = data.species.find((s) => s.name === "Machamp")!;
    const ranked = rankMovesets(
      machamp.fastMoves.map(move),
      machamp.chargedMoves.map(move),
      "rocket",
      input(machamp.types),
    );
    expect(ranked[0]!.score).toBeCloseTo(1, 9);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i]!.score).toBeLessThanOrEqual(ranked[i - 1]!.score);
    }
  });
});

describe("sombroso", () => {
  it("a Frustracao entra na lista e sai por ultimo", () => {
    // Este e o numero que justifica gastar TM de evento: com Frustracao presa
    // no slot, o sombroso perde o moveset inteiro.
    const machamp = data.species.find((s) => s.name === "Machamp")!;
    const charged = withFrustration(machamp.chargedMoves.map(move), move("frustration"));

    expect(charged.some((m) => m.frustration)).toBe(true);

    const ranked = rankMovesets(
      machamp.fastMoves.map(move),
      charged,
      "pvp",
      input(machamp.types),
    );

    const comFrustracao = ranked.filter((m) => m.isFrustration);
    expect(comFrustracao.length).toBeGreaterThan(0);
    // O melhor conjunto COM Frustracao perde para o melhor conjunto sem ela.
    expect(comFrustracao[0]!.score).toBeLessThan(ranked[0]!.score);
    expect(ranked[0]!.isFrustration).toBe(false);
  });

  it("nao injeta golpe quando o dataset nao traz a Frustracao", () => {
    const original = [move("dynamic_punch")];
    expect(withFrustration(original, null)).toHaveLength(1);
  });

  it("o bonus de sombroso e o do jogo e nao mexe na ordem", () => {
    // Registrado de proposito: o bonus e uniforme, entao ele NAO muda qual
    // moveset e o melhor. Expor isso como numero separado evita que a UI
    // finja ter recalculado algo.
    expect(shadowDamageMultiplier(data.settings.battle)).toBeCloseTo(1.2, 6);
  });
});

/**
 * O campo `durationTurns` do GAME_MASTER conta os turnos ALEM do primeiro.
 *
 * Este teste nao le a implementacao: ele cobra do DATASET a propriedade que
 * prova o formato do campo, e cobra do ranking que ele use o divisor certo.
 * Se um dia a fonte mudar para 1-based, o primeiro caso quebra primeiro e diz
 * exatamente o que mudou — em vez de o app so passar a ranquear torto.
 */
describe("turnos de PvP sao zero-based na fonte", () => {
  it("todo golpe carregado ocupa um turno, e o dataset registra isso como 0", () => {
    const carregados = data.chargedMoves.filter((m) => m.pvp);
    const zerados = carregados.filter((m) => m.pvp!.turns === 0);
    // 1-based faria os 257 virem com 1. Vem com 0 — logo, zero-based.
    expect(carregados.length).toBeGreaterThan(200);
    expect(zerados.length / carregados.length).toBeGreaterThan(0.99);
  });

  it("golpe rapido nenhum poderia durar zero turno, e ha doze marcados assim", () => {
    const rapidos = data.fastMoves.filter((m) => m.pvp);
    expect(rapidos.some((m) => m.pvp!.turns === 0)).toBe(true);
  });

  it("Counter (turns 1) rende metade do DPT que renderia se fosse 1 turno", () => {
    /*
     * Counter dura 2 turnos de verdade. Com o divisor errado (1) o DPT sairia
     * o dobro. O teste compara o ranking de dois golpes com o MESMO poder e
     * turnos diferentes: quem ocupa menos turno tem que pontuar mais.
     */
    const counter = move("counter_fast"); // turns 1 -> 2 turnos
    const lockOn = move("lock_on_fast"); // turns 0 -> 1 turno
    expect(counter.pvp!.turns).toBe(1);
    expect(lockOn.pvp!.turns).toBe(0);

    const dptPorTurnoReal = (m: MoveWithPvp) => m.pvp!.power / (m.pvp!.turns + 1);
    expect(dptPorTurnoReal(counter)).toBeCloseTo(8 / 2, 5);
  });
});
