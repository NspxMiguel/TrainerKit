// @vitest-environment node
//
// ⚠️ Ambiente NODE, e nao o jsdom do resto da suite. O tesseract.js escolhe o
// caminho de navegador ou o de Node pela presenca de `window`, e com jsdom ele
// escolhe o de navegador: tenta subir um Web Worker de verdade e morre. Aqui
// nao ha UI pra testar — sao pixels entrando e numeros saindo.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  acharLinhaPc,
  acharLinhaPs,
  ampliarParaOcr,
  lerPc,
  lerPs,
  levelsMatchingHp,
  scanAppraisalBars,
  solveLevel,
  type BaseStats,
  type Bitmap,
  type RegiaoTexto,
} from "@trainerkit/core";

/**
 * A taxa de acerto do leitor de PC e PS, em prints REAIS, medida — nao estimada.
 *
 * "OCR validado contra um conjunto de prints reais do Miguel, medindo taxa de
 * acerto por campo — não 'parece funcionar', mas percentual." Esta e a frase do
 * plano, e este arquivo e ela.
 *
 * ⚠️ Os fixtures ficam FORA do repositorio, como os do `scan.realprints`: sao
 * megabytes de arte do jogo. Sem eles o arquivo se ignora — nao falha, pra nao
 * quebrar o build de quem nao os tem. Com `TK_PRINTS` apontando pra pasta, ele
 * roda o caminho inteiro.
 *
 * O que ele trava e mais importante que o percentual: que o leitor NUNCA
 * devolva um numero que a matematica desminta. Um PC errado com cara de certo
 * faz o app calcular custo de poeira errado e recomendar investimento errado —
 * e o jogador so descobre depois de gastar.
 */
const DIR = process.env.TK_PRINTS ?? "";

/**
 * Gabarito conferido a olho nos recortes binarizados de cada print.
 *
 * `null` = o valor nao foi confirmado (print de mockup, sem referencia
 * independente). Esses casos nao pontuam acerto; servem so pra garantir que o
 * app nao ENGOLE um numero errado.
 */
const CASOS: Array<{ arquivo: string; nome: string; pc: number | null; ps: number | null }> = [
  // Prints NATIVOS de iPhone — o uso real, e onde a medida vale.
  { arquivo: "cel/c2", nome: "Slaking (PC sobre bokeh claro)", pc: null, ps: 138 },
  { arquivo: "cel/c3", nome: "iPhone 3 (aviso do sistema sobre o PC)", pc: null, ps: 90 },
  { arquivo: "cel/c4", nome: "iPhone 4", pc: 1416, ps: 96 },
  { arquivo: "cel/c5", nome: "iPhone 5", pc: 1302, ps: 150 },
  { arquivo: "cel/c6", nome: "iPhone 6", pc: 1279, ps: 122 },
  { arquivo: "cel/c7", nome: "iPhone 7", pc: 1279, ps: 111 },
  { arquivo: "cel/c8", nome: "iPhone 8", pc: 1179, ps: 149 },
  { arquivo: "cel/c9", nome: "iPhone 9", pc: 1161, ps: 162 },
  { arquivo: "cel/c10", nome: "iPhone 10", pc: 1161, ps: 96 },
  { arquivo: "cel/c11", nome: "iPhone 11", pc: 1156, ps: 101 },
  { arquivo: "cel/c12", nome: "iPhone 12", pc: 1125, ps: 108 },
  { arquivo: "cel/c13", nome: "iPhone 13", pc: 1109, ps: 149 },
  { arquivo: "cel/c14", nome: "iPhone 14", pc: 1097, ps: 87 },

  // Mockups: a tela do celular DENTRO de uma janela de computador, e copias
  // reescaladas. O `scan.ts` ja documenta que essa familia e o limite conhecido
  // do scanner, e aqui ela serve pro teste que importa — o de nao mentir.
  { arquivo: "p1", nome: "Dragonite desmaiado (0/172 PS)", pc: null, ps: null },
  { arquivo: "p2", nome: "Gyarados (mockup)", pc: null, ps: 157 },
  { arquivo: "p3", nome: "Mewtwo (mockup)", pc: null, ps: 136 },
  { arquivo: "novos/n1", nome: "Obstagoon", pc: null, ps: 174 },
  { arquivo: "novos/n3", nome: "novo 3", pc: null, ps: 147 },
  { arquivo: "novos/n4", nome: "novo 4", pc: null, ps: 137 },
  { arquivo: "novos/n5", nome: "novo 5", pc: null, ps: 160 },
  { arquivo: "novos/n8", nome: "novo 8", pc: null, ps: 161 },
  { arquivo: "novos/n9", nome: "novo 9", pc: null, ps: 117 },
];

