import type { Move } from "./raid.js";
import { effectiveness, stab, type TypeChart, type TypeOrder } from "./types-chart.js";

/**
 * Melhor moveset por contexto.
 *
 * O mesmo Pokemon tem movesets diferentes conforme o objetivo, e a razao nao e
 * gosto — sao contas diferentes:
 *
 *   raide   dano por segundo contra UM alvo conhecido, sem trocas. Golpe
 *           carregado caro mas devastador compensa.
 *   pvp     turnos e energia. Golpe barato que sai rapido costuma vencer o
 *           golpe forte que nunca carrega, porque o oponente troca e escuda.
 *   geral   quem nao e ruim em nenhum dos dois.
 *
 * Por isso `power` sozinho nunca responde: em PvP o que importa e dano POR
 * ENERGIA e quantos turnos custa carregar.
 */

export type Context = "raid" | "pvp" | "rocket" | "general";

export interface MoveWithPvp extends Move {
  name: string;
  pvp: { power: number; energyDelta: number; turns: number } | null;
  /** Aprendido so por TM Elite: nao aparece em captura normal. */
  elite?: boolean;
  /**
   * Frustracao — o golpe que todo sombroso traz e que TM comum nao remove.
   * Marcado para a UI poder explicar por que ele aparece e por que e tao ruim.
   */
  frustration?: boolean;
}

export interface Moveset {
  fast: MoveWithPvp;
  charged: MoveWithPvp;
  /**
   * Segundo carregado, usado so para queimar escudo. So o contexto Rocket
   * preenche; `null` quando a isca e o proprio finalizador ou nao se aplica.
   */
  bait?: MoveWithPvp | null;
  /** Nota do conjunto no contexto pedido. So compara com outros do mesmo Pokemon. */
  score: number;
  /** `true` quando algum dos golpes exige TM Elite. */
  needsElite: boolean;
  /** `true` quando a Frustracao esta no conjunto. */
  isFrustration: boolean;
}

interface ScoreInput {
  attackerTypes: readonly string[];
  chart: TypeChart;
  order: TypeOrder;
  stabMultiplier: number;
  /** Tipos do alvo. Vazio = media contra tudo. */
  defenderTypes?: readonly string[];
}

/**
 * Dano por segundo do ciclo, para raide.
 *
 * Considera quantos golpes rapidos pagam um carregado — usar so o carregado
 * superestima muito, porque ele nao pode ser usado o tempo todo.
 */
function raidScore(fast: MoveWithPvp, charged: MoveWithPvp, input: ScoreInput): number {
  const multiplier = (move: MoveWithPvp): number =>
    stab(move.type, input.attackerTypes, input.stabMultiplier) *
    (input.defenderTypes && input.defenderTypes.length > 0
      ? effectiveness(input.chart, input.order, move.type, input.defenderTypes)
      : 1);

  const fastDamage = fast.power * multiplier(fast);
  const chargedDamage = charged.power * multiplier(charged);

  const fastSeconds = fast.durationMs / 1000;
  const chargedSeconds = charged.durationMs / 1000;
  if (fastSeconds <= 0 || chargedSeconds <= 0) return 0;

  const energyPerFast = fast.energyDelta;
  if (energyPerFast <= 0) return fastDamage / fastSeconds;

  const cost = Math.abs(charged.energyDelta);
  const fastPerCycle = Math.ceil(cost / energyPerFast);

  const cycleDamage = fastDamage * fastPerCycle + chargedDamage;
  const cycleSeconds = fastSeconds * fastPerCycle + chargedSeconds;
  return cycleDamage / cycleSeconds;
}

/**
 * Dano por turno em PvP.
 *
 * O tempo em PvP e contado em TURNOS, nao em segundos, e a energia e o recurso
 * escasso. Um golpe de 100 de poder que custa 60 de energia perde para um de 50
 * que custa 35 — o segundo sai duas vezes antes de o primeiro sair uma.
 */
