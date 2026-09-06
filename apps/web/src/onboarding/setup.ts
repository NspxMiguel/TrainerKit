import { useSyncExternalStore } from "react";

import {
  TRAINER_LEVELS,
  nivelValido,
  tetoDePowerUp,
  type TrainerLevel,
  type UsageMode,
} from "@trainerkit/core";

/*
 * RE-EXPORTED, not re-declared.
 *
 * `TRAINER_LEVELS` and `tetoDePowerUp` moved to `packages/core` when the native
 * app grew its own first run — see the note there. They keep being reachable
 * from this path because nine screens import them from here, and a move that
 * touches nine files to gain nothing is a move that only adds risk.
 */
export { TRAINER_LEVELS, tetoDePowerUp };
export type { TrainerLevel, UsageMode };

export interface Setup {
  /** `false` ate a pessoa concluir a primeira configuracao. */
  done: boolean;
  mode: UsageMode;
  /** Liga o assistente que opina sobre os especie. */
  assistant: boolean;
  /**
   * Como a pessoa quer ser chamada. Vazio e valido — quem nao quiser dizer o
   * nome ve so a saudacao, e nada no app depende disto.
   */
  name: string;
  /**
   * Nivel do TREINADOR, e nao da especie.
   *
   * Ele existe porque o teto de power-up do jogo e `nivel do treinador + 2`.
   * Ver `tetoDePowerUp`, que e onde isso vira consequencia.
   */
  level: TrainerLevel;
}

const KEY = "tk:setup";

export const DEFAULT_SETUP: Setup = {
  done: false,
  mode: "consulta",
  assistant: true,
  name: "",
  /*
   * ⚠️ 50, e nao 20, e a diferenca importa pra quem JA usa o app.
   *
   * Quem instalou antes desta versao nao tem `level` gravado, e o `??` abaixo
   * decide o que o app passa a achar dessas pessoas. Cair em 20 mudaria o
   * veredito de toda a colecao ja cadastrada, de uma atualizacao pra outra, sem
   * ninguem ter pedido — especie que diziam "Investir" passariam a dizer
   * "Guardar" porque o app resolveu sozinho que o dono e iniciante.
   *
   * 50 e exatamente o que o app assumia antes de este campo existir. Quem
   * atualiza nao ve veredito nenhum mudar; quem passa pelo setup escolhe.
   */
  level: 50,
};

function read(): Setup {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETUP;
    const parsed = JSON.parse(raw) as Partial<Setup>;
    return {
      done: parsed.done ?? false,
      mode: parsed.mode === "colecao" ? "colecao" : "consulta",
      assistant: parsed.assistant ?? true,
      name: typeof parsed.name === "string" ? parsed.name : "",
      level: nivelValido(parsed.level, DEFAULT_SETUP.level),
    };
  } catch {
    return DEFAULT_SETUP;
  }
}

let current = read();
const listeners = new Set<() => void>();

export function getSetup(): Setup {
  return current;
}

export function updateSetup(next: Partial<Setup>): void {
  current = { ...current, ...next };
  /*
   * ⚠️ `setItem` LANCA no Safari privado e com a cota cheia, e este e o
   * onboarding: a excecao subia na primeira tela do app, ao escolher idioma ou
   * modo, e derrubava tudo antes de qualquer coisa aparecer.
   *
   * O `read()` logo acima ja tratava — so a gravacao estava descoberta. A
   * preferencia nao persistida vale mais que app quebrado: `current` continua
   * certo em memoria e a sessao inteira funciona, so nao sobrevive ao
   * fechamento.
   */
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ver acima */
  }
  for (const fn of listeners) fn();
}

export function useSetup(): Setup {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSetup,
    () => DEFAULT_SETUP,
  );
}
