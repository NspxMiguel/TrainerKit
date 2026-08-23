import { computeCP, cpmForLevel, type CpmTable } from "./cp.js";
import {
  computeRaidPerformance,
  damage,
  type BattleSettings,
  type Move,
} from "./raid.js";
import { effectiveness, stab, type TypeChart, type TypeOrder } from "./types-chart.js";
import type { BaseStats, IVs } from "./types.js";

/**
 * Counters de raide, tirados da colecao do jogador.
 *
 * A pergunta que este modulo responde nao e "quais sao os melhores counters do
 * jogo" — isso qualquer site responde. E "com os POKEMON QUE EU TENHO, eu
 * derrubo esse chefe, e sozinho?". Essa so o app do dono da colecao responde,
 * e e a razao de a colecao existir.
 */

export type RaidTier = 1 | 3 | 5 | "mega";

export interface TierSpec {
  /** Vida fixa do chefe. Nao sai da stamina da especie. */
  hp: number;
  /** Multiplicador aplicado a ataque e defesa do chefe. */
  cpm: number;
  /** Duracao da luta, em segundos. */
  seconds: number;
}

/**
 * Parametros de chefe por tier.
 *
 * ⚠️ NAO ESTAO NO GAME_MASTER. Sao client-side, como os limiares da tela de
 * avaliacao — procurei por `raidStamina`, `raidLevel` e pelos proprios numeros
 * no arquivo e nao existe nada. Entao estao fixados aqui e valem enquanto o
 * jogo nao os mudar.
 *
 * A VIDA esta verificada: a formula de PC de chefe publicada — (atk+15) x
 * sqrt(def+15) x sqrt(HP) / 10 — reproduz o PC que o jogo mostra. Mewtwo tier 5
 * da 54.145 contra os 54.148 conhecidos, e ha teste travando isso. Se a vida
 * estivesse errada, o PC nao fecharia.
 *
 * O CPM nao tem fonte primaria publicada; sao os valores medidos pela
 * comunidade ha anos. Por isso a tela mostra o PC do chefe: se um dia divergir
 * do que aparece no jogo, da pra notar sem ler codigo.
 */
export const RAID_TIERS: Record<RaidTier, TierSpec> = {
  1: { hp: 600, cpm: 0.61, seconds: 180 },
  3: { hp: 3600, cpm: 0.73, seconds: 180 },
  5: { hp: 15000, cpm: 0.79, seconds: 300 },
  mega: { hp: 9000, cpm: 0.79, seconds: 300 },
};

/** IV do chefe: ataque e defesa sempre perfeitos. */
const BOSS_IVS: IVs = { atk: 15, def: 15, hp: 15 };

export interface RaidBossInput {
  name: string;
  types: readonly string[];
  baseStats: BaseStats;
  tier: RaidTier;
  /** Golpes que o chefe pode usar, para estimar o dano que ele devolve. */
  fastMoves: readonly Move[];
  chargedMoves: readonly Move[];
}

/**
 * PC do chefe, como o jogo mostra.
 *
 * Note que aqui o CPM e 1, nao o do tier: o numero exibido usa a vida do tier
 * como stamina e nao escala. E contra-intuitivo, mas e o que reproduz os
 * valores publicados.
 */
export function bossCP(boss: RaidBossInput): number {
  const { hp } = RAID_TIERS[boss.tier];
  const atk = boss.baseStats.atk + BOSS_IVS.atk;
  const def = boss.baseStats.def + BOSS_IVS.def;
  return Math.floor((atk * Math.sqrt(def) * Math.sqrt(hp)) / 10);
}

/**
 * Defesa de referencia do `computeRaidPerformance`.
 *
 * O `incomingDps` que ele recebe e medido contra ESTA defesa, e la dentro ele
 * reescala pela defesa real do atacante. Passar um DPS que ja embute a defesa
 * do atacante conta a defesa duas vezes — foi exatamente o bug que apareceu
 * aqui: um Azumarill sobrevivia tempo demais e a conta de "da pra solar"
 * respondia errado.
 */
