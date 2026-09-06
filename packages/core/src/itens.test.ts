import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { EVOLUCOES_POR_ITEM } from "./itens.js";

/**
 * O MAPA DE ITENS É GERADO — este teste regenera e compara.
 *
 * ⚠️ Tabela derivada que ninguém confere é tabela que envelhece. O jogo
 * adiciona item de evolução a cada geração nova, e um mapa parado faria o guia
 * dizer que a Pedra de Sinnoh evolui 24 espécies quando já evolui 26 — errado
 * de um jeito que ninguém percebe, porque as 24 continuam certas.
 *
 * Quando falhar: rodar de novo o gerador contra
 * `packages/dataset/raw/GAME_MASTER.json` e commitar o `itens.ts` novo. A falha
 * é o aviso de que o jogo mudou, não um defeito do código.
 */
const CRU = join(process.cwd(), "..", "dataset", "raw", "GAME_MASTER.json");

/**
 * ⚠️ O DATASET COMPILADO NAO ESTA NO REPOSITORIO — e por isso este teste
 * derrubou o CI uma vez.
 *
 * `GAME_MASTER.json` e commitado; `gamedata.tkdata` e gerado pelo ETL e fica de
 * fora. Na maquina de quem desenvolve os dois existem e os dois casos rodam; no
 * runner so o primeiro. Guardar so um dos dois foi o erro: o teste passava aqui
 * e explodia la, que e o pior lugar pra descobrir.
 */
const TKDATA = join(
  process.cwd(),
  "..",
  "..",
  "apps",
  "mobile",
  "assets",
  "dataset",
  "gamedata.tkdata",
);

/**
 * ⚠️ COLAPSA FORMA COSMÉTICA, como o resto do app faz.
 *
 * O GAME_MASTER traz o mesmo ramo de evolução em mais de um template (a forma
 * `_NORMAL` e a entrada crua), e sem colapsar a tela mostrava
 * "Misdreavus → Mismagius" duas vezes seguidas. O `cosmeticOf` do dataset é
 * quem sabe qual é a espécie de verdade — 60 pares viram 42.
 */
function canonico(): Map<string, string> {
  const ds = JSON.parse(readFileSync(TKDATA, "utf8")) as {
    species: { id: string; cosmeticOf?: string | null }[];
  };
  return new Map(ds.species.map((s) => [s.id, s.cosmeticOf ?? s.id]));
}

function derivar(): Record<string, [string, string][]> {
  const canon = canonico();
  const bruto = JSON.parse(readFileSync(CRU, "utf8")) as unknown;
  const ts = (
    Array.isArray(bruto)
      ? bruto
      : ((bruto as Record<string, unknown>).template ??
        (bruto as Record<string, unknown>).itemTemplates ??
        [])
  ) as { data?: { pokemonSettings?: Record<string, unknown> } }[];

  const mapa: Record<string, Set<string>> = {};
  for (const t of ts) {
    const p = t.data?.pokemonSettings;
    if (!p) continue;
    const de = String(p.pokemonId ?? "").toLowerCase();
    for (const e of (p.evolutionBranch ?? []) as Record<string, string>[]) {
      const item = e.evolutionItemRequirement;
      if (!item) continue;
      const para = String(e.form ?? e.evolution ?? "").toLowerCase();
      (mapa[item] ??= new Set()).add(`${canon.get(de) ?? de}>${canon.get(para) ?? para}`);
    }
  }
  const saida: Record<string, [string, string][]> = {};
  for (const [item, pares] of Object.entries(mapa)) {
    saida[item] = [...pares].sort().map((x) => x.split(">") as [string, string]);
  }
  return saida;
}

describe("mapa de itens de evolução", () => {
  /* Os DOIS: o mapa colapsa forma cosmetica, e quem sabe disso e o dataset. */
  const temArquivo = existsSync(CRU) && existsSync(TKDATA);

  it.runIf(temArquivo)("bate com o GAME_MASTER, item por item", () => {
    const esperado = derivar();
    expect(Object.keys(EVOLUCOES_POR_ITEM).sort()).toEqual(Object.keys(esperado).sort());
    for (const [item, pares] of Object.entries(esperado)) {
      const meu = [...(EVOLUCOES_POR_ITEM[item] ?? [])].map(([a, b]) => `${a}>${b}`).sort();
      expect(meu, `${item} divergiu — regere o itens.ts`).toEqual(
        pares.map(([a, b]) => `${a}>${b}`),
      );
    }
  });

  it.runIf(temArquivo)("todo id citado existe no dataset", () => {
    const ds = JSON.parse(
      readFileSync(
        join(process.cwd(), "..", "..", "apps", "mobile", "assets", "dataset", "gamedata.tkdata"),
        "utf8",
      ),
    ) as { species: { id: string }[] };
    const ids = new Set(ds.species.map((s) => s.id));
    const perdidos: string[] = [];
    for (const [item, pares] of Object.entries(EVOLUCOES_POR_ITEM)) {
      for (const [de, para] of pares) {
        if (!ids.has(de)) perdidos.push(`${item}: ${de}`);
        if (!ids.has(para)) perdidos.push(`${item}: ${para}`);
      }
    }
    expect(perdidos, perdidos.slice(0, 5).join(" | ")).toEqual([]);
  });
});
