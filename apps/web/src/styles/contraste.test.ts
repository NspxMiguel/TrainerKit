import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { TYPE_NAMES, typeColor, typeInk } from "../sprites/provider.ts";

/**
 * As cores do app, medidas em vez de julgadas.
 *
 * ⚠️ POR QUE ISTO E UM TESTE, e nao uma revisao cuidadosa.
 *
 * Contraste ruim nao parece bug. Ninguem abre o app e pensa "4.08:1" — a
 * pessoa so acha o texto meio apagado, encosta o dedo na tela pra ler, e nao
 * reporta. Foi o que aconteceu tres vezes nesta sessao, e as tres so
 * apareceram porque eu parei pra CALCULAR:
 *
 *   --tk-succ  #0b8a5f  3.76   o "POWER UP" do cartao da home, 10px
 *   --tk-pri   #2e6be6  4.15   "Pokédex" na barra de abas, 11px
 *   --tk-txt3  0.56     4.08   o cinza de TODA legenda do app
 *
 * Os tres no tema claro, que e o que se usa na rua com sol na tela. E o
 * prototipo fixou "contraste ≥4.5:1" como regra do design system desde o
 * primeiro dia: o app furava a propria regra nos dois menores textos que tem.
 *
 * Revisao humana nao pega isso de novo — a proxima cor "quase igual" vai
 * passar batido do mesmo jeito. Uma conta, sim.
 *
 * ── O que este teste NAO garante ─────────────────────────────────────────────
 *
 * Ele mede token contra SUPERFICIE CHAPADA. Onde o texto cai sobre gradiente
 * (o degrade `--tk-screen`, os tiles de tipo, o vidro da barra de abas) a
 * conta real varia com a posicao, e nenhuma checagem estatica resolve. Por
 * isso as superficies listadas aqui incluem o ponto mais CLARO do degrade no
 * tema escuro e o mais ESCURO no claro: e o pior caso de cada um.
 *
 * ⚠️ Esse "nenhuma checagem estatica resolve" era largo demais, e a largura
 * custou caro: o BOTAO PRIMARIO tem gradiente, ficou de fora por causa dessa
 * frase, e o branco dele reprovava em 3,71:1 no tema escuro. A distincao certa
 * nao e "tem gradiente", e "o texto cobre o gradiente inteiro?" — numa pilula
 * de 54px cobre, entao a pior parada e a resposta e da pra medir. Ha um teste
 * pra isso mais abaixo.
 *
 * O que continua fora: superficies muito maiores que o texto (`--tk-screen`) e
 * as que dependem do que passa por tras (vidro). Essas so o app medindo a si
 * mesmo pega — e foi assim que esta ultima leva apareceu.
 */

/*
 * Caminho a partir do `cwd`, e nao de `import.meta.url`.
 *
 * Sob o ambiente jsdom do Vitest, `import.meta.url` nao e um `file:` — vira
 * uma URL http do servidor de modulos do Vite, e `fileURLToPath` recusa. O
 * `cwd` aqui e sempre `apps/web`, que e a mesma premissa que o teste do
 * dataset ja usa (`public/dataset/gamedata.json`).
 */
const CSS = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");

type RGB = readonly [number, number, number];

function doHex(h: string): RGB {
  const s = h.replace("#", "");
  return [
    Number.parseInt(s.slice(0, 2), 16),
    Number.parseInt(s.slice(2, 4), 16),
    Number.parseInt(s.slice(4, 6), 16),
  ] as const;
}

