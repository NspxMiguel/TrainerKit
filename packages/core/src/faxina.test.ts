import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { planejarFaxina, type BichoFaxina, type EspecieFaxina } from "./faxina.js";
import type { BaseStats, IVs } from "./types.js";

/**
 * ⚠️ Estes testes protegem Pokémon, não código.
 *
 * A faxina é a única tela do app cujo erro é IRREVERSÍVEL do lado do jogo: uma
 * sugestão errada que a pessoa siga não tem desfazer, não tem suporte e não tem
 * backup. Então o que está travado aqui não é comportamento "esperado" no
 * sentido usual — é a lista do que o motor **nunca** pode fazer, e cada caso
 * abaixo custaria um Pokémon de verdade se regredisse.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");

interface Dataset {
  version: { levelCap: number };
  cpm: number[];
  species: Array<{ id: string; baseStats: BaseStats }>;
}

const data = JSON.parse(readFileSync(DATASET, "utf8")) as Dataset;
const CPM = data.cpm;
const CAP = data.version.levelCap;

function statsDe(id: string): BaseStats {
  const s = data.species.find((x) => x.id === id);
  if (!s) throw new Error(`especie ausente no dataset: ${id}`);
  return s.baseStats;
}

function especie(id: string, extra: Partial<EspecieFaxina> = {}): EspecieFaxina {
  return {
    id,
    baseStats: statsDe(id),
    evolvesInto: [],
    candyToEvolve: null,
    legendary: false,
    ...extra,
  };
}

let contador = 0;
function bicho(speciesId: string, ivs: IVs, extra: Partial<BichoFaxina> = {}): BichoFaxina {
  contador += 1;
  return {
    id: `b${String(contador).padStart(3, "0")}`,
    speciesId,
    ivs,
    level: 20,
    lucky: false,
    shadow: false,
    ivDesconhecido: false,
    ...extra,
  };
}

function planejar(bichos: BichoFaxina[], especies: EspecieFaxina[]) {
  return planejarFaxina({
    bichos,
    especies: new Map(especies.map((e) => [e.id, e])),
    cpm: CPM,
    levelCap: CAP,
  });
}

const PERFEITO: IVs = { atk: 15, def: 15, hp: 15 };
const LIXO: IVs = { atk: 0, def: 1, hp: 2 };

describe("planejarFaxina — o que ela nunca pode sugerir", () => {
  it("NUNCA sugere quem está sem IV informado", () => {
    /*
     * O caso mais caro do arquivo inteiro.
     *
     * Quem entrou pelo "eu tenho esse" tem `ivs` zerado porque o tipo exige três
     * números — não porque alguém mediu zero. Se o motor ler esses zeros, ele
     * produz uma lista PRÉ-MARCADA de transferência cheia de Pokémon que podem
     * ser 100%. É o único defeito aqui capaz de fazer alguém perder um shiny
     * seguindo o conselho do app.
     */
    const bons = [bicho("bulbasaur", PERFEITO), bicho("bulbasaur", { atk: 14, def: 14, hp: 14 })];
    const semIv = bicho("bulbasaur", { atk: 0, def: 0, hp: 0 }, { ivDesconhecido: true });

    const r = planejar([...bons, semIv], [especie("bulbasaur")]);

    expect(r.soltos.map((s) => s.id)).not.toContain(semIv.id);
    expect(r.guardados.find((g) => g.id === semIv.id)?.motivo.key).toBe("faxina.preso.semIv");
  });

  it("NUNCA sugere sortudo, sombroso ou lendário — nem como sugestão desmarcada", () => {
    const sortudo = bicho("rattata", LIXO, { lucky: true });
    const sombroso = bicho("rattata", LIXO, { shadow: true });
    const lendario = bicho("mewtwo", LIXO);

    const r = planejar(
      [sortudo, sombroso, lendario],
      [especie("rattata"), especie("mewtwo", { legendary: true })],
    );

    expect(r.soltos).toHaveLength(0);
    const motivo = (id: string) => r.guardados.find((g) => g.id === id)?.motivo.key;
    expect(motivo(sortudo.id)).toBe("faxina.preso.sortudo");
    expect(motivo(sombroso.id)).toBe("faxina.preso.sombroso");
    expect(motivo(lendario.id)).toBe("faxina.preso.lendario");
  });

  it("NUNCA sugere quem a pessoa disse que vai ficar", () => {
    /*
     * ⚠️ A unica marca do app que vem da PESSOA, e nao de uma conta.
     *
     * "e tem q ter um botão, discordo... vai q o cara gosta do pokemon q quer
     * colecionar? vai q ele ta num desafio e quer usa o pokemon pra fazer reid
     * e ponto final?"
     *
     * O veredito por baixo continua dizendo "transferir" — e e por isso que
     * este teste existe. Uma lista em lote que so lesse o veredito devolveria o
     * bicho PRE-MARCADO numa tela com outros vinte, e a pessoa perderia por
     * distracao exatamente o que ela tinha decidido guardar. E o unico lugar do
     * app em que ignorar esta marca custa um Pokemon.
     */
    const meu = bicho("rattata", LIXO, { meuMotivo: true });
    const outro = bicho("rattata", LIXO);
    const r = planejar([meu, outro], [especie("rattata")]);

    expect(r.soltos.map((s) => s.id)).not.toContain(meu.id);
    expect(r.guardados.find((g) => g.id === meu.id)?.motivo.key).toBe("faxina.preso.meuMotivo");
  });

  it("o motivo da PESSOA vence os motivos do jogo", () => {
    // Um sortudo que ela tambem marcou tem dois motivos validos pra ficar de
    // fora. O que a tela mostra e o dela: a razao de ele estar fora da lista e
    // a decisao dela, e nao uma propriedade do bicho.
    const b = bicho("dragonite", LIXO, { lucky: true, meuMotivo: true });
    const r = planejar([b], [especie("dragonite")]);
    expect(r.guardados[0]?.motivo.key).toBe("faxina.preso.meuMotivo");
  });

  it("NUNCA sugere espécie que o dataset não conhece", () => {
    // Base customizada, forma regional fora do índice, export antigo. Sem stats
    // base não há veredito nem stat product — e a saída honesta é a que não
    // custa um Pokémon.
    const orfao = bicho("especie_que_nao_existe", LIXO);
    const r = planejar([orfao], []);

    expect(r.soltos).toHaveLength(0);
    expect(r.guardados[0]?.motivo.key).toBe("faxina.preso.desconhecida");
  });

  it("NUNCA pré-marca quem não tem um irmão melhor pra provar que sobra", () => {
    /*
     * O último Rattata: melhor da espécie por falta de concorrência, e ainda
     * assim um Rattata. Ele APARECE — a mochila cheia é feita disto — mas na
     * classe que a tela não pré-marca.
     */
    const unico = bicho("rattata", LIXO);
    const r = planejar([unico], [especie("rattata")]);

    expect(r.soltos).toHaveLength(1);
    expect(r.soltos[0]?.classe).toBe("voceDecide");
    expect(r.soltos[0]?.motivo.key).toBe("faxina.solto.melhorRuim");
  });

  it("um sortudo perfeito não rouba as coroas dos irmãos normais", () => {
    /*
     * ⚠️ Efeito colateral que só aparece com os dois grupos juntos.
     *
     * O sortudo é intocável, então ele sai da disputa ANTES de coroar ninguém.
     * Se ficasse, um 15/15/15 seguraria as quatro coroas sozinho — e os irmãos
     * normais, que são justamente os que a pessoa usaria, cairiam TODOS em
     * "sem dúvida". A pessoa perderia o melhor Dragonite utilizável dela porque
     * tem um sortudo que ela nunca vai gastar poeira pra subir.
     */
    const sortudo = bicho("dragonite", PERFEITO, { lucky: true });
    const bom = bicho("dragonite", { atk: 15, def: 14, hp: 13 });
    const fraco = bicho("dragonite", { atk: 2, def: 3, hp: 1 });

    const r = planejar([sortudo, bom, fraco], [especie("dragonite")]);

    expect(r.soltos.map((s) => s.id)).toEqual([fraco.id]);
    expect(r.guardados.map((g) => g.id).sort()).toEqual([bom.id, sortudo.id].sort());
  });
});

