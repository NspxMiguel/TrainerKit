import { msg, type Message } from "./message.js";
import type { BaseStats, IVs } from "./types.js";

/**
 * Vale trocar este?
 *
 * O pedido do Miguel, tres vezes: "Tag de trocar (IV melhor, chance de lucky,
 * bom pra bicho ruim de IV mas boa espécie)".
 *
 * A pergunta e diferente da do veredito, e por isso isto NAO virou uma quinta
 * acao de `decide()`. O veredito responde "o que eu faco com este?" e as
 * respostas se excluem: investir OU transferir. Trocar convive com todas —
 * um Dragonite de IV ruim pode ser guardado E trocado, e trocar so depende de
 * haver alguem do outro lado. E uma ETIQUETA, nao um destino.
 *
 * ── A mecanica em que isto se apoia ──────────────────────────────────────────
 *
 * Trocar SORTEIA os IV de novo, com um piso que depende da amizade. O piso e o
 * ponto inteiro: um bicho de 10/45 nao "melhora um pouco" numa troca, ele volta
 * a um sorteio cujo pior caso ja e melhor que ele.
 *
 *   amigo (piso 1) ....... cada stat sai de 1 a 15  → media 24/45
 *   melhor amigo (piso 5)  cada stat sai de 5 a 15  → media 30/45
 *   sortudo (piso 12) .... cada stat sai de 12 a 15 → media 40,5/45
 *
 * Os pisos de Great e Ultra Friend (2 e 3) existem e ficaram de fora de
 * proposito: eles caem entre os dois primeiros e nao mudam nenhuma decisao —
 * mostrar cinco linhas onde tres ja delimitam o resultado seria voltar a
 * "tacar dados na tela".
 *
 * ── O que a chance NAO diz ───────────────────────────────────────────────────
 *
 * Nao existe aqui nenhuma probabilidade de a troca SAIR sortuda. Ela depende de
 * quanto tempo os dois sao amigos, de serem Lucky Friends e de quando cada
 * Pokemon foi capturado — nada disso o app sabe, e chutar um numero seria
 * inventar precisao. O que se mostra e o CENARIO: se sair sortudo, e isto.
 */

/** Piso de IV por stat depois da troca. */
export type Piso = 1 | 5 | 12;

export interface ChanceTroca {
  piso: Piso;
  /** Media do IV total depois do sorteio, de 0 a 45. */
  media: number;
  /** Chance de o sorteio sair ESTRITAMENTE melhor que o IV de hoje, 0 a 1. */
  melhora: number;
}

export interface TradeInput {
  ivs: IVs;
  baseStats: BaseStats;
  /** Sortudo ja veio de uma troca — e o que impede uma segunda. */
  lucky?: boolean;
  /** Sombroso nao pode ser trocado enquanto for sombroso. */
  shadow?: boolean;
}

export interface TradeAdvice {
  /** Se a etiqueta deve aparecer. */
  vale: boolean;
  /** IV total de hoje, de 0 a 45. */
  atual: number;
  amigo: ChanceTroca;
  melhorAmigo: ChanceTroca;
  sortudo: ChanceTroca;
  /** A frase unica, como chave + numeros. Quem traduz e a interface. */
  motivo: Message;
}

const MAX_IV = 15;
const TOTAL_MAX = MAX_IV * 3;

/**
 * A distribuicao exata do IV total apos o sorteio.
 *
 * Tres stats independentes, uniformes de `piso` a 15. Sao no maximo 15³ = 3.375
 * combinacoes: da pra somar TODAS e ter o numero exato em microssegundos, sem
 * aproximacao e sem simulacao de Monte Carlo. Aproximar aqui seria trocar uma
 * conta trivial por um numero que ninguem consegue conferir.
 */
function distribuicao(piso: Piso): Map<number, number> {
  const faces = MAX_IV - piso + 1;
  const dist = new Map<number, number>();
  for (let a = piso; a <= MAX_IV; a++) {
    for (let d = piso; d <= MAX_IV; d++) {
      for (let h = piso; h <= MAX_IV; h++) {
        const t = a + d + h;
        dist.set(t, (dist.get(t) ?? 0) + 1);
      }
    }
  }
  const casos = faces ** 3;
  for (const [t, n] of dist) dist.set(t, n / casos);
  return dist;
}

const CACHE = new Map<Piso, Map<number, number>>();

function distCache(piso: Piso): Map<number, number> {
  let d = CACHE.get(piso);
  if (!d) {
    d = distribuicao(piso);
    CACHE.set(piso, d);
  }
  return d;
}

function chance(piso: Piso, atual: number): ChanceTroca {
  const dist = distCache(piso);
  let media = 0;
  let melhora = 0;
  for (const [total, p] of dist) {
    media += total * p;
    if (total > atual) melhora += p;
  }
  return { piso, media, melhora };
}

/**
 * A especie vale a pena ter?
 *
 * Mesmo criterio da regra `especie.fraca` do veredito, e de proposito: se as
 * duas telas discordarem sobre o que e um bicho ruim, o app fica dizendo
 * "transferir" de um lado e "vale trocar" do outro sobre o mesmo Pokemon.
 */
function especieBoa(base: BaseStats): boolean {
  return !(base.atk < 150 && base.def + base.hp < 300);
}

export function avaliarTroca(input: TradeInput): TradeAdvice {
  const atual = input.ivs.atk + input.ivs.def + input.ivs.hp;
  const amigo = chance(1, atual);
  const melhorAmigo = chance(5, atual);
  const sortudo = chance(12, atual);

  const base = { atual, amigo, melhorAmigo, sortudo };

  // Sombroso primeiro: nem entra na conta, e a pessoa precisa saber por que a
  // etiqueta nao apareceu num bicho que claramente pedia troca.
  if (input.shadow) {
    return { ...base, vale: false, motivo: msg("trade.no.shadow") };
  }
  // Sortudo ja veio de uma troca, e trocado nao se troca de novo.
  if (input.lucky) {
    return { ...base, vale: false, motivo: msg("trade.no.traded") };
  }
  if (!especieBoa(input.baseStats)) {
    return { ...base, vale: false, motivo: msg("trade.no.species") };
  }
  // Ja e bom: trocar aqui e apostar contra si mesmo. A media do piso 1 e 24/45,
  // entao qualquer coisa acima disso tem mais a perder que a ganhar.
  if (amigo.melhora < 0.5) {
    return { ...base, vale: false, motivo: msg("trade.no.alreadyGood", { atual }) };
  }

  return {
    ...base,
    vale: true,
    motivo: msg("trade.yes", {
      atual,
      chance: Math.round(amigo.melhora * 100),
      media: Math.round(amigo.media),
    }),
  };
}

export { TOTAL_MAX as IV_TOTAL_MAX };
