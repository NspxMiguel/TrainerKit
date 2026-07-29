/**
 * Gera os icones do PWA. Arte propria, desenhada por codigo.
 *
 * A marca sao tres barras de comprimentos crescentes, e a mais longa termina em
 * ponta e vem no verde de "Investir". E o app inteiro em um simbolo: ele LE tres
 * barras num print e devolve UMA decisao. O monograma "TK" que existia antes
 * dizia so o nome — nao dizia o que o app faz.
 *
 * O desenho saiu do Stitch; o que mudou aqui foi a execucao. O PNG que ele
 * devolveu tinha o grupo encostado em cima e a esquerda, com um vazio grande
 * embaixo e a direita, e vinha num tamanho so. Redesenhado em codigo ele fica
 * opticamente centrado, sai em todos os tamanhos e usa os tokens do app em vez
 * de uma paleta paralela — o verde e o mesmo `--tk-succ` do veredito "Investir".
 *
 * Existe como script (e nao como PNG commitado) porque assim o icone e
 * reproduzivel e os tokens de cor sao a unica fonte de verdade. Rode com
 * `pnpm icons`.
 *
 * PNG e escrito na mao — nao ha canvas no Node e nao vale uma dependencia
 * nativa so pra isto.
 */
import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "public");

/*
 * Fundo solido, preto ou branco. O gradiente saiu.
 *
 * Instalado, o icone senta ao lado dos icones do sistema — e ali um tile com
 * gradiente roxo-azul briga com tudo em volta, ainda mais no iOS, onde o
 * conjunto e sobrio. Preto no tema escuro, branco no claro: o icone deixa de
 * competir e a marca (as tres barras) fica sendo a unica coisa que se ve.
 *
 * Cada variante tem a propria paleta, porque as barras brancas do tema escuro
 * simplesmente sumiriam no branco.
 */
type Tema = "dark" | "light";

interface Paleta {
  readonly bg: readonly [number, number, number];
  /** As duas primeiras barras: as que o app LE. */
  readonly bar: readonly [number, number, number];
  /** A terceira: a DECISAO. Sempre o verde de "Investir" do tema. */
  readonly decision: readonly [number, number, number];
}

