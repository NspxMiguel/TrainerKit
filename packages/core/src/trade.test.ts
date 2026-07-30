import { describe, expect, it } from "vitest";

import { avaliarTroca } from "./trade.js";

const FORTE = { atk: 263, def: 198, hp: 209 }; // Dragonite
const FRACO = { atk: 118, def: 111, hp: 128 }; // Bulbasaur, o caso de `especie.fraca`

describe("avaliarTroca", () => {
  it("as medias batem com a conta feita na mao", () => {
    // Uniforme de `piso` a 15, tres vezes. Media por stat = (piso + 15) / 2.
    const r = avaliarTroca({ ivs: { atk: 0, def: 0, hp: 0 }, baseStats: FORTE });
    expect(r.amigo.media).toBeCloseTo(((1 + 15) / 2) * 3, 10); // 24
    expect(r.melhorAmigo.media).toBeCloseTo(((5 + 15) / 2) * 3, 10); // 30
    expect(r.sortudo.media).toBeCloseTo(((12 + 15) / 2) * 3, 10); // 40,5
  });

  it("a distribuicao soma 1 e o pior caso do sortudo e 36", () => {
    // 12+12+12 = 36. Um sortudo NUNCA sai abaixo de 36/45, e e isso que faz a
    // troca sortuda valer mesmo pra quem ja tem um IV razoavel.
    const r = avaliarTroca({ ivs: { atk: 15, def: 15, hp: 15 }, baseStats: FORTE });
    expect(r.sortudo.melhora).toBe(0); // nada supera 45
    const abaixoDe36 = avaliarTroca({ ivs: { atk: 12, def: 11, hp: 12 }, baseStats: FORTE });
    expect(abaixoDe36.sortudo.melhora).toBe(1); // 35 < 36, o pior sorteio ja ganha
  });

  it("IV ruim em especie boa: vale trocar", () => {
    const r = avaliarTroca({ ivs: { atk: 3, def: 4, hp: 2 }, baseStats: FORTE });
    expect(r.vale).toBe(true);
    expect(r.atual).toBe(9);
    expect(r.motivo.key).toBe("trade.yes");
    expect(r.amigo.melhora).toBeGreaterThan(0.9);
  });

  it("IV ja bom: nao vale, porque o sorteio tem mais a perder", () => {
    const r = avaliarTroca({ ivs: { atk: 14, def: 15, hp: 13 }, baseStats: FORTE });
    expect(r.vale).toBe(false);
    expect(r.motivo.key).toBe("trade.no.alreadyGood");
  });

  it("o limite e a mediana do sorteio, nao um numero redondo", () => {
    // A regra e "chance de melhorar >= 50%". Vale conferir que ela cai onde a
    // distribuicao manda, e nao num 22/45 escolhido no olho.
    const vale = (total: number) =>
      avaliarTroca({ ivs: { atk: total, def: 0, hp: 0 }, baseStats: FORTE }).vale;
    // 23/45: a maioria dos sorteios ainda supera.
    expect(vale(23)).toBe(true);
    // 24/45 e a media exata; dai pra cima a chance de melhorar cai abaixo de 50%.
    expect(vale(25)).toBe(false);
  });

  it("especie fraca nao ganha etiqueta, por pior que seja o IV", () => {
    const r = avaliarTroca({ ivs: { atk: 0, def: 0, hp: 0 }, baseStats: FRACO });
    expect(r.vale).toBe(false);
    expect(r.motivo.key).toBe("trade.no.species");
  });

  it("sombroso nao pode ser trocado, e o app diz por que", () => {
    const r = avaliarTroca({ ivs: { atk: 1, def: 1, hp: 1 }, baseStats: FORTE, shadow: true });
    expect(r.vale).toBe(false);
    expect(r.motivo.key).toBe("trade.no.shadow");
  });

  it("sortudo ja veio de uma troca", () => {
    const r = avaliarTroca({ ivs: { atk: 1, def: 1, hp: 1 }, baseStats: FORTE, lucky: true });
    expect(r.vale).toBe(false);
    expect(r.motivo.key).toBe("trade.no.traded");
  });

  it("mesmo bloqueado, as contas continuam disponiveis", () => {
    // A tela do sombroso ainda quer mostrar "seria 24/45 na media" como
    // contexto. Bloquear a etiqueta nao pode zerar os numeros.
    const r = avaliarTroca({ ivs: { atk: 1, def: 1, hp: 1 }, baseStats: FORTE, shadow: true });
    expect(r.amigo.media).toBeCloseTo(24, 10);
    expect(r.sortudo.melhora).toBe(1);
  });
});
