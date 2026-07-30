import {
  computeCPAtLevel,
  effectiveness,
  isObtainable,
  rankDefenders,
  rankMovesets,
  type MoveWithPvp,
} from "@trainerkit/core";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import type { OwnedPokemon } from "../storage/collection.ts";

/**
 * Tudo que o app sabe sobre uma especie, em texto, pra IA ler.
 *
 * Nasceu de um erro meu que o Miguel pegou na hora. Ele perguntou pra Pokedex
 * "é bom pra segurar ginásio?" e ela respondeu "Não tem esse dado" — sendo que o
 * app CALCULA exatamente isso desde ontem, no `rankDefenders`. A resposta estava
 * a uma funcao de distancia e o modelo nao tinha como saber, porque eu mandei
 * pra ele so a locucao de oito linhas e escrevi "responda usando SÓ a ficha".
 *
 * "essa pokedex q devia ser alimentada por ia tambem. tipo a pokedex da
 * serie/filme msm" — o aparelho da serie responde qualquer coisa sobre o bicho
 * porque ELE SABE tudo sobre o bicho. Entao o consertado nao e afrouxar a regra
 * (deixar o modelo inventar), e AUMENTAR o que ele recebe.
 *
 * A regra de ouro do app continua de pe, e e o que separa isto de um chatbot de
 * Pokemon: TODO numero daqui foi calculado por `packages/core`. O modelo escolhe
 * o que dizer, nunca de onde tirar.
 *
 * O texto e cru e sem traducao de propósito: o modelo le qualquer idioma, e
 * traduzir aqui so gastaria contexto. Quem traduz e ele, na resposta.
 */

const NIVEL_REF = 40;
const PERFEITO = { atk: 15, def: 15, hp: 15 };

/** Quantos golpes listar por contexto. Tres ja mostra o padrao sem virar tabela. */
const MOVESETS = 3;

/** Quantos nomes no topo do jogo. Cinco da pra comparar sem virar tabela. */
const TOPO = 5;

function movesetsDe(
  species: DatasetSpecies,
  data: Dataset,
  contexto: "raid" | "pvp",
): string[] {
  const porId = new Map<string, MoveWithPvp>();
  for (const m of data.fastMoves) porId.set(m.id, m as unknown as MoveWithPvp);
  for (const m of data.chargedMoves) porId.set(m.id, m as unknown as MoveWithPvp);

  const fast = [...species.fastMoves, ...species.eliteFastMoves]
    .map((id) => porId.get(id))
    .filter((m): m is MoveWithPvp => m !== undefined);
  const charged = [...species.chargedMoves, ...species.eliteChargedMoves]
    .map((id) => porId.get(id))
    .filter((m): m is MoveWithPvp => m !== undefined);
  if (fast.length === 0 || charged.length === 0) return [];

  return rankMovesets(fast, charged, contexto, {
    attackerTypes: species.types,
    chart: data.typeChart,
    order: data.typeOrder,
    stabMultiplier: data.settings.battle.sameTypeAttackBonusMultiplier,
  })
    .slice(0, MOVESETS)
    .map((m) => `${m.fast.name} + ${m.charged.name}${m.needsElite ? " (precisa de TM Elite)" : ""}`);
}

/**
 * Aguento como defensor, pela MESMA funcao que a tela do Ginasio usa.
 *
 * Extraido pra que a especie e a referencia (Blissey) passem pelo mesmo caminho:
 * duas contas parecidas em lugares diferentes e como dois numeros nascem
 * divergentes.
 */
function defenderBulk(species: DatasetSpecies | undefined, data: Dataset) {
  if (!species) return null;
  return (
    rankDefenders(
      [
        {
          id: species.id,
          speciesId: species.id,
          name: species.name,
          types: species.types,
          baseStats: species.baseStats,
          ivs: PERFEITO,
          level: NIVEL_REF,
        },
      ],
      data.cpm,
      data.typeChart,
      data.typeOrder,
    )[0] ?? null
  );
}

/**
 * O dossie.
 *
 * Uma linha por fato, sem JSON: JSON gasta o dobro de tokens em chaves e aspas
 * pra dizer a mesma coisa, e o modelo le lista tao bem quanto objeto.
 */
