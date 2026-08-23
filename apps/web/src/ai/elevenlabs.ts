/**
 * ElevenLabs: vozes reais, e de graca dentro de um teto.
 *
 * O requisito era voz que soasse humana sem custar nada. A resposta mais direta
 * pra isso e a propria ElevenLabs: o plano gratuito dela da
 * 10.000 creditos por mes, sem cartao, e o `eleven_multilingual_v2` fala
 * portugues de verdade — nao ingles pronunciando portugues.
 *
 * Dez mil creditos sao uns 10.000 caracteres. Uma ficha da Especies tem ~400,
 * entao da umas 25 fichas por mes. Pouco pra usar sempre, suficiente pra ouvir
 * como e — e a tela diz esse numero em vez de deixar a pessoa descobrir quando
 * acabar.
 *
 * POR QUE NAO RESOLVI COM O KOKORO: o Kokoro roda de graça no aparelho e seria
 * melhor em tudo, mas o `kokoro-js` so expoe vozes em ingles (ver a nota la). Pra
 * quem usa o app em portugues, ElevenLabs com chave propria e hoje o unico
 * caminho pra voz humana de verdade.
 *
 * ⚠️ O QUE EU NAO PUDE VERIFICAR: nao tenho chave da ElevenLabs, entao o nome do
 * modelo e os ids de voz vieram da documentacao publica e NAO foram testados
 * contra a API — diferente da Groq, que foi testada com chave de verdade.
 * Por isso este modulo falha BARULHENTO: o erro da ElevenLabs sobe
 * inteiro pra tela (ela diz qual voz e qual modelo valem) e a voz cai pro plano
 * seguinte. Nada fica mudo, e nada finge que funcionou.
 */

const KEY = "tk:11labs";
const VOICE_KEY = "tk:11labs-voz";

/**
 * Modelo multilingue. `flash` custa metade dos creditos e responde mais rapido;
 * pra ler uma ficha curta a diferenca de qualidade nao paga o dobro do consumo.
 */
const MODEL = "eleven_flash_v2_5";

/**
 * Vozes publicas da ElevenLabs.
 *
 * Ids da biblioteca padrao, que toda conta tem. NAO testados — se algum estiver
 * errado, a mensagem de erro da API diz e a tela mostra.
 */
export const ELEVEN_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel" },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh" },
  { id: "VR6AewLTigWG4xSOukaG", label: "Arnold" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam" },
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

export function getElevenKey(): string | null {
  return store.get(KEY);
}

export function setElevenKey(value: string | null): void {
  const limpa = value?.trim();
  store.set(KEY, limpa && limpa !== "" ? limpa : null);
}

export function getElevenVoice(): string {
  return store.get(VOICE_KEY) ?? ELEVEN_VOICES[0].id;
}

export function setElevenVoice(id: string): void {
  store.set(VOICE_KEY, id);
}

export function elevenAvailable(): boolean {
  return getElevenKey() !== null;
}

/**
 * Gera o audio e devolve um Blob de MP3.
 *
 * Nao toca nada: no iPhone o audio so pode comecar dentro de um gesto do
 * usuario, e essa regra e de quem tem o clique na mao.
 */
export async function elevenSynthesize(
  text: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const chave = getElevenKey();
  if (!chave) throw new Error("sem-chave");

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${getElevenVoice()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // A ElevenLabs usa cabecalho proprio, nao `Authorization: Bearer`.
        "xi-api-key": chave,
      },
      body: JSON.stringify({
        // Limite de 1.200 caracteres: a ficha inteira da ~400, e o plano
        // gratuito e por caractere — uma pergunta longa nao pode comer a cota
        // do mes numa tacada.
        text: text.slice(0, 1200),
        model_id: MODEL,
      }),
      ...(signal ? { signal } : {}),
    },
  );

  if (!res.ok) {
    // A mensagem sobe inteira: quando a voz ou o modelo estao errados, e ela que
    // diz quais valem, e eu nao pude conferir isso sem uma chave.
    const detalhe = await res.text().catch(() => "");
    throw new Error(`${res.status} ${detalhe.slice(0, 300)}`);
  }

  return res.blob();
}
