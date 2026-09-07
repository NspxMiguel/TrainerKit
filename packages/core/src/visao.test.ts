import { describe, expect, it } from "vitest";

import { MODELO_DE_VISAO, corpoDaVisao, nomeDaResposta } from "./visao.js";

/**
 * A leitura da resposta do modelo de visão.
 *
 * ⚠️ Não é teste de rede: é teste das três formas que essa resposta já veio
 * errada contra a Groq de verdade. Cada caso aqui foi um bug.
 */
describe("nome que sai da resposta", () => {
  it("o nome limpo passa", () => {
    expect(nomeDaResposta("Charizard")).toBe("Charizard");
    expect(nomeDaResposta("  Mr. Mime \n")).toBe("Mr. Mime");
  });

  it("UNKNOWN é resposta CERTA e vira null, não um bicho chamado Unknown", () => {
    expect(nomeDaResposta("UNKNOWN")).toBeNull();
    expect(nomeDaResposta("unknown\n")).toBeNull();
  });

  it("o bloco <think> sai — modelo de raciocínio devolvia a resposta dentro dele", () => {
    expect(nomeDaResposta("<think>\nHmm, wings, orange...\n</think>\nCharizard")).toBe("Charizard");
    expect(nomeDaResposta("<think>não sei</think>UNKNOWN")).toBeNull();
  });

  it("quando ele desobedece e escreve uma frase, fica a primeira linha", () => {
    expect(nomeDaResposta("Pikachu\nEste é o Pokémon elétrico mais conhecido.")).toBe("Pikachu");
  });

  it("resposta vazia é null — nunca string vazia virando busca por tudo", () => {
    expect(nomeDaResposta("")).toBeNull();
    expect(nomeDaResposta("<think>pensando</think>")).toBeNull();
  });

  it("corta em 40 caracteres: o casamento com o dataset não melhora com um parágrafo", () => {
    expect(nomeDaResposta("x".repeat(200))).toHaveLength(40);
  });
});

describe("corpo do pedido", () => {
  const corpo = corpoDaVisao("data:image/jpeg;base64,AAAA");

  it("temperatura zero e raciocínio desligado — as duas custaram um bug cada", () => {
    expect(corpo.temperature).toBe(0);
    expect(corpo.reasoning_effort).toBe("none");
  });

  it("400 tokens, não 40: com 40 a resposta voltou vazia", () => {
    expect(corpo.max_tokens).toBe(400);
  });

  it("a imagem vai embutida, e o modelo é o que aceita imagem", () => {
    expect(corpo.model).toBe(MODELO_DE_VISAO);
    const msgs = corpo.messages as Array<{ role: string; content: unknown }>;
    const partes = msgs[1]?.content as Array<{ type: string; image_url?: { url: string } }>;
    expect(partes.find((p) => p.type === "image_url")?.image_url?.url).toBe(
      "data:image/jpeg;base64,AAAA",
    );
  });
});