/** Luminancia relativa, pela formula do WCAG 2.1. */
function luminancia([r, g, b]: RGB): number {
  const canal = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function contraste(frente: RGB, fundo: RGB): number {
  const a = luminancia(frente);
  const b = luminancia(fundo);
  const [claro, escuro] = a > b ? [a, b] : [b, a];
  return (claro + 0.05) / (escuro + 0.05);
}

/** Cor com alpha achatada sobre o fundo — e o que o olho ve. */
function achatar(cor: RGB, alpha: number, fundo: RGB): RGB {
  return [
    Math.round(cor[0] * alpha + fundo[0] * (1 - alpha)),
    Math.round(cor[1] * alpha + fundo[1] * (1 - alpha)),
    Math.round(cor[2] * alpha + fundo[2] * (1 - alpha)),
  ] as const;
}

/**
 * Onde um seletor ABRE de verdade — `seletor {`, e não a primeira menção a ele.
 *
 * ⚠️ Isto era `CSS.indexOf(inicio)`, e a fragilidade não é teórica: bastou uma
 * NOTA no topo do arquivo citar `[data-tk="light"]` entre crases pra que o
 * "bloco claro" passasse a começar no comentário — vários tokens antes do
 * bloco escuro. O teste então media as cores do tema ESCURO chamando-as de
 * claras, e reprovou 17 vezes com números absurdos (`--tk-succ` a 1,73:1).
 *
 * Um teste que encontra o texto errado não mede nada, e o pior é que ele
 * reprova, o que dá a impressão de estar funcionando.
 */
function abertura(seletor: string): number {
  const i = CSS.search(new RegExp(`${seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`));
  return i;
}

function bloco(inicio: string, fim: string): string {
  const i = abertura(inicio);
  expect(i, `bloco "${inicio}" sumiu do tokens.css`).toBeGreaterThan(-1);
  const f = CSS.slice(i).search(
    new RegExp(`${fim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`),
  );
  return CSS.slice(i, f === -1 ? undefined : i + f);
}

function hexDoToken(texto: string, nome: string): RGB | null {
  const m = new RegExp(`--${nome}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(texto);
  return m?.[1] ? doHex(m[1]) : null;
}

/**
 * Segue UM nivel de `var(--outro)`.
 *
 * Os nomes antigos (`--tk-txt3`) viraram apelidos dos canonicos do redesenho
 * (`--tk-text-3`) pra que a paleta nova chegasse nas ~5.000 linhas de `App.css`
 * sem renomear nada. Sem resolver o apelido, este teste passaria a dizer que o
 * token "sumiu" — e um teste que nao acha o token nao mede coisa nenhuma.
 */
function rgbaDoToken(texto: string, nome: string): { cor: RGB; alpha: number } | null {
  const alias = new RegExp(`--${nome}\\s*:\\s*var\\(\\s*--([a-z0-9-]+)\\s*\\)`).exec(texto);
  if (alias?.[1]) return rgbaDoToken(texto, alias[1]);

  const m = new RegExp(`--${nome}\\s*:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)`).exec(
    texto,
  );
  if (!m) return null;
  return {
    cor: [Number(m[1]), Number(m[2]), Number(m[3])] as const,
    alpha: Number(m[4]),
  };
}

/** O minimo do WCAG AA pra texto pequeno, que e o tamanho destes tokens. */
const MINIMO = 4.5;

const TEMAS = [
  {
    nome: "escuro",
    css: bloco('[data-tk="dark"]', '[data-tk="light"]'),
    // O fundo, o ponto mais claro do degrade `--tk-screen`, e as duas
    // superficies de cartao. Texto pousa nas quatro.
    // Fundo do redesenho, o topo do degrade, e as duas superficies de cartao.
    // As de vidro sao translucidas sobre o fundo, entao o pior caso e o fundo.
    superficies: ["#0a0c10", "#141a2a", "#12151b", "#181b23"],
  },
  {
    nome: "claro",
    css: bloco('[data-tk="light"]', "@media (prefers-color-scheme: light)"),
    superficies: ["#f2f3f6", "#ffffff", "#f1f3f8"],
  },
] as const;

/** Cores semanticas que viram TEXTO em algum lugar do app. */
const SEMANTICAS = [
  "tk-succ",
  "tk-warn",
  "tk-dang",
  "tk-pri",
  "tk-pri-fg",
  "tk-info",
  // ── canonicos do redesenho ──────────────────────────────────────────────
  // O handoff afirmava que TODOS passavam. Tres nao passavam, e estes casos
  // sao o que impede a afirmacao de voltar a ser aceita sem conta.
  "tk-ultra-fg",
  "tk-ultra-fg-strong",
  "tk-v-investir",
  "tk-v-evoluir",
  "tk-v-guardar",
  "tk-v-transferir",
];

/** Os cinzas de texto, que sao rgba e precisam ser achatados antes. */
const TEXTOS = ["tk-txt2", "tk-txt3", "tk-txt4", "tk-text-2", "tk-text-3"];

describe("contraste dos tokens", () => {
  for (const tema of TEMAS) {
    for (const nome of SEMANTICAS) {
      it(`${tema.nome}: --${nome} passa em toda superficie`, () => {
        const cor = hexDoToken(tema.css, nome);
        expect(cor, `--${nome} sumiu do tema ${tema.nome}`).not.toBeNull();
        for (const sup of tema.superficies) {
          const razao = contraste(cor!, doHex(sup));
          expect(
            razao,
            `--${nome} sobre ${sup} no tema ${tema.nome}: ${razao.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(MINIMO);
        }
      });
    }

    for (const nome of TEXTOS) {
      it(`${tema.nome}: --${nome} passa depois de achatado`, () => {
        const t = rgbaDoToken(tema.css, nome);
        expect(t, `--${nome} sumiu do tema ${tema.nome}`).not.toBeNull();
        for (const sup of tema.superficies) {
          const fundo = doHex(sup);
          const razao = contraste(achatar(t!.cor, t!.alpha, fundo), fundo);
          expect(
            razao,
            `--${nome} (alpha ${t!.alpha}) sobre ${sup} no tema ${tema.nome}: ${razao.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(MINIMO);
        }
      });
    }
  }

  it("a conta bate com os casos conhecidos do WCAG", () => {
    // Sem isto o teste poderia estar medindo errado e aprovando tudo.
    expect(contraste([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contraste([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
    // #767676 sobre branco e o exemplo canonico de "exatamente no limite".
    expect(contraste(doHex("#767676"), [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
    expect(contraste(doHex("#777777"), [255, 255, 255])).toBeLessThan(4.5);
  });

  it("pega as tres cores que o handoff do design afirmava que passavam", () => {
    /*
     * O README do redesenho diz, com todas as letras: "Todos os pares
     * texto/fundo abaixo passam de 4,5:1". Tres nao passavam — e um deles e o
     * cinza de "IV 96 · PC 2.874 · nv 31", a linha de metadado de toda lista.
     *
     * Estes casos existem pra que a afirmacao nao volte a ser aceita de boa fe
     * na proxima leva de tokens que chegar de fora.
     */
    const preto = doHex("#0a0c10");
    const claro = doHex("#f2f3f6");
    const cinza = [235, 238, 245] as const;
    const tinta = [22, 24, 29] as const;

    expect(contraste(achatar(cinza, 0.45, preto), preto)).toBeLessThan(MINIMO);
    expect(contraste(achatar(cinza, 0.52, preto), preto)).toBeGreaterThanOrEqual(MINIMO);

    expect(contraste(achatar(tinta, 0.6, claro), claro)).toBeLessThan(MINIMO);
    expect(contraste(achatar(tinta, 0.61, claro), claro)).toBeGreaterThanOrEqual(MINIMO);

    expect(contraste(achatar(tinta, 0.45, claro), claro)).toBeLessThan(MINIMO);
  });


  it("a etiqueta de tipo é legível nas 19 cores", () => {
    /*
     * ⚠️ Este teste nasceu de um COMENTÁRIO FALSO.
     *
     * A tabela de cores de tipo dizia, em prosa, que fora "escolhida para
     * manter o contraste do texto branco por cima". Nunca tinha sido medido.
     * Medindo: DEZOITO das 19 reprovam — "Planta" saía com 2,21:1 na ficha da
     * espécie, "Elétrico" com 1,63.
     *
     * Um comentário que afirma uma garantia que o código não dá é pior que
     * comentário nenhum: ele impede a pergunta. Achado por um varredor que mede
     * contraste tela por tela, no tema claro.
     *
     * A cor do tipo é DADO (ela identifica o tipo e não pode mudar), então quem
     * cede é a tinta — escolhida por luminância, como `ui/paleta.ts` já fazia
     * pro botão primário.
     */
    const ruins: string[] = [];
    for (const tipo of [...TYPE_NAMES, "inexistente"]) {
      const fundo = doHex(typeColor(tipo));
      const tinta = doHex(typeInk(tipo));
      const r = contraste(tinta, fundo);
      if (r < MINIMO) ruins.push(`${tipo}: ${r.toFixed(2)} (${typeInk(tipo)} sobre ${typeColor(tipo)})`);
    }
    expect(ruins).toEqual([]);
  });

  it("o branco fixo que existia antes REPROVA — é o que este arquivo trava", () => {
    // Sem este caso, alguém "simplifica" o `typeInk` de volta pra `#fff` e o
    // teste acima continua verde, porque ele mediria a simplificação e não a
    // regra. Aqui fica registrado o número que motivou a mudança.
    expect(contraste(doHex("#ffffff"), doHex(typeColor("grass")))).toBeLessThan(MINIMO);
    expect(contraste(doHex("#ffffff"), doHex(typeColor("electric")))).toBeLessThan(2);
  });

  it("o branco do botao primario passa em TODAS as paradas do gradiente", () => {
    /*
     * ⚠️ O que o comentario do topo dizia que este arquivo NAO garantia.
     *
     * "Onde o texto cai sobre gradiente ... nenhuma checagem estatica resolve."
     * Isso vale pro degrade da TELA, que se estende por trezentos pixels e cuja
     * cor sob uma palavra depende de onde a palavra esta. Nao vale pro botao: o
     * gradiente dele mede 54px de altura, o rotulo fica no meio, e TODA parada
     * esta atras do texto. A pior delas e a resposta, e ela e estatica.
     *
     * A distincao importava: `--tk-ultra` do tema escuro comecava em #8a6bff e
     * o branco dava **3,71:1** ali. O botao primario e a acao principal de quase
     * toda tela do app, e passou por todas as revisoes — inclusive por uma que
     * mediu tokens chapados e declarou o tema escuro limpo.
     */
    const ruins: string[] = [];
    for (const tema of TEMAS) {
      const m = /--tk-ultra\s*:\s*linear-gradient\(([^)]+)\)/.exec(tema.css);
      expect(m, `--tk-ultra sumiu do tema ${tema.nome}`).not.toBeNull();
      for (const parada of m![1]!.match(/#[0-9a-fA-F]{6}/g) ?? []) {
        const r = contraste(doHex("#ffffff"), doHex(parada));
        if (r < MINIMO) ruins.push(`${tema.nome}: branco sobre ${parada} = ${r.toFixed(2)}`);
      }
    }
    expect(ruins).toEqual([]);
  });

  it("o chip de veredito passa sobre o proprio fundo, nas quatro cores", () => {
    /*
     * ⚠️ O chip nao pousa numa superficie da lista acima: ele pinta a PROPRIA.
     *
     * `.tk-owned-act` faz `color-mix(in srgb, currentColor 10%, var(--tk-elev))`
     * — um veu da propria cor sobre uma base neutra opaca. Medir a cor contra
     * `#f1f3f8` (como os outros casos deste arquivo fazem) responde uma pergunta
     * que a tela nao faz.
     *
     * Antes ele misturava com `transparent`, e o que aparecia embaixo era o
     * cartao TINGIDO com 14% da cor da especie. Duas tintas somadas: no tema
     * claro as quatro cores reprovavam nas 1.142 especies, `investir` chegando a
     * 3,12:1. Ancorar em `--tk-elev` desacopla o chip da especie de vez.
     */
    const VEU = 0.1;
    const ruins: string[] = [];
    for (const tema of TEMAS) {
      const base = hexDoToken(tema.css, "tk-elev");
      expect(base, `--tk-elev sumiu do tema ${tema.nome}`).not.toBeNull();
      for (const nome of ["tk-v-investir", "tk-v-evoluir", "tk-v-guardar", "tk-v-transferir"]) {
        const cor = hexDoToken(tema.css, nome);
        expect(cor, `--${nome} sumiu do tema ${tema.nome}`).not.toBeNull();
        const fundo = achatar(cor!, VEU, base!);
        const r = contraste(cor!, fundo);
        if (r < MINIMO) ruins.push(`${tema.nome} --${nome}: ${r.toFixed(2)} sobre o proprio chip`);
      }
    }
    expect(ruins).toEqual([]);
  });

  it("o veu de 14% sobre o cartao tingido REPROVA — e o que motivou a mudanca", () => {
    // O cartao do Bulbasaur no tema claro, e o verde de "investir" em cima.
    // Sem este caso, alguem devolve o `transparent` e o teste acima continua
    // verde, porque ele mediria a base neutra e nao a que a tela usaria.
    const cartaoTingido = achatar(doHex("#4e8a72"), 0.14, doHex("#f1f3f8"));
    const chipAntigo = achatar(doHex("#067a56"), 0.14, cartaoTingido);
    expect(contraste(doHex("#067a56"), chipAntigo)).toBeLessThan(MINIMO);
  });

  it("a parada clara que existia antes REPROVA", () => {
    // Mesma trava do `typeInk`: sem o caso negativo, alguem devolve o #8a6bff
    // "porque ficava mais bonito" e o teste acima continua verde medindo a
    // regressao em vez da regra.
    expect(contraste(doHex("#ffffff"), doHex("#8a6bff"))).toBeLessThan(MINIMO);
    expect(contraste(doHex("#ffffff"), doHex("#7657ff"))).toBeGreaterThanOrEqual(MINIMO);
  });

  it("pega a cor que eu tinha deixado passar", () => {
    // O verde antigo do "POWER UP", contra o fundo do tema claro.
    expect(contraste(doHex("#0b8a5f"), doHex("#eceef3"))).toBeLessThan(MINIMO);
    // E o que entrou no lugar.
    expect(contraste(doHex("#097a52"), doHex("#eceef3"))).toBeGreaterThanOrEqual(MINIMO);
  });
});
