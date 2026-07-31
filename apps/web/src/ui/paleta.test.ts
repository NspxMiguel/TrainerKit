import { describe, expect, it } from "vitest";

import tabela from "../dados/paleta.json";
import { enquadrar, gradienteDaEspecie, paletaDaEspecie } from "./paleta.ts";

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
// A superficie clara REAL do app, e nao branco puro — ver a nota em `paleta.ts`.
const FUNDO_CLARO = "#f1f3f8";

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

  it("mede a silhueta de toda espécie, nas duas fontes de imagem", () => {
    /*
     * "testo com todos os pokemons ja? procura tudo po."
     *
     * É este teste, e ele achou o que oito espécies na tela não achariam. As
     * medidas têm que ser plausíveis para as 1.142 × 2 fontes: uma caixa
     * degenerada (largura ou altura zero, topo fora do quadro) faria o CSS
     * dividir por quase-zero e o bicho explodir na tela.
     */
    const ruins: string[] = [];
    for (const id of ids) {
      for (const fonte of ["artwork", "3d"] as const) {
        const q = enquadrar(id, fonte);
        if (q.larg <= 0.02 || q.larg > 1) ruins.push(`#${id} ${fonte}: larg ${q.larg}`);
        if (q.alt <= 0.02 || q.alt > 1) ruins.push(`#${id} ${fonte}: alt ${q.alt}`);
        if (q.topo < 0 || q.topo > 0.9) ruins.push(`#${id} ${fonte}: topo ${q.topo}`);
        if (q.centroX < 0.05 || q.centroX > 0.95) ruins.push(`#${id} ${fonte}: cx ${q.centroX}`);
      }
    }
    expect(ruins).toEqual([]);
  });

  it("as duas fontes enquadram diferente — por isso as duas são medidas", () => {
    // Se fossem iguais, a segunda caixa seria peso morto no pacote. Não são:
    // Bulbasaur ocupa 85% da altura na arte oficial e 71% no render 3D.
    const diferentes = ids.filter((id) => {
      const a = enquadrar(id, "artwork");
      const b = enquadrar(id, "3d");
      return Math.abs(a.alt - b.alt) > 0.03 || Math.abs(a.topo - b.topo) > 0.03;
    });
    expect(diferentes.length).toBeGreaterThan(ids.length * 0.5);
  });

  /**
   * O lado da arte, exatamente como o `--tk-lado` do `design.css` calcula.
   *
   * Ter a conta em UM lugar aqui é o que permite os três testes abaixo cobrarem
   * coisas diferentes da mesma fórmula. Se o CSS mudar e isto não, os testes
   * passam a medir ficção — por isso os números aparecem literais nos dois
   * arquivos, com o comentário de lá apontando pra cá.
   */
  /** A altura do bloco de decisão — o `--tk-hero-bloco` do design.css. */
  const BLOCO = 146;

  function ladoDaArte(
    q: { larg: number; alt: number; barriga: number },
    cqw: number,
    cqh: number,
  ): number {
    return Math.min(
      cqw / q.larg, //                        100cqw / larg
      (0.95 * cqh) / (q.barriga * q.alt), //   95cqh / (barriga × alt) — a cara livre
      (0.95 * cqh + BLOCO) / q.alt, //         (95cqh + bloco) / alt   — os pés inteiros
      710, //                                  710px — 1,5x a resolução do arquivo
    );
  }

  /** As caixas reais da faixa de cima do hero, do iPhone estreito ao desktop. */
  const PROPORCOES: Array<[number, number]> = [
    [339, 243], // iPhone de 375
    [394, 300], // iPhone Pro Max
    [584, 380], // contêiner do desktop
    [339, 180], // hero espremido por um aviso na home
  ];

  it("nenhuma silhueta estoura a caixa pela lateral, em nenhuma proporção", () => {
    /*
     * "procura tudo po."
     *
     * ⚠️ O que isto protege é o TETO. Ele existe pra não ampliar uma silhueta
     * pequena até mostrar o pixel; se alguém subir esse número achando que
     * "deixa o bicho maior", espécies largas passam a vazar pela lateral. Aqui
     * isso vira teste vermelho em vez de um Pokémon cortado que só aparece
     * quando alguém abre justamente aquele.
     */
    const ruins: string[] = [];
    for (const [cqw, cqh] of PROPORCOES) {
      for (const id of ids) {
        for (const fonte of ["artwork", "3d"] as const) {
          const q = enquadrar(id, fonte);
          const lado = ladoDaArte(q, cqw, cqh);
          if (q.larg * lado > cqw + 0.5) ruins.push(`#${id} ${fonte} ${cqw}×${cqh}: larga demais`);
        }
      }
    }
    expect(ruins).toEqual([]);
  });

  it("a cara fica livre do texto em TODA espécie, nas duas fontes", () => {
    /*
     * ⚠️ ESTE É O TESTE QUE ELE PEDIU COM TODAS AS LETRAS.
     *
     * "eu nao gsto disso, da cara do pokemon estar tapada. ent testa um por um,
     * e deixa sempre a cara livre, sem nada. a cara e a parte da barriga pra
     * cima."
     *
     * "Testa um por um" não é força de expressão neste app — foi assim que
     * apareceram as 527 espécies desenhadas pequenas demais e as 823 com
     * contraste reprovado, nenhuma delas visível nos oito Pokémon que eu tinha
     * aberto. O nome cruzava a boca do Venusaur, o peito do Machamp e o rosto
     * inteiro do Hoopa, e cada um exigiria um ajuste diferente.
     *
     * A regra, em geometria: o topo da silhueta fica em 5% da faixa, a faixa
     * termina onde o nome começa, e a parte da silhueta que vai da BARRIGA PRA
     * CIMA tem que caber antes disso.
     *
     * ⚠️ A barriga é medida POR ESPÉCIE, no gerador. Eu tentei duas frações
     * únicas antes — 62% encostava no queixo do Venusaur, 75% ainda cruzava a
     * boca dele na ficha, onde o bicho fica maior. Uma fração não serve a 1.142
     * formas: Machamp dá 0,95, Venusaur 0,82, Gyarados 0,65.
     */
    const ruins: string[] = [];
    for (const [cqw, cqh] of PROPORCOES) {
      for (const id of ids) {
        for (const fonte of ["artwork", "3d"] as const) {
          const q = enquadrar(id, fonte);
          const lado = ladoDaArte(q, cqw, cqh);
          const topo = 0.05 * cqh;
          const linhaDaBarriga = topo + q.barriga * q.alt * lado;
          if (linhaDaBarriga > cqh + 0.5) {
            ruins.push(
              `#${id} ${fonte} ${cqw}×${cqh}: barriga em ${linhaDaBarriga.toFixed(0)}px de ${cqh}`,
            );
          }
        }
      }
    }
    expect(ruins).toEqual([]);
  });

  it("os pés não são cortados pelo fim do hero, em nenhuma altura de tela", () => {
    /*
     * O outro lado da mesma moeda, e a razão do teto de 120%.
     *
     * O que passa de 100% da faixa desce pro bloco de decisão — que tem altura
     * FIXA (146px: nome, frase, botão e recuos) enquanto a faixa cresce com a
     * tela. Sem esta regra, uma silhueta cuja barriga fica alta (Gyarados, 0,65)
     * poderia descer 146% da faixa, e o `overflow: hidden` do hero cortaria os
     * pés no meio numa tela alta.
     *
     * ⚠️ O bloco é o piso, e não a faixa: em tela alta a faixa cresce e o bloco
     * não. Testar só o aparelho pequeno esconderia exatamente o caso ruim.
     */
    const ruins: string[] = [];
    for (const [cqw, cqh] of PROPORCOES) {
      for (const id of ids) {
        for (const fonte of ["artwork", "3d"] as const) {
          const q = enquadrar(id, fonte);
          const lado = ladoDaArte(q, cqw, cqh);
          const pes = 0.05 * cqh + q.alt * lado;
          if (pes > cqh + BLOCO + 0.5) {
            ruins.push(`#${id} ${fonte} ${cqw}×${cqh}: pés em ${pes.toFixed(0)}px de ${cqh + BLOCO}`);
          }
        }
      }
    }
    expect(ruins).toEqual([]);
  });

  it("o monograma branco passa 4,5:1 sobre o selo, em toda espécie", () => {
    /*
     * ⚠️ 671 de 1.142 reprovavam — 59% — e eu nunca tinha medido.
     *
     * O monograma ("BU", "CH") só aparece com a fonte de imagens desligada ou
     * enquanto o sprite carrega. Some rápido, e some justamente enquanto quem
     * testa está olhando: por isso passou por todas as revisões visuais.
     *
     * O foco do radial é a parte mais clara do selo, então é o pior caso.
     */
    const ruins: string[] = [];
    for (const id of ids) {
      const g = gradienteDaEspecie(id, "");
      const foco = g.match(/#[0-9a-f]{6}/i)?.[0];
      if (!foco) continue;
      const r = contraste("#ffffff", foco);
      if (r < 4.5) ruins.push(`#${id}: branco sobre ${foco} = ${r.toFixed(2)}`);
    }
    expect(ruins).toEqual([]);
  });

  it("o nome do hero passa 3:1 sobre o gradiente, em toda espécie", () => {
    /*
     * ⚠️ 152 reprovavam, TODAS amarelas ou verde-claras: Bellsprout em 1,73:1,
     * Abra em 2,04, Pikachu em 2,73.
     *
     * A causa foi limitar as paradas por CLARIDADE em vez de luminância.
     * Amarelo em `l = 0.56` tem quase o triplo da luminância de azul na mesma
     * claridade, porque a fórmula da WCAG pesa verde e vermelho muito mais que
     * azul. Nenhuma espécie azul ou roxa falhava — que é exatamente por que
     * nunca apareceu: Dragonite, Bulbasaur, Mewtwo e Venusaur passam todos.
     *
     * Testar por AMOSTRA não pegaria isto nunca. Só varrendo.
     */
    const ruins: string[] = [];
    for (const id of ids) {
      const paradas = paletaDaEspecie(id).gradiente.match(/#[0-9a-f]{6}/gi) ?? [];
      // O nome fica a 54% da altura: entre a segunda parada (48%) e a terceira (72%).
      for (const parada of paradas.slice(1)) {
        const r = contraste("#ffffff", parada);
        if (r < 3) ruins.push(`#${id}: branco sobre ${parada} = ${r.toFixed(2)}`);
      }
    }
    expect(ruins).toEqual([]);
  });


  it("a tinta de fundo não derruba o texto, em nenhuma espécie", () => {
    /*
     * ⚠️ O fundo do app passou a ter a COR DA ESPÉCIE ("sem cor no meio"), e um
     * fundo que muda por Pokémon é exatamente o tipo de coisa que quebra o
     * contraste sem ninguém ver — foi assim que nasceram as 823 reprovações de
     * luminância desta mesma tabela.
     *
     * A conta aqui repete a do `design.css`: `--tk-accent-topo` misturado a 30%
     * sobre o fundo escuro, e o texto composto por cima. O 30 saiu DESTE teste:
     * comecei em 42% e ele reprovou 104 espécies, todas em `--tk-text-3` entre
     * 4,34 e 4,42 — perto o bastante do mínimo para eu nunca ver no olho. Se os dois arquivos
     * discordarem, isto mede ficção — por isso o número aparece literal nos dois,
     * com o comentário de lá apontando pra cá.
     *
     * O que torna isto seguro é a ESCOLHA da variável: `topo` é a parada mais
     * escura do gradiente, e o teste logo acima já cobra que a luminância dela
     * fique abaixo de 0,18 em todas as espécies.
     */
    const TINTA = 0.3;
    const FUNDO = { r: 0x0a, g: 0x0c, b: 0x11 };

    const canais = (hexa: string) => {
      const n = parseInt(hexa.slice(1), 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    };
    const paraHex = (c: { r: number; g: number; b: number }) =>
      `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
    /** Compõe `frente` com alfa `a` sobre `atras`. */
    const sobre = (
      frente: { r: number; g: number; b: number },
      atras: { r: number; g: number; b: number },
      a: number,
    ) => ({
      r: frente.r * a + atras.r * (1 - a),
      g: frente.g * a + atras.g * (1 - a),
      b: frente.b * a + atras.b * (1 - a),
    });

    // As três cores de texto do tema escuro, com o alfa real dos tokens.
    const TEXTOS: Array<[string, { r: number; g: number; b: number }, number, number]> = [
      ["--tk-text", { r: 0xf4, g: 0xf6, b: 0xfa }, 1, 4.5],
      ["--tk-text-2", { r: 235, g: 238, b: 245 }, 0.62, 4.5],
      ["--tk-text-3", { r: 235, g: 238, b: 245 }, 0.52, 4.5],
    ];

    const ruins: string[] = [];
    for (const id of ids) {
      const topo = canais(paletaDaEspecie(id).topo);
      const fundo = sobre(topo, FUNDO, TINTA);
      const fundoHex = paraHex(fundo);
      for (const [nome, cor, alfa, minimo] of TEXTOS) {
        const composto = paraHex(sobre(cor, fundo, alfa));
        const r = contraste(composto, fundoHex);
        if (r < minimo) ruins.push(`#${id} ${nome}: ${r.toFixed(2)} sobre ${fundoHex}`);
      }
    }
    expect(ruins).toEqual([]);
  });


  it("o nome do hero passa 3:1 sobre o gradiente CLARO, em toda espécie", () => {
    /*
     * ⚠️ O espelho exato do teste acima, e ele existe pela mesma razão.
     *
     * "faz o degrade ser branco no modo claro ne...." — o hero deixou de ser
     * escuro nos dois temas, e agora há um segundo gradiente por espécie. Um
     * gradiente novo sem varredura é como as 152 espécies com o nome ilegível
     * apareceram da primeira vez.
     *
     * No tema claro o nome é quase-preto (`#141920`) e é texto grande
     * (38px/800), então o mínimo é 3:1.
     */
    const ruins: string[] = [];
    for (const id of ids) {
      const paradas = paletaDaEspecie(id).gradienteClaro.match(/#[0-9a-f]{6}/gi) ?? [];
      for (const parada of paradas) {
        const r = contraste("#141920", parada);
        if (r < 3) ruins.push(`#${id}: tinta escura sobre ${parada} = ${r.toFixed(2)}`);
      }
    }
    expect(ruins).toEqual([]);
  });

  it("a saudação passa 4,5:1 sobre o topo CLARO, em toda espécie", () => {
    // A faixa acima do hero é pintada com a primeira parada do gradiente claro,
    // e a saudação vive nela. Mesma cobrança da versão escura — ver o teste da
    // `topoTinta`, que nasceu de "coloca auto contraste pra quando ao mudar o
    // pokemon, nao dar bosta. testa com todas as cores".
    const ruins: string[] = [];
    for (const id of ids) {
      const p = paletaDaEspecie(id);
      const r = contraste(p.topoClaroTinta, p.topoClaro);
      if (r < 4.5) ruins.push(`#${id}: ${p.topoClaroTinta} sobre ${p.topoClaro} = ${r.toFixed(2)}`);
    }
    expect(ruins).toEqual([]);
  });

  it("o topo claro é CLARO mesmo — senão o pedido não foi cumprido", () => {
    /*
     * O pedido era "branco no modo claro". Um teste que só cobra contraste
     * aceitaria um topo cinza-médio com texto preto — passaria em 4,5:1 e
     * continuaria não sendo branco.
     *
     * Luminância ≥ 0,62 é o que garante que a faixa leia como parte de uma tela
     * branca, e não como um painel colorido.
     */
    const escuras = ids.filter((id) => luminancia(paletaDaEspecie(id).topoClaro) < 0.62);
    expect(escuras).toEqual([]);
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
