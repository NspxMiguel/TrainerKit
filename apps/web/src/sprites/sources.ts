import Dexie, { type Table } from "dexie";
import { unzip } from "fflate";

/**
 * Fontes de imagem — modelo Hydra.
 *
 * O app nao hospeda nem embarca arte nenhuma. Em vez disso ele aceita
 * **fontes**: um endereco que descreve onde as imagens estao, ou um .zip com
 * elas dentro. Voce cola o link (ou solta o arquivo) e tudo aparece.
 *
 * Isso resolve duas coisas de uma vez: o que se distribui continua sendo so
 * codigo e numeros, e quem usa nao fica preso ao que EU escolhi — d'a pra
 * apontar pra qualquer acervo, inclusive um pessoal, offline.
 *
 * Formato do manifesto (JSON):
 *
 * ```json
 * {
 *   "name": "Sprites clássicos",
 *   "version": 1,
 *   "template": "https://exemplo.com/sprites/{dex}.png",
 *   "images": { "machamp": "https://exemplo.com/especiais/machamp.png" }
 * }
 * ```
 *
 * `template` cobre o caso geral; `images` sobrescreve especie por especie e e
 * opcional. Um dos dois precisa existir.
 */

export interface SpriteManifest {
  name: string;
  version?: number;
  /** `{dex}` e `{id}` sao substituidos. */
  template?: string;
  /** Mapa explicito, por id de especie ou por dex. Vence o template. */
  images?: Record<string, string>;
}

export type SourceKind = "builtin" | "manifest" | "zip";

export interface SpriteSource {
  id: string;
  name: string;
  kind: SourceKind;
  /** Origem: URL do manifesto, ou nome do arquivo .zip. */
  origin: string;
  /** Quantas imagens vieram no zip. `null` para fontes por URL. */
  fileCount: number | null;
  addedAt: string;
  manifest?: SpriteManifest;
}

/** Arquivo de imagem guardado localmente, vindo de um .zip. */
interface StoredImage {
  /** `${sourceId}:${key}` — key e o nome do arquivo sem extensao. */
  id: string;
  sourceId: string;
  key: string;
  blob: Blob;
}

class SpriteDb extends Dexie {
  sources!: Table<SpriteSource, string>;
  images!: Table<StoredImage, string>;

  constructor() {
    super("trainerkit-sprites");
    this.version(1).stores({
      sources: "id, kind",
      images: "id, sourceId",
    });
  }
}

const db = new SpriteDb();

// --------------------------------------------------------------- manifestos

/**
 * Valida o manifesto antes de aceitar.
 *
 * Uma fonte quebrada precisa falhar AQUI, com mensagem, e nao virar mil tiles
 * vazios depois sem o usuario entender por que.
 */
export function parseManifest(raw: unknown): SpriteManifest {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("O arquivo não é um objeto JSON.");
  }
  const m = raw as Record<string, unknown>;

  if (typeof m.name !== "string" || m.name.trim() === "") {
    throw new Error('O manifesto precisa de um campo "name".');
  }

  const hasTemplate = typeof m.template === "string" && m.template.includes("{");
  const hasImages =
    typeof m.images === "object" && m.images !== null && Object.keys(m.images).length > 0;

  if (!hasTemplate && !hasImages) {
    throw new Error(
      'O manifesto precisa de "template" (com {dex} ou {id}) ou de um mapa "images".',
    );
  }

  return {
    name: m.name.trim(),
    ...(typeof m.version === "number" ? { version: m.version } : {}),
    ...(hasTemplate ? { template: m.template as string } : {}),
    ...(hasImages ? { images: m.images as Record<string, string> } : {}),
  };
}

