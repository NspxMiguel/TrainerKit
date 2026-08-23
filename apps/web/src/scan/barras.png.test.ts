// @vitest-environment node
//
// Ambiente NODE: aqui não há UI, são pixels entrando e números saindo — e o
// decodificador de PNG usa `node:zlib`.
import { readdirSync, readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { scanAppraisalBars } from "@trainerkit/core";

import { lerPng } from "../../scripts/ler-prints.ts";

/**
 * O leitor de barras rodando contra os PNGs REAIS, sem conversão nenhuma.
 *
 * ⚠️ POR QUE ISTO PRECISAVA EXISTIR, tendo `appraisal.selo.test.ts` ──────────
 *
 * Aquele teste travou os limiares de estrela usando treze especie reais do
 * dono. Mas ele guarda o RESULTADO da medição — a tabela de totais que o
 * scanner devolveu naquele dia — e não roda o scanner. Se o leitor de barras
 * regredir amanhã, ele continua passando, verdinho, sobre números que já não
 * correspondem a nada.
 *
 * Este arquivo fecha o circuito: lê os mesmos prints, roda `scanAppraisalBars`,
 * e exige os mesmos totais. Um é o gabarito, o outro é a prova.
 *
 * ── Por que não é o `scan.realprints.test.ts` ───────────────────────────────
 *
 * Aquele é a rede de segurança original e continua valendo, mas depende de
 * fixtures `.raw` convertidos por um script de rascunho que não existe mais —
 * na prática ele está sempre pulado. Este aqui lê PNG direto, que é o que sai
 * do celular e o que sobra na pasta de downloads meses depois.
 *
 * ── Como rodar ──────────────────────────────────────────────────────────────
 *
 *   TK_PRINTS_PNG=~/Downloads pnpm --filter @trainerkit/web test
 *
 * Sem a variável, ou com a pasta faltando algum print, ele se ignora — não
 * falha, pra não quebrar o build de quem não tem os prints. Eles ficam FORA do
 * repositório de propósito: são arte do jogo e são fotos da coleção de alguém.
 */
const DIR = process.env.TK_PRINTS_PNG ?? "";

/**
 * O que cada print tem que ler. Medido, não estimado.
 *
 * Os dois com `apelido` são os que têm gabarito de verdade: o próprio dono
 * escreveu o IV no nome da especie dentro do jogo, então a resposta certa está
 * impressa na própria imagem. Os outros onze travam a regressão — não provam
 * que o número está certo, provam que ele não MUDOU.
 */
const ESPERADO: ReadonlyArray<{
  arquivo: string;
  total: number;
  ivs: [number, number, number];
  apelido?: string;
}> = [
  { arquivo: "IMG_2535.PNG", total: 29, ivs: [8, 6, 15], apelido: "Slaking64%" },
  { arquivo: "IMG_2536.PNG", total: 38, ivs: [13, 10, 15] },
  { arquivo: "IMG_2537.PNG", total: 39, ivs: [14, 11, 14] },
  { arquivo: "IMG_2538.PNG", total: 38, ivs: [11, 14, 13] },
  { arquivo: "IMG_2539.PNG", total: 34, ivs: [11, 12, 11] },
  { arquivo: "IMG_2540.PNG", total: 33, ivs: [14, 7, 12] },
  { arquivo: "IMG_2541.PNG", total: 32, ivs: [11, 10, 11] },
  { arquivo: "IMG_2542.PNG", total: 33, ivs: [10, 11, 12] },
  { arquivo: "IMG_2543.PNG", total: 42, ivs: [15, 12, 15], apelido: "Sneasel93%" },
  { arquivo: "IMG_2544.PNG", total: 23, ivs: [9, 8, 6] },
  { arquivo: "IMG_2545.PNG", total: 32, ivs: [5, 12, 15] },
  { arquivo: "IMG_2546.PNG", total: 36, ivs: [15, 10, 11] },
  { arquivo: "IMG_2547.PNG", total: 42, ivs: [14, 13, 15] },
];

/**
 * Prints que o leitor TEM que recusar.
 *
 * ⚠️ Recusar não é falhar — é o comportamento certo, e ele precisa de teste
 * tanto quanto o acerto. O perigo de um leitor de IV não é dizer "não sei": é
 * dizer um número errado com cara de certo, e o jogador transferir a especie
 * bom por causa dele.
 *
 * Sete destes são prints do Duolingo que estavam na mesma pasta. Se um dia o
 * leitor "melhorar" a ponto de achar barras num print de outro app, este teste
 * é quem avisa.
 */
const RECUSADOS = [
  "IMG_2580.PNG",
  "IMG_2581.PNG",
  "IMG_2582.PNG",
  "IMG_2583.PNG",
  "IMG_2584.PNG",
  "IMG_2585.PNG",
  "IMG_2586.PNG",
  // Print ROLADO: 1206x4506, a tela inteira costurada. As barras existem, mas a
  // proporção da imagem não é a de uma tela — e vários limiares do scanner são
  // relativos à largura.
  "IMG_2455.PNG",
];

const tem = (f: string) => DIR !== "" && existsSync(join(DIR, f));
const temTudo = DIR !== "" && ESPERADO.every((c) => tem(c.arquivo));

describe.skipIf(!temTudo)("leitor de barras nos PNGs reais", () => {
  it("lê os treze prints com exatamente os mesmos IV de sempre", () => {
    for (const caso of ESPERADO) {
      const bmp = lerPng(readFileSync(join(DIR, caso.arquivo)));
      const r = scanAppraisalBars(bmp);

      expect(r.ok, `${caso.arquivo} foi recusado`).toBe(true);
      if (!r.ok) continue;

      const lido = [r.ivs.atk, r.ivs.def, r.ivs.hp];
      expect(lido, caso.arquivo).toEqual(caso.ivs);
      expect(r.ivs.atk + r.ivs.def + r.ivs.hp, caso.arquivo).toBe(caso.total);
    }
  });

  /*
   * O gabarito impresso na imagem. São só dois, e valem mais que os outros onze
   * juntos: os onze provam que a leitura não mudou; estes provam que ela está
   * CERTA, contra um número que o dono escreveu no jogo antes de eu existir.
   */
  it("bate com o IV que o dono escreveu no apelido da especie", () => {
    for (const caso of ESPERADO.filter((c) => c.apelido)) {
      const bmp = lerPng(readFileSync(join(DIR, caso.arquivo)));
      const r = scanAppraisalBars(bmp);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;

      const pct = ((r.ivs.atk + r.ivs.def + r.ivs.hp) / 45) * 100;
      const doApelido = Number(/(\d+)%/.exec(caso.apelido!)?.[1]);
      // O apelido é arredondado pra baixo pelo jogo (93% para 93,3%).
      expect(Math.floor(pct), `${caso.arquivo} (${caso.apelido})`).toBe(doApelido);
    }
  });

  it("recusa o que não é tela de avaliação, sem inventar número", () => {
    for (const nome of RECUSADOS) {
      if (!tem(nome)) continue;
      const bmp = lerPng(readFileSync(join(DIR, nome)));
      const r = scanAppraisalBars(bmp);
      expect(r.ok, `${nome} deveria ter sido recusado`).toBe(false);
    }
  });

  /*
   * A pasta inteira, e não só os arquivos que eu listei.
   *
   * Se ele jogar um print novo ali, este teste passa a lê-lo junto — e a única
   * exigência é a que sempre vale: ou lê um IV plausível, ou recusa. Nunca um
   * número impossível.
   */
  it("nada na pasta produz um IV fora de 0..45", () => {
    const pngs = readdirSync(DIR).filter((f) => extname(f).toLowerCase() === ".png");
    expect(pngs.length).toBeGreaterThan(0);

    for (const nome of pngs) {
      let bmp;
      try {
        bmp = lerPng(readFileSync(join(DIR, nome)));
      } catch {
        continue; // PNG que o decodificador não cobre não é assunto deste teste.
      }
      const r = scanAppraisalBars(bmp);
      if (!r.ok) continue;
      for (const v of [r.ivs.atk, r.ivs.def, r.ivs.hp]) {
        expect(Number.isInteger(v), `${nome} devolveu IV não inteiro`).toBe(true);
        expect(v, nome).toBeGreaterThanOrEqual(0);
        expect(v, nome).toBeLessThanOrEqual(15);
      }
    }
  });
});