function pvpScore(fast: MoveWithPvp, charged: MoveWithPvp, input: ScoreInput): number {
  if (!fast.pvp || !charged.pvp) return 0;

  const multiplier = (type: string): number =>
    stab(type, input.attackerTypes, input.stabMultiplier) *
    (input.defenderTypes && input.defenderTypes.length > 0
      ? effectiveness(input.chart, input.order, type, input.defenderTypes)
      : 1);

  const turns = Math.max(1, fast.pvp.turns);
  const fastDpt = (fast.pvp.power * multiplier(fast.type)) / turns;
  const fastEpt = fast.pvp.energyDelta / turns;

  const cost = Math.abs(charged.pvp.energyDelta);
  if (cost <= 0 || fastEpt <= 0) return fastDpt;

  const chargedDamage = charged.pvp.power * multiplier(charged.type);
  const turnsToCharge = cost / fastEpt;

  // Dano medio por turno ao longo do ciclo completo.
  return (fastDpt * turnsToCharge + chargedDamage) / (turnsToCharge + 1);
}

/**
 * Quantos escudos o chefe de Rocket levanta.
 *
 * Confirmado em duas fontes independentes: os LIDERES (Arlo, Cliff, Sierra e
 * Giovanni) sempre bloqueiam os dois primeiros golpes carregados do treinador;
 * os grunts nao usam escudo nenhum. Modelamos o lider porque e a luta que pede
 * conselho — contra grunt qualquer moveset decente serve.
 */
const ROCKET_SHIELDS = 2;

/**
 * Dano por turno contra um lider de Rocket.
 *
 * A diferenca para o PvP comum e o motivo de este contexto existir. Contra
 * humano, escudar e uma DECISAO do oponente e a isca serve para engana-lo. O
 * lider nao decide nada: ele bloqueia os dois primeiros carregados, sempre.
 * Isso torna a isca aritmetica em vez de blefe — voce sabe de antemao que dois
 * golpes serao desperdicados, entao desperdice os BARATOS.
 *
 * Por isso este contexto pontua um TRIO (rapido + isca + finalizador) e nao um
 * par. Foi so ao rodar os numeros que isso ficou claro: com um carregado so, o
 * modelo de "tres arremessos" continuava elegendo o golpe mais forte, porque
 * dano por energia nao muda com escudo. O que muda e poder gastar pouco nos
 * dois arremessos que nao contam.
 *
 * Quando `bait` e o proprio finalizador, a conta vira o caso de quem so tem um
 * carregado — tres arremessos do mesmo golpe.
 */
function rocketScore(
  fast: MoveWithPvp,
  bait: MoveWithPvp,
  closer: MoveWithPvp,
  input: ScoreInput,
): number {
  if (!fast.pvp || !bait.pvp || !closer.pvp) return 0;

  const multiplier = (type: string): number =>
    stab(type, input.attackerTypes, input.stabMultiplier) *
    (input.defenderTypes && input.defenderTypes.length > 0
      ? effectiveness(input.chart, input.order, type, input.defenderTypes)
      : 1);

  const turns = Math.max(1, fast.pvp.turns);
  const fastDpt = (fast.pvp.power * multiplier(fast.type)) / turns;
  const fastEpt = fast.pvp.energyDelta / turns;

  const baitCost = Math.abs(bait.pvp.energyDelta);
  const closerCost = Math.abs(closer.pvp.energyDelta);
  if (baitCost <= 0 || closerCost <= 0 || fastEpt <= 0) return fastDpt;

  // Carregar a isca duas vezes queima os dois escudos; so o terceiro golpe
  // machuca. O rapido continua entrando esse tempo todo — e ele que carrega.
  const fastTurns = (baitCost * ROCKET_SHIELDS + closerCost) / fastEpt;
  const throws = ROCKET_SHIELDS + 1;
  const landed = closer.pvp.power * multiplier(closer.type);

  return (fastDpt * fastTurns + landed) / (fastTurns + throws);
}

