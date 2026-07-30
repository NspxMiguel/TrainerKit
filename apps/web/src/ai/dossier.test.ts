import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { speciesDossier } from "./dossier.ts";

/**
 * O texto que a IA le, testado como texto.
 *
 * Este arquivo e o unico lugar do app onde um erro meu vira uma frase confiante
 * na tela do usuario sem passar por codigo nenhum: o modelo repete o que esta
 * escrito aqui. E foi exatamente o que aconteceu, duas vezes:
 *
 *   1. Escrevi "Blissey tem aguento perto de 5.100.000" de cabeça. O real e
 *      58.602 — 87 vezes menor. O modelo comparou e disse que Dragonite "não é
 *      bom para segurar ginásio", quando ele tem metade do aguento do melhor do
 *      jogo.
 *   2. Mandei "ataque 129" sem escala nenhuma, e o modelo respondeu "o alto
 *      ataque de Blissey". 129 e BAIXO: 27% das especies ficam abaixo disso.
 *
 * Nos dois casos o modelo se comportou bem — o defeito estava no que eu mandei.
 * Entao o teste e sobre o TEXTO, nao sobre a funcao: ele monta o dossie de
 * verdade, sobre o dataset de verdade, e le o que saiu.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "public", "dataset", "gamedata.json");

const data = JSON.parse(readFileSync(DATASET, "utf8")) as Dataset;

function especie(id: string): DatasetSpecies {
  const s = data.species.find((x) => x.id === id);
  if (!s) throw new Error(`especie ausente: ${id}`);
  return s;
}

const dossie = (id: string) => speciesDossier(especie(id), data);

describe("escala dos atributos", () => {
  it("o ataque 129 do Blissey sai marcado como baixo, nunca como alto", () => {
    const linha = dossie("blissey")
      .split("\n")
      .find((l) => l.startsWith("Atributos base:"))!;

    expect(linha).toContain("ataque 129 (baixo:");
    // A frase exata que o modelo produziu quando faltava escala.
    expect(linha).not.toContain("ataque 129 (alto");
  });

  it("o extremo e dito pelo nome em vez de virar 100%", () => {
    // Blissey tem 496 de resistencia, o maior do jogo. Com arredondamento isto
    // saia "maior que 100% das espécies" — uma frase que se contradiz sozinha.
    expect(dossie("blissey")).toContain("resistência 496 (a maior do jogo)");
  });

  it("a faixa concorda com o genero do atributo", () => {
    /*
     * "Sua defesa é mediano" — resposta real da Pokedex, na tela, depois de eu
     * ter consertado o resto. O modelo nao errou portugues: ele copiou a palavra
     * do meu texto, que vinha sempre no masculino. Concordancia e do texto que
     * eu escrevo, nao do modelo que o le.
     */
    const linha = dossie("blissey")
      .split("\n")
      .find((l) => l.startsWith("Atributos base:"))!;

    expect(linha).toContain("defesa 169 (mediana:");
    expect(linha).not.toContain("(mediano");
    // Ataque e masculino e continua masculino.
    expect(linha).toContain("ataque 129 (baixo:");
  });

  it("nenhum atributo de nenhuma especie afirma ser maior que 100%", () => {
    for (const s of data.species.slice(0, 200)) {
      expect(speciesDossier(s, data), s.id).not.toContain("maior que 100%");
    }
  });

  it("os extremos conhecidos caem nas faixas certas", () => {
    // Mewtwo e ataque de elite; Shedinja tem 1 de vida, o piso do jogo.
    expect(dossie("mewtwo")).toContain("ataque 300 (muito alto:");
    expect(dossie("shedinja")).toContain("resistência 1 (muito baixa:");
  });
});

