/**
 * DE ONDE VEM A IMAGEM DA ESPÉCIE — a parte que os dois apps compartilham.
 *
 * O app é distribuído **sem arte nenhuma** e funciona assim: o monograma
 * colorido não é "o modo sem imagem", é o estado de carga e o recurso de
 * qualquer espécie sem arquivo, em qualquer fonte. Ligar uma fonte é escolha de
 * quem instala, e por isso o padrão é `off`.
 *
 * ⚠️ Isto morava só em `apps/web/src/sprites/`, junto de mil linhas de
 * armazenamento offline, pré-carga e leitura de `.zip` — coisas que dependem de
 * IndexedDB e não atravessam pro nativo. O que atravessa é isto: qual é a URL.
 */

/** As fontes que vêm no app. O web ainda aceita `src:<uuid>` de .zip próprio. */
export type BuiltinSourceId = "off" | "pokeapi-artwork" | "pokeapi-home";

/** Chaves de tradução de cada fonte. O texto mora no dicionário. */
export const SPRITE_SOURCE_KEYS: Record<BuiltinSourceId, { title: string; detail: string }> = {
  off: { title: "sprites.none", detail: "sprites.noneDetail" },
  "pokeapi-artwork": { title: "sprites.official", detail: "sprites.officialDetail" },
  "pokeapi-home": { title: "sprites.home", detail: "sprites.homeDetail" },
};

const POKEAPI = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

export interface SpriteRequest {
  /**
   * Id do sprite resolvido no ETL contra o índice do PokeAPI. **Não é a dex**:
   * as formas regionais vivem na faixa 10000+ e não seguem fórmula (Rattata de
   * Alola é 10091, Raichu de Alola é 10100).
   */
  spriteId: number | null;
  shiny?: boolean;
}

/** URL da imagem, ou `null` quando a fonte está desligada ou não há arte. */
export function spriteUrl(req: SpriteRequest, source: BuiltinSourceId): string | null {
  if (source === "off" || req.spriteId === null) return null;
  const shiny = req.shiny ? "/shiny" : "";
  const pasta = source === "pokeapi-artwork" ? "other/official-artwork" : "other/home";
  return `${POKEAPI}/${pasta}${shiny}/${req.spriteId}.png`;
}

// ─────────────────────────────────────────────────────────── fonte própria

/**
 * O MANIFESTO DE UMA FONTE PRÓPRIA.
 *
 * O app não hospeda arte, e a lista de fontes embutidas é uma escolha minha —
 * que não precisa ser de quem usa. Um manifesto é um JSON com um endereço
 * modelo e, opcionalmente, o mapa espécie a espécie:
 *
 * ```json
 * {
 *   "name": "Meu acervo",
 *   "template": "https://exemplo.com/sprites/{dex}.png",
 *   "images": { "machamp": "https://exemplo.com/machamp.png" }
 * }
 * ```
 *
 * ⚠️ `images` VENCE o `template`, e aceita tanto o id da espécie quanto a dex
 * escrita como texto — quem monta o arquivo à mão usa um ou outro sem pensar,
 * e recusar metade dos arquivos por causa disso seria maldade gratuita.
 */
export interface SpriteManifest {
  name: string;
  version?: number;
  /** `{dex}`, `{id}` e `{spriteId}` são substituídos. */
  template?: string;
  /** Mapa explícito, por id de espécie ou por dex. Vence o `template`. */
  images?: Record<string, string>;
}

/**
 * O que deu errado numa fonte.
 *
 * ⚠️ Chave e não frase: o texto é lido por quem usa, então mora no dicionário
 * como o resto — devolver português daqui deixaria a tela em duas línguas para
 * quem estiver em japonês. `campo` existe porque "falta um campo" é bem pior
 * que "falta o campo cpm" para quem está montando a própria base.
 */
export interface ProblemaDaFonte {
  chave: string;
  campo?: string;
}

/** O manifesto serve? `null` quando está de pé. */
export function validarManifesto(valor: unknown): ProblemaDaFonte | null {
  if (typeof valor !== "object" || valor === null) return { chave: "source.err.notObject" };
  const m = valor as Record<string, unknown>;
  if (typeof m.name !== "string" || m.name.trim() === "") return { chave: "source.err.noName" };
  const temTemplate = typeof m.template === "string" && m.template.includes("{");
  const temImagens =
    typeof m.images === "object" && m.images !== null && Object.keys(m.images).length > 0;
  if (!temTemplate && !temImagens) return { chave: "source.err.noImages" };
  if (m.images !== undefined && (typeof m.images !== "object" || m.images === null)) {
    return { chave: "source.err.badImages" };
  }
  return null;
}

