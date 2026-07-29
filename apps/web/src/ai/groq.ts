import { useSyncExternalStore } from "react";

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
 * O que o modelo pode e nao pode fazer.
 *
 * A proibicao de imagem nao e zelo excessivo: gerar arte de Pokemon a pedido
 * transformaria quem publica o app em DISTRIBUIDOR dessa arte, que e
 * exatamente o risco que o projeto inteiro foi desenhado pra evitar. Como aqui
 * o modelo so devolve texto, a regra e barata — mas fica escrita porque um dia
 * alguem vai querer trocar por um modelo multimodal.
 */
const SYSTEM = `Você é o assistente do TrainerKit, um app de Pokémon GO.

Você NÃO analisa Pokémon. O app já calculou tudo e vai te entregar o veredito
pronto com as regras que levaram a ele. Seu único trabalho é transformar esses
dados em duas ou três frases naturais, no idioma pedido.

Regras rígidas:
- Nunca contradiga os números que receber. Se o veredito diz "transferir", você
  explica por que transferir.
- Nunca invente números, posições, movesets ou mecânicas que não vieram nos
  dados.
- Não gere, descreva nem ofereça imagens.
- Seja direto. Nada de saudação, nada de "espero ter ajudado".
- No máximo 3 frases curtas.`;

export interface ExplainInput {
  language: string;
  species: string;
  action: string;
  confidence: number;
  reason: string;
  signals: Array<{ rule: string; weight: number; because: string }>;
  ivTotal: number;
  cp: number | null;
}

/**
 * Pede ao modelo que explique o veredito.
 *
 * Lanca em erro de rede ou chave invalida — quem chama decide o que mostrar. O
 * app continua inteiro sem isto: a explicacao por regras ja esta na tela, e o
 * modelo so a deixa mais fluida.
 */
export async function explainVerdict(
  input: ExplainInput,
  signal?: AbortSignal,
): Promise<string> {
  if (!apiKey) throw new Error("sem chave");

  const body = {
    model,
    temperature: 0.4,
    max_tokens: 220,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          `Idioma da resposta: ${input.language}`,
          `Pokémon: ${input.species}`,
          `IV: ${input.ivTotal} de 45${input.cp === null ? "" : ` · PC ${input.cp}`}`,
          `Veredito: ${input.action} (confiança ${Math.round(input.confidence * 100)}%)`,
          `Motivo principal: ${input.reason}`,
          "Regras que pesaram:",
          ...input.signals.map((s) => `- ${s.rule} (peso ${s.weight.toFixed(2)}): ${s.because}`),
        ].join("\n"),
      },
    ],
  };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
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
