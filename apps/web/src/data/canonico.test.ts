import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { canonico, type DatasetSpecies } from "./useDataset.ts";

/**
 * Forma cosmética é a MESMA espécie, e comparar id cru não sabe disso.
 *
 * ⚠️ O DEFEITO QUE ISTO FECHA, e ele já tinha sido "consertado" uma vez.
 *
 * "ele duplico e tem 2 venusaur agr". Naquela vez o conserto foi a ficha
 * procurar o Pokémon salvo POR ESPÉCIE quando não recebia o registro pronto.
 * Só que a comparação era `owned.speciesId === species.id`, de id cru — e o
 * GAME_MASTER escreve a mesma espécie de dois jeitos: a coleção guarda
 * `venusaur_normal` (que foi o que o scanner gravou) e a Pokédex navega
 * `venusaur` (a lista só mostra formas canônicas).
 *
 * Resultado: abrir Venusaur pela Pokédex mostrava a ficha como se ele não
 * tivesse nenhum — sem veredito, sem "Ver o IV do meu", e oferecendo "Eu tenho
 * esse", que criaria o segundo Venusaur outra vez. O conserto anterior só
 * funcionava quando as duas escritas coincidiam.
 *
 * Os mesmos ids apareciam em mais dois lugares: o contador de VISTOS da
 * Pokédex (dizia 9 para oito espécies) e o dossiê que alimenta a IA (saía sem
 * a linha "o jogador tem 1", e aí o modelo afirma que ele não tem).
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "public", "dataset", "gamedata.json");
const data = JSON.parse(readFileSync(DATASET, "utf8")) as { species: DatasetSpecies[] };

const canon = canonico(data.species);

describe("canonico", () => {
  it("colapsa a forma cosmética na espécie de verdade", () => {
    // O `_normal` é o caso que mordeu: existe no dataset, é o que o scanner
    // grava, e tem stats idênticos ao canônico.
    expect(canon("venusaur_normal")).toBe("venusaur");
    expect(canon("ivysaur_normal")).toBe("ivysaur");
  });

  it("deixa a forma canônica em paz", () => {
    for (const id of ["venusaur", "machamp", "snorlax", "hoopa", "mewtwo"]) {
      expect(canon(id), id).toBe(id);
    }
  });

  /*
   * ⚠️ Alola, Galar e Hisui NÃO podem colapsar: têm stats e tipos próprios, e
   * juntá-las com a original faria o app decidir sobre o Pokémon errado. O ETL
   * separa por DADO (mesma dex + mesmos stats + mesmos tipos = cosmética), não
   * por lista de sufixos — este teste é quem garante que a régua não afrouxou.
   */
  it("NÃO colapsa forma regional, que é outro Pokémon", () => {
    for (const id of ["rattata_alola", "vulpix_alola", "ninetales_alola"]) {
      const existe = data.species.some((s) => s.id === id);
      if (!existe) continue;
      expect(canon(id), id).toBe(id);
    }
  });

  it("id desconhecido volta como veio, sem quebrar", () => {
    // Backup antigo, dataset de terceiro, espécie removida do jogo: nenhum
    // desses pode derrubar uma tela por causa de um contador.
    expect(canon("bicho_que_nao_existe")).toBe("bicho_que_nao_existe");
  });

  it("é idempotente — canonizar duas vezes dá o mesmo", () => {
    for (const s of data.species) {
      expect(canon(canon(s.id)), s.id).toBe(canon(s.id));
    }
  });

  /*
   * O alvo de um `cosmeticOf` tem que ser uma espécie que EXISTE e que não é
   * ela mesma cosmética — senão o colapso vira uma corrente e o idempotente
   * acima passaria a mentir.
   */
  it("toda forma cosmética aponta pra uma espécie real", () => {
    const porId = new Map(data.species.map((s) => [s.id, s]));
    for (const s of data.species) {
      if (s.cosmeticOf === null) continue;
      const alvo = porId.get(s.cosmeticOf);
      expect(alvo, `${s.id} → ${s.cosmeticOf} não existe`).toBeDefined();
      expect(alvo!.cosmeticOf, `${s.id} aponta pra outra cosmética`).toBeNull();
    }
  });
});