const REFERENCE_DEFENSE = 200;

/**
 * Dano por segundo que o chefe entrega, contra a defesa de referencia.
 *
 * E um CICLO — golpes rapidos ate juntar energia, depois um carregado —, a
 * mesma conta que se faz do lado do atacante. A primeira versao pegava o golpe
 * mais forte do chefe e tratava como dano continuo, e o resultado era absurdo:
 * um Focus Blast de Mewtwo aplicado a cada segundo dava 2,5 segundos de
 * sobrevivencia pra qualquer um, e a conta de "da pra solar" respondia nao
 * sempre. Chefe nao spamma carregado.
 *
 * Continua dependendo do ATACANTE, mas so pelos tipos dele: o mesmo golpe pode
 * ser super efetivo contra um e resistido por outro. A defesa propriamente dita
 * entra depois, em `computeRaidPerformance`.
 *
 * Entre os ciclos possiveis tira a MEDIA, nao o pior.
 *
 * O moveset do chefe e sorteado, entao o resultado esperado e a media. Pegar o
 * pior transformava toda estimativa em pessimismo sistematico: contra um Mewtwo
 * com Focus Blast, um Tyranitar (Pedra/Sombrio, 4x fraco a lutador) durava 7
 * segundos, e o app respondia "chama gente" mesmo pra chefe que se sola. O pior
 * caso e um cenario; a media e a resposta.
 */
export function bossDpsAgainst(
  boss: RaidBossInput,
  attackerTypes: readonly string[],
  chart: TypeChart,
  order: TypeOrder,
  settings: BattleSettings,
): number {
  const spec = RAID_TIERS[boss.tier];
  const bossAtk = (boss.baseStats.atk + BOSS_IVS.atk) * spec.cpm;

  const hit = (move: Move): number =>
    damage(
      move.power,
      bossAtk,
      REFERENCE_DEFENSE,
      effectiveness(chart, order, move.type, attackerTypes),
      stab(move.type, boss.types, settings.sameTypeAttackBonusMultiplier),
    );

  let total = 0;
  let n = 0;
  for (const fast of boss.fastMoves) {
    const fastSeconds = fast.durationMs / 1000;
    if (fastSeconds <= 0 || fast.energyDelta <= 0) continue;

    for (const charged of boss.chargedMoves) {
      const chargedSeconds = charged.durationMs / 1000;
      if (chargedSeconds <= 0) continue;

      const perCycle = Math.ceil(Math.abs(charged.energyDelta) / fast.energyDelta);
      const cycleDamage = hit(fast) * perCycle + hit(charged);
      const cycleSeconds = fastSeconds * perCycle + chargedSeconds;
      total += cycleDamage / cycleSeconds;
      n++;
    }
  }

  // Chefe sem carregado utilizavel: sobra o ciclo de golpe rapido.
  if (n === 0) {
    for (const fast of boss.fastMoves) {
      const seconds = fast.durationMs / 1000;
      if (seconds <= 0) continue;
      total += hit(fast) / seconds;
      n++;
    }
  }

  return n > 0 ? total / n : 0;
}

export interface CounterInput {
  /** Identificador da especie salvo, para a tela reencontrar. */
  id: string;
  name: string;
  speciesId: string;
  types: readonly string[];
  baseStats: BaseStats;
  ivs: IVs;
  level: number;
  shadow?: boolean;
  fast: Move;
  charged: Move;
}

export interface Counter {
  id: string;
  name: string;
  speciesId: string;
  fast: Move;
  charged: Move;
  dps: number;
  tdo: number;
  /** DPS^0,75 x TDO^0,25. E por ele que a lista ordena. */
  er: number;
  survivalSeconds: number;
}

/**
 * Ordena os especie do jogador contra um chefe.
 *
 * Cada especie entra com o MELHOR moveset dele contra este chefe — nao com o
 * que ele tem equipado, que o app nao sabe. A tela diz qual e, porque "seu
 * Machamp e o melhor" sem dizer com qual golpe e conselho pela metade.
 */
