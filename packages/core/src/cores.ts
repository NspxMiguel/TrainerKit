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
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
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
  const tinta =
    contraste("#ffffff", fundo) >= contraste(TINTA_ESCURA, fundo) ? "#ffffff" : TINTA_ESCURA;
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
    paraHex(h, Math.min(1, s * 1.05), Math.max(0.1, l * 0.3)),
    /* Meio: a parada mais saturada das três. É ela que dá o corpo do degradê. */
    paraHex(h, viva, l * 0.72),
    paraHex(h, viva, Math.min(0.72, l * 1.02)),
  ];
}

/**
 * A PONTE ATÉ O FUNDO — o que faz o gradiente CONECTAR em vez de encostar.
 *
 * ⚠️ Interpolar direto da cor do tipo para o fundo passa pelo CINZA: em sRGB o
 * caminho entre um roxo saturado e o branco cruza um mauve dessaturado, e o
 * olho lê essa faixa como uma listra estranha no meio da tela. Foi exatamente
 * o que ele fotografou.
 *
 * A saída é uma parada intermediária que já é quase o fundo mas ainda tem a
 * MATIZ da cor: assim o caminho todo continua sendo "a cor clareando", e a
 * última parada encontra o fundo sendo idêntica a ele.
 *
 * `quanto` é o quanto do fundo entra: 0 devolve a cor, 1 devolve o fundo.
 */
