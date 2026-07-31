import { scanAppraisalBars, type Bitmap, type ScanResult } from "@trainerkit/core";

/**
 * Ponte entre o arquivo que o usuario anexa e a leitura pura do core.
 *
 * Tudo acontece no aparelho: o print vai pra um canvas, os pixels saem dali e a
 * imagem e descartada. Nada e enviado a lugar nenhum, e nada fica guardado.
 */

export interface ScanOutcome {
  result: ScanResult;
  /** Miniatura para a conferencia visual. Revogue com `URL.revokeObjectURL`. */
  previewUrl: string;
  width: number;
  height: number;
  /**
   * Os pixels, pro leitor de PC e PS trabalhar depois.
   *
   * ⚠️ Vem JUNTO de proposito, em vez de o OCR ler o arquivo de novo. As barras
   * saem em milissegundos e o OCR pode levar segundos na primeira vez (baixa
   * 4,8 MB de wasm e modelo); separar os dois deixa o IV aparecer na hora e os
   * numeros chegarem depois, em vez de segurar tudo pelo mais lento.
   *
   * Decodificar a imagem duas vezes seria o caminho preguicoso e custaria o
   * dobro em memoria no pico — um print de iPhone e 12 MP.
   */
  bitmap: Bitmap;
}

/**
 * Limite de trabalho por imagem.
 *
 * Reduzir acelera a varredura, mas reduzir DEMAIS destroi a leitura: medindo os
 * prints reais em varias escalas, o scanner acerta ate cerca de 400 px de
 * largura e passa a recusar abaixo disso.
 *
 * O teto age sobre o LADO MAIOR, e um print de celular e bem mais alto que
 * largo — entao 2000 aqui mantem a largura confortavelmente acima da zona de
 * risco mesmo vindo de um aparelho 4K.
 */
const MAX_DIMENSION = 2000;

export async function scanFile(file: File): Promise<ScanOutcome> {
  const imagem = await createImageBitmap(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(imagem.width, imagem.height));
  const width = Math.round(imagem.width * scale);
  const height = Math.round(imagem.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("O navegador não deu acesso ao canvas.");

  ctx.drawImage(imagem, 0, 0, width, height);
  imagem.close();

  const image = ctx.getImageData(0, 0, width, height);
  const bitmap: Bitmap = { data: image.data, width, height };
  const result = scanAppraisalBars(bitmap);

  return {
    result,
    previewUrl: URL.createObjectURL(file),
    width,
    height,
    bitmap,
  };
}
