import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setDataSource } from "./source.ts";
import { useDataset, type Dataset } from "./useDataset.ts";

/**
 * A base tem que se atualizar SEM o app se atualizar.
 *
 * A causa raiz, medida num aparelho de verdade: `gamedata.json` mora no
 * precache do service worker, e rota de precache atende pela URL exata. Um
 * `fetch` normal nunca chegava no servidor, entao a base tinha a cadencia do
 * SERVICE WORKER — e o service worker novo instala e fica parado esperando o
 * botao de atualizar. Resultado na tela: "07/08 · 9 days old" logo abaixo de um
 * texto prometendo que a base se refaz todo dia.
 *
 * O conserto e uma segunda busca com um carimbo do dia na URL, que nao casa com
 * a rota de precache e por isso chega na rede. O que estes testes travam:
 *
 *   1. a segunda busca EXISTE e usa um endereco diferente da primeira;
 *   2. ela so troca o que esta em uso quando o dado e mais novo;
 *   3. ela nunca anda pra tras;
 *   4. falhar nao derruba o app, porque a primeira ja resolveu;
 *   5. fonte de terceiro nao leva carimbo — ela nem passa pelo precache.
 */

function base(uploadTime: string): Dataset {
  return {
    version: {
      batchId: "b",
      uploadTime,
      generatedAt: "2026-08-16T06:34:00.000Z",
      levelCap: 50,
    },
    cpm: Array.from({ length: 110 }, (_, i) => 0.09 + i * 0.007),
    // `looksLikeDataset` exige os 18 tipos: um dataset com menos nao serve pra
    // indexar a tabela de efetividade, e recusar e o comportamento certo.
    typeOrder: [
      "normal", "fighting", "flying", "poison", "ground", "rock",
      "bug", "ghost", "steel", "fire", "water", "grass",
      "electric", "psychic", "ice", "dragon", "dark", "fairy",
    ],
    typeChart: { normal: new Array(18).fill(1) },
    species: [
      {
        id: "bulbasaur",
        dex: 1,
        name: "Bulbasaur",
        types: ["grass"],
        baseStats: { atk: 118, def: 111, hp: 128 },
        fastMoves: [],
        chargedMoves: [],
        eliteFastMoves: [],
        eliteChargedMoves: [],
        familyId: null,
        parent: null,
        evolvesInto: [],
        candyToEvolve: {},
        cosmeticOf: null,
        spriteId: 1,
      },
    ],
    fastMoves: [],
    chargedMoves: [],
    settings: {
      battle: {
        sameTypeAttackBonusMultiplier: 1.2,
        enemyAttackInterval: 2000,
        maximumEnergy: 100,
        shadowPokemonAttackBonusMultiplier: 1.2,
        shadowPokemonDefenseBonusMultiplier: 0.833,
      },
    },
  } as Dataset;
}

const VELHO = "1754524800000"; // 07/08/2026
const NOVO = "1755100800000"; // 13/08/2026

let container: HTMLDivElement;
let root: Root;
let visto: string | null;
let pedidos: string[];

function Sonda() {
  const st = useDataset();
  visto = st.status === "ready" ? st.data.version.uploadTime : null;
  return null;
}

/** Monta e deixa as promessas do efeito assentarem. */
async function montar() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<Sonda />);
  });
  // As duas buscas sao encadeadas; um tick nao basta.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Responde por URL: quem tem `?d=` recebe `daRede`, o resto recebe `doPrecache`. */
function servir(doPrecache: Dataset | null, daRede: Dataset | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      pedidos.push(url);
      const corpo = url.includes("?d=") || url.includes("&d=") ? daRede : doPrecache;
      if (!corpo) return Promise.resolve({ ok: false, status: 503 } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(corpo) } as Response);
    }),
  );
}

beforeEach(() => {
  visto = null;
  pedidos = [];
  setDataSource(null);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("a segunda busca fura o precache", () => {
  it("pede DOIS enderecos, e o segundo carrega o carimbo do dia", async () => {
    servir(base(VELHO), base(NOVO));
    await montar();
    expect(pedidos).toHaveLength(2);
    expect(pedidos[0]).not.toContain("d=");
    expect(pedidos[1]).toContain("d=");
    // O carimbo e a data de hoje, e nao um relogio: dentro do mesmo dia a URL
    // repete e o cache HTTP absorve.
    expect(pedidos[1]).toContain(new Date().toISOString().slice(0, 10));
  });

  it("o carimbo e o UNICO detalhe diferente entre os dois enderecos", async () => {
    servir(base(VELHO), base(NOVO));
    await montar();
    const [simples, carimbado] = pedidos;
    expect(carimbado!.startsWith(simples!)).toBe(true);
  });
});

describe("so troca quando o dado e mais novo", () => {
  it("rede mais nova que o precache: a tela passa a mostrar a nova", async () => {
    servir(base(VELHO), base(NOVO));
    await montar();
    expect(visto).toBe(NOVO);
  });

  it("rede MAIS VELHA que o precache: nao anda pra tras", async () => {
    servir(base(NOVO), base(VELHO));
    await montar();
    expect(visto).toBe(NOVO);
  });

  it("mesma data dos dois lados: fica onde esta", async () => {
    servir(base(NOVO), base(NOVO));
    await montar();
    expect(visto).toBe(NOVO);
  });
});

describe("a revalidacao nunca derruba o app", () => {
  it("rede fora do ar: continua com a base do precache", async () => {
    servir(base(VELHO), null);
    await montar();
    expect(visto).toBe(VELHO);
  });

  it("sem precache E sem rede: ai sim e erro, e nao tela em branco calada", async () => {
    servir(null, null);
    await montar();
    expect(visto).toBeNull();
  });

  it("precache fora mas rede de pe: nao inventa sucesso a partir da segunda busca", async () => {
    // A primeira busca e a que decide se ha app. Se ela falha, o efeito para —
    // e nao ha por que a segunda salvar um estado que nunca existiu.
    servir(null, base(NOVO));
    await montar();
    expect(visto).toBeNull();
    expect(pedidos).toHaveLength(1);
  });
});

describe("fonte apontada pelo usuario", () => {
  it("nao leva carimbo: ela nao passa pelo precache", async () => {
    setDataSource("https://exemplo.test/base.json");
    servir(base(VELHO), base(NOVO));
    await montar();
    expect(pedidos).toEqual(["https://exemplo.test/base.json"]);
    expect(visto).toBe(VELHO);
  });
});
