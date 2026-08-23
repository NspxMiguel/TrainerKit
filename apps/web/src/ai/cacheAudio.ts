/**
 * Áudio já gerado não se gera de novo.
 *
 * A ideia inicial era gerar o áudio novo e apagar os anteriores, pra economizar
 * cota.
 *
 * ⚠️ Apagar não economiza nada, e a razão importa: a cota da ElevenLabs é
 * consumida na GERAÇÃO, por caractere sintetizado. O que já foi gerado já foi
 * cobrado — jogar o arquivo fora não devolve crédito, só faz a próxima vez
 * custar de novo.
 *
 * A economia é o oposto exato: GUARDAR. Reouvir a ficha do Blissey, ou dois
 * usuários pedindo a mesma ficha no mesmo aparelho, passa a custar zero. Numa
 * cota de ~50 leituras por mês, reler o mesmo bicho duas vezes já é 4% do mês.
 *
 * Vale pras três vozes de rede (neural, ElevenLabs compartilhada, ElevenLabs com
 * chave própria). Kokoro não precisa — roda no aparelho e já é de graça.
 *
 * Cache API e não IndexedDB porque o que se guarda É uma resposta HTTP com áudio,
 * e é pra isso que ela existe: o navegador já sabe versionar, expirar e devolver
 * `Blob` sem serialização no meio.
 */

const CACHE = "tk-voz-v1";

/**
 * Quantos áudios guardar.
 *
 * Uma ficha dá ~50 KB. 120 é uns 6 MB — nada perto da cota de armazenamento
 * (~60% do disco desde o iOS 17), e cobre navegar pela Especies a tarde inteira
 * sem repetir uma geração.
 */
const MAX_ITENS = 120;

/** Cache API não existe em contexto inseguro nem em navegador antigo. */
function disponivel(): boolean {
  return typeof caches !== "undefined" && typeof globalThis.crypto?.subtle !== "undefined";
}

/**
 * A chave: hash do motor + voz + texto.
 *
 * SHA-256 e não o texto cru porque a chave do Cache API é uma URL, e ficha de
 * Especies tem acento, quebra de linha e 400 caracteres. Hash dá uma chave curta,
 * estável e sem caractere problemático.
 *
 * O motor entra na chave: a mesma frase na Thalita e na Sarah são dois áudios, e
 * misturá-los faria o app tocar a voz errada depois de trocar nos Ajustes.
 */
async function chave(motor: string, voz: string, texto: string): Promise<string> {
  const dados = new TextEncoder().encode(`${motor}|${voz}|${texto}`);
  const buf = await crypto.subtle.digest("SHA-256", dados);
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `https://tk-voz.local/${motor}/${hex}`;
}

/** O áudio guardado, ou `null`. Nunca lança: cache é otimização, não caminho. */
export async function audioEmCache(
  motor: string,
  voz: string,
  texto: string,
): Promise<Blob | null> {
  if (!disponivel()) return null;
  try {
    const c = await caches.open(CACHE);
    const res = await c.match(await chave(motor, voz, texto));
    return res ? await res.blob() : null;
  } catch {
    return null;
  }
}

/**
 * Guarda, e apara a cauda quando passa do teto.
 *
 * A poda é por ORDEM DE INSERÇÃO — `keys()` devolve na ordem em que entraram,
 * então os primeiros são os mais antigos. Não é LRU de verdade (reouvir não
 * promove), e pra este uso não precisa ser: o que importa é o cache não crescer
 * sem limite.
 */
export async function guardarAudio(
  motor: string,
  voz: string,
  texto: string,
  blob: Blob,
): Promise<void> {
  if (!disponivel()) return;
  try {
    const c = await caches.open(CACHE);
    await c.put(
      await chave(motor, voz, texto),
      new Response(blob, { headers: { "Content-Type": blob.type || "audio/mpeg" } }),
    );

    const todas = await c.keys();
    if (todas.length > MAX_ITENS) {
      for (const velha of todas.slice(0, todas.length - MAX_ITENS)) {
        await c.delete(velha);
      }
    }
  } catch {
    /* sem cache o app continua inteiro — só gasta cota de novo */
  }
}

/** Esvazia. Usado pelo "apagar todos os dados do app". */
export async function limparCacheAudio(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(CACHE);
  } catch {
    /* idem */
  }
}
