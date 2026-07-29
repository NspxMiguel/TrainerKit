import { computeCP, cpmForLevel, statProduct, type CpmTable } from "./cp.js";
import type { BaseStats, IVs } from "./types.js";
import { MAX_IV, MAX_LEVEL, MIN_IV, MIN_LEVEL } from "./types.js";

/**
 * Ranking de IV para PvP.
 *
 * Em PvP o que manda nao e o PC, e o **stat product**: ataque x defesa x PS,
 * com o Pokemon subido ate o teto de PC da liga. Isso inverte a intuicao — o
 * 100% costuma ser PIOR que um IV baixo de ataque, porque ataque alto infla o
 * PC e obriga a parar num nivel mais baixo, perdendo defesa e PS.
 *
 * Por isso o app precisa ranquear, e nao so mostrar a porcentagem: um Azumarill
 * 0/15/15 e um dos melhores da Great League, e qualquer app que so mostra "36%"
 * esta escondendo isso do jogador.
 */

export interface League {
  id: string;
  name: string;
  /** Teto de PC. `null` na Master, que nao tem. */
  cpCap: number | null;
}

export const GREAT_LEAGUE: League = { id: "great", name: "Great League", cpCap: 1500 };
export const ULTRA_LEAGUE: League = { id: "ultra", name: "Ultra League", cpCap: 2500 };
export const MASTER_LEAGUE: League = { id: "master", name: "Master League", cpCap: null };
export const LITTLE_CUP: League = { id: "little", name: "Little Cup", cpCap: 500 };

export const LEAGUES = [GREAT_LEAGUE, ULTRA_LEAGUE, MASTER_LEAGUE] as const;

export interface IVSpread {
  ivs: IVs;
  /** Maior nivel possivel sem estourar o teto da liga. */
  level: number;
  cp: number;
  statProduct: number;
}

export interface RankedSpread extends IVSpread {
  /** 1 = melhor combinacao possivel para a liga. */
  rank: number;
  /** Stat product como fracao do melhor possivel. 1 = o melhor de todos. */
  percent: number;
}

/**
 * Maior nivel em que a especie cabe no teto de PC.
 *
 * Busca BINARIA, nao linear. O PC cresce junto com o nivel — `cpmForLevel` e
 * estritamente crescente e a formula de PC e monotona nele —, entao o conjunto
 * de niveis validos e um prefixo e da para cortar pela metade a cada passo:
 * 109 niveis viram 7 comparacoes em vez de ate 109.
 *
 * Isso importa porque esta funcao roda 4.096 vezes por liga em cada ranking, e
 * o ranking roda uma vez por Pokemon da colecao. A versao linear custava ~8ms
 * por Pokemon; numa colecao de cem, a tela travava quase um segundo.
 *
 * O resultado continua sendo o maior nivel VALIDO, nao uma aproximacao — meio
 * nivel a mais estoura o limite e o Pokemon nem entra na liga.
 */
export function maxLevelForCap(
  cpm: CpmTable,
  base: BaseStats,
  ivs: IVs,
  cpCap: number | null,
  levelCap: number = MAX_LEVEL,
): number | null {
  if (cpCap === null) return levelCap;

  // Indice i <-> nivel MIN_LEVEL + i * 0.5. Passos de 0.5 sao exatos em ponto
  // flutuante binario, entao a conversao nao acumula erro.
  const levelAt = (i: number): number => MIN_LEVEL + i * 0.5;
  const fits = (i: number): boolean =>
    computeCP(base, ivs, cpmForLevel(cpm, levelAt(i))) <= cpCap;

  if (!fits(0)) return null; // Nem no nivel 1 cabe: forte demais para a liga.

  let low = 0;
  let high = Math.round((levelCap - MIN_LEVEL) / 0.5);
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid - 1;
  }
  return levelAt(low);
}

/**
 * Todas as 4096 combinacoes de IV ranqueadas para uma liga.
 *
 * Forca bruta mesmo: 16^3 combinacoes x ~109 niveis e trabalho de
 * milissegundos, e qualquer atalho aqui viraria erro sutil de ordenacao.
 *
 * `floorIV` existe porque o jogo garante piso em algumas origens — Pokemon de
 * raide, ovo e pesquisa nunca vem abaixo de 10, e lendario capturado nao vem
 * abaixo de 1. Ranquear contra combinacoes impossiveis daria uma posicao
 * enganosa.
 */
