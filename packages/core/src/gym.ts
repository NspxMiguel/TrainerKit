import { cpmForLevel, effectiveDefense, effectiveStamina, type CpmTable } from "./cp.js";
import { effectiveness } from "./types-chart.js";
import type { TypeChart, TypeOrder } from "./types-chart.js";
import type { BaseStats, IVs } from "./types.js";

/**
 * Quem deixar no ginasio pra farmar moeda.
 *
 * Ideia do Miguel. E uma pergunta que o app pode responder com conta propria, e
 * a resposta e CONTRAINTUITIVA — que e justamente onde este app tem serventia.
 *
 * O que decide um defensor NAO e o mesmo que decide um atacante:
 *
 *   ATAQUE NAO CONTA. Um defensor de ginasio nao escolhe golpe, nao ataca no seu
 *   ritmo e nao mira fraqueza. O ataque dele quase nao muda quanto tempo ele
 *   sobrevive. Ou seja: aquele Pokemon de 100% que voce guardou pra raide e um
 *   desperdicio no ginasio, e o de 60% com muita vida aguenta mais.
 *
 *   AGUENTAR E TUDO. O que estica o tempo e defesa vezes vida — as duas
 *   juntas, porque uma sem a outra nao segura nada.
 *
 *   O TIPO DECIDE QUANTOS CONSEGUEM TE DERRUBAR. Um bicho que resiste a muita
 *   coisa cai menos que um que e fraco a muita coisa, com a mesma vida.
 *
 * ⚠️ O QUE ESTE MODULO NAO FAZ, e por que: nao simula perda de motivacao, nao
 * sabe quantas pessoas passam no seu ginasio, e nao adivinha o que elas usam pra
 * atacar. Nada disso esta no GAME_MASTER, e chutar aqui seria inventar — o
 * mesmo erro que o app evita em todas as outras telas. Ele ranqueia pelo que da
 * pra calcular, e a tela diz qual e o criterio.
 */

/** 1 moeda a cada 10 minutos de ginasio. */
const MINUTOS_POR_MOEDA = 10;

/** Teto diario. Nao ha como passar disto, com quantos ginasios for. */
export const MOEDAS_POR_DIA = 50;

export interface CoinMath {
  /** Minutos de ginasio somados que o teto exige. Sempre 500. */
  minutesForCap: number;
  /** Quanto tempo de relogio, com `gyms` ocupados ao mesmo tempo. */
  minutesOfClock: number;
  /** Moedas por hora, com `gyms` ocupados. */
  coinsPerHour: number;
}

/**
 * A conta da moeda.
 *
 * E aritmetica simples e vale estar escrita: o teto de 50 por dia significa 500
 * minutos de ginasio SOMADOS. Com um ginasio so, sao mais de oito horas — com
 * dez, cinquenta minutos de relogio. E por isso que espalhar em muitos ginasios
 * vale mais que caprichar em um, e nenhum ranking de defensor muda esse fato.
 */
export function coinMath(gyms: number): CoinMath {
  const ginasios = Math.max(1, Math.floor(gyms));
  const minutesForCap = MOEDAS_POR_DIA * MINUTOS_POR_MOEDA;
  return {
    minutesForCap,
    minutesOfClock: Math.ceil(minutesForCap / ginasios),
    coinsPerHour: (60 / MINUTOS_POR_MOEDA) * ginasios,
  };
}

export interface DefenderInput {
  id: string;
  speciesId: string;
  name: string;
  types: readonly string[];
  baseStats: BaseStats;
  ivs: IVs;
  level: number;
}

export interface DefenderScore {
  id: string;
  speciesId: string;
  name: string;
  types: readonly string[];
  /** Defesa efetiva vezes vida efetiva, no nivel que ele tem hoje. */
  bulk: number;
  /**
   * Media do multiplicador de dano que ele RECEBE, pelos 18 tipos de ataque.
   * Abaixo de 1 significa que ele resiste a mais coisa do que sofre.
   */
  incomingAverage: number;
  /** Tipos de ataque que batem forte nele. */
  weakTo: string[];
  /** Tipos de ataque que ele resiste. */
  resists: string[];
  /** Nota de 0 a 100, relativa ao primeiro da lista. */
  score: number;
}

/**
 * Ranqueia os SEUS por quanto tempo aguentam num ginasio.
 *
 * `bulk / incomingAverage` porque as duas coisas se multiplicam na pratica: uma
 * parede que e fraca a metade da tabela cai antes de uma parede menor que
 * resiste a metade dela. Somar em vez de dividir daria peso arbitrario a cada
 * metade; dividir e a forma que sai da propria unidade (dano recebido por ponto
 * de aguento).
 */
export function rankDefenders(
  defenders: readonly DefenderInput[],
  cpm: CpmTable,
  chart: TypeChart,
  order: TypeOrder,
): DefenderScore[] {
  const pontuados = defenders.map((d) => {
    const multiplier = cpmForLevel(cpm, d.level);
    const def = effectiveDefense(d.baseStats, d.ivs, multiplier);
    const hp = effectiveStamina(d.baseStats, d.ivs, multiplier);
    const bulk = def * hp;

    const weakTo: string[] = [];
    const resists: string[] = [];
    let soma = 0;

    for (const tipo of order) {
      const mult = effectiveness(chart, order, tipo, d.types);
      soma += mult;
      if (mult > 1) weakTo.push(tipo);
      else if (mult < 1) resists.push(tipo);
    }

    const incomingAverage = soma / order.length;

    return {
      id: d.id,
      speciesId: d.speciesId,
      name: d.name,
      types: d.types,
      bulk,
      incomingAverage,
      weakTo,
      resists,
      // Divisao pela media do dano recebido: aguentar muito e ser fraco a tudo
      // se cancelam, e e assim que se comportam no ginasio de verdade.
      raw: bulk / incomingAverage,
    };
  });

  pontuados.sort((a, b) => b.raw - a.raw);
  const topo = pontuados[0]?.raw ?? 1;

  return pontuados.map(({ raw, ...resto }) => ({
    ...resto,
    score: (raw / topo) * 100,
  }));
}

/**
 * Escolhe defensores SEM repetir tipo primario.
 *
 * Mesma regra do montador de time, e pelo mesmo motivo com uma consequencia
 * pior: seis defensores do mesmo tipo caem todos pro mesmo atacante. No ginasio
 * isso significa uma pessoa so limpando os seis com um Pokemon.
 */
export function pickDefenders(
  ranked: readonly DefenderScore[],
  size: number,
): DefenderScore[] {
  const escolhidos: DefenderScore[] = [];
  const tiposUsados = new Set<string>();

  for (const d of ranked) {
    if (escolhidos.length >= size) break;
    const primario = d.types[0];
    if (primario !== undefined && tiposUsados.has(primario)) continue;
    escolhidos.push(d);
    if (primario !== undefined) tiposUsados.add(primario);
  }

  // Faltou gente: completa pela nota, sem a regra de variedade.
  for (const d of ranked) {
    if (escolhidos.length >= size) break;
    if (escolhidos.some((x) => x.id === d.id)) continue;
    escolhidos.push(d);
  }

  return escolhidos;
}
