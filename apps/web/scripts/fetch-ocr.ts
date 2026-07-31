import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

/**
 * Junta os arquivos do leitor de texto em `public/ocr/`.
 *
 * ⚠️ NADA DISSO E VERSIONADO, pelo mesmo motivo do dataset: sao 5,9 MB de
 * binario reconstruivel em segundos, e um diff de 5,9 MB a cada atualizacao do
 * tesseract nao serve pra ninguem. `public/ocr/` esta no .gitignore.
 *
 * ⚠️ E nada disso e SERVIDO DE TERCEIRO. O tesseract.js, por padrao, busca o
 * wasm e o modelo num CDN em tempo de execucao. Aqui os arquivos ficam na mesma
 * origem do app, o que resolve tres coisas de uma vez:
 *
 *   · offline de verdade — baixou uma vez, funciona pra sempre;
 *   · nada do print, nem metadado de requisicao, sai pra um dominio de terceiro;
 *   · o app nao quebra se o CDN sair do ar (ja aconteceu com a fonte de imagens
 *     deste projeto, quando o repositorio RetroJohns foi deletado).
 */

const aqui = dirname(fileURLToPath(import.meta.url));
const destino = join(aqui, "..", "public", "ocr");
const require = createRequire(import.meta.url);

/*
 * A variante `simd-lstm`: SIMD porque todo navegador que nos importa tem desde
 * 2021, e `lstm` porque o motor antigo (o "legacy") nao e usado e vem junto
 * dobrando o tamanho do arquivo.
 *
 * ⚠️ E o `.wasm.js`, com o wasm embutido em base64 — NAO o `.wasm` separado.
 *
 * Eu comecei pelo separado, que e 1 MB menor e compila em streaming, e o
 * resultado foi um travamento silencioso: o worker do tesseract carrega o core
 * com `importScripts`, e `importScripts` so aceita JavaScript. Com o `.wasm`
 * puro ele nem tenta; com o `.js` que busca o wasm ao lado, ele emite "loading
 * tesseract core 1" em 25 ms — rapido demais pra ter baixado 2,7 MB — e depois
 * fica preso em "initializing tesseract 0" pra sempre, sem erro nenhum.
 *
 * Foi preciso instrumentar o `logger` do proprio tesseract pra ver isso: pela
 * tela, o app so ficava "lendo o PC e o PS…" eternamente. Com o `.wasm.js` a
 * mesma sequencia termina em 113 ms.
 */
const DO_PACOTE = ["tesseract-core-simd-lstm.wasm.js"];

/*
 * O modelo FAST, e nao o padrao.
 *
 * O `tessdata_fast` e ~4x menor que o completo, e onde ele perde e em texto
 * corrido. Aqui nao ha texto corrido: sao no maximo nove glifos, todos digitos
 * ou barra, ja binarizados e ampliados pelo `core/ocr.ts`.
 *
 * Medido com ESTE modelo nos 26 prints reais: 11 de 11 PC certos e 21 de 21 PS
 * certos entre os que o app aceitou ler. Nao ha margem pro modelo grande
 * comprar — o que sobra de erro nao e reconhecimento, e recorte.
 */
const MODELO = "https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz";

async function main(): Promise<void> {
  mkdirSync(destino, { recursive: true });

  const core = dirname(require.resolve("tesseract.js-core/package.json"));
  for (const arquivo of DO_PACOTE) {
    const alvo = join(destino, arquivo);
    if (existsSync(alvo)) {
      console.log(`  ${arquivo}: ja esta aqui`);
      continue;
    }
    await copyFile(join(core, arquivo), alvo);
    console.log(`  ${arquivo}: ${(statSync(alvo).size / 1024 / 1024).toFixed(2)} MB`);
  }

  const worker = join(destino, "worker.min.js");
  if (!existsSync(worker)) {
    const dist = dirname(require.resolve("tesseract.js/package.json"));
    await copyFile(join(dist, "dist", "worker.min.js"), worker);
    console.log(`  worker.min.js: ${(statSync(worker).size / 1024).toFixed(0)} kB`);
  }

  const modelo = join(destino, "eng.traineddata.gz");
  if (existsSync(modelo)) {
    console.log("  eng.traineddata.gz: ja esta aqui");
    return;
  }
  const resposta = await fetch(MODELO);
  if (!resposta.ok || !resposta.body) {
    throw new Error(`modelo do OCR: HTTP ${resposta.status}`);
  }
  await pipeline(Readable.fromWeb(resposta.body as never), createWriteStream(modelo));
  console.log(`  eng.traineddata.gz: ${(statSync(modelo).size / 1024 / 1024).toFixed(2)} MB`);
}

await main();
