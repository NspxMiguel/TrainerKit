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