describe("planejarFaxina — as quatro coroas", () => {
  it("guarda o melhor de Great mesmo quando ele é o de menor IV", () => {
    /*
     * A razão de as coroas existirem, em um caso só.
     *
     * Em Great o 100% costuma ser PIOR: ataque alto infla o PC e obriga a parar
     * num nível mais baixo, perdendo defesa e PS. Um motor que guardasse "o de
     * maior IV" transferiria com toda a confiança do mundo o melhor Azumarill
     * de liga da pessoa — que é o Pokémon mais caro de repor da coleção dela,
     * porque depende de sorteio.
     */
    const cemPorCento = bicho("azumarill", PERFEITO);
    const deGreat = bicho("azumarill", { atk: 0, def: 15, hp: 15 });

    const r = planejar([cemPorCento, deGreat], [especie("azumarill")]);

    const guardado = r.guardados.find((g) => g.id === deGreat.id);
    expect(guardado).toBeDefined();
    expect(guardado?.coroas).toContain("great");
    expect(r.soltos.map((s) => s.id)).not.toContain(deGreat.id);
  });

  it("o melhor de raide não é o melhor de liga, e os dois ficam", () => {
    // Ataque 15 com bulk baixo é o atacante; o inverso é o de liga. Guardar só
    // um dos dois é escolher qual metade do jogo a pessoa para de jogar.
    const atacante = bicho("machamp", { atk: 15, def: 3, hp: 4 });
    const tanque = bicho("machamp", { atk: 1, def: 15, hp: 15 });
    const nadaDemais = bicho("machamp", { atk: 6, def: 7, hp: 6 });

    const r = planejar([atacante, tanque, nadaDemais], [especie("machamp")]);

    expect(r.guardados.find((g) => g.id === atacante.id)?.coroas).toContain("raide");
    expect(r.guardados.map((g) => g.id)).toContain(tanque.id);
    expect(r.soltos.map((s) => s.id)).toEqual([nadaDemais.id]);
  });

  it("compara por IV, não pelo nível de hoje", () => {
    /*
     * Nível se compra com poeira; IV não se compra com nada.
     *
     * Comparar pelo estado atual mandaria transferir o de IV melhor só porque o
     * irmão pior já recebeu investimento — e o investimento é justamente a parte
     * recuperável.
     */
    const melhorIvNivelBaixo = bicho("machamp", { atk: 15, def: 14, hp: 15 }, { level: 8 });
    const piorIvNivelAlto = bicho("machamp", { atk: 4, def: 5, hp: 3 }, { level: 40 });

    const r = planejar([melhorIvNivelBaixo, piorIvNivelAlto], [especie("machamp")]);

    expect(r.soltos.map((s) => s.id)).toEqual([piorIvNivelAlto.id]);
  });

  it("o duplicado aponta pra quem fica, e aponta pro que segura mais coroas", () => {
    const rei = bicho("machamp", PERFEITO);
    const sobra = bicho("machamp", { atk: 3, def: 2, hp: 4 });

    const r = planejar([rei, sobra], [especie("machamp")]);

    expect(r.soltos[0]?.perdePara).toBe(rei.id);
    expect(r.soltos[0]?.motivo.params?.n).toBe(2);
  });
});

