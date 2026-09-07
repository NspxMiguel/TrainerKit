import { describe, expect, it } from "vitest";

import {
  checarUrl,
  manifestSpriteUrl,
  partirUrl,
  validarDataset,
  validarManifesto,
  type SpriteManifest,
} from "./sprites.js";

/**
 * As FONTES PRÓPRIAS.
 *
 * O que se testa aqui não é a rede — é a recusa. Uma fonte que o app aceita sem
 * conferir vira tela branca ou, pior, número errado calculado sobre lixo; e a
 * mensagem que aparece precisa ser CHAVE de tradução, senão quem está em
 * japonês lê metade da tela em português.
 */
describe("manifesto de imagem", () => {
  it("aceita o modelo e substitui as três marcas", () => {
    const m: SpriteManifest = { name: "Meu", template: "https://x/{dex}-{id}-{spriteId}.png" };
    expect(validarManifesto(m)).toBeNull();
    expect(manifestSpriteUrl({ id: "pikachu", dex: 25, spriteId: 25 }, m)).toBe(
      "https://x/25-pikachu-25.png",
    );
  });

  it("o mapa explícito VENCE o modelo, por id ou por dex", () => {
    const m: SpriteManifest = {
      name: "Meu",
      template: "https://x/{dex}.png",
      images: { pikachu: "https://y/pika.png", "6": "https://y/char.png" },
    };
    expect(manifestSpriteUrl({ id: "pikachu", dex: 25, spriteId: 25 }, m)).toBe(
      "https://y/pika.png",
    );
    expect(manifestSpriteUrl({ id: "charizard", dex: 6, spriteId: 6 }, m)).toBe(
      "https://y/char.png",
    );
  });

  it("sem modelo e sem imagens não serve — é o caso que daria fonte muda", () => {
    expect(validarManifesto({ name: "Vazio" })).toBe("source.err.noImages");
  });

  it("recusa o que não é objeto e o que não tem nome", () => {
    expect(validarManifesto("https://x/manifesto.json")).toBe("source.err.notObject");
    expect(validarManifesto({ template: "https://x/{dex}.png" })).toBe("source.err.noName");
  });

  it("espécie fora do mapa e sem modelo devolve null, não uma URL quebrada", () => {
    const m: SpriteManifest = { name: "Meu", images: { pikachu: "https://y/pika.png" } };
    expect(manifestSpriteUrl({ id: "mew", dex: 151, spriteId: 151 }, m)).toBeNull();
  });
});

describe("endereço", () => {
  it("http numa página https é o erro que se confunde com servidor fora do ar", () => {
    expect(checarUrl("http://exemplo.com/a.json", true)).toBe("source.err.mixed");
    /* No app nativo não existe página, então a mesma URL passa. */
    expect(checarUrl("http://exemplo.com/a.json", false)).toBeNull();
  });

  it("localhost passa mesmo em página https — é onde se testa a própria fonte", () => {
    expect(checarUrl("http://localhost:8080/a.json", true)).toBeNull();
  });

  it("recusa esquema que não é http nem endereço inválido", () => {
    expect(checarUrl("ftp://exemplo.com/a.json", false)).toBe("source.err.scheme");
    expect(checarUrl("nao é url", false)).toBe("source.err.badUrl");
  });
});

describe("base do jogo", () => {
  const base = {
    cpm: [0.094],
    species: [{ id: "pikachu", name: "Pikachu", baseStats: { atk: 1, def: 1, hp: 1 }, types: [] }],
    fastMoves: [],
    chargedMoves: [],
    typeChart: {},
    typeOrder: Array.from({ length: 18 }, (_, i) => String(i)),
    settings: {},
    version: {},
  };

  it("aceita o formato mínimo — base própria não precisa trazer ranking", () => {
    expect(validarDataset(base)).toBeNull();
  });

  it("recusa JSON qualquer, que é o que daria número errado em silêncio", () => {
    expect(validarDataset({ hello: "world" })).toBe("source.err.missingField");
    expect(validarDataset("<html>")).toBe("source.err.text");
  });

  it("18 tipos, não 17: a tabela de vantagem é o que quebraria calada", () => {
    expect(validarDataset({ ...base, typeOrder: ["a"] })).toBe("source.err.badField");
  });

  it("espécie sem baseStats é recusada — é com ela que tudo é calculado", () => {
    expect(validarDataset({ ...base, species: [{ id: "x", name: "X", types: [] }] })).toBe(
      "source.err.badSpecies",
    );
  });
});

describe("partirUrl", () => {
  it("lê esquema e host sem `new URL` — o Hermes não parseia absoluto", () => {
    expect(partirUrl("https://www.nspx.dev/TrainerKit/dataset/gamedata.json")).toEqual({
      esquema: "https",
      host: "www.nspx.dev",
    });
  });

  it("porta, credencial e IPv6 não confundem o host", () => {
    expect(partirUrl("http://localhost:8080/a")?.host).toBe("localhost");
    expect(partirUrl("https://u:p@exemplo.com/a")?.host).toBe("exemplo.com");
    expect(partirUrl("http://[::1]:9/a")?.host).toBe("[::1]");
  });

  it("recusa o que não tem esquema ou não tem host", () => {
    expect(partirUrl("exemplo.com/a.json")).toBeNull();
    expect(partirUrl("https://")).toBeNull();
  });
});
