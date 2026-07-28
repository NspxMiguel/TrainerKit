/**
 * Transforma os 18 MB do GAME_MASTER cru no dataset compacto que o app carrega.
 *
 * Regra de ouro deste arquivo: **falhar alto**. Um campo que sumiu do
 * GAME_MASTER deve quebrar o build, nunca virar `undefined` que atravessa o app
 * e reaparece como veredito errado na tela do usuario.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(HERE, "..", "raw");
const OUT_DIR = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset");

/** O cap atual do jogo. Acima disso o GAME_MASTER so repete o ultimo CPM. */
const LEVEL_CAP = 55;

interface Template {
  templateId: string;
  data: Record<string, any>;
}

// ---------------------------------------------------------------- utilidades

function required<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(
      `campo obrigatorio ausente no GAME_MASTER: ${what}. ` +
        `O formato mudou — o ETL precisa ser revisto antes de gerar dataset.`,
    );
  }
  return value;
}

/** POKEMON_TYPE_FIGHTING -> fighting */
function normalizeType(raw: string): string {
  return raw.replace(/^POKEMON_TYPE_/, "").toLowerCase();
}

/** MACHAMP -> machamp ; RATTATA_ALOLA -> rattata_alola */
function normalizeId(raw: string): string {
  return raw.toLowerCase();
}

/** MACHAMP -> Machamp ; RATTATA_ALOLA -> Rattata (Alola) */
function displayName(pokemonId: string, templateSuffix: string): string {
  const base = pokemonId
    .toLowerCase()
    .replace(/(^|_)(\w)/g, (_, sep: string, ch: string) => (sep ? " " : "") + ch.toUpperCase());

  const form = templateSuffix.slice(pokemonId.length).replace(/^_/, "");
  if (!form || form === "NORMAL") return base;

  const prettyForm = form
    .toLowerCase()
    .replace(/(^|_)(\w)/g, (_, sep: string, ch: string) => (sep ? " " : "") + ch.toUpperCase());
  return `${base} (${prettyForm})`;
}

// ------------------------------------------------------------------ extracao

function extractCpm(templates: Template[]): number[] {
  const t = templates.find((x) => x.templateId === "PLAYER_LEVEL_SETTINGS");
  const raw = required(t?.data?.playerLevel?.cpMultiplier, "PLAYER_LEVEL_SETTINGS.cpMultiplier");
  if (!Array.isArray(raw) || raw.length < LEVEL_CAP) {
    throw new Error(`cpMultiplier tem ${raw?.length} entradas, esperava >= ${LEVEL_CAP}`);
  }

  // O array vem com padding: acima do cap o mesmo valor se repete. Cortamos no
  // cap real para nao sugerir que existe nivel 60.
  const trimmed = (raw as number[]).slice(0, LEVEL_CAP);
  const last = trimmed[LEVEL_CAP - 1];
  if (last !== 0.8653) {
    console.warn(
      `AVISO: CPM do nivel ${LEVEL_CAP} e ${last}, esperava 0.8653. ` +
        `O cap de nivel pode ter mudado — confira antes de confiar nos custos.`,
    );
  }
  return trimmed;
}

function extractTypeChart(templates: Template[]): Record<string, number[]> {
  const chart: Record<string, number[]> = {};
  for (const t of templates) {
    const eff = t.data?.typeEffective;
    if (!eff) continue;
    const attackType = required(eff.attackType, `${t.templateId}.typeEffective.attackType`);
    const scalar = required(eff.attackScalar, `${t.templateId}.typeEffective.attackScalar`);
    chart[normalizeType(attackType)] = scalar as number[];
  }
  if (Object.keys(chart).length < 18) {
    throw new Error(`tabela de tipos veio com ${Object.keys(chart).length} tipos, esperava 18`);
  }
  return chart;
}

interface OutSpecies {
  id: string;
  dex: number;
  name: string;
  types: string[];
  baseStats: { atk: number; def: number; hp: number };
  fastMoves: string[];
  chargedMoves: string[];
  eliteFastMoves: string[];
  eliteChargedMoves: string[];
  familyId: string | null;
  parent: string | null;
  evolvesInto: string[];
  candyToEvolve: Record<string, number>;
}

function extractSpecies(templates: Template[]): OutSpecies[] {
  const out: OutSpecies[] = [];

  for (const t of templates) {
    const s = t.data?.pokemonSettings;
    if (!s) continue;

    const m = /^V(\d{4})_POKEMON_(.+)$/.exec(t.templateId);
    if (!m) continue;
    const dex = Number(m[1]);
    const suffix = m[2]!;

    const pokemonId = required(s.pokemonId, `${t.templateId}.pokemonId`) as string;
    const stats = required(s.stats, `${t.templateId}.stats`);

    // Formas nao lancadas aparecem no GAME_MASTER com stats zerados. Incluir
    // isso na busca so polui a lista com coisa que o jogador nao pode ter.
    if (!stats.baseAttack || !stats.baseDefense || !stats.baseStamina) continue;

    const types = [s.type, s.type2].filter(Boolean).map((x: string) => normalizeType(x));

    const branches = (s.evolutionBranch ?? []) as Array<Record<string, any>>;
    const evolvesInto: string[] = [];
    const candyToEvolve: Record<string, number> = {};
    for (const b of branches) {
      if (!b.evolution) continue;
      const target = normalizeId(b.form ?? b.evolution);
      evolvesInto.push(target);
      if (typeof b.candyCost === "number") candyToEvolve[target] = b.candyCost;
    }

    out.push({
      id: normalizeId(suffix),
      dex,
      name: displayName(pokemonId, suffix),
      types,
      baseStats: {
        atk: stats.baseAttack,
        def: stats.baseDefense,
        hp: stats.baseStamina,
      },
      fastMoves: (s.quickMoves ?? []).map(normalizeId),
      chargedMoves: (s.cinematicMoves ?? []).map(normalizeId),
      eliteFastMoves: (s.eliteQuickMove ?? []).map(normalizeId),
      eliteChargedMoves: (s.eliteCinematicMove ?? []).map(normalizeId),
      familyId: s.familyId ? normalizeId(s.familyId) : null,
      parent: s.parentPokemonId ? normalizeId(s.parentPokemonId) : null,
      evolvesInto,
      candyToEvolve,
    });
  }

  if (out.length < 1000) {
    throw new Error(`extraiu so ${out.length} especies, esperava mais de 1000`);
  }
  return out.sort((a, b) => a.dex - b.dex || a.id.localeCompare(b.id));
}

