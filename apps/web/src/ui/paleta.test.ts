import { describe, expect, it } from "vitest";

import tabela from "../dados/paleta.json";
import { enquadrar, paletaDaEspecie } from "./paleta.ts";

/**
 * A paleta muda com o Pokémon — então o contraste tem que valer para TODOS.
 *
 * ⚠️ Este arquivo existe por causa de um defeito real, e não por precaução.
 *
 * Quando o botão primário passou a usar a cor da espécie ("era pra ser laranja,
 * a cor predominante do dragonite"), o texto continuou branco, como era com o
 * violeta Ultra. Sobre o violeta (`#5b3df5`) branco dá 7,6:1; sobre o laranja do
 * Dragonite (`#faa642`) dá **1,98:1**. O botão mais importante do app ficaria
 * ilegível — e no sol, que é onde ele é usado.
 *
 * O `contraste.test.ts` não pega isso e nunca vai pegar: ele mede tokens
 * estáticos do CSS, e estas cores só existem em tempo de execução, uma por
 * espécie. A garantia tem que ser aqui, varrendo a tabela inteira.
 *
 * O que se testa é a REGRA, não um valor: conferir que o Dragonite ficou legível
 * não diz nada sobre as outras 1.141.
 */

const FUNDO_ESCURO = "#0a0c10";
const FUNDO_CLARO = "#ffffff";

function luminancia(hexa: string): number {
  const n = parseInt(hexa.slice(1), 16);
  const canal = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * canal((n >> 16) & 255) +
    0.7152 * canal((n >> 8) & 255) +
    0.0722 * canal(n & 255)
  );
}

function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return la > lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}

const ids = Object.keys(tabela as Record<string, unknown>).map(Number);

describe("paleta por espécie", () => {
  it("tem paleta para praticamente toda espécie com arte", () => {
    // 1.142 de 1.143 sprites; a que falta é monocromática e cai no plano B.
    expect(ids.length).toBeGreaterThan(1100);
  });

  it("a tinta do botão primário passa 4,5:1 sobre a cor cheia, em toda espécie", () => {
    const ruins: string[] = [];
    for (const id of ids) {
      const p = paletaDaEspecie(id);
      const r = contraste(p.tinta, p.base);
      if (r < 4.5) ruins.push(`#${id}: tinta ${p.tinta} sobre ${p.base} = ${r.toFixed(2)}`);
    }
    expect(ruins).toEqual([]);
  });

  it("a cor de texto passa 4,5:1 no tema escuro, em toda espécie", () => {
    const ruins: string[] = [];
    for (const id of ids) {
      const p = paletaDaEspecie(id);
      const r = contraste(p.legivelEscuro, FUNDO_ESCURO);
      if (r < 4.5) ruins.push(`#${id}: ${p.legivelEscuro} = ${r.toFixed(2)}`);
    }
    expect(ruins).toEqual([]);
  });

  it("a cor de texto passa 4,5:1 no tema claro, em toda espécie", () => {
    const ruins: string[] = [];
    for (const id of ids) {
      const p = paletaDaEspecie(id);
      const r = contraste(p.legivelClaro, FUNDO_CLARO);
      if (r < 4.5) ruins.push(`#${id}: ${p.legivelClaro} = ${r.toFixed(2)}`);
    }
    expect(ruins).toEqual([]);
  });

  it("a saudação passa 4,5:1 sobre a cor do topo, em toda espécie", () => {
    // "coloca ... auto contraste pra quando ao mudar o pokemon, nao dar bosta
    // ... testa com todas as cores." É literalmente este teste: a faixa do topo
    // é pintada com a cor da espécie, e o nome do treinador fica em cima dela.
    const ruins: string[] = [];
    for (const id of ids) {
      const p = paletaDaEspecie(id);
      const r = contraste(p.topoTinta, p.topo);
      if (r < 4.5) ruins.push(`#${id}: ${p.topoTinta} sobre ${p.topo} = ${r.toFixed(2)}`);
    }
    expect(ruins).toEqual([]);
  });

  it("a cor do topo é escura o bastante para o texto branco em toda espécie", () => {
    // A cor do topo é a parada mais escura do gradiente justamente para isto —
    // se alguma espécie escapasse, a saudação viraria texto claro sobre claro.
    const claras = ids.filter((id) => luminancia(paletaDaEspecie(id).topo) > 0.18);
    expect(claras).toEqual([]);
  });

  it("o gradiente do hero traz as três paradas com posição, como o handoff pede", () => {
    // `#x 0%, #y 48%, #z 72%` — a posição vem daqui porque o CSS não consegue
    // intercalar porcentagens entre itens de uma lista vinda de variável.
    const g = paletaDaEspecie(149).gradiente;
    expect(g).toMatch(/^#[0-9a-f]{6} 0%, #[0-9a-f]{6} 48%, #[0-9a-f]{6} 72%$/);
  });

  it("enquadra toda espécie com o topo da silhueta no mesmo lugar", () => {
    /*
     * "tem q testar pokemon por pokemon, pra sempre dar certo."
     *
     * É este teste. A arte oficial não enquadra os Pokémon igual — medido, a
     * silhueta do Dragonite ocupa 91% da altura do PNG e a do Charizard 71% —
     * e por isso o nome caía no rosto de uns e no pé de outros.
     *
     * Com o enquadramento medido, o topo da silhueta cai no MESMO ponto em
     * todas. É o que faz um único layout servir para as 1.142 em vez de para a
     * que eu conferi na tela.
     */
    const tab = tabela as unknown as Record<string, { b: [number, number, number, number] }>;
    const topos = ids.map((id) => {
      const e = enquadrar(id);
      const b = tab[String(id)]!.b;
      return b[1] * e.escala + e.deslocaY / 100;
    });
    const menor = Math.min(...topos);
    const maior = Math.max(...topos);
    // Meio ponto percentual de variação, que é arredondamento da caixa medida.
    expect(maior - menor).toBeLessThan(0.005);
  });

  it("nunca amplia a ponto de borrar: escala com teto de 1,45", () => {
    const demais = ids.filter((id) => enquadrar(id).escala > 1.45);
    expect(demais).toEqual([]);
  });

  it("espécie sem paleta cai no plano B em vez de quebrar", () => {
    const p = paletaDaEspecie(999999);
    expect(p.cruas).toEqual([]);
    expect(contraste(p.tinta, p.base)).toBeGreaterThanOrEqual(4.5);
  });

  it("mantém a matiz: Dragonite laranja, Mewtwo lavanda pálido", () => {
    // A regressão que isto trava é a inversa da de contraste: uma cor que passa
    // no contraste mas perdeu o Pokémon de vista. Ver `dataset/src/paleta.ts`.
    const dragonite = paletaDaEspecie(149);
    expect(dragonite.cruas[0]).toMatch(/^#f/i); // laranja claro dominante

    const mewtwo = paletaDaEspecie(150);
    const n = parseInt((mewtwo.cruas[0] ?? "#000000").slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    // Quase acromático: é branco puxado pra roxo, e não roxo.
    expect(sat).toBeLessThan(0.15);
  });
});
