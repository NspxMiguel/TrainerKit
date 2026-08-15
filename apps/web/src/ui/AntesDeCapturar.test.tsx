import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { computeCPAtLevel, faixaDePC } from "@trainerkit/core";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { AntesDeCapturar } from "./AntesDeCapturar.tsx";

/**
 * Os quatro estados da secao, na tela.
 *
 * A conta ja tem teste proprio no core (`encounter.test.ts`), incluindo a
 * varredura das 216 combinacoes de raide. O que este arquivo protege e a outra
 * metade: que a tela MOSTRE o estado certo pra cada resposta. Um solver correto
 * atras de uma tela que sempre diz "so pode ser X" seria pior que nao ter a
 * feature — e justamente a resposta confiante e errada que o app nao pode dar.
 *
 * Montado com `createRoot` direto, como `folha.test.tsx` — o `apps/web` nao tem
 * biblioteca de teste de componente e trazer uma pra isto seria caro.
 *
 * O texto conferido e o INGLES, que e a fonte das chaves — sem idioma
 * guardado, `getLanguage()` cai nele, e assim o teste bate contra a string de
 * verdade em vez de contra um `fallback`.
 *
 * ⚠️ O NAVEGADOR NAO SERVIU PRA CONFERIR ISTO. A Browser pane fica oculta e
 * clique nela expira; o estado da secao so muda por toque. Aqui o React roda em
 * jsdom e o toque e sincrono.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const dados = JSON.parse(
  readFileSync(join(AQUI, "..", "..", "public", "dataset", "gamedata.json"), "utf8"),
) as {
  cpm: number[];
  species: Array<{ id: string; name: string; baseStats: { atk: number; def: number; hp: number } }>;
};

function especie(id: string): DatasetSpecies {
  const s = dados.species.find((x) => x.id === id);
  if (!s) throw new Error(`${id} sumiu do dataset`);
  // A secao le `name` e `baseStats`, e mais nada. O molde completo do
  // `DatasetSpecies` traria trinta campos que nenhum caminho daqui toca.
  return s as unknown as DatasetSpecies;
}

const DATA = { cpm: dados.cpm } as unknown as Dataset;

let container: HTMLDivElement;
let root: Root;

function montar(id: string) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<AntesDeCapturar species={especie(id)} data={DATA} />);
  });
}

/** Aperta o botao cujo texto contem `texto`. */
function tocar(texto: string) {
  const alvo = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(texto),
  );
  if (!alvo) throw new Error(`nao achei botao com "${texto}"`);
  act(() => alvo.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function digitarCp(valor: number | string) {
  const campo = container.querySelector("input[type=number]") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(campo, String(valor));
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const texto = () => container.textContent ?? "";

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("a secao comeca em raide, que e onde a conta responde", () => {
  it("mostra a faixa de PC antes de digitar qualquer coisa", () => {
    montar("mewtwo");
    // Mewtwo de raide sai entre 2.294 e 2.387 — numeros publicos, os mesmos do
    // `catchRange.test.ts`.
    expect(texto()).toContain("2,294");
    expect(texto()).toContain("2,387");
    // Sem PC digitado nao ha resultado nenhum na tela.
    expect(texto()).not.toContain("/ 45");
  });

  it("o nivel e o piso ficam visiveis, que e de onde a resposta sai", () => {
    montar("mewtwo");
    digitarCp(2387);
    expect(texto()).toContain("20");
    expect(texto()).toContain("IV ≥ 10");
  });
});

describe("PC no maximo da raide: a tela responde exato", () => {
  it("mostra 45/45 e a combinacao unica", () => {
    montar("mewtwo");
    digitarCp(faixaDePC(especie("mewtwo").baseStats, "raide", dados.cpm).max);
    expect(texto()).toContain("45");
    expect(texto()).toContain("/ 45");
    expect(texto()).toContain("15/15/15");
    expect(texto()).toContain("100%");
  });

  it("PC do meio da faixa nao inventa exatidao", () => {
    montar("mewtwo");
    const cp = computeCPAtLevel(dados.cpm, especie("mewtwo").baseStats, {
      atk: 12,
      def: 13,
      hp: 11,
    }, 20);
    digitarCp(cp);
    const t = texto();
    // Ou fecha numa combinacao, ou diz quantas sobraram — nunca as duas.
    const fechou = t.includes("Only ");
    const contou = t.includes("combinations still fit");
    expect(fechou !== contou).toBe(true);
  });
});

describe("PC fora da faixa: contradicao visivel, e nao um IV qualquer", () => {
  it("avisa e repete os dois extremos validos", () => {
    montar("mewtwo");
    digitarCp(9999);
    expect(texto()).toContain("doesn't exist here");
    expect(texto()).toContain("2,294");
    expect(texto()).toContain("2,387");
    // Nenhum numero de IV aparece junto do aviso.
    expect(texto()).not.toContain("15/15/15");
  });
});

describe("selvagem: a tela diz que nao decide", () => {
  it("troca pra selvagem, conta as combinacoes e explica por que", () => {
    montar("bulbasaur");
    tocar("Wild");
    const cp = computeCPAtLevel(dados.cpm, especie("bulbasaur").baseStats, {
      atk: 7,
      def: 7,
      hp: 7,
    }, 15);
    digitarCp(cp);
    const t = texto();
    expect(t).toContain("combinations still fit");
    expect(t).toContain("never settles it");
    // A faixa aparece, mas como faixa: nao ha combinacao unica.
    expect(t).not.toContain("Only ");
  });

  it("a nota do selvagem NAO aparece na raide", () => {
    montar("mewtwo");
    digitarCp(2350);
    expect(texto()).not.toContain("never settles it");
  });
});

describe("clima esquecido: o app aponta, em vez de recusar", () => {
  /*
   * O caso mais comum da tela: a pessoa derruba uma raide com clima favoravel,
   * digita o PC e esquece de marcar o clima. As duas faixas nao se tocam, entao
   * sem esta checagem o app diria "esse PC nao existe" sobre um numero que ela
   * esta vendo no jogo.
   */
  it("PC da faixa com clima, com o clima desligado, sugere ligar", () => {
    montar("mewtwo");
    digitarCp(2984);
    expect(texto()).toContain("doesn't exist here");
    expect(texto()).toContain("weather boost on");
  });

  it("e o contrario tambem: clima ligado, PC da faixa normal", () => {
    montar("mewtwo");
    tocar("Weather boosted");
    digitarCp(2387);
    expect(texto()).toContain("doesn't exist here");
    expect(texto()).toContain("without the weather boost");
  });

  it("PC fora das DUAS faixas nao sugere nada", () => {
    montar("mewtwo");
    digitarCp(9999);
    expect(texto()).toContain("doesn't exist here");
    expect(texto()).not.toContain("weather boost on");
  });
});

describe("clima: o controle so existe onde o clima muda alguma coisa", () => {
  it("aparece na raide e some no ovo e na pesquisa", () => {
    montar("mewtwo");
    expect(texto()).toContain("Weather boosted");
    tocar("Egg");
    expect(texto()).not.toContain("Weather boosted");
    tocar("Research");
    expect(texto()).not.toContain("Weather boosted");
    tocar("Raid");
    expect(texto()).toContain("Weather boosted");
  });

  it("ligar o clima sobe a faixa inteira", () => {
    montar("mewtwo");
    tocar("Weather boosted");
    // Nivel 25 em vez de 20: 2.868–2.984.
    expect(texto()).toContain("2,868");
    expect(texto()).toContain("2,984");
    expect(texto()).not.toContain("2,387");
  });
});

describe("ovo e pesquisa saem em niveis diferentes", () => {
  it("pesquisa e nivel 15, e a faixa desce junto", () => {
    montar("mewtwo");
    const raide = texto();
    tocar("Research");
    const pesquisa = texto();
    expect(raide).not.toBe(pesquisa);
    // A faixa da pesquisa fica inteira abaixo da menor da raide.
    const f = faixaDePC(especie("mewtwo").baseStats, "pesquisa", dados.cpm);
    expect(pesquisa).toContain(f.max.toLocaleString("en-US"));
  });
});
