import { computeCPAtLevel, type CpmTable } from "./cp.js";
import { msg, type Message } from "./message.js";
import { GREAT_LEAGUE, MASTER_LEAGUE, ULTRA_LEAGUE, rankOf, type League } from "./pvp.js";
import type { BaseStats, IVs } from "./types.js";

/**
 * O motor de veredito.
 *
 * Ele nao devolve so a resposta — devolve o RASTRO de como chegou nela. Isso e
 * uma restricao de arquitetura, nao um enfeite: um motor que retorna apenas
 * "Investir" nao consegue produzir a explicacao depois, e o app inteiro se
 * apoia em explicar o porque.
 *
 * O desenho e de regras nomeadas que emitem sinal e peso. O veredito e a
 * agregacao delas, e a confianca e o grau de CONCORDANCIA entre os sinais —
 * regras que puxam pra lados opostos derrubam a confianca, que e exatamente o
 * que deveria acontecer quando o caso e ambiguo.
 */

/**
 * As respostas possíveis. São CINCO, e a quinta existe por um defeito real.
 *
 * ⚠️ `descobrir` é "eu não sei, me dá o IV" — e ela precisa ser uma AÇÃO, não
 * uma marca por fora, porque quem esquece dela tem que errar pro lado seguro.
 *
 * Antes eram quatro, e o guarda de "sem IV" vivia na tela inicial: ela detectava
 * `ivDesconhecido` e MONTAVA um veredito à mão, com `action: "investir"` e a
 * frase "falta o IV pra eu decidir". Duas consequências, as duas visíveis na
 * mesma tela:
 *
 *   · a home mostrava "Falta o IV pra eu decidir" com um botão escrito
 *     INVESTIR do lado — a tela se contradizendo em dois centímetros;
 *   · e as OUTRAS telas não tinham guarda nenhum. A ficha da espécie rodava
 *     `decide()` em cima dos zeros e devolvia **"Transferir · IV 0 de 45 ·
 *     confiança 65%"** para o mesmo Bulbasaur. "aq diz investir e no outro diz
 *     transferir..."
 *
 * O guarda mora aqui agora. Quem chamar `decide()` sem passar `ivDesconhecido`
 * continua funcionando; quem passar recebe a resposta honesta, e quem esquecer
 * de tratar `descobrir` na interface mostra "Descobrir o IV", que é o texto
 * certo. Esquecer virou seguro.
 */
export type Action = "investir" | "evoluir" | "guardar" | "transferir" | "descobrir";

export interface Signal {
  /** Nome da regra, como aparece no rastro: `papel.raide`. */
  rule: string;
  /** Para qual acao esta regra puxa. */
  towards: Action;
  /** De 0 a 1. Quanto a regra "acredita" no que diz. */
  weight: number;
  /** A frase de motivo, como chave + numeros. A interface e quem traduz. */
  because: Message;
}

export interface Verdict {
  action: Action;
  /** 0 a 1. Concordancia entre os sinais, nao certeza absoluta. */
  confidence: number;
  /** A frase unica de motivo. Nunca duas — regra do prototipo. */
  reason: Message;
  /** Todos os sinais, para o Trace Viewer. */
  signals: Signal[];
}

export interface VerdictInput {
  name: string;
  baseStats: BaseStats;
  ivs: IVs;
  level: number;
  cpm: CpmTable;
  levelCap: number;
  /** Espécies para as quais esta especie evolui. Vazio = e o estagio final. */
  evolvesInto: readonly string[];
  /** Doces que o jogador tem. `null` quando nao informado. */
  candy?: number | null;
  /** Doces necessarios para a proxima evolucao. */
  candyToEvolve?: number | null;
  lucky?: boolean;
  shadow?: boolean;
  /**
   * A especie faz Gigantamax.
   *
   * ⚠️ Da ESPECIE, nao deste individuo — `fazGigantamax` responde por especie
   * e nao existe dado que responda por individuo. Ausente vira `false`, entao
   * quem nao passar continua com o comportamento antigo.
   */
  gigantamax?: boolean;
  /**
   * "eu tenho esse", sem IV medido.
   *
   * ⚠️ Os `ivs` vêm zerados porque o tipo exige três números — não porque
   * alguém mediu zero. Sem esta marca, `decide()` lê os zeros como medidos e
   * devolve "Transferir" com confiança cheia para um bicho que pode ser 100%.
   */
  ivDesconhecido?: boolean;
}

