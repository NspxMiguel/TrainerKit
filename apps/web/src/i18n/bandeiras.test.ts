import { afterEach, describe, expect, it, vi } from "vitest";

import { bandeirasDesenham, esquecerMedicaoDeBandeira } from "./bandeiras.ts";

/**
 * A deteccao tem que decidir CERTO nos dois lados, e o lado que importa e o
 * negativo: e o Windows, onde a bandeira vira "BR" em letra solta.
 *
 * O teste finge o canvas porque nem o jsdom nem o navegador do CI tem como
 * garantir uma fonte SEM as ligaduras — o que se prova aqui e a regra de
 * decisao, e nao a fonte de uma maquina especifica.
 */
function fingirCanvas(larguras: Record<string, number> | null): void {
  vi.spyOn(document, "createElement").mockImplementation(
    () =>
      ({
        getContext: () =>
          larguras === null
            ? null
            : {
                font: "",
                measureText: (t: string) => ({ width: larguras[t] ?? 0 }),
              },
      }) as unknown as HTMLElement,
  );
}

const JUNTO = "\u{1F1E7}\u{1F1F7}";
const SEPARADO = "\u{1F1E7}​\u{1F1F7}";

afterEach(() => {
  vi.restoreAllMocks();
  esquecerMedicaoDeBandeira();
});

describe("desenha bandeira?", () => {
  it("ligadura acontece: o par junto e mais estreito -> desenha", () => {
    // Onde a fonte tem a bandeira, os dois indicadores viram UM glifo.
    fingirCanvas({ [JUNTO]: 16, [SEPARADO]: 32 });
    expect(bandeirasDesenham()).toBe(true);
  });

  it("sem ligadura: as duas medidas batem -> NAO desenha", () => {
    // No Windows os dois lados sao as mesmas duas letras; o espaco de largura
    // zero nao muda nada porque nao havia ligadura pra impedir.
    fingirCanvas({ [JUNTO]: 32, [SEPARADO]: 32 });
    expect(bandeirasDesenham()).toBe(false);
  });

  it("diferenca de arredondamento nao conta como ligadura", () => {
    // Meio pixel de folga: sem ela, subpixel faria a resposta virar sorteio.
    fingirCanvas({ [JUNTO]: 31.7, [SEPARADO]: 32 });
    expect(bandeirasDesenham()).toBe(false);
  });

  it("sem canvas, mostra — que e o que o app ja fazia", () => {
    fingirCanvas(null);
    expect(bandeirasDesenham()).toBe(true);
  });

  it("mede uma vez so: a segunda chamada nao toca o canvas de novo", () => {
    fingirCanvas({ [JUNTO]: 16, [SEPARADO]: 32 });
    bandeirasDesenham();
    const antes = (document.createElement as unknown as { mock: { calls: unknown[] } }).mock.calls
      .length;
    bandeirasDesenham();
    const depois = (document.createElement as unknown as { mock: { calls: unknown[] } }).mock.calls
      .length;
    // Uma lista de dez idiomas chama isto dez vezes por render.
    expect(depois).toBe(antes);
  });
});
