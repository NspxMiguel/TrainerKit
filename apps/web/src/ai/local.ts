import type { MLCEngine } from "@mlc-ai/web-llm";

import type { ChatMessage } from "./provider.ts";

/**
 * O modelo rodando NO APARELHO.
 *
 * Existe porque a alternativa cobra: a Groq e barata mas exige chave, conta e
 * conexao, e o app inteiro foi desenhado pra nao depender de servidor nenhum.
 * Aqui a inferencia acontece na GPU do telefone, de graca, e offline depois do
 * primeiro download.
 *
 * O preco esta na primeira vez: o modelo tem centenas de megabytes e precisa ser
 * baixado. Por isso NADA aqui acontece sozinho — a tela pede, mostra o tamanho
 * antes, e mostra o progresso durante. Um app que come 900 MB do plano de dados
 * de alguem sem avisar e um app que se desinstala.
 *
 * Precisa de WebGPU: iOS 26+, Chrome/Android 121+, Chrome e Edge no desktop.
 * Onde nao tem, a tela diz e oferece a Groq.
 */

/**
 * Os modelos oferecidos, do menor pro maior.
 *
 * `vramMB` e o que o MLC declara precisar de memoria de video — e o numero que
 * decide se cabe no aparelho, nao o tamanho do arquivo. Um celular que tenta
 * carregar 2,3 GB numa aba simplesmente e morto pelo sistema, entao o padrao e o
 * de 1B: ele cabe em telefone e a tarefa aqui e curta (reescrever texto a partir
 * de dados que o app ja calculou), nao raciocinio pesado.
 */
export const LOCAL_MODELS = [
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B", vramMB: 879 },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 1.5B", vramMB: 1630 },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", label: "Llama 3.2 3B", vramMB: 2264 },
] as const;

export type LocalModelId = (typeof LOCAL_MODELS)[number]["id"];

export const DEFAULT_LOCAL_MODEL: LocalModelId = LOCAL_MODELS[0].id;

/** O navegador tem WebGPU? Sem isso nao ha como rodar modelo nenhum aqui. */
export function hasWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export interface LoadProgress {
  /** 0 a 1. O MLC nem sempre sabe o total, entao pode vir indefinido. */
  fraction: number | null;
  text: string;
}

let engine: MLCEngine | null = null;
let carregando: Promise<MLCEngine> | null = null;
let carregado: string | null = null;

/**
 * Carrega o motor, uma vez.
 *
 * O `import()` e dinamico de propósito: o web-llm tem alguns megabytes de
 * JavaScript e ninguem que nao use IA local deveria baixar isso. Assim o
 * empacotador poe tudo num pedaco separado, que so e buscado quando esta funcao
 * roda pela primeira vez.
 *
 * Chamadas simultaneas compartilham a MESMA promessa — sem isso, dois lugares da
 * tela pedindo resposta ao mesmo tempo iniciariam dois downloads de 900 MB.
 */
export async function ensureEngine(
  modelId: string,
  onProgress?: (p: LoadProgress) => void,
): Promise<MLCEngine> {
  if (!hasWebGPU()) throw new Error("sem-webgpu");

  // Trocou de modelo: o anterior tem que sair da memoria antes, senao dois
  // modelos disputam a GPU e o segundo falha por falta de memoria.
  if (engine && carregado !== modelId) {
    await engine.unload().catch(() => undefined);
    engine = null;
    carregado = null;
  }

  if (engine) return engine;
  if (carregando) return carregando;

  carregando = (async () => {
    const webllm = await import("@mlc-ai/web-llm");
    const criado = new webllm.MLCEngine({
      initProgressCallback: (report) => {
        onProgress?.({
          fraction: Number.isFinite(report.progress) ? report.progress : null,
          text: report.text,
        });
      },
    });
    await criado.reload(modelId);
    engine = criado;
    carregado = modelId;
    return criado;
  })();

  try {
    return await carregando;
  } finally {
    carregando = null;
  }
}

/** Ja esta na memoria e pronto pra responder sem download? */
export function engineReady(modelId: string): boolean {
  return engine !== null && carregado === modelId;
}

/** Descarrega o modelo da GPU. Usado ao desligar a IA local nos Ajustes. */
export async function unloadEngine(): Promise<void> {
  if (!engine) return;
  await engine.unload().catch(() => undefined);
  engine = null;
  carregado = null;
}

export async function localChat(
  modelId: string,
  messages: readonly ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const eng = await ensureEngine(modelId);

  const res = await eng.chat.completions.create({
    messages: messages as Array<{ role: "system" | "user" | "assistant"; content: string }>,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 320,
  });

  const texto = res.choices[0]?.message?.content?.trim();
  if (!texto) throw new Error("resposta vazia");
  return texto;
}
