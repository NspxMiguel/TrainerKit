import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DISTANCIAS,
  emCartaz,
  nomesPossiveis,
  ordemDaDistancia,
  ovosUnicos,
  rolandoAgora,
  semEntidades,
  type EventoAgenda,
  type OvoAgenda,
} from "./agenda.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "public", "dataset", "gamedata.json");
const dataset = JSON.parse(readFileSync(DATASET, "utf8")) as {
  species: Array<{ name: string }>;
};

const ev = (p: Partial<EventoAgenda>): EventoAgenda => ({
  eventID: "x",
  name: "x",
  eventType: "event",
  heading: "x",
  link: "x",
  image: "x",
  ...p,
});

/**
 * ⚠️ O TESTE QUE IMPORTA E O DO CASAMENTO DE NOMES.
 *
 * A fonte fala ingles e escreve forma regional ao contrario do jogo; a base do
 * app fala dez idiomas. Se o casamento falhar, a chocadeira vira uma lista de
 * nomes em ingles sem sprite e sem link — ou seja, a copia de um site, que e
 * exatamente o que ela existe pra nao ser.
 */
describe("os nomes da fonte casam com a base do app", () => {
  const conhecidos = new Set(dataset.species.map((s) => s.name.toLowerCase()));

  const casa = (nome: string): boolean =>
    nomesPossiveis(nome).some((n) => conhecidos.has(n.toLowerCase()));

  it("nome simples casa direto", () => {
    expect(casa("Bulbasaur")).toBe(true);
    expect(casa("Pikachu")).toBe(true);
  });

  it("forma regional casa apesar da ordem invertida", () => {
    // A fonte: "Galarian Meowth". O jogo: "Meowth (Galarian)".
    expect(casa("Galarian Meowth")).toBe(true);
    expect(casa("Hisuian Growlithe")).toBe(true);
  });

  it("as DUAS grafias de Alola, porque o jogo usa as duas", () => {
    // "Rattata (Alolan)" existe; "Geodude (Alola)", sem o N, tambem. Foi isso
    // que fez 11 dos 76 falharem quando so uma grafia era tentada.
    expect(casa("Alolan Geodude")).toBe(true);
    expect(casa("Alolan Rattata")).toBe(true);
  });

  it("nome que nao existe nao casa — o teste tem que poder falhar", () => {
    expect(casa("Missingno")).toBe(false);
  });
});

describe("a ordem das distancias e a do jogo, nao a alfabetica", () => {
  it("2 km vem antes de 10 km", () => {
    expect(ordemDaDistancia("2 km")).toBeLessThan(ordemDaDistancia("10 km"));
  });

  it("12 km vem depois de 10 km", () => {
    expect(ordemDaDistancia("10 km")).toBeLessThan(ordemDaDistancia("12 km"));
  });

  it("distancia desconhecida vai pro fim em vez de quebrar", () => {
    expect(ordemDaDistancia("42 km")).toBe(DISTANCIAS.length);
  });
});

describe("o que esta em cartaz", () => {
  const AGORA = Date.parse("2026-08-28T12:00:00Z");

  it("evento terminado sai da lista", () => {
    const lista = emCartaz([ev({ end: "2026-08-01T00:00:00Z" })], AGORA);
    expect(lista).toHaveLength(0);
  });

  it("evento sem fim FICA — nao da pra afirmar que acabou", () => {
    expect(emCartaz([ev({ eventID: "sem-fim" })], AGORA)).toHaveLength(1);
  });

  it("data podre nao derruba nem some: o evento fica", () => {
    const lista = emCartaz([ev({ eventID: "podre", end: "amanha de tarde" })], AGORA);
    expect(lista).toHaveLength(1);
  });

  it("ordena pelo comeco, do mais proximo pro mais distante", () => {
    const lista = emCartaz(
      [
        ev({ eventID: "depois", start: "2026-09-10T00:00:00Z", end: "2026-09-11T00:00:00Z" }),
        ev({ eventID: "antes", start: "2026-08-29T00:00:00Z", end: "2026-08-30T00:00:00Z" }),
      ],
      AGORA,
    );
    expect(lista.map((e) => e.eventID)).toEqual(["antes", "depois"]);
  });
});

describe("rolando agora", () => {
  const AGORA = Date.parse("2026-08-28T12:00:00Z");

  it("dentro da janela", () => {
    expect(
      rolandoAgora(ev({ start: "2026-08-28T10:00:00Z", end: "2026-08-28T14:00:00Z" }), AGORA),
    ).toBe(true);
  });

  it("antes de comecar, nao", () => {
    expect(
      rolandoAgora(ev({ start: "2026-08-29T10:00:00Z", end: "2026-08-29T14:00:00Z" }), AGORA),
    ).toBe(false);
  });

  it("sem data, nao — e sem chutar", () => {
    expect(rolandoAgora(ev({}), AGORA)).toBe(false);
  });
});

describe("a fonte repete a mesma especie no mesmo ovo", () => {
  const ovo = (p: Partial<OvoAgenda>): OvoAgenda => ({
    name: "Galarian Corsola",
    eggType: "7 km",
    isAdventureSync: false,
    canBeShiny: false,
    isRegional: false,
    ...p,
  });

  it("duas procedencias viram uma linha", () => {
    // Medido na fonte: Galarian Corsola vem duas vezes em 7 km, uma de presente
    // e outra nao. Quem abre a chocadeira quer saber de que ovo sai o bicho, e
    // a resposta e uma so.
    expect(ovosUnicos([ovo({}), ovo({})])).toHaveLength(1);
  });

  it("as marcas somam com OU: se qualquer uma brilha, a especie brilha", () => {
    const [r] = ovosUnicos([ovo({ canBeShiny: false }), ovo({ canBeShiny: true })]);
    expect(r!.canBeShiny).toBe(true);
  });

  it("especies diferentes na mesma distancia continuam separadas", () => {
    expect(ovosUnicos([ovo({}), ovo({ name: "Pikachu" })])).toHaveLength(2);
  });

  it("a mesma especie em distancias diferentes continua nas duas", () => {
    expect(ovosUnicos([ovo({}), ovo({ eggType: "10 km" })])).toHaveLength(2);
  });
});

describe("o texto da fonte vem com entidades HTML dentro", () => {
  it("&amp; vira &, que foi o que apareceu na tela", () => {
    // Medido: "PokémonXP &amp; 2026 Worlds" saía assim, cru, no calendário.
    expect(semEntidades("PokémonXP &amp; 2026 Worlds")).toBe("PokémonXP & 2026 Worlds");
  });

  it("as outras nomeadas também", () => {
    expect(semEntidades("&lt;a&gt; &quot;x&quot; &apos;y&apos;")).toBe(`<a> "x" 'y'`);
  });

  it("numérica decimal e hexadecimal", () => {
    expect(semEntidades("caf&#233; &#x41;")).toBe("café A");
  });

  it("entidade que não existe fica como está, em vez de sumir", () => {
    expect(semEntidades("100 &naoexiste; 200")).toBe("100 &naoexiste; 200");
  });

  it("numérica fora da faixa do Unicode não vira caractere inventado", () => {
    expect(semEntidades("&#99999999;")).toBe("&#99999999;");
  });

  it("texto sem entidade passa intacto", () => {
    expect(semEntidades("Mankey Spotlight Hour")).toBe("Mankey Spotlight Hour");
  });
});
