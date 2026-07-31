import {
  acharLinhaPc,
  acharLinhaPs,
  ampliarParaOcr,
  lerPc,
  lerPs,
  type Bitmap,
  type RegiaoTexto,
} from "@trainerkit/core";

/**
 * Le o PC e o PS do print.
 *
 * ⚠️ Este e o UNICO lugar do app que faz reconhecimento de texto, e ele existe
 * porque o jogo nao mostra o nivel em lugar nenhum. Com o IV exato vindo das
 * barras, PC e PS sobredeterminam o nivel — `solveLevel` varre os 109 niveis e
 * quase sempre sobra um so. Sem esses dois numeros o app sabe o IV e nao sabe
 * quanto custa subir o bicho, que e metade da decisao.
 *
 * O caminho contrario ao que parece obvio: o IV, que e o dado mais importante,
 * NAO passa por aqui. Ele vem da geometria das barras (`core/scan.ts`), que e
 * deterministica. Reconhecimento de texto e probabilistico, entao fica so onde
 * nao ha alternativa — e mesmo ali com conferencia depois.
 */

export interface LeituraOcr {
  pc: number | null;
  /** O PS MAXIMO — o que entra na conta. O atual so serve de conferencia. */
  ps: number | null;
  psAtual: number | null;
}

/**
 * O leitor sobe uma vez e fica de pe.
 *
 * Sao 5,9 MB entre wasm e modelo; recriar o worker a cada print pagaria a
 * inicializacao de novo em quem escaneia vinte de uma vez, que e o caso de uso
 * que o `<input multiple>` do iPhone criou.
 */
let leitor: Promise<TesseractWorker> | null = null;

/** So o que usamos da API do tesseract — evita puxar o tipo do pacote inteiro. */
interface TesseractWorker {
  recognize(imagem: HTMLCanvasElement): Promise<{ data: { text: string } }>;
  terminate(): Promise<void>;
}

async function obterLeitor(): Promise<TesseractWorker> {
  if (leitor) return leitor;
  leitor = (async () => {
    /*
     * ⚠️ IMPORT DINAMICO, e o `manualChunks` do Vite separa este pedaco.
     *
     * Estatico, o tesseract entraria no bundle principal e TODO mundo baixaria
     * o leitor — inclusive quem so quer consultar a Pokedex. Assim ele so chega
     * no aparelho de quem anexa um print, e a partir dai fica no cache.
     */
    const { createWorker, PSM } = await import("tesseract.js");
    const base = import.meta.env.BASE_URL;
    const worker = await createWorker("eng", 1, {
      // Servido pela nossa origem — ver `scripts/fetch-ocr.ts`. Sem isto o
      // tesseract busca num CDN de terceiro em tempo de execucao.
      workerPath: `${base}ocr/worker.min.js`,
      /*
       * ⚠️ `.wasm.js`, e nao `.wasm`. Ver a nota em `scripts/fetch-ocr.ts`.
       *
       * O worker carrega o core com `importScripts`, que so aceita JavaScript.
       * Apontar pro `.wasm` puro, ou pro `.js` que busca o wasm ao lado, trava
       * em "initializing tesseract" sem erro nenhum — e na tela isso vira um
       * "lendo o PC e o PS…" que nunca acaba.
       */
      corePath: `${base}ocr/tesseract-core-simd-lstm.wasm.js`,
      langPath: `${base}ocr`,
      /*
       * O `errorHandler` NAO e opcional aqui.
       *
       * Sem ele, uma falha dentro do worker vira uma promessa que nunca resolve
       * e nunca rejeita — o `catch` de quem chamou nao dispara, e o unico
       * sintoma e a tela travada. Foi exatamente assim que o defeito acima
       * apareceu.
       */
      errorHandler: (e: unknown) => {
        console.error("[tk] leitor de texto:", e);
      },
    });
    /*
     * ⚠️ PSM 7 — UMA LINHA. O padrao do tesseract.js e 6, "bloco de texto".
     *
     * Com o padrao ele procura paragrafo, coluna e ordem de leitura numa imagem
     * que tem quatro digitos e mais nada. O modo de linha unica desliga essa
     * analise inteira.
     *
     * ⚠️ E NAO ha `tessedit_char_whitelist` aqui, embora fosse a coisa obvia a
     * fazer. Com o motor LSTM a lista branca tem bugs abertos no upstream que
     * chegam a apagar a palavra inteira. A garantia de que so entra digito fica
     * no `lerPc`/`lerPs`, DEPOIS — peneira, e nao trava.
     */
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    return worker as unknown as TesseractWorker;
  })();
  return leitor;
}

/** A mascara binaria vira canvas, que e o que o tesseract aceita. */
function paraCanvas(regiao: RegiaoTexto): HTMLCanvasElement {
  const { larg, alt, cinza } = ampliarParaOcr(regiao);
  const canvas = document.createElement("canvas");
  canvas.width = larg;
  canvas.height = alt;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  const img = ctx.createImageData(larg, alt);
  for (let i = 0; i < larg * alt; i++) {
    const v = cinza[i]!;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export async function lerNumeros(bmp: Bitmap): Promise<LeituraOcr> {
  const regiaoPc = acharLinhaPc(bmp);
  const regiaoPs = acharLinhaPs(bmp);
  if (!regiaoPc && !regiaoPs) return { pc: null, ps: null, psAtual: null };

  const worker = await obterLeitor();

  let pc: number | null = null;
  if (regiaoPc) {
    const { data } = await worker.recognize(paraCanvas(regiaoPc));
    pc = lerPc(data.text);
  }

  let ps: number | null = null;
  let psAtual: number | null = null;
  if (regiaoPs) {
    const { data } = await worker.recognize(paraCanvas(regiaoPs));
    const lido = lerPs(data.text);
    if (lido) {
      ps = lido.max;
      psAtual = lido.atual;
    }
  }

  return { pc, ps, psAtual };
}

/**
 * Libera os 5,9 MB do leitor.
 *
 * Chamado quando a folha de escanear fecha. O worker fica vivo entre prints da
 * MESMA sessao de escaneamento, que e onde ele paga; mante-lo depois disso seria
 * segurar memoria por tempo indeterminado num celular.
 */
export async function dispensarLeitor(): Promise<void> {
  const atual = leitor;
  leitor = null;
  if (atual) await (await atual).terminate();
}
