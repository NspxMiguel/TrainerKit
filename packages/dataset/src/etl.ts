/**
 * Transforma os 18 MB do GAME_MASTER cru no dataset compacto que o app carrega.
 *
 * Regra de ouro deste arquivo: **falhar alto**. Um campo que sumiu do
 * GAME_MASTER deve quebrar o build, nunca virar `undefined` que atravessa o app
 * e reaparece como veredito errado na tela do usuario.
 */
import {
  GREAT_LEAGUE,
  MASTER_LEAGUE,
  ULTRA_LEAGUE,
  rankRaidAttackers,
  rankStatProduct,
  type BattleSettings,
  type SpeciesForRanking,
} from "@trainerkit/core";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { LANGUAGES, moveKeyFor, toMap, urlFor } from "./i18n.ts";

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

/** MACHAMP -> Machamp ; NIDORAN_FEMALE -> Nidoran Female */
function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(^|_)(\w)/g, (_, sep: string, ch: string) => (sep ? " " : "") + ch.toUpperCase());
}

/**
 * Extrai o sufixo de forma.
 *
 * O campo `form` repete o nome da especie na frente ("RATTATA_ALOLA"), mas nem
 * sempre o nome COMPLETO: para o Nidoran, `pokemonId` e "NIDORAN_FEMALE"
 * enquanto `form` e "NIDORAN_NORMAL". Por isso o corte e por segmentos comuns,
 * nao por `slice(pokemonId.length)` — que produziria lixo como "(Al)".
 */
function formSuffix(pokemonId: string, form: string | undefined): string {
  if (!form) return "";

  const idParts = pokemonId.split("_");
  const formParts = form.split("_");

  let shared = 0;
  while (
    shared < idParts.length &&
    shared < formParts.length &&
    idParts[shared] === formParts[shared]
  ) {
    shared++;
  }
  return formParts.slice(shared).join("_");
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

/**
 * Ordem dos tipos no `attackScalar`.
 *
 * O array de 18 posicoes de cada `typeEffective` e indexado pelo ENUM de tipo do
 * jogo, e essa ordem NAO esta em lugar nenhum do GAME_MASTER — os templates
 * aparecem em ordem alfabetica, que e outra coisa. Entao ela e fixada aqui e
 * validada por teste contra confrontos conhecidos (Fogo resistido por rocha,
 * fogo, agua e dragao; super efetivo contra inseto, aco, planta e gelo).
 *
 * Se algum dia a ordem mudar, os testes de efetividade quebram — que e
 * exatamente o que deve acontecer, porque um chart torto envenena todo ranking
 * de raide e de PvP sem dar nenhum sinal na tela.
 */
const TYPE_ORDER = [
  "normal", "fighting", "flying", "poison", "ground", "rock",
  "bug", "ghost", "steel", "fire", "water", "grass",
  "electric", "psychic", "ice", "dragon", "dark", "fairy",
] as const;

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
  /**
   * Id da forma canonica quando esta entrada e apenas cosmetica (fantasia,
   * padrao de Unown, "_normal" redundante). `null` quando a forma e real.
   */
  cosmeticOf: string | null;
  /** Id do sprite no PokeAPI. `null` quando nao ha arte — cai no monograma. */
  spriteId: number | null;
}

/**
 * Resolve o id de sprite de cada especie contra o indice do PokeAPI.
 *
 * Os sprites do PokeAPI sao indexados por id numerico, e formas regionais nao
 * seguem formula nenhuma (Rattata de Alola e 10091, Raichu de Alola e 10100).
 * A unica forma confiavel de mapear e consultar o indice de nomes.
 *
 * A nomenclatura tambem diverge: o GAME_MASTER diz "GALARIAN" e "HISUIAN", o
 * PokeAPI diz "galar" e "hisui". Por isso as tentativas em cascata.
 *
 * Falhar aqui nao e erro: a especie sem sprite cai no tile de monograma, que
 * existe justamente para isso.
 */
