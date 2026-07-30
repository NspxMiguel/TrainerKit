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
 * O preco esta na primeira vez: o menor modelo passa de 1,7 GB de download —
 * medido, nao estimado. Por isso NADA aqui acontece sozinho: a tela pede, mostra
 * o tamanho antes, e mostra o progresso durante. Um app que come 1,7 GB do plano
 * de dados de alguem sem avisar e um app que se desinstala.
 *
 * E o resultado nao e o da Groq. Testado: o 1B respondeu "nao sabe qual e o
 * melhor pra raide sem saber a posicao nas ligas de PvP" — uma recusa confusa,
 * com os dados na mao. A tela avisa isso; prometer paridade seria mentira.
 *
 * Precisa de WebGPU: iOS 26+, Chrome/Android 121+, Chrome e Edge no desktop.
 * Onde nao tem, a tela diz e oferece a Groq.
 */

/**
 * Os modelos oferecidos, do menor pro maior.
 *
 * `vramMB` e o que o MLC declara precisar de MEMORIA DE VIDEO. Nao e o tamanho
 * do download, e eu ja errei isso: a tela dizia "Primeiro download: cerca de 879
 * MB" com esse numero, e ao baixar de verdade o 1B passou de 1.670 MB antes de
 * chegar a 96%. Quase o dobro do que estava escrito. Numero que engana e pior
 * que numero ausente, entao agora sao dois campos com nomes diferentes.
 *
 * `downloadMB` so existe onde eu MEDI. Nos outros e `null`, e a tela diz "mais
 * de 1 GB" em vez de inventar um valor.
 */
export const LOCAL_MODELS = [
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B", vramMB: 879, downloadMB: null },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 1.5B",
    vramMB: 1630,
    downloadMB: null,
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B",
    vramMB: 2264,
    /**
     * MEDIDO no navegador: 1.670 MB fetched a 96%, logo ~1,74 GB no total.
     *
     * Cuidado com esta anotacao: eu quase a coloquei na linha do 1B. O download
     * que eu observei rodou com o 3B selecionado, e atribuir o numero ao modelo
     * errado seria pior que nao ter numero — daria a entender que o menor pesa
     * 1,7 GB. Onde nao medi, fica `null` e a tela diz "mais de 1 GB".
     */
    downloadMB: 1740,
  },
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
 * Quem avisar quando o modelo terminar de carregar.
 *
 * Sem isto o resto do app nao tinha como saber que a IA local ficou pronta: as
 * telas perguntavam uma vez, na montagem, e nunca mais. O efeito pratico era a
 * caixa de pergunta aparecer com o modelo AINDA nao baixado — e a primeira
 * pergunta disparava 900 MB de download em silencio, sem barra e sem aviso.
 */
const listeners = new Set<() => void>();

export function onEngineChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit(): void {
  for (const fn of listeners) fn();
}

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
    emit();
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
    emit();
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
  emit();
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
