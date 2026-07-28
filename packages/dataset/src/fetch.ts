/**
 * Baixa o GAME_MASTER cru, mas so quando ele mudou de verdade.
 *
 * O timestamp.json tem 69 bytes e o GAME_MASTER tem 18 MB; comparar o batchId
 * antes evita puxar 18 MB a toa varias vezes por dia.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { GAME_MASTER_SOURCE, TIMESTAMP_SOURCE } from "./sources.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(HERE, "..", "raw");
const GM_PATH = join(RAW_DIR, "GAME_MASTER.json");
const STAMP_PATH = join(RAW_DIR, "timestamp.json");

interface Stamp {
  batchId: string;
  uploadTime: string;
}

async function readLocalStamp(): Promise<Stamp | null> {
  try {
    return JSON.parse(await readFile(STAMP_PATH, "utf8")) as Stamp;
  } catch {
    return null;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, { encoding: null, flag: "r" });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  await mkdir(RAW_DIR, { recursive: true });

  const remoteRes = await fetch(TIMESTAMP_SOURCE.url);
  if (!remoteRes.ok) {
    throw new Error(
      `timestamp.json respondeu ${remoteRes.status}. A fonte mudou de lugar? ` +
        `Confira ${TIMESTAMP_SOURCE.url}`,
    );
  }
  const remote = (await remoteRes.json()) as Stamp;
  const local = await readLocalStamp();

  const haveGm = await fileExists(GM_PATH);
  if (!force && haveGm && local?.batchId === remote.batchId) {
    console.log(`GAME_MASTER ja esta atualizado (batchId ${remote.batchId}).`);
    return;
  }

  console.log(
    local
      ? `batchId mudou: ${local.batchId} -> ${remote.batchId}. Baixando...`
      : `Primeira execucao. Baixando GAME_MASTER (batchId ${remote.batchId})...`,
  );

  const gmRes = await fetch(GAME_MASTER_SOURCE.url);
  if (!gmRes.ok) {
    throw new Error(`GAME_MASTER respondeu ${gmRes.status}`);
  }
  const body = await gmRes.text();

  // Valida antes de gravar: melhor manter o arquivo velho e bom do que
  // substitui-lo por HTML de erro que so vai quebrar no ETL.
  const parsed: unknown = JSON.parse(body);
  if (!Array.isArray(parsed) || parsed.length < 10_000) {
    throw new Error(
      `GAME_MASTER veio com formato inesperado (${
        Array.isArray(parsed) ? `${parsed.length} itens` : typeof parsed
      }). Nada foi gravado.`,
    );
  }

  await writeFile(GM_PATH, body);
  await writeFile(STAMP_PATH, JSON.stringify(remote, null, 2));
  console.log(
    `OK: ${parsed.length} templates, ${(body.length / 1_048_576).toFixed(1)} MB.`,
  );
}

await main();
