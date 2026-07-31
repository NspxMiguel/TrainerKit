import { useEffect, useMemo } from "react";

import tabela from "../dados/paleta.json";

/**
 * A paleta do app vem da ESPÉCIE em destaque.
 *
 * "o pokemon destaque, sempre altera a palheta de cores do app."
 *
 * A tabela é gerada uma vez em `packages/dataset/src/paleta.ts` e vem embutida
 * no pacote — ver lá o porquê de cada cor. Aqui só se faz a metade que o
 * gerador não pode fazer: transformar cor VERDADEIRA em cor USÁVEL.
 *
 * ── A diferença entre as duas, que é o trabalho deste arquivo ───────────────
 *
 * A tabela é honesta: o Mewtwo sai `#d5d0d9`, quase branco, porque o Mewtwo é
 * quase branco. Mas quase-branco não serve de tinta de texto sobre fundo claro,
 * nem de fundo atrás de texto branco. Se a cor crua fosse aplicada direto, cada
 * espécie de tom extremo — Mewtwo claro, Umbreon escuro — quebraria a leitura
 * de um jeito que nenhum teste estático pega, porque a cor só existe em tempo
 * de execução.
 *
 * Então cada cor crua gera derivadas com faixa de luminosidade garantida, e a
 * MATIZ é o que se preserva. É por isso que o Mewtwo continua lavanda pálido e
 * o Dragonite continua laranja: o que muda é o quanto, nunca o qual.
 *
 * ⚠️ O QUE A PALETA **NÃO** PINTA, e por quê:
 *
 *   · o violeta Ultra do botão primário e da aba ativa. Ele é a marca de AÇÃO
 *     DO APP — se mudasse junto, "o que é toque" passaria a depender de qual
 *     bicho está em destaque, e a pessoa perderia a única pista estável de
 *     onde tocar.
 *   · as cores de veredito (verde/violeta/âmbar/cinza). Elas SÃO o significado:
 *     "Investir" verde num bicho e azul noutro não é tema, é ruído.
 *
 * A paleta entra onde a cor é decorativa. Isso é o contrário de "trocar tudo" —
 * é trocar o que pode mudar sem custar leitura.
 */

const CORES = tabela as Record<string, string[]>;

export interface Paleta {
  /** As cores como elas são na arte, em ordem de área ocupada. */
  cruas: readonly string[];
  /** A cor principal, empurrada pra uma faixa que funciona como tinta. */
  base: string;
  /** A principal, clareada até passar 4,5:1 no tema escuro. */
  legivelEscuro: string;
  /** A principal, escurecida até passar 4,5:1 no tema claro. */
  legivelClaro: string;
  /** A segunda cor, usável — é ela que faz o brilho e os detalhes. */
  segunda: string;
  /** As três paradas do fundo do hero, do topo (clara) à base (escura). */
  gradiente: string;
}

// ---------------------------------------------------------------- conversão

function paraHsl(hexa: string): [number, number, number] {
  const n = parseInt(hexa.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return [h < 0 ? h + 360 : h, s, l];
}

function paraHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  return `#${[r, g, b]
    .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

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

/** Os dois fundos do app. A conta de contraste é sempre contra um deles. */
const FUNDO_ESCURO = "#0a0c10";
const FUNDO_CLARO = "#ffffff";

/**
 * Empurra uma cor até ela passar em 4,5:1 contra o fundo dado.
 *
 * ⚠️ Anda numa direção só, escolhida pelo fundo: sobre fundo escuro clareia,
 * sobre fundo claro escurece. O caminho contrário existe matematicamente — dá
 * pra escurecer uma cor até ela contrastar com o preto — mas passaria pelo meio,
 * onde nada contrasta com nada, e sairia do outro lado como uma cor que já não
 * lembra o bicho de onde veio.
 */
function ateLegivel(h: number, s: number, l: number, fundo: string): string {
  const claro = fundo === FUNDO_ESCURO;
  let atual = l;
  let cor = paraHex(h, s, atual);
  for (let i = 0; i < 60 && contraste(cor, fundo) < 4.5; i++) {
    atual += claro ? 0.02 : -0.02;
    if (atual > 0.96 || atual < 0.04) break;
    cor = paraHex(h, s, atual);
  }
  return cor;
}

const vazia: Paleta = {
  cruas: [],
  base: "#8e96a6",
  legivelEscuro: "#aab2c0",
  legivelClaro: "#4b5364",
  segunda: "#6b7280",
  gradiente: "#5c6472, #3a404b, #171a20",
};

export function paletaDaEspecie(spriteId: number | null): Paleta {
  const cruas = spriteId == null ? undefined : CORES[String(spriteId)];
  if (!cruas || cruas.length === 0) return vazia;

  const [h, s, l] = paraHsl(cruas[0] ?? "#888888");
  const segundaCrua = cruas[1] ?? cruas[0] ?? "#888888";
  const [h2, s2] = paraHsl(segundaCrua);

  /*
   * A saturação sobe um pouco, mas com TETO PROPORCIONAL ao que já havia.
   *
   * A arte oficial é sombreada com muito meio-tom, então a média de um balde
   * sai lavada — o laranja do Dragonite dava `#f2b771`, que como tinta de
   * interface parece bege. Um empurrão de 15% devolve o que a média comeu.
   *
   * O teto é `s * 1.15` e não um valor fixo justamente pro Mewtwo: com piso
   * fixo, o cinza-lavanda dele viraria roxo saturado, que é exatamente o erro
   * que ele apontou. Cor sem saturação continua sem saturação.
   */
  const sv = Math.min(0.95, s * 1.15);
  const s2v = Math.min(0.95, s2 * 1.15);

  return {
    cruas,
    base: paraHex(h, sv, Math.min(0.62, Math.max(0.38, l))),
    legivelEscuro: ateLegivel(h, sv, Math.min(0.72, Math.max(0.45, l)), FUNDO_ESCURO),
    legivelClaro: ateLegivel(h, sv, Math.min(0.55, Math.max(0.22, l)), FUNDO_CLARO),
    segunda: paraHex(h2, s2v, 0.55),
    /*
     * CLARO EM CIMA, ESCURO EMBAIXO — e essa ordem é uma correção.
     *
     * A primeira versão descia do escuro pro claro, seguindo o mockup. Só que
     * no mockup o nome do Pokémon fica no TOPO do cartão; aqui ele fica na
     * base, junto dos botões, e é branco. Gradiente clareando pra baixo põe
     * texto branco exatamente onde o fundo é mais claro.
     *
     * Invertido, a luz nasce atrás da cabeça do bicho e a base afunda no escuro
     * — que é de onde o texto precisa de contraste, e de quebra é como a luz se
     * comporta de verdade.
     */
    gradiente: [
      paraHex(h, Math.max(0.35, sv - 0.05), 0.58),
      paraHex(h, sv, 0.34),
      paraHex(h, Math.min(0.95, sv + 0.08), 0.12),
    ].join(", "),
  };
}

