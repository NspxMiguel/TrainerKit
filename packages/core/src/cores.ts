import tabela from "./paleta.json" with { type: "json" };

/**
 * A cor de cada especie, medida da arte oficial.
 *
 * ⚠️ ESTA TABELA MUDOU DE `apps/web` PRA CA quando o app nativo entrou, pelo
 * mesmo motivo dos dicionarios: e DADO, e duas copias divergem. A parte que
 * mora no web e a que fala com CSS (variaveis, `useEffect`); a conta de cor,
 * que e o que os dois precisam, e esta.
 *
 * ── Por que a cor crua nao serve, e essa e a razao do arquivo existir ────────
 *
 * A tabela e honesta: o Mewtwo sai `#d5d0d9`, quase branco, porque o Mewtwo e
 * quase branco. Quase-branco nao serve de fundo atras de texto branco. Entao a
 * cor e ESCURECIDA ate o branco alcancar 4,5:1 — e a MATIZ e o que se preserva,
 * que e o que mantem o Mewtwo lavanda e o Dragonite laranja.
 *
 * O alvo e luminancia 0,183: e o ponto exato em que branco da 4,5:1. Medido no
 * web, isso consertou 671 das 1.142 especies, que reprovavam com o monograma
 * branco por cima.
 */

interface Entrada {
  /** As cores, em ordem de area ocupada. */
  c: string[];
}

const CORES = tabela as unknown as Record<string, Entrada>;

function paraHsl(hexa: string): [number, number, number] {
  const n = parseInt(hexa.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function paraHex(h: number, s: number, l: number): string {
  const f = (n: number): number => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function luminancia(hexa: string): number {
  const n = parseInt(hexa.slice(1), 16);
  const canal = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255)
  );
}

export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return la > lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}

/** Escurece ate a luminancia cair no teto, preservando a matiz. */
function escurecerAte(h: number, s: number, l: number, teto: number): string {
  let atual = l;
  let cor = paraHex(h, s, atual);
  for (let i = 0; i < 60 && luminancia(cor) > teto; i++) {
    atual -= 0.015;
    if (atual < 0.06) break;
    cor = paraHex(h, s, atual);
  }
  return cor;
}

/** A especie tem cor propria na tabela? */
export function temCorPropria(spriteId: number | null): boolean {
  if (spriteId == null) return false;
  const c = CORES[String(spriteId)]?.c;
  return Array.isArray(c) && c.length > 0;
}

const TINTA_ESCURA = "#141920";

/**
 * O par pronto pro selo: fundo da especie e a tinta que se le em cima.
 *
 * `reserva` e a cor do TIPO, usada quando a especie nao esta na tabela — sao as
 * poucas sem arte, mais qualquer dataset customizado.
 */
export function seloDaEspecie(
  spriteId: number | null,
  reserva: string,
): { fundo: string; tinta: string } {
  const cruas = spriteId == null ? undefined : CORES[String(spriteId)]?.c;
  let fundo: string;
  if (cruas && cruas.length > 0) {
    const [h, sat, l] = paraHsl(cruas[0] ?? "#888888");
    const sv = Math.min(0.95, sat * 1.15);
    fundo = escurecerAte(h, sv, Math.min(0.68, Math.max(0.5, l)), 0.183);
  } else {
    fundo = reserva;
  }
  const tinta = contraste("#ffffff", fundo) >= contraste(TINTA_ESCURA, fundo)
    ? "#ffffff"
    : TINTA_ESCURA;
  return { fundo, tinta };
}

/**
 * O DEGRADÊ QUE SOBE.
 *
 * ⚠️ Não é a mesma coisa que uma cor virando transparente. O pacote do Claude
 * Design pinta o herói e o cabeçalho da ficha com TRÊS paradas verticais —
 * escuro em cima, a cor no meio, claro embaixo — e é isso que dá a sensação de
 * luz subindo pela tela. Um degradê de duas paradas terminando em `#RRGGBB22`
 * (o que eu tinha feito) só apaga a cor, e a tela fica chapada.
 *
 * As três paradas do pacote, medidas em HSL:
 *
 *   Fogo    (15, 75%, 28%) → (21, 90%, 48%) → (25, 95%, 53%)
 *   Dragão  (243, 48%, 32%) → (250, 90%, 60%) → (252, 100%, 68%)
 *   Gelo    (194, 70%, 27%) → (192, 91%, 36%) → (187, 92%, 69%)
 *
 * O que se repete nos três: a MATIZ quase não anda, a saturação sobe e a
 * luminosidade sobe. É essa relação que a função reproduz a partir da cor do
 * tipo que o app já usa — em vez de uma tabela com 18 trios escritos à mão, que
 * envelheceria na primeira vez que uma cor de tipo fosse corrigida.
 *
 * As posições (0% / 46% / 72%) também são do pacote: a última parada NÃO é
 * 100%, e é isso que deixa o pé do degradê com uma faixa da cor clara em vez de
 * um ponto. Tirar essa folga achata o efeito.
 *
 * ⚠️ A COR DO TIPO É A PARADA CLARA, e não a do meio.
 *
 * Medido contra os três degradês do pacote: a última parada deles bate com a
 * cor de tipo que o app já usa (fogo 53 vs 59, dragão 68 vs 67, gelo 69 vs 67
 * de luminosidade). Tratar a cor do tipo como o MEIO — que foi o meu primeiro
 * palpite — deixava o degradê inteiro uns dez pontos mais claro, e ele reparou
 * de longe: o resultado era laranja médio uniforme onde o desenho tem sombra
 * em cima e laranja forte no meio.
 */
export const PARADAS_DO_DEGRADE = [0, 0.48, 0.72] as const;

export function degradeDoTipo(cor: string): [string, string, string] {
  const [h, s, l] = paraHsl(cor);
  /*
   * ⚠️ A SATURAÇÃO SOBE MUITO, e isso é de propósito.
   *
   * A paleta de tipo do app é dessaturada porque ela precisa passar em 4,5:1
   * como FUNDO DE SELO, com texto por cima. O degradê não tem texto por cima —
   * o nome fica sobre o scrim — então ele pode e deve usar a cor cheia.
   *
   * Sem isso o herói sai "apagado" ao lado do mockup, que foi exatamente o que
   * ele viu: o pacote usa `#EA580C` (90% de saturação) onde a paleta do app tem
   * `#F0813F` (85% mas 59% de luz, o que lava a cor).
   */
  const viva = Math.min(1, s * 1.45);
  return [
    /* Escuro: a saturação cai um pouco junto com a luz — escurecer com a
       saturação cheia dá marrom sujo em vez de sombra. */
    paraHex(h, Math.min(1, s * 1.05), Math.max(0.10, l * 0.30)),
    /* Meio: a parada mais saturada das três. É ela que dá o corpo do degradê. */
    paraHex(h, viva, l * 0.72),
    paraHex(h, viva, Math.min(0.72, l * 1.02)),
  ];
}