const temFixtures = DIR !== "" && CASOS.every((c) => existsSync(`${DIR}/${c.arquivo}.raw`));

function carregar(nome: string): Bitmap {
  const buf = readFileSync(`${DIR}/${nome}.raw`);
  const width = buf.readUInt32BE(0);
  const height = buf.readUInt32BE(4);
  const data = new Uint8ClampedArray(
    buf.buffer.slice(buf.byteOffset + 8, buf.byteOffset + 8 + width * height * 4),
  );
  return { data, width, height };
}

/*
 * PNG sem filtro, escrito na mao.
 *
 * O tesseract em Node aceita caminho de arquivo, e nao um bitmap cru; escrever
 * 40 linhas de PNG e mais barato que arrastar uma dependencia de imagem so pra
 * teste. (No navegador nada disso acontece: `scan/ocr.ts` monta um canvas.)
 */
const CRC_TAB = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function png(larg: number, alt: number, cinza: Uint8Array): Buffer {
  const linhas = Buffer.alloc((larg * 4 + 1) * alt);
  for (let y = 0; y < alt; y++) {
    const base = y * (larg * 4 + 1) + 1;
    for (let x = 0; x < larg; x++) {
      const v = cinza[y * larg + x]!;
      linhas[base + x * 4] = v;
      linhas[base + x * 4 + 1] = v;
      linhas[base + x * 4 + 2] = v;
      linhas[base + x * 4 + 3] = 255;
    }
  }
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = CRC_TAB[(c ^ x) & 255]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipo: string, corpo: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(corpo.length);
    const tb = Buffer.from(tipo, "ascii");
    const cb = Buffer.alloc(4);
    cb.writeUInt32BE(crc(Buffer.concat([tb, corpo])));
    return Buffer.concat([len, tb, corpo, cb]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(larg, 0);
  ihdr.writeUInt32BE(alt, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(linhas)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe.skipIf(!temFixtures)("prints reais: PC e PS", () => {
  it("le os numeros sem nunca inventar um", async () => {
    const { createWorker, PSM } = await import("tesseract.js");
    /*
     * ⚠️ `cachePath` no diretorio temporario.
     *
     * Em Node o tesseract grava o `eng.traineddata` descompactado (4 MB) no
     * diretorio de trabalho, e o diretorio de trabalho aqui e `apps/web`. Rodei
     * o teste uma vez e o arquivo apareceu no `git status`, esperando pra ser
     * commitado por engano.
     */
    const worker = await createWorker("eng", undefined, { cachePath: tmpdir() });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });

    const reconhecer = async (regiao: RegiaoTexto, tag: string): Promise<string> => {
      const { larg, alt, cinza } = ampliarParaOcr(regiao);
      const caminho = join(tmpdir(), `tk-ocr-${tag}.png`);
      writeFileSync(caminho, png(larg, alt, cinza));
      const { data } = await worker.recognize(caminho);
      return data.text;
    };

    const placar = { pcOk: 0, pcErrado: [] as string[], psOk: 0, psErrado: [] as string[] };

    for (const caso of CASOS) {
      const bmp = carregar(caso.arquivo);
      const tag = caso.arquivo.replace("/", "-");

      const regiaoPc = acharLinhaPc(bmp);
      const pc = regiaoPc ? lerPc(await reconhecer(regiaoPc, `pc-${tag}`)) : null;
      if (caso.pc !== null) {
        if (pc === caso.pc) placar.pcOk++;
        else placar.pcErrado.push(`${caso.nome}: leu ${pc}, era ${caso.pc}`);
      }

      const regiaoPs = acharLinhaPs(bmp);
      const ps = regiaoPs ? lerPs(await reconhecer(regiaoPs, `ps-${tag}`)) : null;
      if (caso.ps !== null) {
        if (ps?.max === caso.ps) placar.psOk++;
        else placar.psErrado.push(`${caso.nome}: leu ${ps?.max ?? "nada"}, era ${caso.ps}`);
      }
    }

    await worker.terminate();

    console.log(
      `  PC: ${placar.pcOk} certos de ${CASOS.filter((c) => c.pc !== null).length} conferidos\n` +
        `  PS: ${placar.psOk} certos de ${CASOS.filter((c) => c.ps !== null).length} conferidos`,
    );

    /*
     * ⚠️ Zero erro, e nao "erro pequeno".
     *
     * Recusar e aceitavel — quem recusa devolve o campo pra pessoa digitar.
     * Errar nao e: um PC plausivel e falso atravessa o app inteiro em silencio
     * e vira recomendacao de investimento sobre um numero inventado.
     */
    expect(placar.pcErrado).toEqual([]);
    expect(placar.psErrado).toEqual([]);
  }, 300_000);

  it("a conta desmente o que o OCR leu errado", async () => {
    /*
     * ⚠️ O TESTE QUE PROTEGE DE VERDADE.
     *
     * Nos mockups o leitor devolveu "10" pra um PC de quatro digitos — e "10"
     * passa em qualquer validacao de formato que se escreva, porque e um PC
     * perfeitamente possivel. O que o desmente nao e o formato, e a fisica do
     * jogo: com o IV exato vindo das barras, PC e PS juntos so existem em algum
     * dos 109 niveis. Se nenhum produz aquele par, um dos dois foi lido errado.
     *
     * Aqui a prova roda com numeros inventados de proposito, pra travar a
     * regra sem depender do que o tesseract fez naquele dia.
     */
    const gamedata = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "..", "..", "public", "dataset", "gamedata.json"),
        "utf8",
      ),
    ) as {
      cpm: number[];
      version: { levelCap: number };
      species: Array<{ id: string; baseStats: BaseStats }>;
    };
    const dragonite = gamedata.species.find((s) => s.id === "dragonite");
    expect(dragonite).toBeDefined();
    const ivs = { atk: 15, def: 14, hp: 13 };

    /*
     * O PS de referencia sai do PROPRIO motor, e nao de um numero que eu digite
     * aqui.
     *
     * Na primeira versao eu inventei "PS 160" — e 160 nao e um PS que este
     * Dragonite possa ter em nivel nenhum, entao o teste reprovava por engano
     * meu, e nao por defeito do app. Perguntando ao motor qual PS existe, ele
     * continua valendo em qualquer versao do dataset.
     */
    let psReal: number | null = null;
    for (let ps = 10; ps <= 300 && psReal === null; ps++) {
      const niveis = levelsMatchingHp(
        gamedata.cpm,
        dragonite!.baseStats,
        ivs,
        ps,
        gamedata.version.levelCap,
      );
      if (niveis.length > 0) psReal = ps;
    }
    expect(psReal).not.toBeNull();

    // O caso do mockup: o PC saiu truncado em "10", que passa em qualquer
    // validacao de FORMATO que se escreva — mas nao existe junto com esse PS,
    // em nivel nenhum. E o que faz o app devolver o campo em vez de calcular
    // custo de poeira em cima de um numero inventado.
    expect(
      solveLevel(
        gamedata.cpm,
        dragonite!.baseStats,
        ivs,
        { cp: 10, hp: psReal! },
        gamedata.version.levelCap,
      ),
    ).toEqual([]);
  });

  it("as barras e os numeros vem do MESMO print, e concordam", () => {
    // Sanidade de integracao: se as barras leem, a regiao do PS tambem tem que
    // ser encontrada. Elas estao na mesma tela; uma achar e a outra nao seria
    // sinal de que o recorte depende de algo que nao e a tela do jogo.
    const semPs: string[] = [];
    for (const caso of CASOS) {
      const bmp = carregar(caso.arquivo);
      if (!scanAppraisalBars(bmp).ok) continue;
      if (!acharLinhaPs(bmp)) semPs.push(caso.nome);
    }
    expect(semPs).toEqual([]);
  });
});
