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
 * Busca linear de cima para baixo: sao no maximo 109 passos e o resultado
 * precisa ser o maior nivel VALIDO, nao uma aproximacao — meio nivel a mais
 * estoura o limite e o Pokemon nem entra na liga.
 */
export function maxLevelForCap(
  cpm: CpmTable,
  base: BaseStats,
  ivs: IVs,
  cpCap: number | null,
  levelCap: number = MAX_LEVEL,
): number | null {
  if (cpCap === null) return levelCap;

  for (let level = levelCap; level >= MIN_LEVEL; level -= 0.5) {
    if (computeCP(base, ivs, cpmForLevel(cpm, level)) <= cpCap) return level;
  }
  // Nem no nivel 1 cabe: especie forte demais para a liga.
  return null;
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
 * Posicao de um IV especifico, sem materializar o ranking inteiro para quem so
 * quer saber do proprio Pokemon.
 */
export function rankOf(
  cpm: CpmTable,
  base: BaseStats,
  ivs: IVs,
  league: League,
  options: { floorIV?: number; levelCap?: number } = {},
): RankedSpread | null {
  const all = rankIVSpreads(cpm, base, league, options);
  return (
    all.find(
      (s) => s.ivs.atk === ivs.atk && s.ivs.def === ivs.def && s.ivs.hp === ivs.hp,
    ) ?? null
  );
}