/**
 * ⚠️ `descobrir` fica FORA da agregação.
 *
 * Ela não disputa peso com as outras: ou o IV existe e as quatro decidem, ou
 * ele não existe e não há o que decidir. Deixá-la na lista faria uma regra
 * futura "puxar para descobrir" e o veredito viraria uma pergunta no meio de
 * quatro respostas.
 */
const ACTIONS: readonly Action[] = ["investir", "evoluir", "guardar", "transferir"];

/**
 * Os vereditos que COBRAM alguma coisa.
 *
 * ⚠️ Mora aqui, e nao na tela, porque DUAS telas dependem dele e elas ja se
 * contradisseram uma vez ("aq diz investir e no outro diz transferir").
 *
 * `guardar` esta de fora: e o veredito de quem nao precisa fazer nada. Ele nao
 * entra na fila da home, nao aparece na faxina e nao cobra nada — e foi
 * exatamente por isso que o botao "Discordo" era UI morta num "Guardar":
 * discordar silencia uma cobranca que nunca existiu.
 *
 * Quem oferecer uma saida ("Discordo", "Já fiz isso") tem que perguntar a esta
 * lista se ha o que sair.
 */
export const ACOES_QUE_COBRAM: readonly Action[] = [
  "descobrir",
  "evoluir",
  "investir",
  "transferir",
];

/**
 * Discordar deste veredito pede um MOTIVO?
 *
 * So o `transferir`. Os motivos que o app oferece — gosto dele, eu uso, e um
 * desafio meu — respondem "por que voce FICA com ele", e essa pergunta so
 * existe quando o conselho foi soltar. Discordar de "investir" e "nao vou
 * gastar poeira nele"; de "evoluir", "nao vou evoluir"; de "descobrir", "nao
 * vou escanear agora". Nenhum dos tres diz isso.
 *
 * ⚠️ Mora aqui, e nao na tela, pelo mesmo motivo de `ACOES_QUE_COBRAM`: e a
 * terceira regra desta familia, e as duas primeiras viraram defeito justamente
 * por estarem escritas dentro de um componente. Aqui ela e testavel sem montar
 * React, sem IndexedDB e sem navegador.
 */
export function pedeMotivo(action: Action): boolean {
  return action === "transferir";
}

/**
 * O veredito de hoje ja foi cumprido?
 *
 * Duas condicoes, e as duas ja moraram espalhadas por quatro arquivos:
 *
 *  1. A acao marcada tem que ser a MESMA que o veredito indica agora. Subiu de
 *     nivel e o conselho virou "evoluir"? Volta a cobrar — e outra coisa.
 *  2. A acao tem que COBRAR alguma coisa. "Guardar" nao se cumpre.
 *
 * ⚠️ A segunda condicao tambem CURA dado velho, e essa e a razao de ela viver
 * aqui e nao na tela. Enquanto o app deixava marcar "Guardar" como feito, ele
 * gravou `doneAction: "guardar"` em especie reais. Tirar so o botao deixaria
 * essas linhas exibindo "✓ FEITO" pra sempre, sem nenhum lugar pra desmarcar —
 * trocar um botao que nao faz nada por um estado do qual nao se sai.
 *
 * Ignorando a marca aqui, a linha volta a mostrar "Guardar" sozinha, sem
 * migracao e sem tocar no banco.
 */
export function cumpriu(action: Action, doneAction: string | null | undefined): boolean {
  return doneAction === action && ACOES_QUE_COBRAM.includes(action);
}

/**
 * Chave de traducao de cada acao. Nao e o rotulo — o rotulo depende do idioma e
 * mora no dicionario da interface.
 */
export const ACTION_KEYS: Record<Action, string> = {
  investir: "action.invest",
  evoluir: "action.evolve",
  guardar: "action.keep",
  transferir: "action.transfer",
  descobrir: "action.discover",
};

/** A melhor posicao entre as tres ligas, que e o que decide se vale pra PvP. */
function bestLeagueRank(
  cpm: CpmTable,
  base: BaseStats,
  ivs: IVs,
): { league: League; rank: number; percent: number } | null {
  let best: { league: League; rank: number; percent: number } | null = null;
  for (const league of [GREAT_LEAGUE, ULTRA_LEAGUE, MASTER_LEAGUE]) {
    const ranked = rankOf(cpm, base, ivs, league);
    if (!ranked) continue;
    if (!best || ranked.rank < best.rank) {
      best = { league, rank: ranked.rank, percent: ranked.percent };
    }
  }
  return best;
}