async function resolveSpriteIds(species: OutSpecies[]): Promise<number> {
  let index: Record<string, number>;
  try {
    const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=2000");
    if (!res.ok) throw new Error(`PokeAPI respondeu ${res.status}`);
    const body = (await res.json()) as { results: Array<{ name: string; url: string }> };
    index = Object.fromEntries(
      body.results.map((r) => [r.name, Number(r.url.replace(/\/$/, "").split("/").pop())]),
    );
  } catch (err) {
    console.warn(
      `AVISO: nao consegui buscar o indice do PokeAPI (${
        err instanceof Error ? err.message : String(err)
      }). Todas as especies vao cair no monograma.`,
    );
    return 0;
  }

  const SUFFIX_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
    [/-galarian$/, "-galar"],
    [/-hisuian$/, "-hisui"],
    [/-paldean$/, "-paldea"],
    [/-alolan$/, "-alola"],
    // Genero: o GAME_MASTER escreve por extenso, o PokeAPI abrevia.
    [/-female$/, "-f"],
    [/-male$/, "-m"],
  ];

  // Indice sem separadores: os Pokemon Paradoxo vem colados no GAME_MASTER
  // ("GREAT_TUSK" vira "greattusk" porque o proprio pokemonId e "GREATTUSK")
  // enquanto o PokeAPI hifeniza ("great-tusk"). Comparar sem separador casa os
  // dois sem precisar de lista.
  const bySquashed = new Map<string, number>();
  for (const [name, id] of Object.entries(index)) {
    const squashed = name.replace(/-/g, "");
    const current = bySquashed.get(squashed);
    if (current === undefined || id < current) bySquashed.set(squashed, id);
  }

  // Indice auxiliar por prefixo: varias especies so existem no PokeAPI com a
  // forma explicita ("deoxys-normal", "giratina-altered", "wormadam-plant"),
  // sem entrada para o nome nu. O menor id e sempre a forma padrao.
  const byPrefix = new Map<string, number>();
  for (const [name, id] of Object.entries(index)) {
    const dash = name.indexOf("-");
    if (dash <= 0) continue;
    const prefix = name.slice(0, dash);
    const current = byPrefix.get(prefix);
    if (current === undefined || id < current) byPrefix.set(prefix, id);
  }

  let resolved = 0;
  for (const s of species) {
    const dashed = s.id.replace(/_/g, "-");

    const candidates = [dashed];
    for (const [pattern, replacement] of SUFFIX_ALIASES) {
      if (pattern.test(dashed)) candidates.push(dashed.replace(pattern, replacement));
    }
    // Ultimo recurso: o nome base, sem sufixo de forma.
    const base = dashed.split("-")[0]!;
    candidates.push(base);

    let found: number | undefined;
    for (const name of candidates) {
      found = index[name];
      if (found !== undefined) break;
    }
    // Ainda nada: tenta ignorando separadores, depois a forma padrao.
    found ??= bySquashed.get(dashed.replace(/-/g, ""));
    found ??= byPrefix.get(base);

    if (found !== undefined) {
      s.spriteId = found;
      resolved++;
    }
  }
  return resolved;
}

/**
 * Busca os nomes de golpe em todos os idiomas.
 *
 * Falhar aqui NAO derruba o build: sem traducao o app mostra so o nome em
 * ingles, que continua correto. Perder o dataset inteiro porque um arquivo de
 * idioma nao respondeu seria trocar um problema pequeno por um grande.
 */
async function fetchMoveNames(
  moves: OutMove[],
): Promise<Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, string>> = {};

  for (const spec of LANGUAGES) {
    try {
      const res = await fetch(urlFor(spec));
      if (!res.ok) throw new Error(`respondeu ${res.status}`);
      const map = toMap(await res.json());

      const names: Record<string, string> = {};
      for (const move of moves) {
        const key = moveKeyFor(move.templateId);
        const name = key ? map[key] : undefined;
        if (name) names[move.id] = name;
      }
      out[spec.code] = names;
      console.log(`  ${spec.code.padEnd(7)} ${Object.keys(names).length} nomes de golpe`);
    } catch (err) {
      console.warn(
        `  AVISO: ${spec.code} falhou (${err instanceof Error ? err.message : String(err)}) — ` +
          `o app cai no nome em ingles.`,
      );
    }
  }

  return out;
}

