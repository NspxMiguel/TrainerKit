import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { scanAppraisalBars } from "./scan.js";

/**
 * Validacao contra prints REAIS do jogo.
 *
 * Foi este teste que pegou o erro que nenhum outro pegaria: as constantes de
 * cor do GoIV (`#EE9219`) estao defasadas — o jogo repintou o laranja para
 * `#F3A74C` desde 2022, distancia ~55 em RGB. Com a cor velha o detector nao
 * acha barra nenhuma num print perfeitamente legivel.
 *
 * Os fixtures ficam FORA do repositorio de proposito: sao 4 MB cada e contem
 * arte do jogo. Para rodar, converta seus prints com o script do scratchpad e
 * aponte TK_PRINTS para a pasta. Sem eles, o teste se ignora — nao falha, para
 * nao quebrar o build de quem nao os tem.
 */
const DIR = process.env.TK_PRINTS ?? "";

/**
 * Os tres primeiros tem gabarito: o proprio dono escreveu o IV no apelido do
 * Pokemon ("Gyardeos100", "Mewtwo93", "Dragonitlv86"). Os demais nao tem numero
 * conhecido e servem para garantir que a leitura ao menos NAO FALHA — foi assim
 * que apareceram os casos de barra quase vazia e de barra encoberta.
 */
const CASOS = [
  { file: "p1", nome: "Dragonite", esperado: 86.7 },
  { file: "p2", nome: "Gyarados", esperado: 100 },
  { file: "p3", nome: "Mewtwo", esperado: 93.3 },
  { file: "p4", nome: "Hariyama", esperado: null },
  { file: "novos/n1", nome: "Obstagoon (ataque quase zero)", esperado: null },
  { file: "novos/n2", nome: "novo 2", esperado: null },
  { file: "novos/n3", nome: "novo 3", esperado: null },
  { file: "novos/n4", nome: "novo 4", esperado: null },
  { file: "novos/n5", nome: "novo 5", esperado: null },
  { file: "novos/n6", nome: "novo 6", esperado: null },
  { file: "novos/n7", nome: "novo 7", esperado: null },
  { file: "novos/n8", nome: "novo 8", esperado: null },
  { file: "novos/n9", nome: "novo 9", esperado: null },
] as const;

const temFixtures = DIR !== "" && CASOS.every((c) => existsSync(`${DIR}/${c.file}.raw`));

describe.skipIf(!temFixtures)("prints reais", () => {
  for (const caso of CASOS) {
    it(`${caso.nome}`, () => {
      const buf = readFileSync(`${DIR}/${caso.file}.raw`);
      const width = buf.readUInt32BE(0);
      const height = buf.readUInt32BE(4);
      const data = new Uint8ClampedArray(
        buf.buffer.slice(buf.byteOffset + 8, buf.byteOffset + 8 + width * height * 4),
      );

      const r = scanAppraisalBars({ data, width, height });

      if (!r.ok) {
        console.log(`  ${caso.nome}: FALHOU — ${r.reason}: ${r.detail}`);
        for (const b of r.bars.slice(0, 8)) {
          console.log(
            `     cand x=${b.rect.x} y=${b.rect.y} larg=${b.rect.width} alt=${b.rect.height} val=${b.value}`,
          );
        }
        expect.fail(r.reason);
      }

      const total = r.ivs.atk + r.ivs.def + r.ivs.hp;
      const pct = (total / 45) * 100;
      console.log(
        `  ${caso.nome}: IV ${r.ivs.atk}/${r.ivs.def}/${r.ivs.hp} = ${pct.toFixed(1)}% ` +
          `(esperado ${caso.esperado ?? "?"})`,
      );
      for (const b of r.bars) {
        console.log(
          `     barra x=${b.rect.x} y=${b.rect.y} larg=${b.rect.width} val=${b.value}${b.perfect ? " vermelha" : ""}`,
        );
      }

      if (caso.esperado !== null) expect(pct).toBeCloseTo(caso.esperado, 0);
    });
  }
});
