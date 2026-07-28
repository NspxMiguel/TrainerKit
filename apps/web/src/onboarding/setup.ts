import { useSyncExternalStore } from "react";

/**
 * Como a pessoa quer usar o app.
 *
 * A escolha existe porque as duas formas sao legitimas e exigem telas
 * diferentes. Quem so quer saber se um Pokemon presta nao deveria ser obrigado
 * a cadastrar colecao — e quem quer o veredito precisa cadastrar. Empurrar todo
 * mundo pro mesmo fluxo faria o app parecer burocratico pra metade das pessoas.
 */
export type UsageMode = "consulta" | "colecao";

export interface Setup {
  /** `false` ate a pessoa concluir a primeira configuracao. */
  done: boolean;
  mode: UsageMode;
  /** Liga o assistente que opina sobre os Pokemon. */
  assistant: boolean;
}

const KEY = "tk:setup";

export const DEFAULT_SETUP: Setup = {
  done: false,
  mode: "consulta",
  assistant: true,
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
  localStorage.setItem(KEY, JSON.stringify(current));
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