interface OutMove {
  id: string;
  name: string;
  type: string;
  /** PvE */
  power: number;
  energyDelta: number;
  durationMs: number;
  damageWindowStartMs: number;
  /** PvP — ausente quando o movimento nao existe em PvP. */
  pvp: { power: number; energyDelta: number; turns: number; buffs?: unknown } | null;
}

function extractMoves(templates: Template[]): { fast: OutMove[]; charged: OutMove[] } {
  // Indexa o lado PvP primeiro: mesmo movimento, numeros diferentes.
  const pvpById = new Map<string, Record<string, any>>();
  for (const t of templates) {
    const cm = t.data?.combatMove;
    if (!cm?.uniqueId) continue;
    pvpById.set(normalizeId(cm.uniqueId), cm);
  }

  const fast: OutMove[] = [];
  const charged: OutMove[] = [];

  for (const t of templates) {
    const ms = t.data?.moveSettings;
    if (!ms?.movementId) continue;

    const id = normalizeId(ms.movementId);
    const isFast = id.endsWith("_fast");
    const pvp = pvpById.get(id);

    const move: OutMove = {
      id,
      name: displayName(ms.movementId.replace(/_FAST$/, ""), ms.movementId.replace(/_FAST$/, "")),
      type: normalizeType(required(ms.pokemonType, `${t.templateId}.pokemonType`)),
      power: ms.power ?? 0,
      energyDelta: ms.energyDelta ?? 0,
      durationMs: required(ms.durationMs, `${t.templateId}.durationMs`),
      damageWindowStartMs: ms.damageWindowStartMs ?? 0,
      pvp: pvp
        ? {
            power: pvp.power ?? 0,
            energyDelta: pvp.energyDelta ?? 0,
            turns: pvp.durationTurns ?? 0,
            ...(pvp.buffs ? { buffs: pvp.buffs } : {}),
          }
        : null,
    };

    (isFast ? fast : charged).push(move);
  }

  return { fast, charged };
}

function extractSettings(templates: Template[]): Record<string, unknown> {
  const battle = templates.find((t) => t.templateId === "BATTLE_SETTINGS")?.data?.battleSettings;
  const combat = templates.find((t) => t.templateId === "COMBAT_SETTINGS")?.data?.combatSettings;
  const stages = templates.find((t) => t.templateId === "COMBAT_STAT_STAGE_SETTINGS")?.data
    ?.combatStatStageSettings;

  return {
    battle: required(battle, "BATTLE_SETTINGS"),
    combat: required(combat, "COMBAT_SETTINGS"),
    statStages: required(stages, "COMBAT_STAT_STAGE_SETTINGS"),
  };
}

// ---------------------------------------------------------------------- main

async function main(): Promise<void> {
  const rawText = await readFile(join(RAW_DIR, "GAME_MASTER.json"), "utf8");
  const templates = JSON.parse(rawText) as Template[];
  const stamp = JSON.parse(await readFile(join(RAW_DIR, "timestamp.json"), "utf8"));

  console.log(`lendo ${templates.length} templates (batchId ${stamp.batchId})`);

  const cpm = extractCpm(templates);
  const typeChart = extractTypeChart(templates);
  const species = extractSpecies(templates);
  const { fast, charged } = extractMoves(templates);
  const settings = extractSettings(templates);

  const dataset = {
    version: {
      batchId: stamp.batchId,
      uploadTime: stamp.uploadTime,
      generatedAt: new Date().toISOString(),
      levelCap: LEVEL_CAP,
    },
    cpm,
    typeChart,
    species,
    fastMoves: fast,
    chargedMoves: charged,
    settings,
  };

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, "gamedata.json");
  const json = JSON.stringify(dataset);
  await writeFile(outPath, json);

  console.log(
    [
      `  especies:  ${species.length}`,
      `  ataques:   ${fast.length} rapidos, ${charged.length} carregados`,
      `  tipos:     ${Object.keys(typeChart).length}`,
      `  cpm:       ${cpm.length} niveis (cap ${LEVEL_CAP}, ultimo ${cpm[cpm.length - 1]})`,
      `  saida:     ${(json.length / 1_048_576).toFixed(2)} MB em ${outPath}`,
    ].join("\n"),
  );
}

await main();