export function rankIVSpreads(
  cpm: CpmTable,
  base: BaseStats,
  league: League,
  options: { floorIV?: number; levelCap?: number } = {},
): RankedSpread[] {
  const floor = Math.max(MIN_IV, options.floorIV ?? MIN_IV);
  const levelCap = options.levelCap ?? MAX_LEVEL;

  const spreads: IVSpread[] = [];

  for (let atk = floor; atk <= MAX_IV; atk++) {
    for (let def = floor; def <= MAX_IV; def++) {
      for (let hp = floor; hp <= MAX_IV; hp++) {
        const ivs: IVs = { atk, def, hp };
        const level = maxLevelForCap(cpm, base, ivs, league.cpCap, levelCap);
        if (level === null) continue;

        const multiplier = cpmForLevel(cpm, level);
        spreads.push({
          ivs,
          level,
          cp: computeCP(base, ivs, multiplier),
          statProduct: statProduct(base, ivs, multiplier),
        });
      }
    }
  }

  spreads.sort((a, b) => b.statProduct - a.statProduct);

  const best = spreads[0]?.statProduct ?? 0;
  return spreads.map((s, i) => ({
    ...s,
    rank: i + 1,
    percent: best > 0 ? s.statProduct / best : 0,
  }));
}

/**
 * Tabela compacta de stat product, para responder posicao sem materializar
 * 4.096 objetos.
 *
 * `products` e indexada por `ivIndex` e guarda 0 onde a combinacao nao entra na
 * liga (nem no nivel 1 cabe) ou esta abaixo do piso de IV. Um `Float64Array` de
 * 4.096 posicoes sao 32 KB — cabe em cache com folga, ao contrario do array de
 * objetos, que passa de 800 KB por especie e liga.
 */
interface ProductTable {
  products: Float64Array;
  best: number;
}

const ivIndex = (ivs: IVs): number => (ivs.atk * 16 + ivs.def) * 16 + ivs.hp;

/**
 * Cache dos rankings ja calculados.
 *
 * A colecao repete especie o tempo todo — cinco Azumarill sao um calculo, nao
 * cinco — e cada re-render do React pediria tudo de novo. O limite existe para
 * o cache nao virar vazamento numa sessao longa; ao estourar, esvazia inteiro,
 * que e simples e bom o bastante para um mapa de algumas dezenas de entradas.
 */
const PRODUCT_CACHE = new Map<string, ProductTable>();
const PRODUCT_CACHE_LIMIT = 64;

function productTable(
  cpm: CpmTable,
  base: BaseStats,
  league: League,
  options: { floorIV?: number; levelCap?: number },
): ProductTable {
  const floor = Math.max(MIN_IV, options.floorIV ?? MIN_IV);
  const levelCap = options.levelCap ?? MAX_LEVEL;
  const key = `${base.atk}/${base.def}/${base.hp}|${league.id}|${floor}|${levelCap}`;

  const cached = PRODUCT_CACHE.get(key);
  if (cached) return cached;

  const products = new Float64Array(16 * 16 * 16);
  let best = 0;

  for (let atk = floor; atk <= MAX_IV; atk++) {
    for (let def = floor; def <= MAX_IV; def++) {
      for (let hp = floor; hp <= MAX_IV; hp++) {
        const ivs: IVs = { atk, def, hp };
        const level = maxLevelForCap(cpm, base, ivs, league.cpCap, levelCap);
        if (level === null) continue;

        const product = statProduct(base, ivs, cpmForLevel(cpm, level));
        products[ivIndex(ivs)] = product;
        if (product > best) best = product;
      }
    }
  }

  if (PRODUCT_CACHE.size >= PRODUCT_CACHE_LIMIT) PRODUCT_CACHE.clear();
  const table = { products, best };
  PRODUCT_CACHE.set(key, table);
  return table;
}

/**
 * Posicao de um IV especifico, sem materializar o ranking inteiro para quem so
 * quer saber do proprio Pokemon.
 *
 * A posicao e "quantos sao estritamente melhores, mais um" — empate divide a
 * mesma posicao, que e o que a palavra significa. A versao anterior ordenava o
 * array e lia o indice, o que dava posicoes diferentes para stat products
 * iguais dependendo da ordem em que a ordenacao os deixou.
 */
export function rankOf(
  cpm: CpmTable,
  base: BaseStats,
  ivs: IVs,
  league: League,
  options: { floorIV?: number; levelCap?: number } = {},
): RankedSpread | null {
  const { products, best } = productTable(cpm, base, league, options);
  const mine = products[ivIndex(ivs)] ?? 0;
  if (mine <= 0) return null;

  let better = 0;
  for (const product of products) {
    if (product > mine) better++;
  }

  const level = maxLevelForCap(cpm, base, ivs, league.cpCap, options.levelCap ?? MAX_LEVEL);
  if (level === null) return null;

  return {
    ivs,
    level,
    cp: computeCP(base, ivs, cpmForLevel(cpm, level)),
    statProduct: mine,
    rank: better + 1,
    percent: best > 0 ? mine / best : 0,
  };
}
