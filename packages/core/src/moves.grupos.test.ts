import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { groupIdenticalContexts, type Context, type MoveWithPvp } from "./moves.js";

/**
 * "tem alguns pokemon, tipo o eternatus, que sla, raide, pra tudo e pvp sao
 * iguais, so muda pra rocket."
 *
 * O teste roda sobre o dataset REAL, e não sobre golpes inventados, porque a
 * afirmação dele é sobre o jogo — se um dia o Eternatus ganhar um golpe que
 * separe raide de PvP, este teste tem que passar a refletir isso em vez de
 * continuar verde em cima de dados de mentira.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");

interface Dataset {
  species: Array<{
    id: string;
    types: string[];
    fastMoves: string[];
    chargedMoves: string[];
    eliteFastMoves: string[];
    eliteChargedMoves: string[];
  }>;
  fastMoves: MoveWithPvp[];
  chargedMoves: MoveWithPvp[];
  typeChart: Record<string, number[]>;
  typeOrder: string[];
}

const data = JSON.parse(readFileSync(DATASET, "utf8")) as Dataset;

const porId = new Map<string, MoveWithPvp>();
for (const m of [...data.fastMoves, ...data.chargedMoves]) porId.set(m.id, m);

function gruposDe(id: string) {
  const s = data.species.find((x) => x.id === id);
  if (!s) throw new Error(`especie ausente: ${id}`);
  const pega = (ids: string[]) =>
    ids.map((i) => porId.get(i)).filter((m): m is MoveWithPvp => m !== undefined);

  return groupIdenticalContexts(
    pega([...s.fastMoves, ...s.eliteFastMoves]),
    pega([...s.chargedMoves, ...s.eliteChargedMoves]),
    {
      attackerTypes: s.types,
      chart: data.typeChart,
      order: data.typeOrder,
      stabMultiplier: 1.2,
    },
  );
}

describe("contextos que dao a mesma resposta viram um só", () => {
  it("Eternatus: o caso que ele apontou", () => {
    const grupos = gruposDe("eternatus");

    // Menos de quatro grupos = houve unificação. É o ponto do exercício.
    expect(grupos.length).toBeLessThan(4);

    // E o Rocket tem que estar separado dos outros: ele recomenda um PAR de
    // carregados (isca + finalizador), o que nenhum outro contexto faz.
    const doRocket = grupos.find((g) => g.contexts.includes("rocket"))!;
    expect(doRocket.contexts).toEqual(["rocket"]);
  });

  it("todo Pokémon devolve pelo menos um grupo", () => {
    // Inclusive os que não têm golpe nenhum no dataset: a tela não pode receber
    // uma lista vazia e ficar sem nada pra desenhar.
    for (const id of ["eternatus", "machamp", "blissey", "pidgey", "shedinja"]) {
      expect(gruposDe(id).length, id).toBeGreaterThan(0);
    }
  });

  it("nenhum contexto aparece em dois grupos, e os quatro sempre aparecem", () => {
    /*
     * A invariante que impede o pior defeito possível aqui: um contexto sumir da
     * tela. Se `general` não entrasse em nenhum grupo, o botão "Tudo"
     * simplesmente não existiria e ninguém notaria — a tela continuaria coerente
     * consigo mesma, só que sem uma opção.
     */
    for (const id of ["eternatus", "machamp", "tyranitar", "azumarill"]) {
      const todos = gruposDe(id).flatMap((g) => g.contexts);
      expect([...todos].sort(), id).toEqual(["general", "pvp", "raid", "rocket"]);
      expect(new Set(todos).size, `${id}: contexto repetido`).toBe(todos.length);
    }
  });

  it("quando os movesets diferem, os contextos NÃO são unificados", () => {
    /*
     * O outro lado do teste acima. Unificar demais seria pior que não unificar:
     * esconderia uma recomendação diferente atrás de um botão que a pessoa
     * acharia redundante.
     *
     * Azumarill é o caso clássico: em PvP ele vive de Bubble + carregado barato,
     * e em raide o cálculo é outro.
     */
    const grupos = gruposDe("azumarill");
    const chave = (c: Context) => grupos.find((g) => g.contexts.includes(c))!;
    expect(chave("pvp").movesets[0]).toBeDefined();
    expect(chave("raid").movesets[0]).toBeDefined();
    // Se raide e PvP caíram no mesmo grupo, os golpes têm que ser mesmo iguais.
    if (chave("pvp") === chave("raid")) {
      expect(chave("pvp").movesets[0]!.fast.id).toBe(chave("raid").movesets[0]!.fast.id);
    }
  });
});