export function rankCounters(
  team: readonly CounterInput[],
  boss: RaidBossInput,
  cpm: CpmTable,
  chart: TypeChart,
  order: TypeOrder,
  settings: BattleSettings,
): Counter[] {
  const spec = RAID_TIERS[boss.tier];

  const counters = team.map((member) => {
    const multiplier = cpmForLevel(cpm, member.level);
    const incomingDps = bossDpsAgainst(boss, member.types, chart, order, settings);

    const perf = computeRaidPerformance(
      {
        types: member.types,
        baseStats: member.baseStats,
        ivs: member.ivs,
        cpm: multiplier,
        fast: member.fast,
        charged: member.charged,
        ...(member.shadow === undefined ? {} : { shadow: member.shadow }),
      },
      {
        types: boss.types,
        baseStats: boss.baseStats,
        cpm: spec.cpm,
        incomingDps,
      },
      chart,
      order,
      settings,
    );

    return {
      id: member.id,
      name: member.name,
      speciesId: member.speciesId,
      fast: member.fast,
      charged: member.charged,
      dps: perf.dps,
      tdo: perf.tdo,
      er: perf.er,
      survivalSeconds: perf.survivalSeconds,
    };
  });

  return counters.sort((a, b) => b.er - a.er);
}

export interface RaidEstimate {
  /** Quantos treinadores como voce sao necessarios. 1 = da pra solar. */
  trainers: number;
  /** Segundos estimados para derrubar, com o numero de treinadores acima. */
  seconds: number;
  /** Dano por segundo do seu time de seis. */
  teamDps: number;
  /** Dano total que seu time entrega antes de cair inteiro. */
  teamTdo: number;
  /** `true` quando um treinador so da conta dentro do tempo. */
  canSolo: boolean;
  /**
   * Nem lotando a sala da. Quando isto e `true`, o numero de treinadores nao
   * quer dizer nada — o conselho e trocar de counter, nao chamar gente.
   */
  beyondLobby: boolean;
  /**
   * O time entrega menos dano do que a vida do chefe antes de cair inteiro.
   * Nao impede a vitoria — voce revive e volta —, mas avisa que vai ser feio.
   */
  frail: boolean;
}

/** Quantos especie entram numa raide. */
export const TEAM_SIZE = 6;

/**
 * Maximo de treinadores numa sala.
 *
 * Este numero VEM do GAME_MASTER (`RAID_CLIENT_SETTINGS.maxPlayersPerLobby`),
 * ao contrario da vida e do CPM por tier. Ele existe aqui porque e o que separa
 * "chama gente" de "esse time nao serve": pedir 2.511 treinadores e uma
 * resposta correta e imprestavel.
 */
export const MAX_LOBBY = 20;

/**
 * Da pra solar?
 *
 * A trava e o TEMPO, nao o aguente.
 *
 * A primeira versao exigia que o dano total do time antes de cair inteiro
 * cobrisse a vida do chefe. Isso responde a pergunta errada: numa raide voce
 * REVIVE e volta, entao o aguente do time nao e um teto de dano — e o que
 * define quantas vezes voce vai ter que voltar. Com aquela trava, seis
 * Alakazam de nivel 40 "nao solavam" um Machamp tier 3, que se sola
 * tranquilo, e todo chefe voltava "limitado por sobrevivencia".
 *
 * O modelo agora e o mesmo dos calculadores conhecidos: o chefe tem vida fixa
 * e a luta tem duracao fixa, entao a pergunta e se o seu DPS entrega essa vida
 * no tempo. O aguente vira AVISO — um time que derrete faz o numero de idas e
 * voltas explodir, e isso o jogador precisa saber, mas nao e o que decide.
 */
