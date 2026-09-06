/**
 * O QUE CADA ITEM FAZ — o guia que faltava pra quem está começando.
 *
 * "poderia ter algum lugar no app, q mostra pra q serve cada item q vc ganha,
 * para usuarios novos". O jogo entrega o item na mochila e não explica nada; o
 * app tem o GAME_MASTER e pode dizer exatamente o que aquilo destrava.
 *
 * ── O que é DADO e o que é TEXTO ────────────────────────────────────────────
 *
 * ⚠️ O GAME_MASTER **não traz nome nem descrição de item** — isso mora nos
 * arquivos de tradução do jogo, que não baixamos. O que ele traz é melhor:
 * quais espécies cada item evolui. Então o guia é feito das duas metades:
 *
 * · **derivado** — o par "de → para" de cada item de evolução, que é fato do
 *   arquivo e muda quando o jogo muda;
 * · **escrito** — a frase de uma linha do que o item serve, que é editorial.
 *
 * Os nomes ficam em inglês, como as espécies e os golpes já ficam no app
 * inteiro: é o que a pessoa lê no jogo e nos guias da comunidade.
 *
 * ⚠️ ITENS SEM NOME AQUI NÃO SÃO ESQUECIMENTO. Alguns templates novos
 * (`ITEM_OTHER_EVOLUTION_STONE_*`) não têm nome público que eu possa afirmar,
 * e inventar um seria pior que omitir — a tela mostra as evoluções que eles
 * destravam, que é o que a pessoa precisa saber de qualquer jeito.
 */

/**
 * Item de evolução → os pares `[de, para]` que ele destrava.
 *
 * ⚠️ GERADO do GAME_MASTER, não escrito à mão, e `itens.test.ts` regenera e
 * compara. Sessenta pares conferidos contra os ids do dataset: zero divergência.
 */
export const EVOLUCOES_POR_ITEM: Record<string, readonly (readonly [string, string])[]> = {
  ITEM_BEANS: [
    ["zygarde", "zygarde"],
    ["zygarde", "zygarde_complete"],
  ],
  ITEM_DRAGON_SCALE: [["seadra", "kingdra"]],
  ITEM_GEN4_EVOLUTION_STONE: [
    ["aipom", "ambipom"],
    ["dusclops", "dusknoir"],
    ["electabuzz", "electivire"],
    ["gligar", "gliscor"],
    ["kirlia", "gallade"],
    ["lickitung", "lickilicky"],
    ["magmar", "magmortar"],
    ["misdreavus", "mismagius"],
    ["murkrow", "honchkrow"],
    ["piloswine", "mamoswine"],
    ["porygon2", "porygon_z"],
    ["rhydon", "rhyperior"],
    ["roselia", "roserade"],
    ["sneasel", "weavile"],
    ["snorunt", "froslass"],
    ["tangela", "tangrowth"],
    ["togetic", "togekiss"],
    ["yanma", "yanmega"],
  ],
  ITEM_GEN5_EVOLUTION_STONE: [
    ["eelektrik", "eelektross"],
    ["lampent", "chandelure"],
    ["minccino", "cinccino"],
    ["munna", "musharna"],
    ["panpour", "simipour"],
    ["pansage", "simisage"],
    ["pansear", "simisear"],
  ],
  ITEM_KINGS_ROCK: [
    ["poliwhirl", "politoed"],
    ["slowpoke", "slowking"],
  ],
  ITEM_METAL_COAT: [
    ["onix", "steelix"],
    ["scyther", "scizor"],
  ],
  ITEM_OTHER_EVOLUTION_STONE_A: [["gimmighoul", "gholdengo"]],
  ITEM_OTHER_EVOLUTION_STONE_MAPLE_A: [["applin", "appletun"]],
  ITEM_OTHER_EVOLUTION_STONE_MAPLE_B: [["applin", "flapple"]],
  ITEM_OTHER_EVOLUTION_STONE_MAPLE_C: [["applin", "dipplin"]],
  ITEM_SUN_STONE: [
    ["cottonee", "whimsicott"],
    ["gloom", "bellossom"],
    ["helioptile", "heliolisk"],
    ["petilil", "lilligant"],
    ["sunkern", "sunflora"],
  ],
  ITEM_UP_GRADE: [["porygon", "porygon2"]],
};

/** O nome do item no jogo, onde dá pra afirmar. `undefined` = sem nome público. */
export const NOME_DO_ITEM: Record<string, string> = {
  ITEM_SUN_STONE: "Sun Stone",
  ITEM_KINGS_ROCK: "King's Rock",
  ITEM_METAL_COAT: "Metal Coat",
  ITEM_DRAGON_SCALE: "Dragon Scale",
  ITEM_UP_GRADE: "Up-Grade",
  ITEM_GEN4_EVOLUTION_STONE: "Sinnoh Stone",
  ITEM_GEN5_EVOLUTION_STONE: "Unova Stone",
  ITEM_RARE_CANDY: "Rare Candy",
  ITEM_XL_RARE_CANDY: "Rare Candy XL",
  ITEM_MOVE_REROLL_FAST_ATTACK: "Fast TM",
  ITEM_MOVE_REROLL_SPECIAL_ATTACK: "Charged TM",
  ITEM_MOVE_REROLL_ELITE_FAST_ATTACK: "Elite Fast TM",
  ITEM_MOVE_REROLL_ELITE_SPECIAL_ATTACK: "Elite Charged TM",
  ITEM_SINGLE_STAT_INCREASE: "Single Stat Increase",
  ITEM_TRIPLE_STAT_INCREASE: "Triple Stat Increase",
};

/** Os itens que não evoluem nada, na ordem em que o guia os mostra. */
export const ITENS_DO_GUIA: readonly { id: string; explicacao: string }[] = [
  { id: "ITEM_RARE_CANDY", explicacao: "items.rareCandy" },
  { id: "ITEM_XL_RARE_CANDY", explicacao: "items.rareCandyXL" },
  { id: "ITEM_SINGLE_STAT_INCREASE", explicacao: "items.statSingle" },
  { id: "ITEM_TRIPLE_STAT_INCREASE", explicacao: "items.statTriple" },
  { id: "ITEM_MOVE_REROLL_FAST_ATTACK", explicacao: "items.fastTM" },
  { id: "ITEM_MOVE_REROLL_SPECIAL_ATTACK", explicacao: "items.chargedTM" },
  { id: "ITEM_MOVE_REROLL_ELITE_FAST_ATTACK", explicacao: "items.eliteTM" },
  { id: "ITEM_MOVE_REROLL_ELITE_SPECIAL_ATTACK", explicacao: "items.eliteTM" },
];
