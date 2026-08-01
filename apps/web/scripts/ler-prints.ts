/**
 * Roda o leitor de barras contra uma PASTA DE PRINTS, direto em PNG.
 *
 *   pnpm --filter @trainerkit/web ler-prints ~/Downloads
 *
 * ⚠️ POR QUE ISTO EXISTE, tendo `scan.realprints.test.ts` ─────────────────────
 *
 * Aquele teste é a rede de segurança e continua sendo: ele tem GABARITO (o dono
 * escreveu o IV no apelido) e reprova o build se o leitor regredir. Mas ele
 * depende de fixtures `.raw` fora do repositório, convertidos por um script de
 * rascunho que não existe mais — na prática, ele estava sempre pulado.
 *
 * Este aqui não depende de nada: aponta pra pasta onde os prints estão e lê. É
 * o que se usa pra CONFERIR um lote novo ("tem algumas no meu pc, procura ai"),
 * e é como se descobre qual print o leitor recusa antes de o usuário descobrir.
 *
 * O decodificador de PNG é feito à mão com `zlib` da stdlib, de propósito: o
 * app decodifica no `canvas` do navegador, e trazer uma dependência de imagem só
 * pra um script de conferência seria pagar caro por pouco.
 */
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { inflateSync } from "node:zlib";

import { scanAppraisalBars } from "@trainerkit/core";

interface Bitmap {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * PNG → RGBA.
 *
 * Cobre o que sai de celular: 8 e 16 bits por canal, com e sem alfa, cinza e
 * cor. Recusa entrelaçado e o `CgBI` da Apple, que são formatos que um print de
 * iPhone tirado pelo aparelho não produz.
 */
export function lerPng(buf: Buffer): Bitmap {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("não é PNG");

  let p = 8;
  let width = 0;
  let height = 0;
  let profundidade = 0;
  let tipoCor = 0;
  let entrelacado = 0;
  const idat: Buffer[] = [];

  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const tipo = buf.toString("ascii", p + 4, p + 8);
    const dados = buf.subarray(p + 8, p + 8 + len);
    if (tipo === "IHDR") {
      width = dados.readUInt32BE(0);
      height = dados.readUInt32BE(4);
      profundidade = dados[8]!;
      tipoCor = dados[9]!;
      entrelacado = dados[12]!;
    } else if (tipo === "IDAT") idat.push(dados);
    else if (tipo === "IEND") break;
    else if (tipo === "CgBI") throw new Error("PNG da Apple (CgBI)");
    p += 12 + len;
  }

  if (profundidade !== 8 && profundidade !== 16) {
    throw new Error(`profundidade ${profundidade} não suportada`);
  }
  if (entrelacado) throw new Error("PNG entrelaçado não suportado");

  const canais = tipoCor === 6 ? 4 : tipoCor === 2 ? 3 : tipoCor === 4 ? 2 : tipoCor === 0 ? 1 : 0;
  if (canais === 0) throw new Error(`tipo de cor ${tipoCor} não suportado`);

  /* 16 bits por canal: o byte alto basta — a medida aqui é de COR DE BARRA, e
     meio bit de precisão não move um limiar de distância euclidiana. */
  const bytesPorCanal = profundidade === 16 ? 2 : 1;
  const bpp = canais * bytesPorCanal;
  const stride = width * bpp;

  const bruto = inflateSync(Buffer.concat(idat));
  const out = new Uint8ClampedArray(width * height * 4);
  const linha = Buffer.alloc(stride);
  const anterior = Buffer.alloc(stride);
  let q = 0;

  for (let y = 0; y < height; y++) {
    const filtro = bruto[q++]!;
    bruto.copy(linha, 0, q, q + stride);
    q += stride;

    // Desfaz o filtro da linha (PNG §9). `bpp` aqui é em BYTES, como a spec pede.
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? linha[i - bpp]! : 0;
      const b = anterior[i]!;
      const c = i >= bpp ? anterior[i - bpp]! : 0;
      let v = linha[i]!;
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += (a + b) >> 1;
      else if (filtro === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      linha[i] = v & 255;
    }
    linha.copy(anterior);

    for (let x = 0; x < width; x++) {
      const s = x * bpp;
      const d = (y * width + x) * 4;
      if (canais >= 3) {
        out[d] = linha[s]!;
        out[d + 1] = linha[s + bytesPorCanal]!;
        out[d + 2] = linha[s + 2 * bytesPorCanal]!;
        out[d + 3] = canais === 4 ? linha[s + 3 * bytesPorCanal]! : 255;
      } else {
        out[d] = out[d + 1] = out[d + 2] = linha[s]!;
        out[d + 3] = canais === 2 ? linha[s + bytesPorCanal]! : 255;
      }
    }
  }

  return { data: out, width, height };
}

const pasta = process.argv[2];
if (pasta === undefined) {
  console.error("uso: pnpm --filter @trainerkit/web ler-prints <pasta>");
  process.exit(1);
}

const arquivos = readdirSync(pasta)
  .filter((f) => extname(f).toLowerCase() === ".png")
  .sort();

console.log(`${arquivos.length} PNG em ${pasta}\n`);

let lidos = 0;
let recusados = 0;

for (const nome of arquivos) {
  try {
    const bmp = lerPng(readFileSync(join(pasta, nome)));
    const r = scanAppraisalBars(bmp);
    if (!r.ok) {
      recusados++;
      console.log(`${nome}  ✗ ${r.reason}  (${bmp.width}×${bmp.height})`);
      continue;
    }
    lidos++;
    const total = r.ivs.atk + r.ivs.def + r.ivs.hp;
    const pct = ((total / 45) * 100).toFixed(1);
    console.log(`${nome}  ✓ ${r.ivs.atk}/${r.ivs.def}/${r.ivs.hp} = ${total}/45 = ${pct}%`);
  } catch (e) {
    recusados++;
    console.log(`${nome}  ✗ ${e instanceof Error ? e.message : String(e)}`);
  }
}

/* Recusar não é falhar: um print que não é da tela de avaliação TEM que ser
   recusado, e a maioria das recusas deste lote foram prints de outro app. O que
   nunca pode acontecer é ler ERRADO — por isso a saída mostra o IV lido, e não
   um "ok". */
console.log(`\nlidos ${lidos} · recusados ${recusados}`);
