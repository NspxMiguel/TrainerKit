import { computeCPAtLevel } from "./cp.js";
import { ATK_ALTO, DEF_ALTO, HP_ALTO } from "./limiares.js";
import type { CpmTable } from "./cp.js";
import type { BaseStats } from "./types.js";

/**
 * A locucao da Especies.
 *
 * A referencia e a Especies da serie: apontar pro especie, ou mandar um print.
 * La o aparelho identifica e ANUNCIA —
 * nome, classificacao, e um fato — numa voz plana de maquina.
 *
 * ⚠️ DECISAO IMPORTANTE, e ela e de projeto e nao de gosto: o texto da Especies
 * do JOGO nao entra aqui. Aquelas descricoes ("Machamp tem quatro bracos que se
 * movem tao rapido...") sao obra criativa da especie Company. Stats e formulas
 * dao pra defender como fato; um paragrafo escrito por um roteirista, nao — e o
 * projeto inteiro foi desenhado pra ficar do lado defensavel dessa linha.
 *
 * Entao a locucao e ESCRITA PELO APP, a partir do que o app calculou. Isso saiu
 * melhor do que copiar, e nao por sorte: "entre os atacantes de Fogo, é o
 * terceiro melhor para raides" e informacao que muda a decisao de quem joga
 * hoje. A descricao original e bonita e nao serve pra nada.
 *
 * Este modulo devolve as PARTES em dados, nunca frases prontas: quem monta a
 * frase e a camada de idioma, porque o app fala dez.
 *
 * ── O que a pesquisa achou, e a UNICA coisa que falta ────────────────────────
 *
 * "PESQUISA COMO A POKEDEX FUNCIONA NOS JOGOS, FILMES E SERIES PRA TU VER."
 * Pesquisado (julho/2026). O resultado, e o que ele muda aqui:
 *
 *  · Nos JOGOS a ficha e categoria + altura + peso + grito + o texto. Altura e
 *    peso ja entram (`DexMode` monta com `heightDm`/`weightHg`); o texto e a
 *    obra escrita que este arquivo decidiu nao copiar.
 *  · Na SERIE o aparelho abre SEMPRE pela categoria: "Bulbasaur, a especie
 *    Semente." E a assinatura da locucao — a frase que qualquer pessoa reconhece
 *    de ouvido. Depois vem o resto, na ordem que a `locucao` do `DexMode` ja usa.
 *  · O ROTOM Dex conversa e tem personalidade propria. Isso o app ja faz, e pela
 *    bolinha da IA.
 *
 * ⚠️ A CATEGORIA ENTROU, como decisao de quem assume o risco de usar texto do
 * jogo — mesma linha da build pessoal com sprites oficiais.
 *
 * Ela nao passa por este modulo: a categoria e TEXTO, e este arquivo continua
 * devolvendo so o que o app CALCULOU. Ela e montada onde as frases sao montadas
 * (`DexMode`), a partir de `categoryNames` do dataset.
 *
 * Duas coisas valem ficar escritas, porque as duas eram armadilha:
 *
 *  · A fonte NAO e a PokeAPI. O `pokemon_species_names.csv` de la parecia o
 *    caminho obvio — ja e fonte declarada do app — e nao tem portugues nem
 *    russo. A categoria sairia em ingles no meio de uma frase em portugues,
 *    justamente pro dono do app. Os textos do proprio jogo tem
 *    `pokemon_category_0001` nos dez idiomas.
 *  · O compromisso deste arquivo continua de pe pra build publicavel, e ele e
 *    um INTERRUPTOR de verdade: `INCLUIR_CATEGORIA` no ETL tira o texto do
 *    ARQUIVO, nao da tela. Sem o campo, a locucao volta sozinha ao que era.
 */

export interface DexEntryInput {
  name: string;
  dex: number;
  types: readonly string[];
  baseStats: BaseStats;
  cpm: CpmTable;
  levelCap: number;
  /** Quantos evoluem a partir dele. Zero = fim da linha. */
  evolvesInto: readonly string[];
  /**
   * Posicao no ranking de atacantes de raide do tipo primario, quando ele
   * aparece la. `null` quando nao entra na lista — e a maioria, e a locucao
   * simplesmente nao fala disso em vez de inventar um elogio.
   */
  raidRank?: { type: string; position: number } | null;
  /** Melhor posicao entre as tres ligas, pelo produto de atributos. */
  leagueRank?: { league: "great" | "ultra" | "master"; position: number } | null;
}

/**
 * Como o bicho se comporta, em uma palavra.
 *
 * Os limiares moram em `limiares.ts`, importados — nao copiados. A copia ja
 * divergiu uma vez e produziu exatamente a contradicao que o comentario antigo
 * dizia estar evitando.
 */
const HIGH_ATK = ATK_ALTO;
const HIGH_DEF = DEF_ALTO;
const HIGH_HP = HP_ALTO;

export type DexBuild = "glassCannon" | "wall" | "balanced" | "frail" | "monster";

export interface DexEntry {
  name: string;
  /** Numero com tres digitos, do jeito que a Especies fala. */
  dexNumber: string;
  types: readonly string[];
  baseStats: BaseStats;
  build: DexBuild;
  /** PC maximo no teto de nivel atual, com IV perfeito. */
  maxCP: number;
  /** Ainda evolui? Muda o conselho, e a serie sempre menciona. */
  evolves: boolean;
  raidRank: { type: string; position: number } | null;
  leagueRank: { league: "great" | "ultra" | "master"; position: number } | null;
}

export function buildDexEntry(input: DexEntryInput): DexEntry {
  const { atk, def, hp } = input.baseStats;
  const bulk = def + hp;

  const build: DexBuild =
    atk >= HIGH_ATK && bulk >= HIGH_DEF + HIGH_HP
      ? "monster"
      : atk >= HIGH_ATK && bulk < HIGH_DEF + HIGH_HP * 0.8
        ? "glassCannon"
        : bulk >= HIGH_DEF + HIGH_HP && atk < HIGH_ATK * 0.8
          ? "wall"
          : atk < HIGH_ATK * 0.6 && bulk < (HIGH_DEF + HIGH_HP) * 0.6
            ? "frail"
            : "balanced";

  return {
    name: input.name,
    dexNumber: String(input.dex).padStart(3, "0"),
    types: input.types,
    baseStats: input.baseStats,
    build,
    maxCP: computeCPAtLevel(
      input.cpm,
      input.baseStats,
      { atk: 15, def: 15, hp: 15 },
      input.levelCap,
    ),
    evolves: input.evolvesInto.length > 0,
    raidRank: input.raidRank ?? null,
    leagueRank: input.leagueRank ?? null,
  };
}