export function speciesDossier(
  species: DatasetSpecies,
  data: Dataset,
  owned: readonly OwnedPokemon[] = [],
): string {
  const linhas: string[] = [];
  const nomeTipo = (t: string) => t;

  linhas.push(`Nome: ${species.name} (nº ${species.dex})`);
  linhas.push(`Tipos: ${species.types.join(" / ")}`);
  linhas.push(
    `Atributos base: ataque ${species.baseStats.atk}, defesa ${species.baseStats.def}, resistência ${species.baseStats.hp}`,
  );

  if (species.heightDm != null && species.weightHg != null) {
    linhas.push(`Tamanho: ${species.heightDm / 10} m, ${species.weightHg / 10} kg`);
  }

  linhas.push(
    `PC máximo com IV perfeito: ${computeCPAtLevel(data.cpm, species.baseStats, PERFEITO, 40)} no nível 40, ` +
      `${computeCPAtLevel(data.cpm, species.baseStats, PERFEITO, data.version.levelCap)} no nível ${data.version.levelCap}`,
  );

  /* --------------------------------------------------- tabela de tipos */

  const fracoA: string[] = [];
  const resiste: string[] = [];
  for (const tipo of data.typeOrder) {
    const mult = effectiveness(data.typeChart, data.typeOrder, tipo, species.types);
    if (mult > 1) fracoA.push(`${nomeTipo(tipo)} (${mult.toFixed(2)}x)`);
    else if (mult < 1) resiste.push(`${nomeTipo(tipo)} (${mult.toFixed(2)}x)`);
  }
  linhas.push(`Sofre mais de: ${fracoA.join(", ") || "nada"}`);
  linhas.push(`Resiste a: ${resiste.join(", ") || "nada"}`);

  /* ------------------------------------------------------- defesa de ginasio */

  /*
   * A pergunta que fez este arquivo existir.
   *
   * "é bom pra segurar ginásio?" tem resposta calculavel: aguento vezes
   * resistencia, dividido pelo dano medio que a tabela deixa ele sofrer. O
   * numero vem do mesmo `rankDefenders` que a tela do Ginasio usa, entao as duas
   * NUNCA se contradizem.
   */
  const comoDefensor = defenderBulk(species, data);

  if (comoDefensor) {
    /*
     * A referencia e CALCULADA, nunca escrita.
     *
     * ⚠️ Eu tinha posto "Blissey tem aguento perto de 5.100.000" de cabeça. O
     * numero real e 58.602 — errei por 87 vezes. E o estrago nao foi cosmetico:
     * o modelo comparou Dragonite (29.795) com os 5,1 milhoes inventados e
     * concluiu "não é bom para segurar ginásio", quando na verdade ele tem 51%
     * do aguento do melhor defensor do jogo, o que e bem respeitavel.
     *
     * Numero inventado no contexto faz o modelo errar COM CONFIANÇA, que e
     * exatamente o defeito que este app inteiro existe pra nao ter. Agora sai do
     * mesmo `rankDefenders`, sobre o mesmo dataset, e nao tem como divergir.
     */
    const referencia = defenderBulk(
      data.species.find((s) => s.id === "blissey"),
      data,
    );

    const emPercentual =
      referencia && referencia.bulk > 0
        ? ` — ${Math.round((comoDefensor.bulk / referencia.bulk) * 100)}% do aguento do Blissey, ` +
          `que é a melhor parede do jogo (${Math.round(referencia.bulk).toLocaleString("pt-BR")})`
        : "";

    linhas.push(
      `Como defensor de ginásio: aguento (defesa x vida) ${Math.round(comoDefensor.bulk).toLocaleString("pt-BR")} ` +
        `no nível ${NIVEL_REF} com IV perfeito${emPercentual}. ` +
        `Dano médio que recebe pela tabela de tipos: ${comoDefensor.incomingAverage.toFixed(2)}x. ` +
        `Lembre: num defensor o ATAQUE não conta — ele não escolhe golpe nem mira fraqueza.`,
    );
  }

  /* ------------------------------------------------- com quem se compara */

  /*
   * O TOPO do jogo entra junto.
   *
   * "O dossiê não fornece informações sobre outros Pokémon, então não é possível
   * comparar" — foi a resposta que ele levou ao perguntar "o melhor pokemon para
   * segurar ginasio?". E o modelo estava certo: eu mandava a especie sozinha.
   * Perguntar "qual o melhor" e a pergunta mais natural que existe numa Pokedex,
   * e ela precisa de uma lista pra ser respondida.
   *
   * Cinco nomes de cada, calculados aqui — nao uma opiniao minha sobre quem e
   * bom.
   */
  const melhoresDefensores = rankDefenders(
    data.species
      .filter((sp) => sp.cosmeticOf === null && isObtainable(sp.id))
      .map((sp) => ({
        id: sp.id,
        speciesId: sp.id,
        name: sp.name,
        types: sp.types,
        baseStats: sp.baseStats,
        ivs: PERFEITO,
        level: NIVEL_REF,
      })),
    data.cpm,
    data.typeChart,
    data.typeOrder,
  ).slice(0, TOPO);

  linhas.push(
    `Melhores defensores de ginásio do jogo (aguento no nível ${NIVEL_REF}, IV perfeito): ` +
      melhoresDefensores
        .map((d, i) => `${i + 1}º ${d.name} ${Math.round(d.bulk).toLocaleString("pt-BR")}`)
        .join(", "),
  );

  const topoRaide = (data.rankings?.raidOverall ?? []).slice(0, TOPO);
  if (topoRaide.length > 0) {
    linhas.push(
      `Melhores atacantes de raide do jogo: ` +
        topoRaide.map((r, i) => `${i + 1}º ${r.name}`).join(", "),
    );
  }

  /* ------------------------------------------------------------- rankings */

  const tipoPrimario = species.types[0] ?? "normal";
  const listaRaide = data.rankings?.raidByType[tipoPrimario] ?? [];
  const posRaide = listaRaide.findIndex((r) => r.speciesId === species.id);
  linhas.push(
    posRaide >= 0
      ? `Ranking de atacante de ${tipoPrimario} para raide: ${posRaide + 1}º de ${listaRaide.length} listados`
      : `Não está entre os ${listaRaide.length} melhores atacantes de ${tipoPrimario} para raide`,
  );

  for (const liga of ["great", "ultra", "master"] as const) {
    const lista = data.rankings?.statProductByLeague[liga] ?? [];
    const pos = lista.findIndex((r) => r.speciesId === species.id);
    linhas.push(
      pos >= 0
        ? `Liga ${liga}: ${pos + 1}º de ${lista.length} por produto de atributos`
        : `Liga ${liga}: fora dos ${lista.length} primeiros por produto de atributos`,
    );
  }

  /* -------------------------------------------------------------- golpes */

  const raide = movesetsDe(species, data, "raid");
  const pvp = movesetsDe(species, data, "pvp");
  if (raide.length > 0) linhas.push(`Melhores golpes para raide: ${raide.join(" | ")}`);
  if (pvp.length > 0) linhas.push(`Melhores golpes para PvP: ${pvp.join(" | ")}`);

  /* ----------------------------------------------------------- evolucao */

  if (species.evolvesInto.length > 0) {
    const nomes = species.evolvesInto.map((id) => {
      const alvo = data.species.find((s) => s.id === id);
      const doces = species.candyToEvolve[id];
      return alvo ? `${alvo.name}${doces ? ` (${doces} doces)` : ""}` : id;
    });
    linhas.push(`Evolui para: ${nomes.join(", ")}`);
  } else {
    linhas.push("Não evolui mais: é forma final.");
  }

  if (species.parent) {
    const antes = data.species.find((s) => s.id === species.parent);
    if (antes) linhas.push(`Evolui a partir de: ${antes.name}`);
  }

  if (species.legendary) {
    linhas.push("É lendário, mítico ou Ultra Beast — aparece em raide de tier 5.");
  }

  /* ------------------------------------------------------- os dele */

  const meus = owned.filter((o) => o.speciesId === species.id);
  if (meus.length > 0) {
    linhas.push(
      `O jogador tem ${meus.length}: ` +
        meus
          .map((o) => {
            const iv = o.ivs.atk + o.ivs.def + o.ivs.hp;
            const partes = [`IV ${iv}/45`];
            if (o.cp !== null) partes.push(`PC ${o.cp}`);
            if (o.level !== null) partes.push(`nível ${o.level}`);
            if (o.shadow) partes.push("sombroso");
            if (o.lucky) partes.push("lucky");
            return partes.join(" ");
          })
          .join("; "),
    );
  } else {
    linhas.push("O jogador não tem nenhum desta espécie na coleção.");
  }

  return linhas.join("\n");
}

