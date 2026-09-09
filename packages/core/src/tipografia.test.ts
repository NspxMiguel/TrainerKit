import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * ENTRELINHA NÃO PODE COMER ACENTO DE MAIÚSCULA.
 *
 * ⚠️ Este teste nasceu de um defeito que só aparecia na tela, em português, e
 * que eu passei quatro rodadas sem ver: `legenda` tinha `lineHeight: "1"` —
 * entrelinha IGUAL ao tamanho da fonte — e o iOS cortava o que passa da altura
 * de caixa. O til do Ã e o circunflexo do Ê ficam ali em cima, então o app
 * escrevia "SUA COLEÇAO", "1 PEDE UMA DECISAO", "VOCE SABIA" e
 * "MOSTRAR TRADUÇAO DOS ATAQUES". A cedilha sobrevivia porque desce.
 *
 * O dicionário sempre teve os acentos certos. Testar as strings não pegaria
 * isto nunca — quem come o acento é a folha de estilo, e é ela que este teste
 * lê.
 *
 * ⚠️ 1,25 não é chute: com peso 800 e caixa alta, o diacrítico ocupa cerca de
 * 18% acima da altura de caixa nas fontes do sistema. 1,2 já raspa; 1,25 passa
 * com folga em Ã, Õ, Ê, Á, À, Ü e Ñ — que aparecem em nove dos dez idiomas.
 */
const MINIMO = 1.25;

const CONFIG = fileURLToPath(new URL("../../../apps/mobile/tailwind.config.js", import.meta.url));

describe("entrelinha da tipografia nativa", () => {
  const fonte = readFileSync(CONFIG, "utf8");

  it("o arquivo de configuração está onde este teste procura", () => {
    expect(fonte).toContain("fontSize:");
  });

  it("nenhum papel tipográfico tem entrelinha abaixo do mínimo", () => {
    /* Pega `nome: ["34px", { lineHeight: "1.1" ...` em qualquer ordem. */
    const achados = [...fonte.matchAll(/"?([\w-]+)"?:\s*\[\s*"(\d+)px",\s*\{([^}]*)\}/g)];
    expect(achados.length).toBeGreaterThan(3);

    const ruins: string[] = [];
    for (const [, nome, px, corpo] of achados) {
      const m = /lineHeight:\s*"([\d.]+)"/.exec(corpo ?? "");
      if (!m) continue;
      const valor = Number(m[1]);
      /* Entrelinha pode vir em px também; aí a razão é ela dividida pelo tamanho. */
      const razao = valor > 3 ? valor / Number(px) : valor;
      if (razao < MINIMO) ruins.push(`${nome} ${px}px → ${razao.toFixed(2)}`);
    }
    expect(ruins, ruins.join(" | ")).toEqual([]);
  });
});
