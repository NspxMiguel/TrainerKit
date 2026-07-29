import { describe, expect, it } from "vitest";

import { LANGUAGES } from "./language.ts";
import { DICTS } from "./dict/index.ts";
import { EN } from "./dict/en.ts";

/**
 * O que estes testes protegem.
 *
 * O tipo `Dict` ja garante que todo idioma tenha todas as chaves — isso o
 * compilador resolve. O que ele NAO pega e o resto: um idioma listado no seletor
 * sem dicionario, uma traducao que esqueceu um `{parametro}` e some com o numero
 * na tela, ou um texto que ficou identico ao ingles porque passou batido.
 *
 * Foi por nao ter isto que o app passou semanas com o seletor de idioma trocando
 * so o nome dos ataques.
 */

const KEYS = Object.keys(EN) as Array<keyof typeof EN>;

describe("dicionarios", () => {
  it("todo idioma do seletor tem dicionario", () => {
    for (const l of LANGUAGES) {
      expect(DICTS[l.code], `sem dicionario: ${l.code}`).toBeDefined();
    }
  });

  it("nao ha dicionario orfao, fora do seletor", () => {
    const listed = new Set(LANGUAGES.map((l) => l.code));
    for (const code of Object.keys(DICTS)) {
      expect(listed.has(code), `dicionario nao listado: ${code}`).toBe(true);
    }
  });

  it("nenhuma chave fica vazia", () => {
    for (const [code, dict] of Object.entries(DICTS)) {
      for (const key of KEYS) {
        expect(dict[key]?.trim(), `${code} · ${key}`).toBeTruthy();
      }
    }
  });

  it("os parametros sobrevivem a traducao", () => {
    // `{cp}` perdido numa traducao vira um numero que some da tela sem erro
    // nenhum — o tipo de defeito que so aparece quando alguem reclama.
    const params = (s: string): string[] =>
      [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

    for (const [code, dict] of Object.entries(DICTS)) {
      if (code === "en") continue;
      for (const key of KEYS) {
        expect(params(dict[key]!), `${code} · ${key}`).toEqual(params(EN[key]));
      }
    }
  });

  it("os idiomas realmente traduzem, nao copiam o ingles", () => {
    // Alguns valores IGUAIS ao ingles sao legitimos: "PvP", "Pokédex", "BETA",
    // uma URL de exemplo. O que nao pode e um idioma inteiro ser copia.
    for (const [code, dict] of Object.entries(DICTS)) {
      if (code === "en") continue;
      const iguais = KEYS.filter((k) => dict[k] === EN[k]).length;
      const fracao = iguais / KEYS.length;
      expect(fracao, `${code}: ${Math.round(fracao * 100)}% igual ao ingles`).toBeLessThan(0.2);
    }
  });
});