/**
 * O que a Pokedex pode e nao pode fazer com o dossie.
 *
 * "tipo a pokedex da serie/filme msm": la o aparelho responde qualquer pergunta
 * sobre o bicho, no tom de quem esta lendo um registro. Entao o tom aqui e esse
 * — direto, informativo, sem "olá" e sem "espero ter ajudado".
 *
 * A restricao que fica: os NUMEROS sao do dossie. O modelo pode raciocinar em
 * cima deles ("aguento alto e poucas fraquezas, entao segura bem"), que e o que
 * torna a resposta util, mas nao pode inventar um numero que nao esta ali. E a
 * mesma linha que o app inteiro respeita.
 */
export const DEX_SYSTEM = `Você é a Pokédex do TrainerKit, um app de Pokémon GO.

Sua memória sobre este Pokémon inclui: atributos, tabela de tipos, aguento como
defensor de ginásio, posição nos rankings de raide e das três ligas, melhores
golpes, linha evolutiva, o que o jogador tem dele, e os melhores do jogo em
defesa e em ataque de raide para comparação.

Responda a pergunta a partir dele.

Regras rígidas:
- NUNCA cite o dossiê, "os dados fornecidos", "as informações que recebi" ou
  qualquer coisa parecida. Você É a Pokédex: esses números são a SUA memória, não
  um documento que alguém te passou. Diga "Dragonite aguenta 29.795", nunca "de
  acordo com o dossiê, Dragonite aguenta 29.795".
- Você PODE raciocinar sobre os dados e tirar conclusões deles. "Aguento alto e
  só duas fraquezas, então segura ginásio bem" é uma resposta correta e é
  exatamente o que se espera de você.
- Você NÃO PODE inventar números, golpes, posições ou mecânicas. Se algo não
  estiver na sua memória, diga o que você sabe de mais próximo em vez de recusar
  — e nunca explique que "não foi fornecido".
- Não gere, descreva nem ofereça imagens.
- Tom de aparelho: direto, informativo, sem saudação e sem se despedir.
- No máximo 4 frases curtas. Responda no idioma da pergunta.`;