/**
 * O gradiente do selo de monograma, na cor da ESPÉCIE.
 *
 * "inclusive, mesmo sem sprite, o famoso DR pra qm nao ta com os sprites
 * ativos, tem q aparecer a cor do pokemon."
 *
 * O selo era pintado pelo TIPO, e é justamente aí que o exemplo dele mordia: o
 * "MW" do Mewtwo saía rosa-avermelhado, porque Psíquico é rosa na paleta de
 * tipos. Agora sai lavanda pálido, que é a cor do bicho — e o modo sem imagem
 * deixa de ser o modo sem identidade.
 *
 * A geometria (radial, foco em 32%/24%) é a mesma de antes: o que mudou foi de
 * onde vêm as duas cores, não como elas são dispostas.
 *
 * ⚠️ Cai no tipo quando a espécie não tem paleta — e isso não é hipótese: são
 * as 5 entradas sem arte na tabela, mais qualquer dataset customizado cujo
 * `spriteId` não exista no índice do PokeAPI.
 */
export function gradienteDaEspecie(
  spriteId: number | null,
  reserva: string,
): string {
  const cruas = spriteId == null ? undefined : CORES[String(spriteId)];
  if (!cruas || cruas.length === 0) return reserva;

  const [h, s, l] = paraHsl(cruas[0] ?? "#888888");
  const sv = Math.min(0.95, s * 1.15);
  // Claro no foco, escuro na borda: é o que dá volume ao selo. As duas paradas
  // saem da MESMA matiz pra não virar um degradê de duas cores diferentes.
  const clara = paraHex(h, sv, Math.min(0.68, Math.max(0.5, l)));
  const escura = paraHex(h, Math.min(0.95, sv + 0.06), 0.26);
  return `radial-gradient(72% 72% at 32% 24%, ${clara} 0%, ${escura} 100%)`;
}

/**
 * Escreve a paleta no `<html>`.
 *
 * As variáveis vão na raiz, e não no hero — é o que faz a cor ESCAPAR do cartão
 * e alcançar o resto da interface, que é o pedido. Quem quiser usá-la escreve
 * `var(--tk-c1)` em qualquer lugar.
 */
export function usarPaleta(spriteId: number | null): Paleta {
  const paleta = useMemo(() => paletaDaEspecie(spriteId), [spriteId]);

  useEffect(() => {
    const raiz = document.documentElement;
    const vars: Record<string, string> = {
      "--tk-c1": paleta.cruas[0] ?? paleta.base,
      "--tk-c2": paleta.cruas[1] ?? paleta.cruas[0] ?? paleta.base,
      "--tk-c3": paleta.cruas[2] ?? paleta.cruas[1] ?? paleta.cruas[0] ?? paleta.base,
      "--tk-accent": paleta.base,
      "--tk-accent-2": paleta.segunda,
      "--tk-accent-fg-escuro": paleta.legivelEscuro,
      "--tk-accent-fg-claro": paleta.legivelClaro,
      "--tk-accent-grad": paleta.gradiente,
    };
    for (const [k, v] of Object.entries(vars)) raiz.style.setProperty(k, v);
    return () => {
      for (const k of Object.keys(vars)) raiz.style.removeProperty(k);
    };
  }, [paleta]);

  return paleta;
}
