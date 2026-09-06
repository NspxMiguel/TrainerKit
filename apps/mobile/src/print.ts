import { decodePng, type Bitmap } from "@trainerkit/core";
import * as Manipulator from "expo-image-manipulator";
import { inflate } from "pako";

/**
 * DO PRINT PRA BITMAP — o que faltava pro leitor de tela existir no nativo.
 *
 * `scanAppraisalBars` do core pede um `Bitmap`: RGBA cru, quatro bytes por
 * pixel, do jeito que `ImageData.data` entrega. No navegador isso sai de graça
 * de um `<canvas>`. Em React Native não existe canvas, e nenhum módulo do Expo
 * devolve pixel cru — então o caminho é: o manipulator reduz e re-encoda em
 * PNG, e o PNG é decodificado em JavaScript (`packages/core/src/png.ts`, que é
 * testado contra o Pillow pixel a pixel).
 *
 * ── Reduzir NÃO é atalho, é o que torna isso viável ─────────────────────────
 *
 * ⚠️ E é seguro por medida, não por esperança: `scan.scale.test.ts` reescala
 * cada print real para 1×, 0,75×, 0,5× e **0,35×** e exige o IV EXATAMENTE
 * igual em todas. O teste existe porque o print já chega reduzido pelo WhatsApp
 * na mão de muita gente. Um print de iPhone tem ~3,6 milhões de pixels;
 * decodificar isso em JS levaria segundos e comeria memória à toa.
 *
 * ── Por que PNG e não JPEG ──────────────────────────────────────────────────
 *
 * JPEG perde informação, e o que o scanner lê é a BORDA entre o cheio e o vazio
 * da barra — exatamente onde o artefato de compressão mora. PNG é sem perda.
 */

/** Largura de trabalho. Acima disso o custo cresce sem o scanner ganhar nada. */
const LARGURA = 800;

/** Um `Bitmap` pronto pro `scanAppraisalBars`, a partir do arquivo escolhido. */
export async function bitmapDoArquivo(uri: string): Promise<Bitmap> {
  const contexto = Manipulator.ImageManipulator.manipulate(uri);
  contexto.resize({ width: LARGURA });
  const imagem = await contexto.renderAsync();
  const salvo = await imagem.saveAsync({ format: Manipulator.SaveFormat.PNG, base64: true });
  if (!salvo.base64) throw new Error("o manipulador nao devolveu base64");

  /* `atob` existe no Hermes; `Buffer` nao. */
  const binario = atob(salvo.base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return decodePng(bytes, inflate);
}