export function estimateRaid(counters: readonly Counter[], boss: RaidBossInput): RaidEstimate {
  const spec = RAID_TIERS[boss.tier];
  const team = counters.slice(0, TEAM_SIZE);

  if (team.length === 0) {
    return {
      trainers: Infinity,
      seconds: Infinity,
      teamDps: 0,
      teamTdo: 0,
      canSolo: false,
      beyondLobby: true,
      frail: true,
    };
  }

  // Um por vez: o DPS efetivo e o do que esta na frente. Somar os seis daria um
  // numero seis vezes otimista, que e o erro classico.
  const teamDps = team[0]!.dps;
  const teamTdo = team.reduce((sum, c) => sum + c.tdo, 0);

  const secondsSolo = teamDps > 0 ? spec.hp / teamDps : Infinity;
  const trainers = teamDps > 0 ? Math.max(1, Math.ceil(spec.hp / (teamDps * spec.seconds))) : Infinity;

  return {
    trainers,
    seconds: secondsSolo,
    teamDps,
    teamTdo,
    canSolo: secondsSolo <= spec.seconds,
    beyondLobby: trainers > MAX_LOBBY,
    // O time nao aguenta entregar a vida do chefe de uma vez: da pra ganhar,
    // mas revivendo. E informacao util, nao impedimento.
    frail: teamTdo < spec.hp,
  };
}

/** PC que o chefe teria como especie capturavel, util pra conferir a especie. */
export function bossCatchCP(boss: RaidBossInput, cpm: CpmTable, level = 20): number {
  return computeCP(boss.baseStats, { atk: 10, def: 10, hp: 10 }, cpmForLevel(cpm, level));
}

/** O piso de IV de quem sai de uma raide. Nao existe chefe capturado abaixo disto. */
const PISO_IV_RAIDE = 10;

/** Nivel de captura: 20 no normal, 25 quando o clima favorece o tipo do chefe. */
const NIVEL_NORMAL = 20;
const NIVEL_CLIMA = 25;

export interface FaixaDeCaptura {
  /** PC do pior IV possivel (10/10/10) e do perfeito (15/15/15), no nivel 20. */
  normal: { min: number; max: number };
  /** O mesmo com clima favoravel, que sobe a captura pro nivel 25. */
  comClima: { min: number; max: number };
}

/**
 * Em que PC o chefe sai, e qual seria o 100%.
 *
 * ⚠️ Isto e o que transforma numero em DECISAO, e por isso existe.
 *
 * Quem derruba uma raide ve um PC e tem que decidir na hora se vale gastar as
 * bolas douradas. O jogo nao diz nada — e o app tinha a conta pronta e nao
 * mostrava: `bossCatchCP` existia desde sempre em `counters.ts` e nenhuma tela
 * o chamava.
 *
 * Com a faixa na mao, o PC vira resposta: um chefe que sai no MAXIMO da faixa
 * e 15/15/15, ponto final. Nao precisa escanear, nao precisa avaliar, nao
 * precisa nem capturar pra saber.
 *
 * As duas faixas porque o clima muda o nivel de captura de 20 pra 25, e um PC
 * "alto demais" pra faixa normal nao e erro de leitura — e clima favoravel.
 * Mostrar so uma faria a pessoa achar que o app errou.
 */
export function bossCatchRange(boss: RaidBossInput, cpm: CpmTable): FaixaDeCaptura {
  const pc = (iv: number, nivel: number) =>
    computeCP(
      boss.baseStats,
      { atk: iv, def: iv, hp: iv },
      cpmForLevel(cpm, nivel),
    );

  return {
    normal: { min: pc(PISO_IV_RAIDE, NIVEL_NORMAL), max: pc(MAX_IV_RAIDE, NIVEL_NORMAL) },
    comClima: { min: pc(PISO_IV_RAIDE, NIVEL_CLIMA), max: pc(MAX_IV_RAIDE, NIVEL_CLIMA) },
  };
}

/** O teto de IV, que e o mesmo do jogo inteiro. */
const MAX_IV_RAIDE = 15;