export function misturar(cor: string, fundo: string, quanto: number): string {
  const a = parseInt(cor.slice(1), 16);
  const b = parseInt(fundo.slice(1), 16);
  const canal = (deslocamento: number) => {
    const ca = (a >> deslocamento) & 255;
    const cb = (b >> deslocamento) & 255;
    return Math.round(ca + (cb - ca) * quanto);
  };
  const r = canal(16);
  const g = canal(8);
  const bl = canal(0);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

// ───────────────────────────────────────────── o degradê do herói, por ESPÉCIE

/**
 * AS TRÊS PARADAS DO HERÓI — a conta do app web, agora compartilhada.
 *
 * ⚠️ O nativo pintava o herói com a cor do TIPO, e o web com a cor da ESPÉCIE.
 * Medido lado a lado no Charizard: o nativo dava `#512505 → #ce5800 → #ff8225`
 * (luminância 0,031 / 0,201 / 0,374) e o web `#603110 → #bd6628 → #d27f44`
 * (0,047 / 0,205 / 0,293). A terceira parada do nativo é 28% mais luminosa e
 * saturada até o talo — é ela que lia como laranja de néon ao lado do web.
 *
 * E a diferença não era só de tom: pela cor do tipo, TODA espécie de Fogo abre
 * a tela com o mesmo laranja. Pela cor da espécie, o Charmander e o Charizard
 * têm cada um o seu — que é o que o web faz e o que ele reconheceu como certo.
 *
 * A forma vem do handoff do pacote de desenho: `linear-gradient(180deg, p1 0%,
 * p2 48%, p3 72%)`, escuro em cima e a luz crescendo até o terço final. O
 * `SCRIM` por cima é que devolve o contraste embaixo — as duas peças trabalham
 * juntas, e mexer numa sem a outra já custou uma reescrita.
 */
export function degradeDoHeroi(
  spriteId: number | null,
  reserva: string,
  escuro: boolean,
): [string, string, string] {
  const cruas = spriteId == null ? undefined : CORES[String(spriteId)]?.c;
  const [h, s] = paraHsl(cruas && cruas.length > 0 ? (cruas[0] ?? reserva) : reserva);
  /*
   * ⚠️ TETO PROPORCIONAL, e não um piso fixo de saturação.
   *
   * A arte oficial é sombreada com muito meio-tom, então a média de um balde
   * sai lavada e precisa do empurrão. Mas com piso fixo o cinza-lavanda do
   * Mewtwo viraria roxo saturado: cor sem saturação tem que continuar sem.
   */
  const sv = Math.min(0.95, s * 1.15);

  if (escuro) {
    return [
      paraHex(h, Math.min(0.95, sv + 0.06), 0.22),
      escurecerAte(h, sv, 0.45, TETO_LUZ_HEROI),
      escurecerAte(h, Math.max(0.4, sv - 0.04), 0.56, TETO_LUZ_HEROI),
    ];
  }
  return [
    entre(h, Math.min(0.95, sv * 1.5), 0.62, 0.42, 0.56),
    entre(h, Math.min(0.95, sv * 1.15), 0.8, 0.55, 0.68),
    entre(h, Math.min(0.95, sv * 0.55), 0.92, 0.8, 0.88),
  ] as [string, string, string];
}

/**
 * O TETO DE LUMINÂNCIA das paradas do herói escuro.
 *
 * ⚠️ Luminância, e não claridade — e a distinção é o defeito inteiro. Limitando
 * por claridade HSL, amarelo em `l = 0,56` tem quase o triplo da luminância de
 * azul na mesma claridade, porque a fórmula da WCAG pesa verde e vermelho muito
 * mais que azul. A varredura achou 152 espécies com o nome reprovando —
 * Bellsprout em 1,73:1, Abra em 2,04 — todas amarelas ou verde-claras.
 */
const TETO_LUZ_HEROI = 0.3;

/** Anda a claridade até a luminância cair na faixa pedida, preservando a matiz. */
function entre(h: number, s: number, l: number, piso: number, teto: number): string {
  let atual = l;
  let cor = paraHex(h, s, atual);
  for (let i = 0; i < 80; i++) {
    const luz = luminancia(cor);
    if (luz >= piso && luz <= teto) break;
    atual += luz < piso ? 0.012 : -0.012;
    if (atual > 0.99 || atual < 0.02) break;
    cor = paraHex(h, s, atual);
  }
  return cor;
}

/**
 * O VÉU DO HERÓI — a mesma rampa do app web, e ela INVERTE com o tema.
 *
 * ⚠️ O nativo escurecia de 42% a 78% com 45% de preto cravado. Isso apagava
 * justamente a faixa onde a cor é mais forte, e era metade do "as cores tao
 * muito diferente": as paradas já batiam com as do site, mas o véu por cima
 * tirava delas o brilho que o site mostra.
 *
 * A rampa do site começa a agir só na METADE de baixo (0% até 50%
 * transparente) porque é lá que o texto mora — em cima não há o que proteger, e
 * escurecer o topo é o que deixava a cor lavada.
 *
 * E ela troca de cor com o tema: no escuro o meio precisa ESCURECER para o
 * texto branco passar; no claro precisa CLAREAR, para o texto escuro passar.
 * Aplicar preto nos dois dava a listra cinza no tema claro, que ele já
 * fotografou uma vez.
 */
export const VEU_DO_HEROI = {
  escuro: { cor: "#0a0c10", forca: 0.55 },
  claro: { cor: "#fafbfd", forca: 0.34 },
} as const;

/** As paradas do véu, prontas para um `LinearGradient` — cor e posição. */
export function veuDoHeroi(escuro: boolean): {
  cores: [string, string, string, string];
  paradas: [number, number, number, number];
} {
  const { cor, forca } = escuro ? VEU_DO_HEROI.escuro : VEU_DO_HEROI.claro;
  const rgb = (a: number) => {
    const n = parseInt(cor.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  return { cores: [rgb(0), rgb(0), rgb(forca), rgb(0)], paradas: [0, 0.5, 0.82, 1] };
}

/**
 * A TINTA DO HERÓI: branca ou escura, decidida pela cor que fica sob o texto.
 *
 * ⚠️ Ela era branca CRAVADA, e isso só funcionava enquanto o degradê ignorava o
 * tema. Agora o tema claro dá paradas claras de verdade (`#f2e9e3` no
 * Charizard) e branco sobre elas é ilegível. Quem decide é a mesma conta de
 * contraste do resto do app, feita sobre a parada de baixo JÁ COM o véu — que é
 * literalmente o pixel que fica atrás da letra.
 */
export function tintaDoHeroi(paradas: readonly string[], escuro: boolean): string {
  const { cor, forca } = escuro ? VEU_DO_HEROI.escuro : VEU_DO_HEROI.claro;
  const sob = misturar(paradas[2] ?? "#888888", cor, forca);
  return contraste(sob, "#FFFFFF") >= contraste(sob, TINTA_ESCURA) ? "#FFFFFF" : TINTA_ESCURA;
}
