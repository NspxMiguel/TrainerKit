import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

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

function bloco(inicio: string, fim: string): string {
  const i = CSS.indexOf(inicio);
  const f = CSS.indexOf(fim, i);
  expect(i, `bloco "${inicio}" sumiu do tokens.css`).toBeGreaterThan(-1);
  return CSS.slice(i, f === -1 ? undefined : f);
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

  it("pega a cor que eu tinha deixado passar", () => {
    // O verde antigo do "POWER UP", contra o fundo do tema claro.
    expect(contraste(doHex("#0b8a5f"), doHex("#eceef3"))).toBeLessThan(MINIMO);
    // E o que entrou no lugar.
    expect(contraste(doHex("#097a52"), doHex("#eceef3"))).toBeGreaterThanOrEqual(MINIMO);
  });
});