describe("aguento de ginasio no texto", () => {
  it("a referencia do Blissey sai em dezenas de milhares, nao em milhoes", () => {
    const texto = dossie("dragonite");
    // O numero que eu inventei. Se ele voltar, volta com esta ordem de grandeza.
    expect(texto).not.toMatch(/5\.1\d\d\.\d\d\d/);

    const m = /melhor parede do jogo — marca ([\d.]+)/.exec(texto);
    expect(m, "a comparacao com o Blissey sumiu do dossie").not.toBeNull();

    const bulk = Number(m![1]!.replaceAll(".", ""));
    expect(bulk).toBeGreaterThan(50_000);
    expect(bulk).toBeLessThan(70_000);
  });

  it("o numero do aguento nunca sai sem dizer que e um indice", () => {
    /*
     * "O Blissey aguenta 58.633 oq?" — a pergunta do Miguel, e ela e justa: o
     * numero nao tem unidade. O dossie tem que dizer isso na cara, senao o
     * modelo apresenta o indice como se fosse vida ou segundos.
     */
    const texto = dossie("blissey");
    expect(texto).toContain("índice de aguento");
    expect(texto).toContain("NÃO TEM UNIDADE");
  });

  it("a lista dos melhores tem numeros que descem junto com a numeracao", () => {
    /*
     * Este teste existe por um bug que nenhum outro teste pegava, porque nenhum
     * lia o texto: a lista saia "4º Arceus (Steel) 39.789, 5º Giratina 44.763".
     * A ordem vinha de `bulk / incomingAverage` e o numero impresso era o `bulk`
     * cru. Uma lista numerada cujos numeros contradizem a numeracao ensina o
     * modelo a desconfiar dela.
     */
    const linha = dossie("blissey")
      .split("\n")
      .find((l) => l.startsWith("Melhores defensores"))!;

    const valores = [...linha.matchAll(/\d+º [^\d]+ ([\d.]+)/g)].map((m) =>
      Number(m[1]!.replaceAll(".", "")),
    );
    expect(valores.length).toBe(5);
    for (let i = 1; i < valores.length; i += 1) {
      expect(valores[i]!, `${i + 1}º maior que o ${i}º`).toBeLessThanOrEqual(valores[i - 1]!);
    }
  });

  it("Dragonite aparece como metade do Blissey, nao como fraco", () => {
    const m = /(\d+)% do melhor defensor que existe/.exec(dossie("dragonite"));
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThan(40);
    expect(Number(m![1])).toBeLessThan(60);
  });

  it("o Blissey nao se compara consigo mesmo", () => {
    /*
     * Antes daqui saia "100% do aguento do Blissey" — no dossie DO Blissey. A
     * frase provava que a referencia passa pela mesma funcao que a especie (era
     * pra isso que ela existia), mas era ilegivel pra quem le a resposta, e os
     * testes em outros idiomas mostraram o estrago: em russo o modelo inventou
     * "aguenta 100% dos ataques do melhor defensor", e em coreano comparou o
     * Blissey com o Blissey.
     *
     * A garantia de que as duas contas nao divergem continua — agora pelo ramo
     * que so e alcançavel quando `meu` e `ref` batem.
     */
    const texto = dossie("blissey");
    expect(texto).toContain("Este É o melhor defensor de ginásio do jogo");
    expect(texto).not.toContain("100% do melhor defensor");
  });
});

describe("o dossie responde as perguntas que ja falharam", () => {
  it("traz os melhores do jogo, pra pergunta 'qual o melhor?'", () => {
    // "O dossiê não fornece informações sobre outros Pokémon" foi a resposta
    // real da Pokedex antes desta lista existir.
    expect(dossie("dragonite")).toContain("Melhores defensores de ginásio do jogo");
  });

  it("nao lista a forma inobtenivel entre os melhores", () => {
    // Eternamax tem 505 de defesa base e ja liderou esta lista numa tela minha.
    expect(dossie("blissey")).not.toContain("Eternamax");
  });

  it("diz na cara que ataque nao conta em defensor", () => {
    // Sem esta frase o modelo somava ataque ao julgar quem segura ginasio.
    expect(dossie("dragonite")).toContain("num defensor o ATAQUE não conta");
  });
});
