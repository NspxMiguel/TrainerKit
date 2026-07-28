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
 * Print de celular moderno passa de 1200x2600. Reduzir antes de varrer corta o
 * tempo pela metade sem perder precisao: a barra tem ~215 px de largura no
 * print original, e mesmo reduzida continua com folga sobre o minimo de 2 px
 * por passo.
 */
const MAX_DIMENSION = 1400;

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
