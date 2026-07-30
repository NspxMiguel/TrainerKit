import { describe, expect, it } from "vitest";

import { EDGE_VOICES } from "./edgeTts.ts";
import { getEdgeVoice } from "./edgeTts.ts";
import { listarVozes, recomendadas } from "./vozes.ts";

/**
 * "PEGA AS VOZES DA TAL LINGUA, NAO USAR UMA VOZ BRASILEIRA FALANDO JAPA"
 *
 * É a classe de defeito mais audível que este app pode ter, e a mais fácil de
 * voltar sem ninguém ver: basta alguém acrescentar uma voz na lista errada, ou
 * uma preferência antiga sobreviver a uma troca de idioma. Nenhum teste de tipo
 * pega isso — os dois lados são `string`.
 *
 * Então os testes aqui olham o DADO: cada voz oferecida pra um idioma tem que
 * ser daquele idioma, em todos os dez.
 */

const IDIOMAS = ["pt-BR", "en", "es", "es-419", "fr", "de", "it", "ja", "ko", "ru"];

describe("cada idioma só oferece vozes dele", () => {
  for (const idioma of IDIOMAS) {
    it(`${idioma}: as vozes neurais são do idioma`, () => {
      const base = idioma.split("-")[0]!;
      const lista = EDGE_VOICES[idioma] ?? [];
      expect(lista.length, `${idioma} ficou sem voz neural`).toBeGreaterThan(0);
      for (const v of lista) {
        // O id da Microsoft começa com o locale: `ja-JP-NanamiNeural`.
        expect(v.id.startsWith(base), `${v.id} não é de ${idioma}`).toBe(true);
      }
    });
  }
});

describe("a preferência não atravessa idiomas", () => {
  it("voz brasileira escolhida não fala japonês", () => {
    /*
     * O caso exato que ele nomeou. `getEdgeVoice` recebe a preferência e o
     * idioma; se a preferência for de outro idioma ela TEM que ser descartada.
     */
    const escolhida = getEdgeVoice("ja", "pt-BR-AntonioNeural");
    expect(escolhida.startsWith("ja")).toBe(true);
    expect(escolhida).not.toBe("pt-BR-AntonioNeural");
  });

  it("mas a preferência do idioma certo é respeitada", () => {
    // O outro lado: descartar demais faria a escolha da tela não valer nada —
    // que foi exatamente o bug que este conserto veio consertar.
    expect(getEdgeVoice("pt-BR", "pt-BR-AntonioNeural")).toBe("pt-BR-AntonioNeural");
  });

  it("preferência inexistente cai na primeira do idioma, nunca em vazio", () => {
    const v = getEdgeVoice("de", "voz-que-nao-existe");
    expect(v.startsWith("de")).toBe(true);
  });
});

describe("as recomendadas de cada idioma", () => {
  for (const idioma of IDIOMAS) {
    it(`${idioma}: nenhuma recomendada tem sotaque de outro idioma`, () => {
      const base = idioma.split("-")[0]!;
      // Sem vozes do sistema: em teste não há `speechSynthesis`, e o que
      // interessa aqui são as que o app controla.
      const boas = recomendadas(listarVozes(idioma, []));
      expect(boas.length, `${idioma} ficou sem nenhuma recomendada`).toBeGreaterThan(0);
      for (const v of boas) {
        expect(
          (v.sotaque ?? "").startsWith(base),
          `${v.nome} (${v.sotaque}) foi recomendada em ${idioma}`,
        ).toBe(true);
      }
    });
  }

  it("as vozes da ElevenLabs só são recomendadas em inglês", () => {
    /*
     * As 21 da biblioteca padrão são todas american/british/australian —
     * consultado na API, não estimado. Elas falam os outros idiomas pelo modelo
     * multilíngue, com sotaque. Recomendá-las em japonês seria o mesmo erro que
     * ele apontou, invertido.
     */
    for (const idioma of IDIOMAS) {
      const boas = recomendadas(listarVozes(idioma, []));
      const temEleven = boas.some((v) => v.motor === "eleven-share");
      expect(temEleven, `ElevenLabs recomendada em ${idioma}`).toBe(idioma === "en");
    }
  });
});
