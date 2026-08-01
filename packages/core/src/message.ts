/**
 * Texto que o core produz, sem produzir texto.
 *
 * O core calcula em qualquer idioma e nao conhece nenhum. Antes ele devolvia
 * frase pronta em portugues — "e top 1 na Ultra League" — e isso amarrava a
 * matematica a um idioma: trocar de lingua no app deixava o veredito e o
 * assistente falando portugues no meio de uma tela em alemao.
 *
 * Agora ele devolve a CHAVE da frase e os numeros que entram nela. Quem monta a
 * frase e a interface, que sabe o idioma. A uniao `MessageKey` e fechada de
 * proposito: o dicionario da interface e tipado por ela, entao esquecer de
 * traduzir uma mensagem nova nao compila.
 */

export type MessageKey =
  // ---- veredito
  | "verdict.evolution.ready"
  | "verdict.evolution.pending"
  | "verdict.pvp.top"
  | "verdict.pvp.good"
  | "verdict.raid.attack"
  | "verdict.shadow.bonus"
  | "verdict.lucky.cost"
  /** A especie faz Gigantamax — lista fechada do GAME_MASTER, ver `dynamax.ts`. */
  | "verdict.gigantamax"
  /**
   * Sem IV informado, o app NAO decide — ele pede o IV.
   *
   * Quem entra pelo "eu tenho esse" nao informou IV nenhum. Decidir em cima dos
   * zeros que o tipo exige produziria "Transferir" com confianca cheia pra um
   * bicho que pode ser 100%.
   */
  | "verdict.needIv"
  | "verdict.iv.weak"
  | "verdict.species.weak"
  | "verdict.default"
  // ---- assistente: perfil da especie
  | "assistant.profile.hitsHard"
  | "assistant.profile.tanky"
  | "assistant.profile.weak"
  | "assistant.profile.attacker"
  | "assistant.profile.wall"
  | "assistant.profile.balanced"
  // ---- assistente: o Pokemon do dono
  | "assistant.iv.greatForLeague"
  | "assistant.iv.maxAttack"
  | "assistant.iv.attackHurtsCapped"
  | "assistant.iv.weak"
  // ---- assistente: evidencias
  | "assistant.evidence.baseAttack"
  | "assistant.evidence.defAndHp"
  | "assistant.evidence.hpAndDefVsAtk"
  | "assistant.evidence.allStats"
  | "assistant.evidence.atkVsBulk"
  | "assistant.evidence.rankOf4096"
  | "assistant.evidence.attackMax"
  | "assistant.evidence.attackAndRank"
  | "assistant.evidence.ivOutOf45"
  // ---- assistente: manchete
  | "assistant.headline.perfect"
  | "assistant.headline.topLeague"
  | "assistant.headline.weak"
  | "assistant.headline.plain"
  | "assistant.headline.speciesOnly"
  /*
   * ---- faxina
   *
   * Duas famílias, e a divisão não é organizacional: `solto.*` justifica uma
   * sugestão de transferir e `preso.*` justifica a RECUSA de sugerir. A segunda
   * é a que sustenta a confiança na primeira — é ela que responde "cadê o meu
   * sortudo?" antes que a pergunta vire desconfiança na lista inteira.
   */
  | "faxina.solto.duplicado"
  | "faxina.solto.melhorRuim"
  | "faxina.preso.meuMotivo"
  | "faxina.preso.semIv"
  | "faxina.preso.sortudo"
  | "faxina.preso.sombroso"
  | "faxina.preso.lendario"
  | "faxina.preso.desconhecida"
  | "faxina.preso.great"
  | "faxina.preso.ultra"
  | "faxina.preso.master"
  | "faxina.preso.raide"
  // ---- troca
  | "trade.yes"
  | "trade.no.alreadyGood"
  | "trade.no.species"
  | "trade.no.shadow"
  | "trade.no.traded";

export interface Message {
  key: MessageKey;
  params?: Record<string, string | number>;
}

/** Atalho, so pra deixar as regras curtas onde elas moram. */
export function msg(key: MessageKey, params?: Record<string, string | number>): Message {
  return params ? { key, params } : { key };
}
