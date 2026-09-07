import { requireOptionalNativeModule } from "expo-modules-core";

import type { EventoAgenda } from "./agenda";

/**
 * A LIVE ACTIVITY do evento que esta rolando.
 *
 * ⚠️ ISTO NAO E NOTIFICACAO. A notificacao (`avisos.ts`) avisa que um evento VAI
 * comecar; a atividade fica na tela de bloqueio e na Ilha Dinamica ENQUANTO ele
 * acontece, contando quanto falta. Sao coisas diferentes e as duas existem.
 *
 * ⚠️ Uma so por vez, de proposito. O calendario tem sete eventos simultaneos num
 * fim de semana bom, e sete atividades na tela de bloqueio nao e recurso, e
 * lixo. Entra a que acaba PRIMEIRO — e a unica em que "quanto falta" ainda muda
 * a decisao de alguem.
 */

interface Ponte {
  iniciar(nome: string, cabecalho: string, cor: string, fimEmSegundos: number): Promise<string>;
  encerrar(): Promise<void>;
  suportado(): Promise<boolean>;
}

/*
 * A ponte nativa e OPCIONAL, e o modulo tem que carregar sem ela.
 *
 * O alvo da extensao so existe depois de um `expo prebuild`, e o app roda em
 * simulador e em Expo Go sem ele. Sem esta guarda, `import` desta linha
 * derrubaria toda tela que a importasse — inclusive a agenda, que e onde a
 * atividade nasce.
 */
const ponte = requireOptionalNativeModule<Ponte>("TKAtividade");

export function suportaAtividade(): boolean {
  return ponte != null;
}

function fimDe(e: EventoAgenda): number | null {
  if (!e.end) return null;
  const quando = Date.parse(e.end);
  return Number.isFinite(quando) ? quando : null;
}

/**
 * Poe na tela de bloqueio o evento em curso que acaba primeiro.
 *
 * Devolve o evento escolhido, ou `null` quando nao ha nada rolando — e nesse
 * caso encerra o que estivesse la, senao a atividade de ontem fica pra sempre.
 */
export async function acompanharEventoAtual(
  eventos: readonly EventoAgenda[],
  cor: string,
): Promise<EventoAgenda | null> {
  if (!ponte) return null;

  const agora = Date.now();
  const rolando = eventos
    .map((e) => ({ e, fim: fimDe(e) }))
    .filter((x): x is { e: EventoAgenda; fim: number } => x.fim !== null && x.fim > agora)
    .sort((a, b) => a.fim - b.fim);

  const escolhido = rolando[0];
  if (!escolhido) {
    await ponte.encerrar().catch(() => {});
    return null;
  }

  await ponte
    .iniciar(
      escolhido.e.name,
      escolhido.e.heading.toUpperCase(),
      cor,
      Math.round((escolhido.fim - agora) / 1000),
    )
    .catch(() => {});
  return escolhido.e;
}

export async function pararAtividade(): Promise<void> {
  await ponte?.encerrar().catch(() => {});
}
