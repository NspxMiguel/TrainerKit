import { scanAppraisalBars, type ScanResult } from "@trainerkit/core";

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
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("O navegador não deu acesso ao canvas.");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const image = ctx.getImageData(0, 0, width, height);
  const result = scanAppraisalBars({ data: image.data, width, height });

  return {
    result,
    previewUrl: URL.createObjectURL(file),
    width,
    height,
  };
}
