/**
 * Auditoria do que sai publicado.
 *
 * Roda depois do build e falha o CI se algo que nao deveria ser distribuido
 * entrou no `dist`. Existe porque a diferenca entre este projeto e um problema
 * juridico e exatamente esta: o app APONTA para arte de terceiros, buscada no
 * aparelho de quem ligou a fonte, e nunca a REDISTRIBUI.
 *
 * Um sprite commitado por engano transformaria o repositorio em redistribuicao,
 * que e coisa completamente diferente do ponto de vista legal. Um humano
 * esquece; um teste no caminho do deploy nao.
 *
 * O que e permitido esta na lista branca e cada item tem motivo escrito.
 */
import { readdir, stat } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "..", "dist");

/**
 * Imagens que PODEM ser publicadas.
 *
 * Todas sao arte propria, geradas por `scripts/make-icons.ts` a partir dos
 * tokens do app: quadrado arredondado com o gradiente da marca e as tres barras.
 * Nao ha nenhuma imagem de Pokemon aqui, e nao pode haver.
 */
const ALLOWED_IMAGES = new Set([
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "apple-touch-icon.png",
  "favicon-32.png",
  "favicon-16.png",
]);

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp"]);

/** Nomes que denunciam sprite de Pokemon, mesmo com extensao inocente. */
const SUSPECT = /pokemon|sprite|pokeapi|pogo_assets|artwork|serebii|pokemondb/i;

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    if ((await stat(full)).isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const problems: string[] = [];
const files = await walk(DIST);

for (const file of files) {
  const rel = relative(DIST, file);
  const name = rel.split("/").pop() ?? rel;

  if (IMAGE_EXT.has(extname(name).toLowerCase()) && !ALLOWED_IMAGES.has(name)) {
    problems.push(`imagem nao autorizada no bundle: ${rel}`);
  }

  if (SUSPECT.test(rel) && !rel.endsWith(".js") && !rel.endsWith(".json")) {
    problems.push(`caminho suspeito de arte de terceiros: ${rel}`);
  }
}

// O dataset e dado transformado, nao arte — mas se ele sumir, o app publica
// quebrado, e vale falhar aqui em vez de descobrir em producao.
if (!files.some((f) => f.endsWith("dataset/gamedata.json"))) {
  problems.push("o dataset nao esta no bundle: o app abriria sem conseguir calcular nada");
}

if (problems.length > 0) {
  console.error("\n  AUDITORIA FALHOU\n");
  for (const p of problems) console.error(`   ✗ ${p}`);
  console.error("");
  process.exit(1);
}

const images = files.filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()));
console.log(
  `  auditoria ok: ${files.length} arquivos, ${images.length} imagens (todas arte propria)`,
);
