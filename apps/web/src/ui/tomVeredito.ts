import type { Action } from "@trainerkit/core";

/**
 * A cor de cada veredito. UMA vez, para o app inteiro.
 *
 * ⚠️ Existiam TRÊS cópias desta tabela — home, coleção e cartão de veredito — e
 * duas estavam erradas. O mesmo Snorlax aparecia com o chip âmbar no destaque da
 * home e AZUL na lista "Meus", porque só a home tinha sido corrigida quando os
 * tokens do handoff entraram. Tabela duplicada não fica errada de uma vez: fica
 * errada aos poucos, e o sintoma é o app se contradizer sobre o mesmo Pokémon.
 *
 * ⚠️ E as duas cores que estavam erradas erravam com significado, não por
 * descuido de valor:
 *
 *   · "Guardar" saía AZUL (`--tk-info`) — a cor de informação, que no resto do
 *     app quer dizer "leia isto". Guardar não é um aviso, é a ausência de um.
 *
 *   · "Transferir" saía VERMELHO (`--tk-dang`) — a cor de perigo. Transferir um
 *     Pokémon não é erro nem risco: é a recomendação mais comum do app, sobre
 *     um bicho que não vale investimento. Pintar de vermelho transformava um
 *     conselho de rotina em alarme — e num app cuja tese é DECIDIR por você,
 *     assustar na decisão mais frequente é o pior lugar possível para errar o
 *     tom.
 *
 * Os valores vivem em `tokens.css` (`--tk-v-*`), com par claro e escuro medidos
 * para 4,5:1 nos dois temas.
 */
export const TOM_VEREDITO: Record<Action, string> = {
  investir: "var(--tk-v-investir)",
  evoluir: "var(--tk-v-evoluir)",
  guardar: "var(--tk-v-guardar)",
  transferir: "var(--tk-v-transferir)",
};

/** O tom de quem já cumpriu: neutro. Cor de veredito cobra; cumprido não cobra. */
export const TOM_FEITO = "var(--tk-text-3)";
