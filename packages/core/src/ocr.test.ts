import { describe, expect, it } from "vitest";

import { componentesConectados, lerPc, lerPs, linhasDeTexto } from "./ocr.js";

/**
 * A peneira de DEPOIS do OCR.
 *
 * ⚠️ Ela e a unica garantia de que so entra digito, e isso e uma decisao, nao um
 * descuido: com o motor LSTM o `tessedit_char_whitelist` do tesseract tem bugs
 * abertos no upstream que chegam a apagar a palavra inteira. Restringir na
 * entrada e frágil; conferir na saida nao é.
 */
describe("peneira do PC", () => {
  it("aceita um PC plausivel", () => {
    expect(lerPc("1416")).toBe(1416);
    expect(lerPc(" 3566 \n")).toBe(3566);
  });

  it("corrige as trocas classicas de digito", () => {
    // O tesseract troca zero por O e um por l/I com frequencia; sao as duas
    // confusoes que aparecem em qualquer fonte sem serifa.
    expect(lerPc("14O6")).toBe(1406);
    expect(lerPc("l416")).toBe(1416);
  });

  it("recusa o que nao pode ser PC", () => {
    // "PC" sozinho: o recorte pegou so o prefixo e perdeu os digitos. Aconteceu
    // de verdade em dois prints de mockup.
    expect(lerPc("PC")).toBeNull();
    expect(lerPc("")).toBeNull();
    // Abaixo de 10 nao existe: nem um Magikarp nivel 1 chega la.
    expect(lerPc("7")).toBeNull();
    // Acima do teto do jogo, e com digito a mais que qualquer PC real.
    expect(lerPc("123456")).toBeNull();
    expect(lerPc("9999")).toBeNull();
  });
});

describe("peneira do PS", () => {
  it("le o par atual/maximo", () => {
    expect(lerPs("138 / 138 PS")).toEqual({ atual: 138, max: 138 });
    // Sem espaco em volta da barra — sai assim nos prints menores.
    expect(lerPs("96/96 PS")).toEqual({ atual: 96, max: 96 });
  });

  it("le a especie desmaiado", () => {
    // "0 / 172 PS": o atual pode ser zero, e e justamente quem acabou de sair de
    // uma raide que a pessoa vai escanear.
    expect(lerPs("0 / 172 PS")).toEqual({ atual: 0, max: 172 });
  });

  it("ignora o sufixo, seja qual for o idioma", () => {
    // PS, HP, KP, PV — o sufixo nunca e recortado fora, e nao precisa ser.
    expect(lerPs("150 / 150 HP")?.max).toBe(150);
    expect(lerPs("150 / 150 KP")?.max).toBe(150);
    // "PS" lido como "P5" nao atrapalha: a expressao para no primeiro par.
    expect(lerPs("161/161 P5")?.max).toBe(161);
  });

  it("recusa quando a barra se perdeu", () => {
    // Casos reais: "07172P5" e "2717 271P5". Sem a barra nao da pra saber onde
    // acaba o atual e comeca o maximo — e inventar seria pior que recusar.
    expect(lerPs("07172P5")).toBeNull();
    expect(lerPs("2717 271P5")).toBeNull();
  });

  it("recusa o par impossivel", () => {
    // O PS atual nunca passa do maximo. E a regra que pega a troca de digito
    // mais comum sem precisar saber qual dos dois numeros errou.
    expect(lerPs("200 / 138 PS")).toBeNull();
    expect(lerPs("3 / 4 PS")).toBeNull();
  });
});

describe("componentes e linhas", () => {
  /** Desenha um retangulo cheio numa mascara, pra montar cenario de teste. */
  function bloco(m: Uint8Array, larg: number, x: number, y: number, w: number, h: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) m[(y + j) * larg + (x + i)] = 1;
  }

  it("separa blocos vizinhos que nao se tocam", () => {
    const larg = 40;
    const alt = 20;
    const m = new Uint8Array(larg * alt);
    bloco(m, larg, 2, 4, 6, 10);
    bloco(m, larg, 12, 4, 6, 10);
    const comps = componentesConectados(m, larg, alt, 4);
    expect(comps).toHaveLength(2);
    expect(comps.every((c) => c.alt === 10 && c.larg === 6)).toBe(true);
  });

  it("descarta o que e menor que o minimo", () => {
    const larg = 20;
    const alt = 20;
    const m = new Uint8Array(larg * alt);
    bloco(m, larg, 2, 2, 5, 5);
    bloco(m, larg, 12, 2, 1, 2); // ruido
    expect(componentesConectados(m, larg, alt, 10)).toHaveLength(1);
  });

  it("um componente alto NAO engole a linha inteira", () => {
    /*
     * ⚠️ E a regressao que este teste existe pra travar, e ela custou 20 dos 26
     * prints.
     *
     * A primeira versao agrupava pela caixa ACUMULADA da linha. Bastava um
     * componente alto no recorte — a silhueta do treinador no canto do cartao,
     * a borda — pra a caixa passar a cobrir a regiao inteira, e dali em diante
     * o centro de qualquer componente caia dentro dela. O resultado era uma
     * unica "linha" com o cartao todo dentro, e nenhuma utilizavel.
     *
     * Medindo entre CENTROS, com tolerancia derivada da altura do glifo, o
     * componente alto continua sendo um item da linha dele.
     */
    const larg = 60;
    const alt = 60;
    const m = new Uint8Array(larg * alt);
    bloco(m, larg, 2, 2, 6, 50); // a barra alta
    bloco(m, larg, 20, 4, 5, 6); // texto de cima
    bloco(m, larg, 30, 4, 5, 6);
    bloco(m, larg, 20, 40, 5, 6); // texto de baixo
    bloco(m, larg, 30, 40, 5, 6);

    const linhas = linhasDeTexto(componentesConectados(m, larg, alt, 8));
    // Tres linhas: a de cima, a barra alta (centro no meio) e a de baixo.
    expect(linhas.length).toBeGreaterThanOrEqual(3);
    const deCima = linhas.find((l) => l.itens.every((i) => i.y0 === 4));
    expect(deCima?.itens).toHaveLength(2);
    const deBaixo = linhas.find((l) => l.itens.every((i) => i.y0 === 40));
    expect(deBaixo?.itens).toHaveLength(2);
  });

  it("ordena os glifos da esquerda pra direita", () => {
    const larg = 60;
    const alt = 20;
    const m = new Uint8Array(larg * alt);
    bloco(m, larg, 40, 4, 5, 8);
    bloco(m, larg, 10, 4, 5, 8);
    bloco(m, larg, 25, 4, 5, 8);
    const [linha] = linhasDeTexto(componentesConectados(m, larg, alt, 8));
    expect(linha?.itens.map((i) => i.x0)).toEqual([10, 25, 40]);
  });
});
