/**
 * Gera os icones do PWA. Arte propria, desenhada por codigo: quadrado
 * arredondado com o gradiente da marca e o monograma TK.
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

// --- gradiente da marca, o mesmo --tk-brand dos tokens -----------------------
const FROM = [0x4f, 0x8c, 0xff] as const;
const TO = [0xb7, 0x9c, 0xff] as const;

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
 * Monograma "TK" em formas geometricas.
 *
 * Coordenadas normalizadas em [0,1] sobre o tile, para o desenho escalar
 * junto com o tamanho pedido. Retorna true se o pixel cai na letra.
 */
function inMonogram(u: number, v: number): boolean {
  const bar = 0.052; // espessura do traco

  // T — barra superior e haste central
  const tLeft = 0.2;
  const tRight = 0.46;
  const tTop = 0.3;
  const tBottom = 0.7;
  const tStem = (tLeft + tRight) / 2;
  if (v >= tTop && v <= tTop + bar && u >= tLeft && u <= tRight) return true;
  if (u >= tStem - bar / 2 && u <= tStem + bar / 2 && v >= tTop && v <= tBottom) return true;

  // K — haste vertical e duas diagonais
  const kStem = 0.56;
  const kTop = 0.3;
  const kBottom = 0.7;
  const kMid = (kTop + kBottom) / 2;
  const kRight = 0.8;
  if (u >= kStem && u <= kStem + bar && v >= kTop && v <= kBottom) return true;

  // Diagonais: distancia perpendicular ao segmento.
  const seg = (ax: number, ay: number, bx: number, by: number): boolean => {
    const vx = bx - ax;
    const vy = by - ay;
    const wx = u - ax;
    const wy = v - ay;
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
    return Math.hypot(wx - t * vx, wy - t * vy) <= bar / 2;
  };
  if (seg(kStem + bar, kMid, kRight, kTop)) return true;
  if (seg(kStem + bar, kMid, kRight, kBottom)) return true;

  return false;
}

function renderIcon(size: number, maskable: boolean): Uint8Array {
  const rgba = new Uint8Array(size * size * 4);

  // Icone maskable precisa de zona segura: o sistema recorta ate 10% de cada
  // borda. Entao o tile ocupa tudo e o monograma encolhe pro centro.
  const inset = maskable ? 0 : size * 0.06;
  const half = size / 2 - inset;
  const radius = maskable ? size / 2 : size * 0.235; // raio = 1/3 do lado (prototipo)
  const monoScale = maskable ? 0.78 : 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      const d = roundedRectSdf(px, py, size / 2, size / 2, half, half, radius);
      const coverage = Math.max(0, Math.min(1, 0.5 - d));
      if (coverage <= 0) continue;

      // Gradiente na diagonal, como o --tk-brand (150deg).
      const t = Math.max(0, Math.min(1, (px * 0.45 + py * 0.9) / (size * 1.35)));
      let r = FROM[0] + (TO[0] - FROM[0]) * t;
      let g = FROM[1] + (TO[1] - FROM[1]) * t;
      let b = FROM[2] + (TO[2] - FROM[2]) * t;

      // Monograma em branco por cima, com antialias por supersampling 2x2.
      let hits = 0;
      for (const oy of [-0.25, 0.25]) {
        for (const ox of [-0.25, 0.25]) {
          const u = (px + ox - size / 2) / (size * monoScale) + 0.5;
          const w = (py + oy - size / 2) / (size * monoScale) + 0.5;
          if (inMonogram(u, w)) hits++;
        }
      }
      if (hits > 0) {
        const a = hits / 4;
        r = r * (1 - a) + 255 * a;
        g = g * (1 - a) + 255 * a;
        b = b * (1 - a) + 255 * a;
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

for (const [size, maskable, name] of [
  [192, false, "icon-192.png"],
  [512, false, "icon-512.png"],
  [512, true, "icon-maskable-512.png"],
  [180, false, "apple-touch-icon.png"],
] as const) {
  const png = encodePng(size, size, renderIcon(size, maskable));
  await writeFile(join(OUT_DIR, name), png);
  console.log(`${name.padEnd(26)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