export function decide(input: VerdictInput): Verdict {
  /*
   * ⚠️ SEM IV, O APP NÃO DECIDE — ele pede o IV. E isso vem ANTES de tudo.
   *
   * Não há sinal, não há rastro e não há confiança: confiança é o grau de
   * concordância entre regras, e aqui nenhuma regra chegou a rodar. Devolver
   * `confidence: 0` com a lista de sinais vazia é o único jeito de a barra da
   * interface não desenhar certeza sobre um palpite.
   */
  if (input.ivDesconhecido) {
    return {
      action: "descobrir",
      confidence: 0,
      reason: msg("verdict.needIv"),
      signals: [],
    };
  }

  const signals: Signal[] = [];
  const total = input.ivs.atk + input.ivs.def + input.ivs.hp;

  // ------------------------------------------------------ evoluir vem primeiro
  //
  // Evoluir muda a especie e portanto invalida qualquer analise feita sobre a
  // forma atual. Nao adianta recomendar investir num Machoke: o que importa e
  // o Machamp que ele vira.
  if (input.evolvesInto.length > 0) {
    const need = input.candyToEvolve ?? null;
    const have = input.candy ?? null;

    if (need !== null && have !== null && have >= need) {
      signals.push({
        rule: "evolucao.disponivel",
        towards: "evoluir",
        weight: 0.95,
        because: msg("verdict.evolution.ready", { candy: need }),
      });
    } else {
      signals.push({
        rule: "evolucao.pendente",
        towards: "evoluir",
        weight: 0.7,
        because: msg("verdict.evolution.pending"),
      });
    }
  }

  // ------------------------------------------------------------------- PvP
  const best = bestLeagueRank(input.cpm, input.baseStats, input.ivs);

  if (best && best.rank <= 50) {
    signals.push({
      rule: "pvp.rank",
      towards: "investir",
      weight: 0.9,
      because: msg("verdict.pvp.top", { rank: best.rank, league: best.league.name }),
    });
  } else if (best && best.rank <= 500) {
    signals.push({
      rule: "pvp.rank",
      towards: "guardar",
      weight: 0.55,
      because: msg("verdict.pvp.good", { rank: best.rank, league: best.league.name }),
    });
  }

  // ------------------------------------------------------------------ raide
  //
  // Em raide o ataque manda, e ataque base alto com IV de ataque alto e a
  // combinacao que faz diferenca real.
  if (input.baseStats.atk >= 230 && input.ivs.atk >= 14) {
    signals.push({
      rule: "raide.ataque",
      towards: "investir",
      weight: 0.85,
      because: msg("verdict.raid.attack", { base: input.baseStats.atk, iv: input.ivs.atk }),
    });
  }

  // Shadow ganha 20% de ataque: um shadow de IV medio bate mais que um normal
  // de IV alto, e por isso NAO deve ser purificado nem transferido as pressas.
  if (input.shadow) {
    signals.push({
      rule: "shadow.bonus",
      towards: "guardar",
      weight: 0.75,
      because: msg("verdict.shadow.bonus"),
    });
  }

  if (input.lucky) {
    signals.push({
      rule: "lucky.custo",
      towards: "investir",
      weight: 0.6,
      because: msg("verdict.lucky.cost"),
    });
  }

  /*
   * ------------------------------------------------------------- Gigantamax
   *
   * ⚠️ A MECANICA QUE O MOTOR IGNORAVA INTEIRA.
   *
   * O plano registrava o risco em uma frase: "se o jogo ja tem, o motor de
   * veredito esta ignorando uma mecanica inteira". Tem — ver `dynamax.ts`, e o
   * motivo de ninguem ter achado (no GAME_MASTER a mecanica se chama BREAD).
   *
   * Das tres coisas que os dados permitem afirmar, so UMA muda um veredito, e e
   * esta: a especie faz Gigantamax. As outras duas (custo dos Max Ataques,
   * papel na Batalha Max) sao informacao pra ficha, nao razao pra guardar ou
   * soltar um bicho especifico.
   *
   * Peso 0.7, e nao mais: Gigantamax e da ESPECIE, nao deste individuo. Nao
   * transforma um 20% em bom especie — o `iv.fraco` continua com 0.8 e continua
   * vencendo, que e o certo. O que ele impede e um caso especifico: um
   * Snorlax medio ser mandado embora sem ninguem mencionar que ele e uma das 31
   * especies que fazem Gigantamax, e que o jogo cobra caro pra repor.
   */
  if (input.gigantamax) {
    signals.push({
      rule: "dynamax.gigantamax",
      towards: "guardar",
      weight: 0.7,
      because: msg("verdict.gigantamax"),
    });
  }

  // -------------------------------------------------------------- transferir
  if (total <= 15 && !input.lucky && !input.shadow) {
    signals.push({
      rule: "iv.fraco",
      towards: "transferir",
      weight: 0.8,
      because: msg("verdict.iv.weak", { total }),
    });
  }

  if (input.baseStats.atk < 150 && input.baseStats.def + input.baseStats.hp < 300) {
    signals.push({
      rule: "especie.fraca",
      towards: "transferir",
      weight: 0.5,
      because: msg("verdict.species.weak"),
    });
  }

  // Nenhuma regra falou: guardar e a resposta segura.
  if (signals.length === 0) {
    signals.push({
      rule: "padrao",
      towards: "guardar",
      weight: 0.4,
      because: msg("verdict.default"),
    });
  }

  // ------------------------------------------------------------- agregacao
  //
  // Evoluir tem PRECEDENCIA, nao so peso alto.
  //
  // Um teste pegou isto: um Machoke 100% recebia "investir", porque o sinal de
  // PvP pesava mais que o de evolucao. Mas recomendar investir numa
  // pre-evolucao e recomendar a acao errada — o que decide o futuro daquele
  // especie e o Machamp que ele vira, e toda analise feita sobre a forma atual
  // fica obsoleta no instante em que ele evolui.
  //
  // Os outros sinais continuam no rastro: eles explicam POR QUE vale a pena
  // evoluir este em vez de outro.
  // ...mas a precedencia NAO e absoluta: ninguem evolui um Rattata de 3%.
  //
  // Quando o IV e ruim o bastante para pedir transferencia, transferir vence —
  // evoluir gastaria doce num bicho que ja se sabe descartavel. O teste pegou
  // este caso na primeira versao, que mandava evoluir qualquer coisa evoluivel.
  const strongTransfer = signals.some((s) => s.towards === "transferir" && s.weight >= 0.8);

  const evolution = strongTransfer ? undefined : signals.find((s) => s.towards === "evoluir");
  if (evolution) {
    const totalWeightEvo = signals.reduce((sum, s) => sum + s.weight, 0);
    return {
      action: "evoluir",
      confidence: totalWeightEvo > 0 ? evolution.weight / totalWeightEvo : 0,
      reason: evolution.because,
      signals,
    };
  }

  const scores = new Map<Action, number>(ACTIONS.map((a) => [a, 0]));
  for (const s of signals) {
    scores.set(s.towards, (scores.get(s.towards) ?? 0) + s.weight);
  }

  let action: Action = "guardar";
  let top = -1;
  for (const [candidate, score] of scores) {
    if (score > top) {
      top = score;
      action = candidate;
    }
  }

  // Confianca = quanto do peso total puxa pro lado vencedor.
  //
  // Se duas regras fortes apontam para acoes diferentes, isso cai — e deve
  // cair. Um app que diz "invista, confianca 95%" quando as regras discordam
  // esta mentindo sobre o que sabe.
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const confidence = totalWeight > 0 ? top / totalWeight : 0;

  const winner = signals
    .filter((s) => s.towards === action)
    .sort((a, b) => b.weight - a.weight)[0]!;

  return { action, confidence, reason: winner.because, signals };
}

/**
 * O rastro, no formato do Trace Viewer do prototipo.
 *
 *     decide(machamp)
 *     ├─ raide.ataque ....... +0.85
 *     ├─ pvp.rank ........... +0.55
 *     └─ veredito ........... 0.61
 */
export function formatTrace(name: string, verdict: Verdict): string {
  const lines = [`decide(${name})`];
  const pad = (label: string): string => label.padEnd(22, ".");

  for (const s of verdict.signals) {
    lines.push(`├─ ${pad(s.rule)} +${s.weight.toFixed(2)}`);
  }
  lines.push(`└─ ${pad("veredito")} ${verdict.confidence.toFixed(2)}`);

  return lines.join("\n");
}