describe("planejarFaxina — invariantes", () => {
  it("todo Pokémon sai em exatamente uma das duas listas", () => {
    /*
     * A partição total é o que deixa a tela dizer "não vou sugerir estes 12" com
     * um número que fecha. Sem ela, um Pokémon podia sumir das duas listas — e
     * o sintoma seria a soma não bater com a coleção, que é exatamente o tipo de
     * coisa que ninguém confere numa lista de 300.
     */
    const bichos = [
      bicho("bulbasaur", PERFEITO),
      bicho("bulbasaur", LIXO),
      bicho("bulbasaur", { atk: 7, def: 8, hp: 9 }, { lucky: true }),
      bicho("rattata", LIXO),
      bicho("mewtwo", PERFEITO),
      bicho("machamp", { atk: 0, def: 0, hp: 0 }, { ivDesconhecido: true }),
      bicho("fantasma_inexistente", PERFEITO),
    ];
    const r = planejar(bichos, [
      especie("bulbasaur"),
      especie("rattata"),
      especie("mewtwo", { legendary: true }),
      especie("machamp"),
    ]);

    const ids = [...r.soltos.map((s) => s.id), ...r.guardados.map((g) => g.id)];
    expect(ids.sort()).toEqual(bichos.map((b) => b.id).sort());
    expect(new Set(ids).size).toBe(bichos.length);
  });

  it("a mesma coleção em outra ordem dá a mesma resposta", () => {
    /*
     * A coleção chega ordenada por data e reordena a cada escaneamento. Sem
     * desempate estável, dois irmãos com o mesmo stat product trocariam de coroa
     * entre duas aberturas da tela — e o que ontem estava guardado apareceria
     * hoje pré-marcado pra transferência.
     */
    const bichos = [
      bicho("pidgey", { atk: 10, def: 10, hp: 10 }),
      bicho("pidgey", { atk: 10, def: 10, hp: 10 }),
      bicho("pidgey", { atk: 10, def: 10, hp: 10 }),
      bicho("pidgey", { atk: 12, def: 4, hp: 4 }),
    ];
    const especies = [especie("pidgey")];

    const direto = planejar(bichos, especies);
    const invertido = planejar([...bichos].reverse(), especies);

    expect(invertido.soltos.map((s) => s.id).sort()).toEqual(
      direto.soltos.map((s) => s.id).sort(),
    );
    expect(invertido.soltos.map((s) => s.perdePara).sort()).toEqual(
      direto.soltos.map((s) => s.perdePara).sort(),
    );
  });

  it("coleção vazia não inventa nada", () => {
    const r = planejar([], []);
    expect(r.soltos).toHaveLength(0);
    expect(r.guardados).toHaveLength(0);
  });

  it("dá conta de uma mochila de 600 sem travar", () => {
    // A tela existe pra quem tem a mochila cheia. Se ela só funciona com
    // coleção pequena, ela não existe pra quem precisa dela.
    const especies = ["pidgey", "rattata", "machamp", "azumarill", "dragonite"];
    const bichos = Array.from({ length: 600 }, (_, i) =>
      bicho(especies[i % especies.length]!, {
        atk: i % 16,
        def: (i * 7) % 16,
        hp: (i * 11) % 16,
      }),
    );

    const t0 = performance.now();
    const r = planejar(
      bichos,
      especies.map((e) => especie(e)),
    );
    const ms = performance.now() - t0;

    expect(r.soltos.length + r.guardados.length).toBe(600);
    expect(ms).toBeLessThan(2000);
  });
});
