import * as Notifications from "expo-notifications";

import type { EventoAgenda } from "./agenda";

/**
 * AVISO DE EVENTO — local, e só local.
 *
 * ⚠️ NÃO É PUSH. Não há servidor, não há token de aparelho, não há conta: o
 * app agenda no próprio iOS um alarme para uma data que ele já conhece, porque
 * a lista de eventos já está baixada. Push exigiria um servidor guardando o
 * token de cada pessoa — exatamente o que a tela de Privacidade afirma que não
 * existe, e a afirmação vale mais que a notificação.
 *
 * Por isso ligar aviso **não** muda aquela tela: continua um host só recebendo
 * pedido do app, que é a lista de eventos que já era baixada de qualquer jeito.
 *
 * ── O que ele avisa, e o que não ────────────────────────────────────────────
 *
 * Avisa **quando o evento começa**, e nada mais. Não avisa que "vai começar em
 * 1 hora" e não avisa duas vezes: o calendário do jogo tem dezenas de eventos
 * por mês, e um app que dispara um aviso por evento vira app silenciado — que
 * é a mesma coisa que app sem aviso, só que pior, porque ninguém desliga o que
 * já ignorou.
 */

/** Prefixo do identificador, pra dar pra apagar só o que é nosso. */
const MARCA = "tk-evento:";

/**
 * Pede a permissão, e devolve se tem.
 *
 * ⚠️ Só pede quando a pessoa LIGA o aviso, nunca na abertura. Pedir permissão
 * antes de a pessoa saber o que o app faz é como se ganha um "não" definitivo:
 * o iOS só pergunta uma vez, e depois disso o caminho é Ajustes do sistema.
 */
export async function pedirPermissao(): Promise<boolean> {
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return true;
  if (!atual.canAskAgain) return false;
  const pedido = await Notifications.requestPermissionsAsync();
  return pedido.granted;
}

/** Apaga só os avisos deste app, sem tocar no que não é nosso. */
export async function limpar(): Promise<void> {
  const agendados = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    agendados
      .filter((n) => n.identifier.startsWith(MARCA))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * Reagenda tudo a partir da lista de eventos.
 *
 * ⚠️ APAGA ANTES DE AGENDAR. A lista muda quando a fonte atualiza — evento sai,
 * data muda — e agendar por cima deixaria aviso de evento que não existe mais.
 * Reconstruir é barato; reconciliar seria uma máquina de estado que não paga.
 *
 * Devolve quantos ficaram agendados, que é o que a tela mostra.
 */
export async function reagendar(eventos: readonly EventoAgenda[]): Promise<number> {
  await limpar();

  const agora = Date.now();
  let n = 0;
  for (const e of eventos) {
    if (!e.start) continue;
    const quando = new Date(e.start);
    /* Evento sem hora válida ou que já começou não vira alarme. */
    if (Number.isNaN(quando.getTime()) || quando.getTime() <= agora) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: `${MARCA}${e.eventID}`,
      content: { title: e.name, body: e.heading },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: quando },
    });
    n++;
    /* O iOS guarda 64 notificações locais por app e descarta o resto em
       silêncio. Parar em 60 deixa folga e evita que o app confie num aviso que
       o sistema nunca registrou. */
    if (n >= 60) break;
  }
  return n;
}
