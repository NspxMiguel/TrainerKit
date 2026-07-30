import { useSyncExternalStore } from "react";

import type { ChatMessage } from "./provider.ts";

/**
 * O assistente com modelo de linguagem.
 *
 * DESENHO CENTRAL: ele nao analisa Pokemon. Ele EXPLICA um veredito que o app
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
const MODEL_KEY = "tk:groq-modelo";

/**
 * Modelos que valem a pena aqui.
 *
 * A tarefa e reescrever texto curto a partir de dados estruturados — nao exige
 * raciocinio pesado, e latencia importa mais que capacidade. Por isso o padrao
 * e o menor: numa tela que ja tem a resposta pronta, um assistente que demora
 * tres segundos e pior que nao ter.
 */
export const GROQ_MODELS = [
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
] as const;

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
let model = store.get(MODEL_KEY) ?? GROQ_MODELS[0].id;
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
  return model;
}

export function setGroqModel(value: string): void {
  model = value;
  store.set(MODEL_KEY, value);
  emit();
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
  const snapshot = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => `${apiKey ?? ""}\u0000${model}`,
    () => `\u0000${GROQ_MODELS[0].id}`,
  );

  const [key, chosen] = snapshot.split("\u0000");
  return { key: key === "" ? null : (key ?? null), model: chosen ?? GROQ_MODELS[0].id };
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