/**
 * Marca formas cosmeticas.
 *
 * O GAME_MASTER traz ~2.470 entradas para ~1.020 especies porque cada fantasia,
 * cada letra de Unown e um "_NORMAL" redundante viram template proprio. Numa
 * busca isso aparece como "Bulbasaur" tres vezes seguidas, o que e lixo.
 *
 * A regra e por DADO, nao por lista de sufixos: se a forma tem a mesma dex, os
 * mesmos stats base e os mesmos tipos da entrada canonica, ela nao muda nenhum
 * veredito e portanto e cosmetica. Alola, Galar e Hisui sobrevivem sozinhos
 * porque de fato diferem — sem precisar que ninguem os liste.
 */
function markCosmeticForms(species: OutSpecies[]): void {
  const canonicalByDex = new Map<number, OutSpecies>();

  // A entrada canonica e a de id mais curto (sem sufixo de forma).
  for (const s of species) {
    const current = canonicalByDex.get(s.dex);
    if (!current || s.id.length < current.id.length) canonicalByDex.set(s.dex, s);
  }

  const signature = (s: OutSpecies): string =>
    `${s.baseStats.atk}/${s.baseStats.def}/${s.baseStats.hp}|${[...s.types].sort().join(",")}`;

  for (const s of species) {
    const canonical = canonicalByDex.get(s.dex);
    if (!canonical || canonical.id === s.id) continue;
    if (signature(s) === signature(canonical)) s.cosmeticOf = canonical.id;
  }
}

function extractSpecies(templates: Template[]): OutSpecies[] {
  const out: OutSpecies[] = [];

  for (const t of templates) {
    const s = t.data?.pokemonSettings;
    if (!s) continue;

    const m = /^V(\d{4})_POKEMON_/.exec(t.templateId);
    if (!m) continue;
    const dex = Number(m[1]);

    // A identidade vem de pokemonId + form, NUNCA do sufixo do templateId:
    // `V0029_POKEMON_NIDORAN` e `V0032_POKEMON_NIDORAN` tem o mesmo sufixo para
    // especies diferentes (Nidoran femea e macho), e derivar dali gera ids
    // colidentes.
    const pokemonId = required(s.pokemonId, `${t.templateId}.pokemonId`) as string;
    const stats = required(s.stats, `${t.templateId}.stats`);

    const suffix = formSuffix(pokemonId, s.form);
    const id = normalizeId(suffix ? `${pokemonId}_${suffix}` : pokemonId);
    const name = suffix && suffix !== "NORMAL"
      ? `${titleCase(pokemonId)} (${titleCase(suffix)})`
      : titleCase(pokemonId);

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
      id,
      dex,
      name,
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
      cosmeticOf: null,
      spriteId: null,
    });
  }

  if (out.length < 1000) {
    throw new Error(`extraiu so ${out.length} especies, esperava mais de 1000`);
  }

  // Id repetido nao e detalhe: ele quebra qualquer busca por id e, na UI, faz o
  // React manter no DOM um item que ja saiu da lista — bug que aparece como
  // "Nidoran Female no meio dos Alola" e custa caro pra rastrear. Melhor
  // explodir aqui.
  const seen = new Map<string, string>();
  for (const s of out) {
    const previous = seen.get(s.id);
    if (previous !== undefined) {
      throw new Error(
        `id de especie duplicado: ${s.id} (dex ${s.dex} "${s.name}" colide com "${previous}"). ` +
          `A derivacao de id a partir de pokemonId+form precisa ser revista.`,
      );
    }
    seen.set(s.id, s.name);
  }

  markCosmeticForms(out);
  return out.sort((a, b) => a.dex - b.dex || a.id.localeCompare(b.id));
}

