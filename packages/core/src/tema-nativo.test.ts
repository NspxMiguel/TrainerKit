import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * O CONTRASTE DO APP NATIVO, medido pelo teste e não pelo olho.
 *
 * O app web tem `contraste.test.ts` desde cedo; o nativo não tinha nada, e a
 * falta apareceu do jeito mais barato possível: `texto3` sobre o cartão escuro
 * media **4,45:1**, reprovando por 0,05 — e ninguém ia notar isso lendo o hex.
 *
 * ── Por que o teste mora em `packages/core` ─────────────────────────────────
 *
 * `apps/mobile` não tem runner: montar vitest lá só por causa disto custaria
 * uma dependência de dev, uma config e um script, pra rodar um arquivo. Aqui a
 * suíte já existe e já roda no `pnpm test`. O preço é ler os dois arquivos do
 * app irmão por caminho relativo, e é por isso que a falta deles FALHA em vez
 * de pular: um teste que se desliga sozinho quando não acha o alvo é um teste
 * que some no dia em que alguém renomeia a pasta.
 *
 * ── O segundo caso é tão importante quanto o primeiro ───────────────────────
 *
 * `src/tema.tsx` e `global.css` guardam a MESMA paleta duas vezes — o CSS pro
 * NativeWind, o TS pro que é prop de JS (`ActivityIndicator color`,
 * `placeholderTextColor`, a barra do `Stack`). O comentário do `tema.tsx` já
 * avisava que as duas listas têm que ficar iguais, e nada verificava. Divergir
 * não quebra build nem typecheck: só renderiza uma tela torta.
 */
const MOBILE = join(process.cwd(), "..", "..", "apps", "mobile");
const MINIMO = 4.5;

function ler(arquivo: string): string {
  return readFileSync(join(MOBILE, arquivo), "utf8");
}

function canal(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * canal(r!) + 0.7152 * canal(g!) + 0.0722 * canal(b!);
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro! + 0.05) / (escuro! + 0.05);
}

/** As cores do `tema.tsx`, lidas do arquivo — não copiadas pra cá. */
function doTs(nome: string): Record<string, string> {
  const fonte = ler("src/tema.tsx");
  const i = fonte.indexOf(`const ${nome}: Paleta = {`);
  expect(i, `${nome} sumiu de src/tema.tsx`).toBeGreaterThan(-1);
  const corpo = fonte.slice(i, fonte.indexOf("};", i));
  const cores: Record<string, string> = {};
  for (const m of corpo.matchAll(/(\w+): "(#[0-9a-f]{6})"/g)) cores[m[1]!] = m[2]!;
  return cores;
}

/** As mesmas cores do `global.css`, que vêm em canais RGB separados por espaço. */
function doCss(seletor: string): Record<string, string> {
  const fonte = ler("global.css");
  const i = fonte.indexOf(seletor);
  expect(i, `${seletor} sumiu de global.css`).toBeGreaterThan(-1);
  const corpo = fonte.slice(i, fonte.indexOf("}", i));
  const cores: Record<string, string> = {};
  for (const m of corpo.matchAll(/--tk-([a-z0-9]+): (\d+) (\d+) (\d+);/g)) {
    cores[m[1]!] =
      `#${[m[2], m[3], m[4]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  }
  return cores;
}

/* `fundo` e `superficie` são o que se mede CONTRA; `linha` é borda de 0,5px e
   não texto, então nenhum dos três entra como tinta. */
const NAO_E_TINTA = ["fundo", "superficie", "linha"];

describe("paleta do app nativo", () => {
  for (const [nome, seletor] of [
    ["CLARO", ":root {"],
    ["ESCURO", ".dark:root {"],
  ] as const) {
    it(`${nome}: toda tinta passa em 4,5:1 nas duas superfícies`, () => {
      const p = doTs(nome);
      const ruins: string[] = [];
      for (const [chave, cor] of Object.entries(p)) {
        if (NAO_E_TINTA.includes(chave)) continue;
        for (const sup of [p.fundo!, p.superficie!]) {
          const r = contraste(cor, sup);
          if (r < MINIMO) ruins.push(`${chave} sobre ${sup}: ${r.toFixed(2)}:1`);
        }
      }
      expect(ruins, ruins.join(" | ")).toEqual([]);
    });

    it(`${nome}: tema.tsx e global.css dizem a mesma coisa`, () => {
      const ts = doTs(nome);
      const css = doCss(seletor);
      const divergem: string[] = [];
      for (const [chave, cor] of Object.entries(ts)) {
        if (css[chave] && css[chave] !== cor) {
          divergem.push(`${chave}: tema.tsx ${cor} vs global.css ${css[chave]}`);
        }
      }
      expect(divergem, divergem.join(" | ")).toEqual([]);
    });
  }

  it("o #767c8c que reprovava continua reprovando — senão o teste acima não mede nada", () => {
    // Sem este caso negativo, alguém devolve o cinza antigo "porque ficava mais
    // discreto" e os testes acima passam medindo a regressão em vez da regra.
    expect(contraste("#767c8c", "#131313")).toBeLessThan(MINIMO);
    expect(contraste("#7d8494", "#131313")).toBeGreaterThanOrEqual(MINIMO);
  });
});
