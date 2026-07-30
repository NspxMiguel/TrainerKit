import { computeCPAtLevel } from "./cp.js";
import type { CpmTable } from "./cp.js";
import type { BaseStats } from "./types.js";

/**
 * A locucao da Pokedex.
 *
 * A ideia e do Miguel: "PODERIA FUNCIONAR IGUAL UMA POKEDEX DA SERIE, VC APONTA
 * PRO POKEMON, MANDA PRINT E ETC". Na serie o aparelho identifica e ANUNCIA —
 * nome, classificacao, e um fato — numa voz plana de maquina.
 *
 * ⚠️ DECISAO IMPORTANTE, e ela e de projeto e nao de gosto: o texto da Pokedex
 * do JOGO nao entra aqui. Aquelas descricoes ("Machamp tem quatro bracos que se
 * movem tao rapido...") sao obra criativa da Pokemon Company. Stats e formulas
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
 * Mesmos limiares do `assistant.ts` de propósito: dois modulos que descrevem o
 * mesmo Pokemon com criterios diferentes acabam se contradizendo na tela, e o
 * app ja passou por isso uma vez (o Eternatus dizia que batia forte e caia
 * rapido em linhas seguidas).
 */
const HIGH_ATK = 240;
const HIGH_DEF = 220;
const HIGH_HP = 200;

export type DexBuild = "glassCannon" | "wall" | "balanced" | "frail" | "monster";

export interface DexEntry {
  name: string;
  /** Numero com tres digitos, do jeito que a Pokedex fala. */
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