interface OutMove {
  /** Guardado so para casar com a chave de traducao (`V0101_MOVE_...`). */
  templateId: string;
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
      templateId: t.templateId,
      id,
      // O sufixo "_FAST" e marcador interno, nao faz parte do nome do golpe.
      name: titleCase(ms.movementId.replace(/_FAST$/, "")),
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

  const spritesResolved = await resolveSpriteIds(species);

  console.log("buscando traducoes oficiais:");
  const moveNames = await fetchMoveNames([...fast, ...charged]);

  /**
   * Rankings pre-calculados.
   *
   * O de stat product varre 4.096 combinacoes de IV por especie por liga —
   * medido em 3 SEGUNDOS no navegador, o que travaria a tela. E uma conta fixa
   * sobre dados fixos: pertence ao build, nao ao aparelho de ninguem.
   *
   * O de raide sai em 7ms e podia rodar no cliente; vem junto por consistencia,
   * e porque assim as duas listas envelhecem juntas com o dataset.
   */
  const forRanking = species.map((s) => ({
    id: s.id,
    name: s.name,
    types: s.types,
    baseStats: s.baseStats,
    fastMoves: [...s.fastMoves, ...s.eliteFastMoves]
      .map((id) => [...fast, ...charged].find((m) => m.id === id))
      .filter((m): m is NonNullable<typeof m> => m !== undefined),
    chargedMoves: [...s.chargedMoves, ...s.eliteChargedMoves]
      .map((id) => [...fast, ...charged].find((m) => m.id === id))
      .filter((m): m is NonNullable<typeof m> => m !== undefined),
    cosmetic: s.cosmeticOf !== null,
  })) as unknown as SpeciesForRanking[];

  // `extractSettings` devolve o JSON cru do GAME_MASTER, que e `unknown` por
  // desenho — tipar centenas de campos opcionais seria fingir uma garantia que
  // a fonte nao da. Aqui a forma que interessa e pequena e ja foi conferida em
  // runtime pelo `required()`, entao o estreitamento e explicito.
  const battle = settings.battle as unknown as BattleSettings;

  const raidOverall = rankRaidAttackers(forRanking, cpm, typeChart, TYPE_ORDER, battle, {
    limit: 30,
  });
  const raidByType: Record<string, ReturnType<typeof rankRaidAttackers>> = {};
  for (const type of TYPE_ORDER) {
    raidByType[type] = rankRaidAttackers(forRanking, cpm, typeChart, TYPE_ORDER, battle, {
      attackType: type,
      limit: 15,
    });
  }

  const statProductByLeague = {
    great: rankStatProduct(forRanking, cpm, GREAT_LEAGUE, { limit: 30 }),
    ultra: rankStatProduct(forRanking, cpm, ULTRA_LEAGUE, { limit: 30 }),
    master: rankStatProduct(forRanking, cpm, MASTER_LEAGUE, { limit: 30 }),
  };

  const dataset = {
    typeOrder: TYPE_ORDER,
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
    /** Nome oficial do golpe por idioma. O `name` em ingles fica no proprio golpe. */
    moveNames,
    settings,
    rankings: {
      raidOverall,
      raidByType,
      statProductByLeague,
    },
  };

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, "gamedata.json");
  const json = JSON.stringify(dataset);
  await writeFile(outPath, json);

  const real = species.filter((s) => s.cosmeticOf === null).length;
  console.log(
    [
      `  especies:  ${species.length} (${real} reais, ${species.length - real} cosmeticas)`,
      `  ataques:   ${fast.length} rapidos, ${charged.length} carregados`,
      `  sprites:   ${spritesResolved} de ${species.length} resolvidos`,
      `  idiomas:   ${Object.keys(moveNames).length}`,
      `  tipos:     ${Object.keys(typeChart).length}`,
      `  cpm:       ${cpm.length} niveis (cap ${LEVEL_CAP}, ultimo ${cpm[cpm.length - 1]})`,
      `  rankings:  ${raidOverall.length} de raide, ${Object.keys(raidByType).length} tipos, 3 ligas`,
      `  saida:     ${(json.length / 1_048_576).toFixed(2)} MB em ${outPath}`,
    ].join("\n"),
  );
}

await main();
