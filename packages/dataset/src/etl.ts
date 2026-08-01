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
import { DECLARED_SOURCES } from "./sources.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(HERE, "..", "raw");
const OUT_DIR = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset");

/**
 * ⚠️ O TETO DE NIVEL NAO E MAIS CHUTADO. Ele vem do GAME_MASTER.
 *
 * Aqui havia `const LEVEL_CAP = 55`, com o comentario "o cap atual do jogo".
 * Estava errado, e o erro tinha 5 niveis de tamanho: o `cpMultiplier` do
 * `PLAYER_LEVEL_SETTINGS` REALMENTE sobe ate 0.8653 no indice 54, mas aquilo e
 * a tabela do CLIENTE, nao a permissao pra chegar la.
 *
 * Quem manda e `POKEMON_UPGRADE_SETTINGS`:
 *
 *   maxNormalUpgradeLevel: 50        — ate onde da pra PAGAR power-up
 *   defaultCpBoostAdditionalLevel: 1 — o que o Melhor Amigo soma POR CIMA disso
 *
 * A pista de que 51..55 era invencao estava na propria tabela: do nivel 41 pra
 * frente o CPM sobe exatamente 0.005 por nivel, uma reta — e ela continua reta
 * ate 55 e ai vira plato, repetindo 0.8653 ate o indice 80 (que hoje acompanha
 * o teto de TREINADOR, que subiu pra 80 em outubro/2025). Extensao linear com
 * plato no fim e padding, nao mecanica.
 *
 * Consequencia do erro: `computeCPAtLevel(..., 55)` inflava o "PC maximo" em
 * ~6% (CPM 0.8653 contra 0.8403, e o CPM entra ao QUADRADO no PC). Um Mewtwo
 * perfeito aparecia com ~4425 em vez de ~4178. O app anunciava um teto que o
 * jogo nao deixa alcancar, e o custo de chegar la saia junto.
 *
 * Os dois numeros sao coisas diferentes e o dataset publica os dois:
 *
 *   `levelCap`  — o teto que se PAGA. E o teto do "PC maximo" e dos custos.
 *   `capBuddy`  — o teto que se OBSERVA. E ate onde o solver de nivel procura,
 *                 porque um Melhor Amigo mostra o PC ja com o bonus aplicado, e
 *                 um solver que parasse em 50 nao acharia solucao pra ele.
 */
interface TetoDeNivel {
  /** `maxNormalUpgradeLevel` — ate onde da pra pagar power-up. */
  cap: number;
  /** `defaultCpBoostAdditionalLevel` — o bonus de Melhor Amigo. */
  bonusMelhorAmigo: number;
  /** `cap + bonusMelhorAmigo`. O maior nivel que um Pokemon pode APARENTAR. */
  capObservavel: number;
}

function extractTetoDeNivel(templates: Template[]): TetoDeNivel {
  const t = templates.find((x) => x.templateId === "POKEMON_UPGRADE_SETTINGS");
  const up = required(t?.data?.pokemonUpgrades, "POKEMON_UPGRADE_SETTINGS.pokemonUpgrades");
  const cap = required(up.maxNormalUpgradeLevel, "pokemonUpgrades.maxNormalUpgradeLevel") as number;
  const bonus = (up.defaultCpBoostAdditionalLevel as number | undefined) ?? 0;

  // Sanidade: um teto fora deste intervalo e mudanca grande demais pra passar
  // calada. Melhor o ETL parar do que gerar um dataset que mente.
  if (!Number.isFinite(cap) || cap < 40 || cap > 100) {
    throw new Error(`maxNormalUpgradeLevel implausivel: ${cap}`);
  }

  return { cap, bonusMelhorAmigo: bonus, capObservavel: cap + bonus };
}

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

