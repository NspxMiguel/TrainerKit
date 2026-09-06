import type { Bitmap } from "./scan.js";

/**
 * PNG -> `Bitmap`, sem depender de canvas nem de plataforma.
 *
 * Existe porque o leitor de print precisou rodar em React Native, onde não há
 * `<canvas>` e nenhum módulo devolve pixel cru. O caminho lá é: reduzir e
 * re-encodar em PNG, e decodificar em JavaScript — e a decodificação é isto.
 *
 * ⚠️ `inflate` ENTRA POR PARÂMETRO de propósito. `packages/core` não tem
 * dependência nenhuma e não vai ganhar uma por causa disto: o app nativo passa
 * o `pako`, e o teste passa o `zlib` do Node. O efeito colateral é o que
 * importa — a decodificação fica testável fora do aparelho, que é onde ela
 * falharia em silêncio.
 *
 * Só o que o `expo-image-manipulator` produz é aceito: 8 bits, RGB ou RGBA, sem
 * entrelace. Recusar o resto é melhor que decodificar errado sem avisar.
 */

/** Descompacta o fluxo zlib dos IDAT. O chamador escolhe a implementação. */
export type Inflate = (dados: Uint8Array) => Uint8Array;

/**
 * Desfaz os filtros por linha do PNG (RFC 2083, §6) e devolve RGBA.
 *
 * ⚠️ Cada linha do PNG começa com um byte dizendo qual dos cinco filtros ela
 * usou, e o filtro se refere ao pixel da ESQUERDA e ao da linha de CIMA já
 * desfiltrados. Tratar o buffer como pixel puro devolve uma imagem que parece
 * ruído — e o scanner não erra, ele simplesmente não acha barra nenhuma, que é
 * um jeito silencioso de falhar.
 */
function desfiltrar(cru: Uint8Array, largura: number, altura: number, canais: number): Uint8Array {
  const passo = largura * canais;
  const saida = new Uint8Array(passo * altura);
  let origem = 0;

  for (let y = 0; y < altura; y++) {
    const filtro = cru[origem++]!;
    const linha = y * passo;
    const anterior = linha - passo;

    for (let x = 0; x < passo; x++) {
      const bruto = cru[origem++]!;
      const a = x >= canais ? saida[linha + x - canais]! : 0; // esquerda
      const b = y > 0 ? saida[anterior + x]! : 0; // acima
      const c = y > 0 && x >= canais ? saida[anterior + x - canais]! : 0; // diagonal

      let valor: number;
      switch (filtro) {
        case 0:
          valor = bruto;
          break;
        case 1:
          valor = bruto + a;
          break;
        case 2:
          valor = bruto + b;
          break;
        case 3:
          valor = bruto + ((a + b) >> 1);
          break;
        case 4: {
          // Paeth: escolhe o vizinho que melhor prevê este pixel.
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          valor = bruto + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`filtro PNG desconhecido: ${filtro}`);
      }
      saida[linha + x] = valor & 0xff;
    }
  }
  return saida;
}

/** Lê a assinatura, o IHDR e junta os IDAT. Só o que este caminho produz. */
function lerPng(bytes: Uint8Array, inflate: Inflate): Bitmap {
  const ASSINATURA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < ASSINATURA.length; i++) {
    if (bytes[i] !== ASSINATURA[i]) throw new Error("nao e PNG");
  }

  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let largura = 0;
  let altura = 0;
  let canais = 0;
  const pedacos: Uint8Array[] = [];

  while (pos < bytes.length) {
    const tamanho = vista.getUint32(pos);
    const tipo = String.fromCharCode(
      bytes[pos + 4]!,
      bytes[pos + 5]!,
      bytes[pos + 6]!,
      bytes[pos + 7]!,
    );
    const corpo = pos + 8;

    if (tipo === "IHDR") {
      largura = vista.getUint32(corpo);
      altura = vista.getUint32(corpo + 4);
      const profundidade = bytes[corpo + 8]!;
      const tipoDeCor = bytes[corpo + 9]!;
      const entrelacado = bytes[corpo + 12]!;
      /* O manipulator do Expo só produz 8 bits, RGB ou RGBA, sem entrelace.
         Recusar o resto é melhor que decodificar errado em silêncio. */
      if (profundidade !== 8) throw new Error(`PNG de ${profundidade} bits`);
      if (tipoDeCor !== 2 && tipoDeCor !== 6) throw new Error(`PNG tipo de cor ${tipoDeCor}`);
      if (entrelacado !== 0) throw new Error("PNG entrelacado");
      canais = tipoDeCor === 6 ? 4 : 3;
    } else if (tipo === "IDAT") {
      pedacos.push(bytes.subarray(corpo, corpo + tamanho));
    } else if (tipo === "IEND") {
      break;
    }
    pos = corpo + tamanho + 4; // + CRC
  }

  if (!largura || !altura || !canais) throw new Error("PNG sem IHDR");

  let total = 0;
  for (const p of pedacos) total += p.length;
  const juntos = new Uint8Array(total);
  let off = 0;
  for (const p of pedacos) {
    juntos.set(p, off);
    off += p.length;
  }

  const pixels = desfiltrar(inflate(juntos), largura, altura, canais);

  if (canais === 4) return { data: pixels, width: largura, height: altura };

  /* RGB -> RGBA: o `Bitmap` do core sempre tem quatro bytes por pixel. */
  const rgba = new Uint8Array(largura * altura * 4);
  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
    rgba[j] = pixels[i]!;
    rgba[j + 1] = pixels[i + 1]!;
    rgba[j + 2] = pixels[i + 2]!;
    rgba[j + 3] = 255;
  }
  return { data: rgba, width: largura, height: altura };
}
/** Decodifica um PNG inteiro. `inflate` vem de fora — ver a nota do topo. */
export function decodePng(bytes: Uint8Array, inflate: Inflate): Bitmap {
  return lerPng(bytes, inflate);
}
