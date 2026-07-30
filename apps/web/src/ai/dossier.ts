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
 * Onde cada atributo cai, comparado ao jogo inteiro.
 *
 * ⚠️ O defeito que isto conserta: eu mandava "Ataque 129" e o modelo respondeu
 * "o alto ataque de Blissey". Numero cru nao diz se e muito ou pouco, e o modelo
 * chuta — normalmente pra cima, porque a pergunta era elogiosa. Chutar a
 * MAGNITUDE de um numero certo e tao errado quanto inventar o numero.
 *
 * Agora cada atributo vem com a faixa dele, calculada sobre as especies reais do
 * proprio dataset. 129 de ataque deixa de ser "129" e passa a ser
 * "129 (baixo: maior que 27% das espécies)". Nao ha o que chutar.
 *
 * Os cortes (10/30/70/90) sao arbitrarios como toda faixa, mas o PERCENTIL que
 * acompanha nao e: quem quiser conferir, confere.
 */
function faixas(data: Dataset) {
  const reais = data.species.filter((s) => s.cosmeticOf === null && isObtainable(s.id));
  const ordenar = (k: "atk" | "def" | "hp") =>
    reais.map((s) => s.baseStats[k]).sort((a, b) => a - b);

  const listas = { atk: ordenar("atk"), def: ordenar("def"), hp: ordenar("hp") };

  /*
   * O GENERO de cada atributo.
   *
   * "ataque" e masculino; "defesa" e "resistência" sao femininos. Enquanto o
   * rotulo era so masculino, o modelo copiava a palavra como ela chegava e
   * escrevia "sua defesa é mediano" — vi isso na tela, na resposta sobre o
   * Blissey. Ele nao errou portugues: repetiu o meu.
   *
   * Concordancia e do texto que EU escrevo. Pedir no prompt "concorde o genero"
   * seria empurrar pro modelo um trabalho que uma tabela de duas colunas resolve
   * sem chance de erro.
   */
  const genero = { atk: "m", def: "f", hp: "f" } as const;

  const ROTULOS = {
    muitoBaixo: { m: "muito baixo", f: "muito baixa" },
    baixo: { m: "baixo", f: "baixa" },
    mediano: { m: "mediano", f: "mediana" },
    alto: { m: "alto", f: "alta" },
    muitoAlto: { m: "muito alto", f: "muito alta" },
  } as const;

  return (k: "atk" | "def" | "hp", valor: number): string => {
    const v = listas[k];
    const g = genero[k];

    // "o maior do jogo" pra ataque, "a maior do jogo" pra defesa e resistência.
    if (valor >= v[v.length - 1]!) {
      return `${valor} (${g === "f" ? "a" : "o"} maior do jogo)`;
    }

    const abaixo = v.filter((x) => x < valor).length;
    // Piso, nao arredondamento: com 1.181 espécies, arredondar dava
    // "maior que 100% das espécies" pra quem tem uma acima — uma frase que se
    // contradiz sozinha.
    const pct = Math.floor((abaixo / v.length) * 100);
    const rotulo =
      pct < 10
        ? ROTULOS.muitoBaixo
        : pct < 30
          ? ROTULOS.baixo
          : pct < 70
            ? ROTULOS.mediano
            : pct < 90
              ? ROTULOS.alto
              : ROTULOS.muitoAlto;

    return `${valor} (${rotulo[g]}: maior que ${pct}% das espécies)`;
  };
}

/**
 * Aguento como defensor, pela MESMA funcao que a tela do Ginasio usa.
 *
 * Extraido pra que a especie e a referencia (Blissey) passem pelo mesmo caminho:
 * duas contas parecidas em lugares diferentes e como dois numeros nascem
 * divergentes.
 */
/**
 * O numero pelo qual `rankDefenders` ORDENA.
 *
 * ⚠️ Bug que so apareceu quando eu imprimi o dossie inteiro e li: a lista dos
 * melhores defensores saia "4º Arceus (Steel) 39.789, 5º Giratina 44.763". A
 * ordem estava certa e o numero ao lado era outro — eu ordenava por um valor e
 * mostrava outro.
 *
 * `rankDefenders` classifica por `bulk / incomingAverage`, porque aguentar muito
 * e ser fraco a tudo se cancelam. Giratina tem menos defesa x vida que Arceus e
 * ainda assim segura mais, porque resiste a mais coisa. Eu mostrava so o `bulk`.
 *
 * Uma lista numerada cujos numeros nao explicam a numeracao e pior que nenhuma
 * lista: o modelo le a contradicao e ou repete ela, ou "conserta" reordenando
 * por conta propria. Esta funcao e a MESMA conta da linha 140 de `gym.ts`,
 * escrita a partir dos dois campos que o tipo expoe.
 */
function aguentoEfetivo(d: { bulk: number; incomingAverage: number }): number {
  return d.bulk / d.incomingAverage;
}

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
  const faixa = faixas(data);
  linhas.push(
    `Atributos base: ataque ${faixa("atk", species.baseStats.atk)}; ` +
      `defesa ${faixa("def", species.baseStats.def)}; ` +
      `resistência ${faixa("hp", species.baseStats.hp)}`,
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

    const meu = aguentoEfetivo(comoDefensor);
    const ref = referencia ? aguentoEfetivo(referencia) : 0;

    const emPercentual =
      ref > 0
        ? ` — ${Math.round((meu / ref) * 100)}% do aguento do Blissey, ` +
          `que é a melhor parede do jogo (${Math.round(ref).toLocaleString("pt-BR")})`
        : "";

    linhas.push(
      `Como defensor de ginásio: aguento ${Math.round(meu).toLocaleString("pt-BR")} ` +
        `(defesa x vida ${Math.round(comoDefensor.bulk).toLocaleString("pt-BR")}, dividido pelo dano que a ` +
        `tabela de tipos deixa ele sofrer) no nível ${NIVEL_REF} com IV perfeito${emPercentual}. ` +
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
    `Melhores defensores de ginásio do jogo (mesmo aguento acima, nível ${NIVEL_REF}, IV perfeito): ` +
      melhoresDefensores
        .map((d, i) => `${i + 1}º ${d.name} ${Math.round(aguentoEfetivo(d)).toLocaleString("pt-BR")}`)
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
- Cada atributo já vem com UMA palavra entre parênteses: muito baixo, baixo,
  mediano, alto ou muito alto (no feminino para defesa e resistência: baixa,
  mediana, alta). Ao falar daquele atributo, use ESSA palavra, como ela está
  escrita. Usar outra é tão errado quanto inventar o número — e vale também no
  meio de uma frase elogiosa: se a defesa está marcada "mediana", ela não vira
  "alta" só porque o resto do Pokémon é bom, e não vira "alta" por estar na mesma
  frase que outro atributo que é alto. Cite atributos medianos separadamente ou não os
  cite.
- Não invente adjetivo pra número nenhum. Se a memória não deu a palavra, dê o
  número e siga.
- Comparações só valem contra o que está na sua memória (o Blissey de
  referência, os melhores do jogo). Não compare com um Pokémon que você não
  recebeu.
- Não gere, descreva nem ofereça imagens.
- Tom de aparelho: direto, informativo, sem saudação e sem se despedir.
- No máximo 4 frases curtas. Responda no idioma da pergunta.`;