const PALETAS: Record<Tema, Paleta> = {
  // Preto puro, nao o `--tk-bg` (#07080b): no icone, um preto quase-preto
  // aparece como um cinza sujo ao lado dos icones vizinhos.
  dark: {
    bg: [0x00, 0x00, 0x00],
    bar: [0xff, 0xff, 0xff],
    decision: [0x37, 0xd3, 0x99], // --tk-succ do tema escuro
  },
  light: {
    bg: [0xff, 0xff, 0xff],
    bar: [0x10, 0x13, 0x19], // --tk-txt do tema claro
    decision: [0x0b, 0x8a, 0x5f], // --tk-succ do tema claro: o verde escuro
  },
};

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10..12 = compression, filter, interlace = 0

  // Cada scanline leva um byte de filtro (0 = None) na frente.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const src = y * width * 4;
    const dst = y * (width * 4 + 1);
    raw[dst] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + src, width * 4).copy(raw, dst + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Distancia assinada a um retangulo arredondado, para antialias de borda. */
function roundedRectSdf(
  px: number,
  py: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  radius: number,
): number {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - radius;
}

/**
 * A marca: tres barras crescentes, a ultima apontando pra frente.
 *
 * Coordenadas normalizadas em [0,1] sobre o tile, para o desenho escalar junto
 * com o tamanho pedido. Devolve `null` fora da marca, ou a cor do pixel.
 *
 * Os numeros sao escolhidos para o grupo ficar centrado nos DOIS eixos: as tres
 * barras mais os dois vaos somam 0,40 de altura comecando em 0,30, e a extensao
 * horizontal vai de 0,26 ate 0,74. Foi exatamente isso que faltou no PNG
 * original — a marca encostava em cima e a esquerda e sobrava vazio na diagonal
 * oposta, o que num icone de app salta aos olhos.
 */
const BAR_H = 0.105; // espessura de cada barra
const BAR_GAP = 0.072; // vao entre elas
const MARK_LEFT = 0.255;
/** Comprimento de cada barra. A terceira ganha cabeca de seta depois do corpo. */
const BAR_LEN = [0.2, 0.3, 0.33] as const;
/** Vao entre o corpo da terceira barra e a cabeca da seta. */
const HEAD_GAP = 0.028;
/** Comprimento e meia-altura da cabeca. Mais alta que a barra, de proposito. */
const HEAD_LEN = 0.115;
const HEAD_H = 0.093;

/** Onde a ponta da seta termina. A barra simplificada vai ate aqui. */
const MARK_RIGHT = MARK_LEFT + BAR_LEN[2] + HEAD_GAP + HEAD_LEN;

/**
 * @param simple Sem a cabeca de seta, com a terceira barra indo ate o fim.
 *   Ligado nos tamanhos minimos: a 16 px a cabeca tem tres pixels de base e o
 *   vao que a separa do corpo tem menos de um. Ela nao vira seta, vira sujeira
 *   verde — e some junto com a legibilidade da terceira barra. Desenhar menos
 *   nesse tamanho mostra mais.
 */
function markAt(
  u: number,
  v: number,
  simple: boolean,
  paleta: Paleta,
): readonly [number, number, number] | null {
  const top = 0.5 - (3 * BAR_H + 2 * BAR_GAP) / 2;
  const r = BAR_H / 2;
  const rowY = (i: number): number => top + i * (BAR_H + BAR_GAP) + BAR_H / 2;

  // Cabeca de seta primeiro: ela e mais ALTA que a barra, entao precisa ser
  // testada fora do laco das barras — o corte por `dy > r` de la descartaria
  // justamente os pixels que fazem dela uma seta.
  if (!simple) {
    const headCy = rowY(2);
    const headBase = MARK_LEFT + BAR_LEN[2]! + HEAD_GAP;
    if (u >= headBase && u <= headBase + HEAD_LEN) {
      const t = (u - headBase) / HEAD_LEN;
      if (Math.abs(v - headCy) <= HEAD_H * (1 - t)) return paleta.decision;
    }
  }

  for (let i = 0; i < 3; i++) {
    const cy = rowY(i);
    if (Math.abs(v - cy) > r) continue;

    const len = simple && i === 2 ? MARK_RIGHT - MARK_LEFT : BAR_LEN[i]!;

    // Corpo da barra: capsula, ou seja, distancia ao segmento horizontal.
    const xa = MARK_LEFT + r;
    const xb = MARK_LEFT + len - r;
    const nearest = Math.max(xa, Math.min(xb, u));
    if (Math.hypot(u - nearest, v - cy) <= r) {
      return i === 2 ? paleta.decision : paleta.bar;
    }
  }

  return null;
}

function renderIcon(size: number, maskable: boolean, tema: Tema): Uint8Array {
  const paleta = PALETAS[tema];
  const rgba = new Uint8Array(size * size * 4);

  // Icone maskable precisa de zona segura: o sistema recorta ate 10% de cada
  // borda. Entao o tile ocupa tudo e o monograma encolhe pro centro.
  const inset = maskable ? 0 : size * 0.06;
  const half = size / 2 - inset;
  const radius = maskable ? size / 2 : size * 0.235; // raio = 1/3 do lado (prototipo)
  const monoScale = maskable ? 0.78 : 1;
  // Abaixo disto a cabeca de seta nao cabe em pixel nenhum. Ver `markAt`.
  // O limite saiu de comparar 32 px lado a lado: com seta ela vira um borrao
  // verde grudado na barra; sem ela a marca fica limpa e ainda diz a mesma
  // coisa. Os tamanhos que importam pro icone (180 pra cima) ficam com a seta.
  const simple = size <= 40;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      const d = roundedRectSdf(px, py, size / 2, size / 2, half, half, radius);
      const coverage = Math.max(0, Math.min(1, 0.5 - d));
      if (coverage <= 0) continue;

      let r: number = paleta.bg[0];
      let g: number = paleta.bg[1];
      let b: number = paleta.bg[2];

      // A marca por cima, com antialias por supersampling 4x4. Quatro amostras
      // bastavam pro monograma, que era todo reto; a ponta da barra decisiva e
      // uma diagonal rasa e ficava serrilhada nos tamanhos pequenos.
      let hits = 0;
      let mr = 0;
      let mg = 0;
      let mb = 0;
      for (const oy of [-0.375, -0.125, 0.125, 0.375]) {
        for (const ox of [-0.375, -0.125, 0.125, 0.375]) {
          const u = (px + ox - size / 2) / (size * monoScale) + 0.5;
          const w = (py + oy - size / 2) / (size * monoScale) + 0.5;
          const color = markAt(u, w, simple, paleta);
          if (!color) continue;
          hits++;
          mr += color[0];
          mg += color[1];
          mb += color[2];
        }
      }
      if (hits > 0) {
        const a = hits / 16;
        r = r * (1 - a) + (mr / hits) * a;
        g = g * (1 - a) + (mg / hits) * a;
        b = b * (1 - a) + (mb / hits) * a;
      }

      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = Math.round(coverage * 255);
    }
  }

  return rgba;
}

await mkdir(OUT_DIR, { recursive: true });

/*
 * Cada arquivo sai duas vezes: escuro e claro.
 *
 * O favicon TROCA sozinho — `<link rel="icon" media="(prefers-color-scheme:
 * dark)">` e respeitado pelos navegadores atuais. O icone instalado NAO troca:
 * o manifest nao tem como declarar variante por tema, e o sistema copia o
 * arquivo uma vez, na hora de instalar. O escuro fica como padrao porque o app
 * abre no escuro e o `background_color` do manifest e preto.
 */
for (const [size, maskable, name] of [
  [192, false, "icon-192.png"],
  [512, false, "icon-512.png"],
  [512, true, "icon-maskable-512.png"],
  [180, false, "apple-touch-icon.png"],
  // Favicons renderizados NO tamanho, nao encolhidos do 512: o navegador
  // reamostra a imagem grande e a marca vira borrao: sao tres barras finas com
  // vaos de dois pixels. Renderizado direto, com supersampling, ele sai nitido.
  [32, false, "favicon-32.png"],
  [16, false, "favicon-16.png"],
] as const) {
  for (const tema of ["dark", "light"] as const) {
    const arquivo = tema === "dark" ? name : name.replace(".png", "-light.png");
    const png = encodePng(size, size, renderIcon(size, maskable, tema));
    await writeFile(join(OUT_DIR, arquivo), png);
    console.log(`${arquivo.padEnd(30)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
  }
}