/**
 * Ordena os movesets possiveis.
 *
 * "Geral" usa a MENOR das duas notas normalizadas, nao a media: um moveset
 * excelente em raide e pessimo em PvP nao e um bom moveset geral — e um bom
 * moveset de raide. Media premiaria o especialista; minimo premia o versatil,
 * que e o que "serve pra tudo" quer dizer.
 */
export function rankMovesets(
  fastMoves: readonly MoveWithPvp[],
  chargedMoves: readonly MoveWithPvp[],
  context: Context,
  input: ScoreInput,
): Moveset[] {
  if (context === "rocket") return rankForRocket(fastMoves, chargedMoves, input);

  const combos: Array<{
    fast: MoveWithPvp;
    charged: MoveWithPvp;
    raid: number;
    pvp: number;
  }> = [];

  for (const fast of fastMoves) {
    for (const charged of chargedMoves) {
      combos.push({
        fast,
        charged,
        raid: raidScore(fast, charged, input),
        pvp: pvpScore(fast, charged, input),
      });
    }
  }

  if (combos.length === 0) return [];

  const maxRaid = Math.max(...combos.map((c) => c.raid), 1);
  const maxPvp = Math.max(...combos.map((c) => c.pvp), 1);

  return combos
    .map((c) => {
      const raid = c.raid / maxRaid;
      const pvp = c.pvp / maxPvp;
      const score = context === "raid" ? raid : context === "pvp" ? pvp : Math.min(raid, pvp);

      return {
        fast: c.fast,
        charged: c.charged,
        score,
        needsElite: Boolean(c.fast.elite) || Boolean(c.charged.elite),
        isFrustration: Boolean(c.charged.frustration),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Rocket ranqueia TRIOS, porque a isca faz parte da resposta.
 *
 * O segundo golpe carregado custa doce e poeira, entao a recomendacao precisa
 * dizer qual e a isca e nao so "use estes dois". Quando os dois campos vem
 * iguais, e porque o Pokemon so tem um carregado — e ai a isca e ele mesmo.
 */
function rankForRocket(
  fastMoves: readonly MoveWithPvp[],
  chargedMoves: readonly MoveWithPvp[],
  input: ScoreInput,
): Moveset[] {
  const combos: Array<{
    fast: MoveWithPvp;
    bait: MoveWithPvp;
    closer: MoveWithPvp;
    score: number;
  }> = [];

  for (const fast of fastMoves) {
    for (const closer of chargedMoves) {
      for (const bait of chargedMoves) {
        combos.push({ fast, bait, closer, score: rocketScore(fast, bait, closer, input) });
      }
    }
  }

  if (combos.length === 0) return [];
  const max = Math.max(...combos.map((c) => c.score), 1);

  const ranked = combos
    .map((c) => ({
      fast: c.fast,
      charged: c.closer,
      bait: c.bait.id === c.closer.id ? null : c.bait,
      score: c.score / max,
      needsElite: Boolean(c.fast.elite) || Boolean(c.closer.elite) || Boolean(c.bait.elite),
      isFrustration: Boolean(c.closer.frustration) || Boolean(c.bait.frustration),
    }))
    .sort((a, b) => b.score - a.score);

  // So a MELHOR isca de cada dupla rapido+finalizador.
  //
  // Sem isto a lista vira cinco linhas de "Counter + Close Combat" variando so
  // a isca, com notas quase iguais. Quem le nao esta escolhendo entre iscas —
  // esta escolhendo o conjunto. A isca e detalhe da resposta, nao alternativa.
  const seen = new Set<string>();
  return ranked.filter((m) => {
    const key = `${m.fast.id}/${m.charged.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * O golpe carregado que todo sombroso carrega ate um evento deixar troca-lo.
 *
 * Nao vem no moveset da especie no GAME_MASTER — o jogo o adiciona em tempo de
 * execucao a qualquer sombroso —, entao a lista de golpes precisa injeta-lo
 * quando o jogador diz que o Pokemon dele e sombroso. Sem isso o app mostraria
 * o moveset ideal de um Pokemon que nao pode usa-lo.
 *
 * `null` quando o dataset nao traz a Frustracao, para nao inventar um golpe.
 */
export function withFrustration(
  chargedMoves: readonly MoveWithPvp[],
  frustration: MoveWithPvp | null,
): MoveWithPvp[] {
  if (!frustration) return [...chargedMoves];
  return [{ ...frustration, frustration: true }, ...chargedMoves];
}

/**
 * Quanto um sombroso bate a mais.
 *
 * Existe como numero separado, e nao embutido na nota, porque o bonus e
 * UNIFORME: multiplicar todos os golpes por 1,2 nao muda qual e o melhor. A
 * nota compara movesets entre si, entao ela ficaria identica e o app estaria
 * fingindo que calculou algo. O que muda de verdade e o dano absoluto — e a
 * Frustracao ocupando o slot.
 */
export function shadowDamageMultiplier(settings: {
  shadowPokemonAttackBonusMultiplier: number;
}): number {
  return settings.shadowPokemonAttackBonusMultiplier;
}

/**
 * Chaves de traducao de cada contexto. Nao sao os rotulos: eles dependem do
 * idioma e moram no dicionario da interface.
 */
export const CONTEXT_KEYS: Record<Context, { title: string; detail: string }> = {
  general: { title: "context.general.title", detail: "context.general.detail" },
  raid: { title: "context.raid.title", detail: "context.raid.detail" },
  pvp: { title: "context.pvp.title", detail: "context.pvp.detail" },
  rocket: { title: "context.rocket.title", detail: "context.rocket.detail" },
};

/**
 * Contextos que dao EXATAMENTE a mesma recomendacao, agrupados.
 *
 * O Miguel: "tem alguns pokemon, tipo o eternatus, que sla, raide, pra tudo e
 * pvp sao iguais, so muda pra rocket. entao, daria pra unificar todos q sao
 * iguais. pra n deixar diversos botoes, que no final sao exatamente iguais".
 *
 * Ele descreveu uma questao de interface, mas a decisao e de DADO: so o core
 * sabe se dois contextos coincidem, e isso muda de especie pra especie. O
 * Eternatus tem um golpe carregado que domina em qualquer criterio, entao
 * "raide", "PvP" e "tudo" devolvem a mesma lista; um Pokemon com um carregado
 * barato e um caro devolve listas diferentes e precisa dos tres botoes.
 *
 * Quatro botoes que respondem a mesma coisa nao sao quatro opcoes — sao quatro
 * chances de a pessoa achar que perdeu alguma coisa ao nao clicar em todos.
 *
 * A COMPARACAO E PELA RECOMENDACAO — o PRIMEIRO conjunto, e nao a lista inteira.
 *
 * ⚠️ Isto e uma correcao, e a versao anterior comparava as cinco linhas.
 *
 * "vc nao unificou os melhores ataques de todos os pokemons. lembra q te pedi?
 * as vezes para tudo, raide pvp sao iguais, e so rocket é diferente."
 *
 * A regra existia e rodava nas 2.464 espécies — so que quase nunca unificava:
 * medido, 90% continuavam com tres ou quatro botoes, e o Venusaur (o que ele
 * abriu) com quatro. Comparando so o primeiro colocado, 44% caem pra um ou dois
 * botoes. A diferenca inteira estava na CAUDA: os contextos concordam sobre qual
 * e o melhor e discordam sobre a ordem do quarto e do quinto.
 *
 * Quatro botoes por causa da ordem do quinto lugar e exatamente o defeito que
 * esta funcao existe pra tirar. O titulo da secao e "melhores ataques", e a
 * resposta que a pessoa veio buscar e a primeira linha.
 *
 * ⚠️ E o que se PERDE ao unificar fica dito, nao escondido: quando os contextos
 * de um grupo concordam so no primeiro, `mesmaLista` vem `false`, e a tela avisa
 * que a ordem das alternativas segue o primeiro contexto do grupo. Unificar sem
 * dizer isso seria trocar quatro botoes redundantes por uma lista que mente para
 * tres dos quatro contextos.
 *
 * Identidade de GOLPE, nunca de nota: a nota so ordena dentro do proprio
 * contexto e nunca aparece pro usuario. Comparar nota separaria contextos
 * identicos por causa de uma casa decimal que ninguem ve.
 *
 * `bait` entra na chave porque no Rocket ele MUDA a jogada: mesmo par de golpes
 * com iscas diferentes sao recomendacoes diferentes.
 */
const CONTEXT_ORDER: readonly Context[] = ["general", "raid", "pvp", "rocket"];

function assinatura(m: Moveset | undefined): string {
  if (!m) return "-";
  return `${m.fast.id}>${m.charged.id}${m.bait ? `+${m.bait.id}` : ""}`;
}

/** A chave de agrupamento: so o primeiro colocado. Ver a nota acima. */
function chaveDaRecomendacao(sets: readonly Moveset[]): string {
  return assinatura(sets[0]);
}

/** A lista inteira, pra saber se o grupo concorda ate o fim ou so no topo. */
function chaveDaLista(sets: readonly Moveset[]): string {
  return sets.map(assinatura).join("|");
}

export interface ContextGroup {
  /** Os contextos que compartilham esta recomendacao, na ordem canonica. */
  contexts: Context[];
  /**
   * A lista mostrada. Vem do PRIMEIRO contexto do grupo, na ordem canonica —
   * "Tudo" quando ele esta no grupo, que e o criterio mais neutro dos quatro.
   */
  movesets: Moveset[];
  /**
   * `true` quando todos os contextos do grupo dao a lista INTEIRA igual.
   *
   * `false` quando eles concordam sobre o melhor e divergem nas alternativas —
   * e ai a tela tem que dizer de quem e a ordem que esta sendo mostrada. Sem
   * isso a unificacao viraria uma afirmacao falsa sobre tres dos quatro
   * contextos, que e pior que o botao a mais.
   */
  mesmaLista: boolean;
}

/**
 * Roda os quatro contextos e junta os que recomendam o mesmo conjunto.
 *
 * Devolve sempre pelo menos um grupo. Quando os quatro coincidem, e um grupo so
 * — e ai a tela nem precisa desenhar seletor.
 */
export function groupIdenticalContexts(
  fastMoves: readonly MoveWithPvp[],
  chargedMoves: readonly MoveWithPvp[],
  input: ScoreInput,
): ContextGroup[] {
  const grupos: ContextGroup[] = [];
  const porChave = new Map<string, ContextGroup>();
  /* A lista inteira de cada grupo, pra decidir `mesmaLista` sem guardar quatro
     rankings vivos depois que a funcao devolve. */
  const listaDoGrupo = new Map<ContextGroup, string>();

  for (const context of CONTEXT_ORDER) {
    const movesets = rankMovesets(fastMoves, chargedMoves, context, input);
    const chave = chaveDaRecomendacao(movesets);

    const existente = porChave.get(chave);
    if (existente) {
      existente.contexts.push(context);
      if (listaDoGrupo.get(existente) !== chaveDaLista(movesets)) existente.mesmaLista = false;
      continue;
    }

    const novo: ContextGroup = { contexts: [context], movesets, mesmaLista: true };
    porChave.set(chave, novo);
    listaDoGrupo.set(novo, chaveDaLista(movesets));
    grupos.push(novo);
  }

  return grupos;
}