function extractCpm(templates: Template[], teto: TetoDeNivel): number[] {
  const t = templates.find((x) => x.templateId === "PLAYER_LEVEL_SETTINGS");
  const raw = required(t?.data?.playerLevel?.cpMultiplier, "PLAYER_LEVEL_SETTINGS.cpMultiplier");
  if (!Array.isArray(raw) || raw.length < teto.capObservavel) {
    throw new Error(
      `cpMultiplier tem ${raw?.length} entradas, esperava >= ${teto.capObservavel}`,
    );
  }

  /*
   * Corta no teto OBSERVAVEL, nao no de power-up.
   *
   * O array vem longo (hoje 80 entradas, acompanhando o teto de treinador) e
   * com plato no fim. Cortar em 50 pareceria mais "correto", mas quebraria o
   * solver de nivel: um Melhor Amigo esta em 51 e o `cpmForLevel` levantaria
   * RangeError justamente no Pokemon mais investido da colecao.
   */
  const trimmed = (raw as number[]).slice(0, teto.capObservavel);
  const noCap = trimmed[teto.cap - 1];
  if (noCap !== 0.8403) {
    console.warn(
      `AVISO: CPM do nivel ${teto.cap} e ${noCap}, esperava 0.8403. ` +
        `A curva de CPM mudou — confira antes de confiar nos custos.`,
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
  /**
   * Grupo de custo dos Max Ataques — o `breadTierGroup` do GAME_MASTER.
   *
   * ⚠️ NAO significa "pode Dynamax". Quase toda especie tem um; ele so diz
   * quanto custaria subir os Max Ataques SE aquele individuo puder. Ver
   * `extractDynamax`.
   */
  maxGrupo: string | null;
  /** Id do sprite no PokeAPI. `null` quando nao ha arte — cai no monograma. */
  spriteId: number | null;
  /**
   * Altura em decimetros e peso em hectogramas, como o jogo guarda.
   *
   * Sao MEDIDAS, nao texto: 16 decimetros e "1,6 m" na tela. Entraram porque a
   * ficha da Pokedex sem altura e peso nao parece ficha de Pokedex, e porque
   * medida e fato — diferente das descricoes do jogo, que sao obra escrita e por
   * isso ficam de fora deste app.
   *
   * `null` quando o PokeAPI nao tem a forma (algumas formas so do GO).
   */
  heightDm: number | null;
  weightHg: number | null;
  /**
   * Lendario, mitico ou Ultra Beast.
   *
   * Vem do `pokemonClass` do GAME_MASTER, e serve pra uma coisa so: e essa
   * classe que aparece em raide de tier 5. Sem ela o app supunha tier 5 pra
   * qualquer especie e anunciava um Machamp de 40.227 de PC — numero certo pra
   * formula e absurdo pro jogo, porque Machamp nunca e chefe de tier 5.
   *
   * A lista de chefes de cada tier NAO esta no GAME_MASTER (muda a cada
   * evento), entao isto e o mais perto que da pra chegar sem inventar dado.
   */
  legendary: boolean;
}

/**
 * Altura e peso, de um CSV so.
 *
 * A alternativa era `/api/v2/pokemon/{id}` por especie: 2.466 requisicoes num
 * CI, contra uma API publica e gratuita que pede educacao. O repositorio do
 * PokeAPI publica o mesmo dado em CSV, indexado pelo MESMO id numerico que
 * `resolveSpriteIds` ja resolve — entao sai de graca em cima de trabalho que ja
 * era feito.
 *
 * Unidades como o jogo guarda: altura em decimetros, peso em hectogramas. A
 * conversao pra metro e quilo fica na tela, com o separador do idioma.
 *
 * Falhar aqui nao e erro: sem os numeros a ficha simplesmente nao mostra a
 * linha. Nenhum veredito depende disto.
 */
async function resolveSizes(species: OutSpecies[]): Promise<number> {
  let porId: Map<number, { heightDm: number; weightHg: number }>;
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv",
    );
    if (!res.ok) throw new Error(`CSV respondeu ${res.status}`);
    const texto = await res.text();

    porId = new Map();
    const linhas = texto.split("\n");
    // `id,identifier,species_id,height,weight,base_experience,order,is_default`
    for (const linha of linhas.slice(1)) {
      const col = linha.split(",");
      if (col.length < 5) continue;
      const id = Number(col[0]);
      const h = Number(col[3]);
      const w = Number(col[4]);
      if (!Number.isFinite(id) || !Number.isFinite(h) || !Number.isFinite(w)) continue;
      /*
       * Zero e AUSENCIA de dado, nao uma medida.
       *
       * Achado auditando: `eternatus_eternamax` vem com peso 0 no CSV — a forma
       * de chefe de Dynamax nao tem peso publicado. Guardar isso faria a ficha
       * da Pokedex anunciar "0 quilos", que e pior que nao dizer nada. Sem o
       * valor, a linha inteira simplesmente nao aparece.
       */
      if (h <= 0 || w <= 0) continue;
      porId.set(id, { heightDm: h, weightHg: w });
    }
  } catch (err) {
    console.warn(
      `AVISO: nao consegui buscar altura/peso (${
        err instanceof Error ? err.message : String(err)
      }). A ficha da Pokedex vai sem essas linhas.`,
    );
    return 0;
  }

  let resolvidos = 0;
  for (const s of species) {
    if (s.spriteId === null) continue;
    const tamanho = porId.get(s.spriteId);
    if (!tamanho) continue;
    s.heightDm = tamanho.heightDm;
    s.weightHg = tamanho.weightHg;
    resolvidos += 1;
  }
  return resolvidos;
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
 * A CATEGORIA da Pokedex — "o Pokemon Semente".
 *
 * ⚠️ ISTO E UM INTERRUPTOR DE BUILD, e ele e a razao de existir deste bloco.
 *
 * `dex.ts` tem um compromisso escrito de nao embarcar texto da Pokemon Company,
 * e a categoria E texto deles. A decisao de incluir foi do dono desta build, que
 * a mantem pessoal e nao publicada — a mesma decisao que ja vale pros sprites
 * oficiais, e registrada no plano ("build pessoal, com sprites").
 *
 * Desligar esta constante nao esconde a categoria da tela: remove o texto do
 * ARQUIVO. O dataset publicavel sai sem ele, e a locucao volta a nao ter
 * categoria sozinha, porque o app so mostra o que existe no dado. E o mesmo
 * desenho do `SpriteProvider`, e pelo mesmo motivo: trocar de build pessoal pra
 * build publicavel tem que ser uma linha, nao uma refatoracao.
 *
 * ── De onde vem, e por que NAO da PokeAPI ───────────────────────────────────
 *
 * O caminho obvio seria a PokeAPI (`pokemon_species_names.csv`, campo `genus`),
 * que o ETL ja usa pra sprites. Ele nao serve: aquele CSV **nao tem
 * portugues** (nao ha linha de idioma 13 nenhuma) e nao tem russo. O app fala
 * dez idiomas e o dono joga em portugues — a categoria apareceria em ingles no
 * meio de uma frase em portugues, ou nao apareceria pra ele.
 *
 * Os textos do proprio jogo tem `pokemon_category_0001` nos DEZ idiomas, sao a
 * traducao oficial, e o ETL ja baixa exatamente esses arquivos pros nomes de
 * golpe. Sai de graca e sai certo.
 */
const INCLUIR_CATEGORIA = true;

async function fetchCategories(
  species: OutSpecies[],
): Promise<Record<string, Record<string, string>>> {
  if (!INCLUIR_CATEGORIA) return {};

  // Uma categoria por DEX, nao por forma: Charizard e Charizard Mega X sao o
  // mesmo "Pokemon Chamas", e o jogo so publica a chave por numero.
  const dexes = Array.from(new Set(species.map((s) => s.dex))).sort((a, b) => a - b);
  const out: Record<string, Record<string, string>> = {};

  for (const spec of LANGUAGES) {
    try {
      const res = await fetch(urlFor(spec));
      if (!res.ok) throw new Error(`respondeu ${res.status}`);
      const map = toMap(await res.json());

      const cats: Record<string, string> = {};
      for (const dex of dexes) {
        const valor = map[`pokemon_category_${String(dex).padStart(4, "0")}`];
        if (valor) cats[String(dex)] = valor;
      }
      out[spec.code] = cats;
      console.log(`  ${spec.code.padEnd(7)} ${Object.keys(cats).length} categorias`);
    } catch (err) {
      // Mesmo criterio dos nomes de golpe: sem categoria a locucao continua
      // correta, so mais curta. Derrubar o dataset por isso seria trocar um
      // problema pequeno por um grande.
      console.warn(
        `  AVISO: categoria ${spec.code} falhou (${err instanceof Error ? err.message : String(err)})`,
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

  /*
   * ⚠️ A LINHA DE EVOLUCAO TAMBEM APONTA PRO CANONICO.
   *
   * Sem isto, `ivysaur.evolvesInto` sai como `["venusaur_normal"]` — o
   * canonico evoluindo pra uma forma COSMETICA. O GAME_MASTER e assim mesmo: o
   * `evolutionBranch` cita a forma, nao a especie.
   *
   * E daqui que saiam os ids cosmeticos na colecao de quem usa o app. Evoluir
   * grava `evolvesInto[0]`, entao quem evoluiu um Ivysaur ficou com um
   * `venusaur_normal` guardado — e ai a ficha aberta pela Pokedex (que navega
   * `venusaur`) nao reconhecia o proprio Pokemon da pessoa. Foi exatamente esse
   * o caminho do "ele duplico e tem 2 venusaur agr".
   *
   * As telas ja canonizam na leitura, e continuam — dado velho existe. Isto
   * fecha a TORNEIRA: daqui pra frente nao nasce id cosmetico novo.
   *
   * Feito depois de `cosmeticOf` estar preenchido, e nao junto: o mapa precisa
   * estar completo antes de qualquer reescrita.
   */
  const canonizar = (id: string): string => {
    const alvo = species.find((x) => x.id === id);
    return alvo?.cosmeticOf ?? id;
  };

  for (const s of species) {
    s.evolvesInto = s.evolvesInto.map(canonizar);
    const doces: Record<string, number> = {};
    for (const [para, custo] of Object.entries(s.candyToEvolve)) doces[canonizar(para)] = custo;
    s.candyToEvolve = doces;
    if (s.parent) s.parent = canonizar(s.parent);
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
      maxGrupo: typeof s.breadTierGroup === "string" ? s.breadTierGroup : null,
      spriteId: null,
      heightDm: null,
      weightHg: null,
      legendary:
        s.pokemonClass === "POKEMON_CLASS_LEGENDARY" ||
        s.pokemonClass === "POKEMON_CLASS_MYTHIC" ||
        s.pokemonClass === "POKEMON_CLASS_ULTRA_BEAST",
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

/**
 * Dynamax, Gigantamax e as Batalhas Max.
 *
 * ⚠️ NO GAME_MASTER A MECANICA NAO SE CHAMA DYNAMAX. Ela se chama **BREAD**.
 *
 * Era esse o motivo de o plano registrar "apareceram nas fontes e nunca foram
 * investigados": procurar por `DYNAMAX` no GAME_MASTER devolve o golpe do
 * Eternatus (Dynamax Cannon), um par de luvas de avatar e uma animacao — e mais
 * nada. Da pra concluir com toda a confianca do mundo que a mecanica nao
 * existe. Ela existe: sao 209 templates, e todos comecam com `BREAD`.
 *
 * (Gigantamax e `SOURDOUGH`, pao fermentado. Alguem no time se divertiu.)
 *
 * O que da pra afirmar a partir dos dados, e que e o que este bloco extrai:
 *
 *  · A mecanica esta LIGADA — `BREAD_FEATURE_FLAGS.enabled` e
 *    `battleEnabled`, com nivel minimo de treinador.
 *  · QUAIS especies fazem Gigantamax — `allowedSourdoughPokemon` e uma lista
 *    fechada e explicita. E o unico fato per-especie duro da mecanica inteira.
 *  · QUANTO CUSTA subir os Max Ataques de cada especie — cada uma tem um
 *    `breadTierGroup`, e cada grupo tem sua tabela de doce/doce XL/particulas.
 *
 * ⚠️ E o que NAO da, que importa igual: **nao existe lista de quem pode
 * Dynamax**. No jogo isso e propriedade do INDIVIDUO (vem de ter sido pego numa
 * Batalha Max), nao da especie — 2.450 das 2.466 especies tem `breadTierGroup`,
 * o que so diz "se um dia esta especie aparecer, o custo dela e este". Um app
 * que transformasse isso em "este Pokemon pode Dynamax" estaria inventando.
 */
interface DadosDynamax {
  ligado: boolean;
  nivelMinimo: number | null;
  /** Ids de especie (normalizados) que fazem Gigantamax. Lista fechada. */
  gigantamax: string[];
  /** Custo de subir cada Max Ataque, por grupo de custo. */
  custoPorGrupo: Record<string, unknown>;
}

function extractDynamax(templates: Template[]): DadosDynamax {
  const flags = templates.find((t) => t.templateId === "BREAD_FEATURE_FLAGS")?.data
    ?.breadFeatureFlags;
  const shared = templates.find((t) => t.templateId === "BREAD_SHARED_SETTINGS")?.data
    ?.breadSettings;

  const gigantamax = Array.from(
    new Set<string>(
      ((shared?.allowedSourdoughPokemon ?? []) as Array<{ pokemonId?: string }>)
        .map((p) => p.pokemonId)
        .filter((id): id is string => typeof id === "string")
        .map(normalizeId),
    ),
  ).sort();

  const custoPorGrupo: Record<string, unknown> = {};
  for (const t of templates) {
    if (!t.templateId.startsWith("BREAD_MOVE_LEVEL_SETTINGS_")) continue;
    const s = t.data?.breadMoveLevelSettings;
    if (!s) continue;
    // `group` vem como "GROUP_1" numas e como o numero 7 noutras. O sufixo do
    // templateId e o unico identificador que aparece igual nos dois casos, e e
    // ele que casa com o `breadTierGroup` da especie.
    custoPorGrupo[t.templateId.replace("BREAD_MOVE_LEVEL_SETTINGS_", "")] = s;
  }

  return {
    ligado: flags?.enabled === true && flags?.battleEnabled === true,
    nivelMinimo: typeof flags?.minimumPlayerLevel === "number" ? flags.minimumPlayerLevel : null,
    gigantamax,
    custoPorGrupo,
  };
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

  const teto = extractTetoDeNivel(templates);
  const cpm = extractCpm(templates, teto);
  const typeChart = extractTypeChart(templates);
  const species = extractSpecies(templates);
  const { fast, charged } = extractMoves(templates);
  const settings = extractSettings(templates);
  const dynamax = extractDynamax(templates);

  const spritesResolved = await resolveSpriteIds(species);
  // Depois dos sprites de propósito: o CSV e indexado pelo id do PokeAPI, que e
  // exatamente o que `resolveSpriteIds` acabou de descobrir.
  const sizesResolved = await resolveSizes(species);

  console.log("buscando traducoes oficiais:");
  const moveNames = await fetchMoveNames([...fast, ...charged]);
  const categoryNames = await fetchCategories(species);

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
  /*
   * 40 por tipo, nao 15.
   *
   * Quinze cobria a tela de rankings, onde ninguem le a 16a linha. Mas a ficha
   * da Pokedex diz "entre os atacantes de Lutador, é o número N" — e com limite
   * 15 essa frase nunca aparecia pra Machamp, Conkeldurr, Hariyama: as quinze
   * primeiras vagas sao todas de lendario e Mega. O jogador comum nao tem
   * nenhum dos quinze, e a linha mais util da ficha sumia justamente pra quem
   * ela servia. Custa alguns KB no dataset.
   */
  const raidByType: Record<string, ReturnType<typeof rankRaidAttackers>> = {};
  for (const type of TYPE_ORDER) {
    raidByType[type] = rankRaidAttackers(forRanking, cpm, typeChart, TYPE_ORDER, battle, {
      attackType: type,
      limit: 40,
    });
  }

  // Mesmo motivo do de raide: a ficha cita a posicao na liga, e 30 vagas sao
  // poucas pra um jogador se achar nelas.
  const statProductByLeague = {
    great: rankStatProduct(forRanking, cpm, GREAT_LEAGUE, { limit: 60 }),
    ultra: rankStatProduct(forRanking, cpm, ULTRA_LEAGUE, { limit: 60 }),
    master: rankStatProduct(forRanking, cpm, MASTER_LEAGUE, { limit: 60 }),
  };

  const dataset = {
    typeOrder: TYPE_ORDER,
    /**
     * De onde veio cada numero. Vai DENTRO do dataset de proposito: quem
     * apontar o app pra outra base ve as fontes daquela base, nao as minhas.
     */
    sources: DECLARED_SOURCES,
    version: {
      batchId: stamp.batchId,
      uploadTime: stamp.uploadTime,
      generatedAt: new Date().toISOString(),
      /** O teto que se PAGA. Base do "PC maximo" e de todo custo. */
      levelCap: teto.cap,
      /** O bonus de Melhor Amigo, que nao se compra. Hoje 1. */
      buddyBonusLevels: teto.bonusMelhorAmigo,
      /** `levelCap + buddyBonusLevels`. Ate onde o solver de nivel procura. */
      observableLevelCap: teto.capObservavel,
    },
    cpm,
    typeChart,
    species,
    fastMoves: fast,
    chargedMoves: charged,
    /** Nome oficial do golpe por idioma. O `name` em ingles fica no proprio golpe. */
    moveNames,
    /**
     * "o Pokemon Semente", por idioma e por numero da Pokedex.
     *
     * Vazio quando `INCLUIR_CATEGORIA` esta desligada — ver a nota la. O app
     * so fala da categoria quando ela existe aqui.
     */
    categoryNames,
    settings,
    dynamax,
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
      `  tamanhos:  ${sizesResolved} com altura e peso`,
      `  idiomas:   ${Object.keys(moveNames).length}`,
      `  tipos:     ${Object.keys(typeChart).length}`,
      `  cpm:       ${cpm.length} niveis (power-up ate ${teto.cap}, +${teto.bonusMelhorAmigo} de Melhor Amigo, ultimo ${cpm[cpm.length - 1]})`,
      `  dynamax:   ${dynamax.ligado ? "ligado" : "desligado"}, ${dynamax.gigantamax.length} com Gigantamax, ${Object.keys(dynamax.custoPorGrupo).length} grupos de custo`,
      `  rankings:  ${raidOverall.length} de raide, ${Object.keys(raidByType).length} tipos, 3 ligas`,
      `  saida:     ${(json.length / 1_048_576).toFixed(2)} MB em ${outPath}`,
    ].join("\n"),
  );
}

await main();
