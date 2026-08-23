import { useSyncExternalStore } from "react";

import type { ChatMessage } from "./provider.ts";

/**
 * O assistente com modelo de linguagem.
 *
 * DESENHO CENTRAL: ele nao analisa especie. Ele EXPLICA um veredito que o app
 * ja calculou, com o rastro de regras na mao. Isso nao e limitacao tecnica, e o
 * que torna o recurso barato e confiavel ao mesmo tempo — um modelo que
 * recebesse so "Machamp 96%" inventaria a analise, e inventar e exatamente o
 * que este app nao faz. Aqui o numero vem do `verdict.ts`; o modelo so escolhe
 * as palavras.
 *
 * A chave e do usuario e fica no aparelho. Nao ha servidor no meio, nao ha
 * conta, e nao ha cobranca — quem paga a inferencia e quem a pediu, direto ao
 * provedor. Era a unica forma de ter isto sem virar um produto que precisa de
 * backend, autenticacao e politica de privacidade.
 */

const KEY = "tk:groq";

/**
 * O modelo, escolhido pelo app.
 *
 * "quem coloca key do groq n deve escolher modelo". Ele esta certo, e o motivo e
 * melhor que economia de tela: a pessoa NAO TEM COMO decidir isso. Ela nao sabe
 * qual responde melhor pra esta tarefa, e escolher errado piora o app sem ela
 * entender por que. Antes eram dois botoes e o padrao era o 8B.
 *
 * VERIFICADO no catalogo da conta via `/v1/models`: os dois existem. O
 * escolhido e o 70B — a tarefa e reescrever texto curto a partir de dados que o
 * app ja calculou, e ele erra menos nisso sem custo perceptivel de tempo.
 */
const MODEL = "llama-3.3-70b-versatile";

const store = {
  get(k: string): string | null {
    try {
      return globalThis.localStorage?.getItem(k) ?? null;
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null): void {
    try {
      if (v === null) globalThis.localStorage?.removeItem(k);
      else globalThis.localStorage?.setItem(k, v);
    } catch {
      /* preferencia nao persistida vale mais que app quebrado */
    }
  },
};

let apiKey = store.get(KEY);
const listeners = new Set<() => void>();
const emit = () => {
  for (const fn of listeners) fn();
};

export function getGroqKey(): string | null {
  return apiKey;
}

export function setGroqKey(value: string | null): void {
  apiKey = value && value.trim() !== "" ? value.trim() : null;
  store.set(KEY, apiKey);
  emit();
}

export function getGroqModel(): string {
  return MODEL;
}

/**
 * Chave e modelo, reagindo a mudanca.
 *
 * O snapshot e uma STRING, nao um objeto: `useSyncExternalStore` compara por
 * identidade, e devolver `{ key, model }` novo a cada chamada faria o React
 * re-renderizar pra sempre. A string e derivada, entao muda so quando o valor
 * muda de verdade.
 */
export function useGroq(): { key: string | null; model: string } {
  // O snapshot e so a chave agora: o modelo e constante, e um valor constante num
  // `useSyncExternalStore` nao muda nada — so daria trabalho de comparacao.
  const key = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => apiKey ?? "",
    () => "",
  );

  return { key: key === "" ? null : key, model: MODEL };
}

/**
 * Transporte da Groq. So isso.
 *
 * O que o modelo deve fazer (o `system`, as regras, o formato) NAO mora aqui —
 * mora em quem faz a pergunta, porque e a mesma pergunta quando o modelo roda no
 * aparelho. Sem essa separacao, ligar IA local exigiria duplicar cada prompt.
 */
export async function groqChat(
  apiKey: string,
  model: string,
  messages: readonly ChatMessage[],
  options: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 320,
      messages,
    }),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${detail.slice(0, 120)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("resposta vazia");
  return text;
}
