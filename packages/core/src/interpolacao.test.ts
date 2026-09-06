import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { EN } from "./dict/en.js";

/**
 * PLACEHOLDER NÃO PREENCHIDO É DEFEITO QUE SÓ APARECE NA TELA.
 *
 * `t("raid.tier")` compila, passa no typecheck e imprime **"Tier {n}"** para o
 * usuário — a chave existe, o tipo está certo, e o texto está errado. Foi assim
 * que a tela de raide do app nativo mostrou "TIER {N}" como cabeçalho e o
 * montador de time mostrou "6 · {n} tipos diferentes entre os {total}".
 *
 * O teste é grosseiro de propósito: ele só olha se a chamada tem um segundo
 * argumento. Isso não prova que os nomes passados são os certos — mas pega a
 * classe inteira do defeito que apareceu, que é chamar sem argumento nenhum.
 *
 * ⚠️ Ele lê o código dos DOIS apps por caminho relativo, e falha se não achar
 * a pasta. Um teste que se desliga sozinho quando o alvo muda de lugar é um
 * teste que desaparece sem ninguém notar.
 */
const RAIZ = join(process.cwd(), "..", "..");
const ALVOS = ["apps/mobile/app", "apps/mobile/src", "apps/web/src"];

/** As chaves cujo texto em inglês tem `{algo}` dentro. */
function chavesComPlaceholder(): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const [chave, texto] of Object.entries(EN)) {
    const nomes = [...String(texto).matchAll(/\{([a-z]+)\}/g)].map((m) => m[1]!);
    if (nomes.length) mapa.set(chave, nomes);
  }
  return mapa;
}

function arquivos(dir: string): string[] {
  const saida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    if (["node_modules", "ios", "android", ".expo", "dist"].includes(entrada)) continue;
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho));
    else if (/\.tsx?$/.test(caminho) && !/\.test\.tsx?$/.test(caminho)) saida.push(caminho);
  }
  return saida;
}

describe("interpolação da interface", () => {
  it("nenhuma chamada t() deixa um placeholder sem preencher", () => {
    const precisa = chavesComPlaceholder();
    expect(precisa.size, "o inglês não tem nenhuma frase com {placeholder}?").toBeGreaterThan(10);

    const cruas: string[] = [];
    for (const alvo of ALVOS) {
      const dir = join(RAIZ, alvo);
      expect(statSync(dir).isDirectory(), `${alvo} sumiu — o teste está medindo o nada`).toBe(true);

      for (const arquivo of arquivos(dir)) {
        const fonte = readFileSync(arquivo, "utf8");
        for (const m of fonte.matchAll(/\bt\(\s*"([a-zA-Z0-9._-]+)"\s*([,)])/g)) {
          if (m[2] === ",") continue; // tem segundo argumento
          const nomes = precisa.get(m[1]!);
          if (!nomes) continue;
          const linha = fonte.slice(0, m.index).split("\n").length;
          cruas.push(
            `${arquivo.slice(RAIZ.length + 1)}:${linha} t("${m[1]}") sem {${nomes.join(", ")}}`,
          );
        }
      }
    }
    expect(cruas, cruas.join(" | ")).toEqual([]);
  });

  it("a busca acha o padrão que ela promete achar", () => {
    // Sem este caso, um regex quebrado deixaria a lista vazia para sempre e o
    // teste acima passaria medindo zero arquivo.
    const amostra = 'const a = t("raid.tier"); const b = t("raid.tier", { n: 3 });';
    const achadas = [...amostra.matchAll(/\bt\(\s*"([a-zA-Z0-9._-]+)"\s*([,)])/g)];
    expect(achadas).toHaveLength(2);
    expect(achadas.filter((m) => m[2] === ")")).toHaveLength(1);
  });
});
