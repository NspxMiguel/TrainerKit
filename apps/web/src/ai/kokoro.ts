import type { KokoroTTS } from "kokoro-js";

/**
 * Voz de verdade, rodando no aparelho, de graça.
 *
 * O requisito, refeito em tres rodadas: voz que soe humana, sem custar nada.
 *
 * O teto do caminho anterior era baixo: `SpeechSynthesis` usa a
 * voz do SISTEMA, e as vozes de sistema em portugues sao de uma geracao anterior
 * de sintese. Escolher a melhor delas (Luciana em vez de Eddy) foi um conserto
 * real, mas o melhor Luciana possivel ainda e Luciana.
 *
 * Kokoro e outra coisa: TTS neural de 82 milhoes de parametros, com voz que soa
 * humana, e roda inteiro no navegador via ONNX. Sem chave, sem conta, sem
 * servidor, sem custo.
 *
 * ⚠️ SO EM INGLES. Ver a nota em `KOKORO_VOICES` — o modelo tem vozes
 * brasileiras, a biblioteca nao as expoe, e eu so descobri testando a sintese.
 * Pra portugues o caminho e o `elevenlabs.ts`.
 *
 * O preco: 88 MB uma vez. Vinte vezes menos que o modelo de linguagem, e por
 * isso este download vale a pena mesmo pra quem nunca vai ligar a IA de texto.
 * Como em todo download deste app, o tamanho aparece ANTES e a pessoa aperta.
 *
 * Se qualquer coisa falhar — sem rede, sem memoria, navegador antigo — a voz do
 * sistema continua sendo o plano B. Nunca fica muda.
 */

/**
 * Quantizacao escolhida.
 *
 * `q8` = `model_quantized.onnx`, 88 MB. Eu tinha escrito `q8f16` (82 MB) olhando
 * a lista de arquivos do Hugging Face, mas a API tipada do `kokoro-js` so aceita
 * fp32/fp16/q8/q4/q4f16 — `q8f16` existe no repositorio e nao na biblioteca. Os
 * 6 MB de diferenca nao valem um `as unknown` pra furar a tipagem.
 */
const DTYPE = "q8" as const;

const MODELO = "onnx-community/Kokoro-82M-v1.0-ONNX";

/**
 * As vozes, e SO as que a biblioteca aceita.
 *
 * ⚠️ Eu quase enviei isto quebrado. O repositorio do Kokoro no Hugging Face TEM
 * vozes brasileiras — `pf_dora`, `pm_alex`, `pm_santa` — e eu montei a tabela
 * inteira em cima disso, com espanhol, frances, italiano e japones. Ao testar a
 * sintese de verdade:
 *
 *   Voice "pf_dora" not found. Should be one of: af_heart, af_alloy, …, bm_fable
 *
 * O `kokoro-js` 1.2.1 valida contra uma lista fixa que so tem ingles americano
 * (`af_`/`am_`) e britanico (`bf_`/`bm_`). Os arquivos das outras linguas estao
 * no modelo e a biblioteca nao os alcanca. Arquivo existir nao e recurso existir.
 *
 * Entao Kokoro serve o app EM INGLES. Pra portugues, ver `elevenlabs.ts`.
 */
export const KOKORO_VOICES: Record<string, ReadonlyArray<{ id: string; label: string }>> = {
  en: [
    { id: "af_heart", label: "Heart" },
    { id: "af_bella", label: "Bella" },
    { id: "af_nicole", label: "Nicole" },
    { id: "am_michael", label: "Michael" },
    { id: "am_puck", label: "Puck" },
    { id: "bf_emma", label: "Emma" },
    { id: "bm_george", label: "George" },
  ],
};

/**
 * Tamanho do primeiro download, pra tela avisar antes.
 *
 * 88 MB do modelo (`model_quantized.onnx`) mais o runtime ONNX em WebAssembly e
 * o JavaScript da biblioteca — medidos no build e na rede, nao estimados. Fica
 * arredondado pra CIMA de propósito: eu ja anunciei "879 MB" pra um download de
 * 1,7 GB neste app, e prefiro errar sobrando.
 */
export const KOKORO_MB = 95;

export function kokoroSupports(language: string): boolean {
  return (KOKORO_VOICES[language]?.length ?? 0) > 0;
}

export function kokoroVoicesFor(language: string): ReadonlyArray<{ id: string; label: string }> {
  return KOKORO_VOICES[language] ?? [];
}

export interface KokoroProgress {
  fraction: number | null;
  text: string;
}

let tts: KokoroTTS | null = null;
let carregando: Promise<KokoroTTS> | null = null;

const listeners = new Set<() => void>();

export function onKokoroChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit(): void {
  for (const fn of listeners) fn();
}

export function kokoroReady(): boolean {
  return tts !== null;
}

/**
 * Carrega o modelo, uma vez.
 *
 * `import()` dinamico pelo mesmo motivo do web-llm: sao megabytes de JavaScript
 * que ninguem que nao use a voz boa deveria baixar. Chamadas simultaneas
 * compartilham a promessa — sem isso, dois lugares pedindo voz ao mesmo tempo
 * iniciariam dois downloads de 82 MB.
 */
export async function ensureKokoro(
  onProgress?: (p: KokoroProgress) => void,
): Promise<KokoroTTS> {
  if (tts) return tts;
  if (carregando) return carregando;

  carregando = (async () => {
    const { KokoroTTS: Kokoro } = await import("kokoro-js");
    const criado = await Kokoro.from_pretrained(MODELO, {
      dtype: DTYPE,
      // `webgpu` quando existe: no telefone a diferenca e de segundos por frase.
      device: "gpu" in navigator ? "webgpu" : "wasm",
      progress_callback: (p) => {
        const info = p as { status?: string; progress?: number; file?: string };
        onProgress?.({
          fraction: typeof info.progress === "number" ? info.progress / 100 : null,
          text: info.file ? `${info.status ?? ""} ${info.file}`.trim() : (info.status ?? ""),
        });
      },
    });

    tts = criado;
    emit();
    return criado;
  })();

  try {
    return await carregando;
  } finally {
    carregando = null;
  }
}

/**
 * Gera o audio e devolve um Blob de WAV.
 *
 * Nao toca nada: no iPhone o audio so pode comecar dentro de um gesto do
 * usuario, e essa regra e de quem tem o clique na mao.
 */
export async function kokoroSynthesize(text: string, voice: string): Promise<Blob> {
  const motor = await ensureKokoro();
  // Limite de 1.000 caracteres: a ficha inteira da uns 400, e uma pergunta longa
  // nao pode virar meio minuto de sintese travando a tela.
  const audio = await motor.generate(text.slice(0, 1000), { voice: voice as never });
  return audio.toBlob();
}
