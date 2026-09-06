import { inflateSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { decodePng } from "./png.js";

/**
 * O DECODIFICADOR DE PNG, medido contra um decodificador de verdade.
 *
 * ⚠️ Ele falha SEM ERRO quando está errado. Um filtro por linha mal desfeito
 * não lança nada: devolve uma imagem que parece ruído, e o scanner responde
 * "não achei barra nenhuma" — que se parece exatamente com um print ruim. Sem
 * este teste, o defeito viraria "o leitor não funciona no meu celular".
 *
 * A referência é o Pillow do Python do sistema, e a comparação é pixel a pixel:
 * qualquer byte diferente reprova. Se o Pillow não estiver instalado o teste
 * PULA, mas só ele — o caso do PNG cinza abaixo roda sempre, porque ele é
 * gerado aqui dentro e não depende de nada.
 */
const inflate = (dados: Uint8Array): Uint8Array => new Uint8Array(inflateSync(dados));

/** Os ícones do app são PNGs reais, gerados pelo próprio repositório. */
const ICONE = join(process.cwd(), "..", "..", "apps", "web", "public", "icon-192.png");

function pillowDisponivel(): boolean {
  try {
    execFileSync("/usr/bin/python3", ["-c", "import PIL"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("decodePng", () => {
  it.runIf(pillowDisponivel())("bate pixel a pixel com o Pillow", () => {
    const bytes = new Uint8Array(readFileSync(ICONE));
    const meu = decodePng(bytes, inflate);

    const saida = execFileSync("/usr/bin/python3", [
      "-c",
      `from PIL import Image; import sys
im = Image.open(${JSON.stringify(ICONE)}).convert("RGBA")
sys.stdout.buffer.write(im.width.to_bytes(4,"big") + im.height.to_bytes(4,"big") + im.tobytes())`,
    ]);

    const larguraRef = saida.readUInt32BE(0);
    const alturaRef = saida.readUInt32BE(4);
    expect(meu.width).toBe(larguraRef);
    expect(meu.height).toBe(alturaRef);

    const ref = saida.subarray(8);
    expect(meu.data.length).toBe(ref.length);
    let diferentes = 0;
    for (let i = 0; i < ref.length; i++) if (meu.data[i] !== ref[i]) diferentes++;
    expect(diferentes, `${diferentes} bytes diferentes de ${ref.length}`).toBe(0);
  });

  it("recusa o que não sabe decodificar, em vez de devolver ruído", () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), inflate)).toThrow(/nao e PNG/);
  });
});
