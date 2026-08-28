import type { BaseStats } from "./types.js";
import { ATK_ALTO, DEF_ALTO, HP_ALTO } from "./limiares.js";

/**
 * Dynamax, Gigantamax e as Batalhas Max.
 *
 * ⚠️ POR QUE ISTO NAO EXISTIA ATE AGORA ─────────────────────────────────────
 *
 * O plano registrava, desde julho, que "Dynamax / Gigantamax / Max Battles
 * apareceram nas fontes de 2026 e nunca foram investigados", com a observacao
 * certa de que "se o jogo ja tem, o motor de veredito esta ignorando uma
 * mecanica inteira".
 *
 * O jogo tem. E o motivo de a investigacao nunca ter saido do lugar e bobo e
 * util de registrar: **no GAME_MASTER a mecanica nao se chama Dynamax, se chama
 * BREAD**. Procurar "DYNAMAX" devolve um golpe do Eternatus e um par de luvas
 * de avatar — o suficiente pra alguem concluir com seguranca que a mecanica nao
 * chegou. Sao 209 templates, todos com prefixo `BREAD`. Gigantamax e
 * `SOURDOUGH`.
 *
 * ── A linha que este modulo NAO cruza ───────────────────────────────────────
 *
 * Nao existe, em lugar nenhum do GAME_MASTER, uma lista de "especies que podem
 * Dynamax". No jogo isso e propriedade do INDIVIDUO — vem de ter sido pego numa
 * Batalha Max — e nao da especie. O `breadTierGroup` existe em 2.450 das 2.466
 * especies e so responde "quanto custaria", nunca "pode".
 *
 * Entao o app fala de tres coisas, e cala nas outras:
 *
 *   1. Gigantamax: lista fechada e explicita. Fato duro.
 *   2. Custo de subir os Max Ataques: tabela por grupo. Fato duro.
 *   3. Papel numa Batalha Max: derivado dos stats base, do mesmo jeito que o
 *      app ja deriva papel de raide. E leitura, e a tela diz que e.
 *
 * O que ele nao faz e afirmar que uma especie da colecao "pode Dynamax". Ele nao
 * tem como saber, e um app que decide nao pode inventar a premissa.
 */

/** Como o dataset entrega o bloco. Campos opcionais: base de terceiro pode nao ter. */
export interface DadosDynamax {
  ligado: boolean;
  nivelMinimo: number | null;
  /** Ids de especie que fazem Gigantamax. Lista fechada do GAME_MASTER. */
  gigantamax: readonly string[];
  custoPorGrupo?: Record<string, GrupoDeCusto>;
}

/**
 * Os tres Max Ataques, e o custo de subir cada um do nivel 1 ao 3.
 *
 * `a` e o ataque (Max Attack, o dano), `b` e a guarda (Max Guard, reduz o dano
 * que o time toma) e `c` e o espirito (Max Spirit, que cura). Os nomes de uma
 * letra sao do GAME_MASTER, nao meus.
 */
export interface GrupoDeCusto {
  aSettings?: readonly DegrauDeCusto[];
  bSettings?: readonly DegrauDeCusto[];
  cSettings?: readonly DegrauDeCusto[];
}

export interface DegrauDeCusto {
  /** Particulas Max. Ausente nos grupos que cobram poeira em vez disso. */
  mpCost?: number;
  candyCost?: number;
  xlCandyCost?: number;
  stardustCost?: number;
  xpRewards?: number;
}

/** O que custa deixar UM Max Ataque no nivel 3, somando os degraus. */
export interface CustoDoMaxAtaque {
  particulas: number;
  doces: number;
  docesXL: number;
  poeira: number;
}

const ZERO: CustoDoMaxAtaque = { particulas: 0, doces: 0, docesXL: 0, poeira: 0 };

function somar(degraus: readonly DegrauDeCusto[] | undefined): CustoDoMaxAtaque {
  if (!degraus || degraus.length === 0) return ZERO;
  return degraus.reduce<CustoDoMaxAtaque>(
    (a, d) => ({
      particulas: a.particulas + (d.mpCost ?? 0),
      doces: a.doces + (d.candyCost ?? 0),
      docesXL: a.docesXL + (d.xlCandyCost ?? 0),
      poeira: a.poeira + (d.stardustCost ?? 0),
    }),
    ZERO,
  );
}

/**
 * Quanto custa subir os tres Max Ataques de uma especie ate o nivel 3.
 *
 * `null` quando o grupo e desconhecido — e ai a tela nao mostra custo nenhum,
 * que e melhor que mostrar zero. Zero e um numero; ausencia nao e.
 */
export function custoDosMaxAtaques(
  grupo: string | null | undefined,
  dados: DadosDynamax | undefined,
): { ataque: CustoDoMaxAtaque; guarda: CustoDoMaxAtaque; espirito: CustoDoMaxAtaque } | null {
  if (!grupo || !dados?.custoPorGrupo) return null;
  const g = dados.custoPorGrupo[grupo];
  if (!g) return null;
  return {
    ataque: somar(g.aSettings),
    guarda: somar(g.bSettings),
    espirito: somar(g.cSettings),
  };
}

/** A especie faz Gigantamax? Lista fechada — nao ha inferencia aqui. */
export function fazGigantamax(
  speciesId: string,
  dados: DadosDynamax | undefined,
): boolean {
  if (!dados?.gigantamax) return false;
  // Formas cosmeticas e regionais chegam como `charizard_normal`; a lista do
  // jogo guarda so `charizard`. Comparar o prefixo antes do primeiro `_` erra
  // pra menos em vez de pra mais, que e o lado certo pra errar.
  const base = speciesId.split("_")[0] ?? speciesId;
  return dados.gigantamax.includes(speciesId) || dados.gigantamax.includes(base);
}

/**
 * Que papel a especie faz numa Batalha Max.
 *
 * Batalha Max tem tres funcoes de verdade, e elas nao sao as de raide: quem
 * ataca precisa de ataque, quem segura o chefe precisa de defesa e PS, e quem
 * cura o time precisa sobreviver pra chegar a curar. Um time so de atacantes
 * perde, e e por isso que "o melhor de raide" nao responde esta pergunta.
 *
 * ⚠️ Isto e LEITURA, e derivada so dos stats base — nao ha ranking oficial
 * disso em lugar nenhum. A tela tem que dizer que e sugestao.
 */
export type PapelMax = "atacante" | "guarda" | "espirito" | "equilibrado";


export function papelNaBatalhaMax(base: BaseStats): PapelMax {
  const couro = base.def + base.hp;
  const couroAlto = DEF_ALTO + HP_ALTO;

  if (base.atk >= ATK_ALTO && couro < couroAlto) return "atacante";
  if (couro >= couroAlto && base.atk < ATK_ALTO) return "guarda";
  // Curar exige ficar vivo: PS alto pesa mais que defesa pro papel de espirito.
  if (base.hp >= HP_ALTO && base.atk < ATK_ALTO * 0.85) return "espirito";
  return "equilibrado";
}