export async function addManifestSource(url: string): Promise<SpriteSource> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("O endereço precisa começar com http:// ou https://");
  }

  let raw: unknown;
  try {
    const res = await fetch(trimmed);
    if (!res.ok) throw new Error(`o servidor respondeu ${res.status}`);
    raw = await res.json();
  } catch (err) {
    throw new Error(
      `Não consegui ler o manifesto: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const manifest = parseManifest(raw);
  const source: SpriteSource = {
    id: crypto.randomUUID(),
    name: manifest.name,
    kind: "manifest",
    origin: trimmed,
    fileCount: manifest.images ? Object.keys(manifest.images).length : null,
    addedAt: new Date().toISOString(),
    manifest,
  };

  await db.sources.put(source);
  return source;
}

// --------------------------------------------------------------------- zips

/** Nome do arquivo dentro do zip, sem pasta nem extensao: `034.png` -> `034`. */
function zipKey(path: string): string | null {
  const file = path.split("/").pop() ?? "";
  const match = /^(.+)\.(png|jpg|jpeg|webp|gif)$/i.exec(file);
  if (!match) return null;
  return match[1]!.toLowerCase();
}

function mimeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/png";
}

/**
 * Importa um .zip de sprites.
 *
 * Aceita qualquer estrutura de pastas: so o nome do arquivo importa. Um zip com
 * `001.png ... 1025.png` casa por dex; um com `machamp.png` casa por id.
 */
export async function addZipSource(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<SpriteSource> {
  const buffer = new Uint8Array(await file.arrayBuffer());

  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(buffer, (err, data) => (err ? reject(err) : resolve(data)));
  });

  const paths = Object.keys(entries).filter((p) => zipKey(p) !== null);
  if (paths.length === 0) {
    throw new Error("Não achei nenhuma imagem no arquivo (.png, .jpg, .webp ou .gif).");
  }

  const sourceId = crypto.randomUUID();
  const rows: StoredImage[] = [];

  for (const [i, path] of paths.entries()) {
    const key = zipKey(path)!;
    const bytes = entries[path]!;
    rows.push({
      id: `${sourceId}:${key}`,
      sourceId,
      key,
      // `slice` desanexa a view do buffer grande do zip; sem isso o Blob
      // seguraria o arquivo inteiro na memoria por imagem.
      blob: new Blob([bytes.slice()], { type: mimeFor(path) }),
    });
    onProgress?.(i + 1, paths.length);
  }

  await db.images.bulkPut(rows);

  const source: SpriteSource = {
    id: sourceId,
    name: file.name.replace(/\.zip$/i, ""),
    kind: "zip",
    origin: file.name,
    fileCount: rows.length,
    addedAt: new Date().toISOString(),
  };
  await db.sources.put(source);
  return source;
}

// ------------------------------------------------------------------ leitura

export async function listSources(): Promise<SpriteSource[]> {
  return db.sources.orderBy("id").toArray();
}

export async function removeSource(id: string): Promise<void> {
  await db.images.where("sourceId").equals(id).delete();
  await db.sources.delete(id);
}

/** Resolve a imagem de uma especie numa fonte. */
export async function resolveFromSource(
  source: SpriteSource,
  keys: { dex: number; speciesId: string; spriteId: number | null },
): Promise<string | null> {
  if (source.kind === "zip") {
    // Tenta por id de especie, por dex com zeros a esquerda, e por dex cru.
    const candidates = [
      keys.speciesId,
      String(keys.dex).padStart(3, "0"),
      String(keys.dex),
      keys.spriteId !== null ? String(keys.spriteId) : null,
    ].filter((k): k is string => k !== null);

    for (const key of candidates) {
      const row = await db.images.get(`${source.id}:${key.toLowerCase()}`);
      if (row) return URL.createObjectURL(row.blob);
    }
    return null;
  }

  const manifest = source.manifest;
  if (!manifest) return null;

  const explicit =
    manifest.images?.[keys.speciesId] ??
    manifest.images?.[String(keys.dex)] ??
    manifest.images?.[String(keys.dex).padStart(3, "0")];
  if (explicit) return explicit;

  if (!manifest.template) return null;
  return manifest.template
    .replaceAll("{dex}", String(keys.dex))
    .replaceAll("{dex3}", String(keys.dex).padStart(3, "0"))
    .replaceAll("{id}", keys.speciesId)
    .replaceAll("{spriteId}", String(keys.spriteId ?? keys.dex));
}
