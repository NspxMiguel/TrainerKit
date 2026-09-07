import { describe, expect, it } from "vitest";

import { DICTS } from "./index.js";

/**
 * CONCORDANCIA depois da troca de marca.
 *
 * A varredura que tirou o nome da franquia trocou uma palavra MASCULINA e
 * INVARIAVEL por uma FEMININA que flexiona. Cada troca deixou o determinante e
 * o adjetivo em volta no genero e no numero antigos, e o resultado passa em
 * typecheck, em teste de chave e em teste de interpolacao — so quem le percebe.
 *
 * Ja apareceram, em rodadas diferentes: "um espécie", "{count} espécie
 * importados", "Salve seus espécie", "os próprios espécie", "algunos especie".
 * Tres varreduras, tres achados novos: por isso virou teste, e nao mais uma
 * varredura.
 */
const PADROES: { idioma: string; regex: RegExp; explica: string }[] = [
  {
    idioma: "pt-BR",
    /* Determinante masculino colado em "espécie". O `s?` pega o singular e o
       plural: "os espécie" e "os espécies" estao os dois errados. */
    regex:
      /\b(o|os|um|uns|seu|seus|meu|meus|nosso|nossos|este|estes|esse|esses|aquele|aqueles|outro|outros|todo|todos|muito|muitos|pouco|poucos|vário|vários|novo|novos|próprio|próprios|mesmo|mesmos) espécies?\b/i,
    explica: "determinante masculino antes de espécie",
  },
  {
    idioma: "pt-BR",
    /* Singular do determinante com o plural do substantivo, e vice-versa. */
    regex: /\b(uma|a|esta|essa|aquela|outra|sua|minha|nossa|própria|mesma) espécies\b/i,
    explica: "determinante singular antes de espécies",
  },
  {
    idioma: "pt-BR",
    /*
     * CONTRAÇÃO QUE FALTOU.
     *
     * A troca de marca pôs "o jogo" onde antes havia um nome próprio, e em
     * português a preposição contrai: "de o jogo" tinha que virar "do jogo".
     * Apareceram dois — "Transfira no o jogo primeiro" e "Só sei falar de o
     * jogo" — e os dois passaram por typecheck, teste de chave e revisão.
     */
    /*
     * ⚠️ SEM o "a" solto na lista. O `\b` do JavaScript só conhece
     * `[A-Za-z0-9_]`, então "ç" conta como fronteira e "alcança os" casava
     * como se fosse a preposição "a" seguida de artigo. Duas frases corretas
     * foram acusadas antes de eu perceber. Com "de", "em" e "por" o padrão
     * fica sem ambiguidade.
     */
    regex: /\b(de|em|por) (o|a|os|as)\s/i,
    explica: "preposição sem contrair (de o, em a, …)",
  },
  {
    idioma: "es",
    /* "de su especie" e "otro de su especie" estão CERTOS — o `de` antes muda a
       frase de posse para pertencimento, e aí o singular é o correto. */
    regex:
      /(?<!de )\b(el|los|un|unos|sus|mis|este|estos|ese|esos|aquel|aquellos|otros|todos|muchos|algunos|nuevos|propios|mismos) especies?\b/i,
    explica: "determinante masculino antes de especie",
  },
  {
    idioma: "es-419",
    regex:
      /(?<!de )\b(el|los|un|unos|sus|mis|este|estos|ese|esos|aquel|aquellos|otros|todos|muchos|algunos|nuevos|propios|mismos) especies?\b/i,
    explica: "determinante masculino antes de especie",
  },
];

describe("concordância de gênero e número nos dicionários", () => {
  for (const { idioma, regex, explica } of PADROES) {
    it(`${idioma}: sem ${explica}`, () => {
      const dict = DICTS[idioma];
      expect(dict, `dicionário ${idioma} sumiu`).toBeDefined();
      const erradas: string[] = [];
      for (const [chave, texto] of Object.entries(dict!)) {
        const achou = regex.exec(texto);
        if (achou) erradas.push(`${chave}: "…${achou[0]}…"`);
      }
      expect(erradas, erradas.join("\n")).toEqual([]);
    });
  }
});