/** URL da imagem numa fonte própria, ou `null` quando aquela espécie não tem. */
export function manifestSpriteUrl(
  req: SpriteRequest & { id: string; dex: number },
  manifest: SpriteManifest,
): string | null {
  const direto = manifest.images?.[req.id] ?? manifest.images?.[String(req.dex)];
  if (typeof direto === "string" && direto !== "") return direto;
  if (!manifest.template) return null;
  return manifest.template
    .replaceAll("{dex}", String(req.dex))
    .replaceAll("{id}", req.id)
    .replaceAll("{spriteId}", String(req.spriteId ?? req.dex));
}

// ───────────────────────────────────────────────────── fonte de dados própria

/**
 * O ENDEREÇO SERVE? Devolve a chave do erro, ou `null`.
 *
 * ⚠️ `http://` a partir de uma página `https://` é bloqueado pelo navegador
 * como conteúdo misto, e o que chega ao app é um `TypeError: Failed to fetch` —
 * idêntico a "servidor fora do ar". Dizer qual dos dois é poupa meia hora de
 * quem estiver do outro lado. No app nativo não há página, então `paginaHttps`
 * chega `false` e a checagem some sozinha.
 */
export function checarUrl(url: string, paginaHttps: boolean): ProblemaDaFonte | null {
  const partes = partirUrl(url);
  if (!partes) return { chave: "source.err.badUrl" };
  if (partes.esquema !== "https" && partes.esquema !== "http") return { chave: "source.err.scheme" };
  const local = partes.host === "localhost" || partes.host === "127.0.0.1";
  if (partes.esquema === "http" && paginaHttps && !local) return { chave: "source.err.mixed" };
  return null;
}

/**
 * Esquema e host, sem `new URL`.
 *
 * ⚠️ E não é preciosismo: o `URL` do Hermes NÃO parseia endereço absoluto —
 * `new URL("https://exemplo.com/a.json")` lança, e o app nativo respondia
 * "endereço inválido" para um endereço perfeitamente válido. Medido no
 * simulador. O que o app precisa saber cabe num padrão: o esquema e o host.
 */
export function partirUrl(url: string): { esquema: string; host: string } | null {
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#\s]+)/.exec(url.trim());
  if (!m) return null;
  /* Fora o host pode vir `user:senha@host:porta` — o que interessa é o host. */
  const autoridade = (m[2] ?? "").split("@").pop() ?? "";
  const host = autoridade.startsWith("[")
    ? (autoridade.slice(0, autoridade.indexOf("]") + 1) || autoridade)
    : (autoridade.split(":")[0] ?? "");
  if (host === "") return null;
  return { esquema: (m[1] ?? "").toLowerCase(), host: host.toLowerCase() };
}

/**
 * O que voltou parece mesmo um dataset do TrainerKit?
 *
 * Sem isto, apontar para um JSON qualquer daria tela branca ou — pior — número
 * errado calculado sobre lixo. A checagem é do formato MÍNIMO de que o app
 * precisa: uma base própria pode legitimamente não trazer `rankings` ou
 * `moveNames`, e aí a tela some em vez de quebrar.
 */
export function validarDataset(valor: unknown): ProblemaDaFonte | null {
  if (typeof valor === "string") return { chave: "source.err.text" };
  if (typeof valor !== "object" || valor === null) return { chave: "source.err.notObject" };

  const d = valor as Record<string, unknown>;
  const exigidos: Array<[string, (v: unknown) => boolean]> = [
    ["cpm", (v) => Array.isArray(v) && v.length > 0 && typeof v[0] === "number"],
    ["species", (v) => Array.isArray(v) && v.length > 0],
    ["fastMoves", Array.isArray],
    ["chargedMoves", Array.isArray],
    ["typeChart", (v) => typeof v === "object" && v !== null],
    ["typeOrder", (v) => Array.isArray(v) && v.length === 18],
    ["settings", (v) => typeof v === "object" && v !== null],
    ["version", (v) => typeof v === "object" && v !== null],
  ];
  for (const [campo, ok] of exigidos) {
    if (!(campo in d)) return { chave: "source.err.missingField", campo };
    if (!ok(d[campo])) return { chave: "source.err.badField", campo };
  }
  const primeira = (d.species as unknown[])[0] as Record<string, unknown>;
  for (const campo of ["id", "name", "baseStats", "types"]) {
    if (!(campo in primeira)) return { chave: "source.err.badSpecies", campo };
  }
  return null;
}
