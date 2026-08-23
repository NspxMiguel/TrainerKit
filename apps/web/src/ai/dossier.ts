import {
  computeCPAtLevel,
  effectiveness,
  isObtainable,
  rankDefenders,
  rankMovesets,
  type MoveWithPvp,
} from "@trainerkit/core";

import { canonico, type Dataset, type DatasetSpecies } from "../data/useDataset.ts";
import type { OwnedPokemon } from "../storage/collection.ts";

/**
 * Tudo que o app sabe sobre uma especie, em texto, pra IA ler.
 *
 * Nasceu de um defeito claro: perguntar a Especies "e bom pra segurar ginasio?"
 * devolvia "Nao tem esse dado" — sendo que o app CALCULA exatamente isso, no
 * `rankDefenders`. A resposta estava a uma funcao de distancia e o modelo nao
 * tinha como saber, porque o que chegava a ele era so a locucao de oito linhas,
 * com a instrucao "responda usando SÓ a ficha".
 *
 * "essa pokedex q devia ser alimentada por ia tambem. tipo a pokedex da
 * serie/filme msm" — o aparelho da serie responde qualquer coisa sobre o bicho
 * porque ELE SABE tudo sobre o bicho. Entao o consertado nao e afrouxar a regra
 * (deixar o modelo inventar), e AUMENTAR o que ele recebe.
 *
 * A regra de ouro do app continua de pe, e e o que separa isto de um chatbot de
 * especie: TODO numero daqui foi calculado por `packages/core`. O modelo escolhe
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
function faixas(data: Dataset, idioma: string) {
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

  /*
   * Em português, com gênero. Fora dele, EM INGLÊS.
   *
   * ⚠️ A segunda metade desta frase é um conserto, não uma escolha de estilo.
   * Com as faixas em português e a ordem de "traduza", o alemão saiu assim:
   *
   *   "Seine Verteidigung ist MEDIANA mit 169. (…) einen AGUENTOwert von 58.633.
   *    Seine Verteidigung ist also sehr stark"
   *
   * Duas falhas na mesma frase: copiou a palavra portuguesa crua, e depois
   * contradisse a si mesmo chamando de "sehr stark" (muito forte) a defesa que
   * ele acabou de marcar como mediana. Palavra que o modelo não entende no meio
   * do texto ele ou copia, ou ignora — e ignorar a faixa traz de volta
   * exatamente o bug do "alto ataque de Blissey".
   *
   * Inglês resolve os dois: é a língua-ponte de qualquer modelo, os adjetivos
   * não flexionam (adeus gênero), e "low" ele traduz certo pra alemão sempre.
   * Não é o idioma do usuário — é o idioma dos DADOS, e o cabeçalho do sistema
   * já manda escrever a resposta na língua da tela.
   */
  const ROTULOS_PT = {
    muitoBaixo: { m: "muito baixo", f: "muito baixa" },
    baixo: { m: "baixo", f: "baixa" },
    mediano: { m: "mediano", f: "mediana" },
    alto: { m: "alto", f: "alta" },
    muitoAlto: { m: "muito alto", f: "muito alta" },
  } as const;

  const ROTULOS_EN = {
    muitoBaixo: { m: "very low", f: "very low" },
    baixo: { m: "low", f: "low" },
    mediano: { m: "average", f: "average" },
    alto: { m: "high", f: "high" },
    muitoAlto: { m: "very high", f: "very high" },
  } as const;

  const ROTULOS = idioma === "pt-BR" ? ROTULOS_PT : ROTULOS_EN;
  const maiorDoJogo =
    idioma === "pt-BR"
      ? (g: "m" | "f") => `${g === "f" ? "a" : "o"} maior do jogo`
      : () => "the highest in the game";
  const maiorQue =
    idioma === "pt-BR"
      ? (pct: number) => `maior que ${pct}% das espécies`
      : (pct: number) => `higher than ${pct}% of all species`;

  return (k: "atk" | "def" | "hp", valor: number): string => {
    const v = listas[k];
    const g = genero[k];

    // "o maior do jogo" pra ataque, "a maior do jogo" pra defesa e resistência.
    if (valor >= v[v.length - 1]!) return `${valor} (${maiorDoJogo(g)})`;

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

    return `${valor} (${rotulo[g]}: ${maiorQue(pct)})`;
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
  /**
   * O idioma da RESPOSTA — que decide o idioma das faixas aqui dentro.
   *
   * Fora do português elas saem em inglês, pra o modelo não copiar palavra
   * portuguesa crua pro meio da resposta. Ver a nota em `faixas`.
   */
  idioma = "pt-BR",
): string {
  const linhas: string[] = [];
  const nomeTipo = (t: string) => t;

  linhas.push(`Nome: ${species.name} (nº ${species.dex})`);
  linhas.push(`Tipos: ${species.types.join(" / ")}`);
  const faixa = faixas(data, idioma);
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

    /*
     * "O Blissey aguenta 58.633 oq?"
     *
     * A pergunta e justa, e ela se responde sozinha: 58.633 nao e pontos de vida, nem segundos, nem golpes. E um
     * INDICE: defesa x vida dividido pelo dano medio que a tabela de tipos
     * deixa ele sofrer. Sozinho nao quer dizer nada; so serve pra comparar um
     * especie com outro.
     *
     * Eu escrevia "aguento 58.633" como se fosse medida, e o modelo repetiu do
     * jeito que chegou. Mesmo erro de classe do "ataque 129" sem escala: numero
     * sem referencia obriga quem le a inventar o significado.
     *
     * Agora o dossie diz o que o numero e, e a regra em DEX_SYSTEM proibe
     * solta-lo sem a comparacao do lado.
     */
    const pt = idioma === "pt-BR";
    const num = (n: number) => Math.round(n).toLocaleString(pt ? "pt-BR" : "en-US");

    /*
     * O próprio Blissey não se compara consigo mesmo.
     *
     * ⚠️ "100% do melhor defensor que existe" é uma frase que o modelo não sabe
     * ler quando a espécie É o melhor defensor. Saiu isto, testando:
     *
     *   russo:   "pode aguentar 100% dos ataques do melhor defensor do jogo"
     *            — inventou um significado pro índice
     *   coreano: "o mesmo nível do Blissey, o melhor defensor" — comparando o
     *            Blissey com o Blissey
     *
     * Os dois estão certos em achar a frase estranha: ela É estranha. Quando a
     * espécie é a referência, o que há pra dizer é que ela É o teto.
     */
    const ehAReferencia = ref > 0 && Math.abs(meu - ref) < 0.5;

    const emPercentual =
      ref <= 0
        ? ""
        : ehAReferencia
          ? pt
            ? ` Este É o melhor defensor de ginásio do jogo — nenhum outro chega perto; ele é o teto da escala.`
            : ` THIS IS the best gym defender in the game — nothing else comes close; it is the top of the scale.`
          : pt
            ? ` Na mesma escala, o Blissey — a melhor parede do jogo — marca ${num(ref)}, ` +
              `então este aqui é ${Math.round((meu / ref) * 100)}% do melhor defensor que existe.`
            : ` On the same scale Blissey, the best wall in the game, scores ${num(ref)}, ` +
              `so this one is ${Math.round((meu / ref) * 100)}% of the best defender there is.`;

    /*
     * A linha inteira em inglês fora do português.
     *
     * ⚠️ "aguento" era a última palavra portuguesa solta na resposta em alemão:
     * saía "einen AGUENTOwert von 58.633". Mesmo motivo das faixas — palavra que
     * o modelo não reconhece ele copia crua. "Bulk index" ele traduz certo pra
     * qualquer uma das dez línguas.
     */
    linhas.push(
      pt
        ? `Como defensor de ginásio: índice de aguento ${num(meu)}. ` +
            `ESTE NÚMERO NÃO TEM UNIDADE — não é vida, não é tempo, não é dano. É uma escala de ` +
            `comparação entre especie: defesa x vida (${num(comoDefensor.bulk)}) ` +
            `dividido pelo dano que a tabela de tipos deixa ele sofrer, no nível ${NIVEL_REF} com IV perfeito.` +
            `${emPercentual} ` +
            `Dano médio que recebe pela tabela de tipos: ${comoDefensor.incomingAverage.toFixed(2)}x. ` +
            `Lembre: num defensor o ATAQUE não conta — ele não escolhe golpe nem mira fraqueza.`
        : `As a gym defender: bulk index ${num(meu)}. ` +
            `THIS NUMBER HAS NO UNIT — it is not HP, not time, not damage. It is a comparison scale ` +
            `between especie: defense x stamina (${num(comoDefensor.bulk)}) divided by the damage the ` +
            `type chart lets it take, at level ${NIVEL_REF} with perfect IVs.` +
            `${emPercentual} ` +
            `Average damage taken from the type chart: ${comoDefensor.incomingAverage.toFixed(2)}x. ` +
            `Remember: for a defender ATTACK does not count — it picks no move and targets no weakness.`,
    );
  }

  /* ------------------------------------------------- com quem se compara */

  /*
   * O TOPO do jogo entra junto.
   *
   * "O dossiê não fornece informações sobre outros especie, então não é possível
   * comparar" — foi a resposta que ele levou ao perguntar "o melhor pokemon para
   * segurar ginasio?". E o modelo estava certo: eu mandava a especie sozinha.
   * Perguntar "qual o melhor" e a pergunta mais natural que existe numa Especies,
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

    /*
     * A LINHA INTEIRA, e a FORMA FINAL — nao so o proximo passo.
     *
     * ⚠️ Perguntei "vale a pena evoluir ele?" na ficha do Bulbasaur e o modelo
     * respondeu, com razao: "não tenho informações sobre a linha evolutiva
     * completa do Bulbasaur". Ele estava certo — o dossie dizia "Evolui para:
     * Ivysaur" e parava ali.
     *
     * E um passo so nao responde a pergunta. Quem pergunta se vale evoluir quer
     * saber onde a linha TERMINA: evoluir um Bulbasaur so vale a pena porque no
     * fim tem um Venusaur, e o que decide e o quanto o Venusaur presta.
     *
     * Entao a linha completa entra, com o PC maximo da forma final — que e o
     * numero que muda a decisao.
     */
    /*
     * ⚠️ SO quando a linha e RETA. Linha que se divide nao tem "forma final".
     *
     * Meu primeiro rascunho seguia sempre o primeiro ramo, e o Eevee saiu assim:
     *
     *   "Linha evolutiva completa: Eevee → Vaporeon. A forma final é Vaporeon
     *    (…) É ELA que decide se vale a pena evoluir."
     *
     * Mentira com toda a confianca do mundo: o Eevee tem OITO evolucoes, e
     * Vaporeon e so a primeira da lista. Eu tinha ate escrito no comentario que
     * pegava "so o primeiro ramo" — e mesmo assim rotulei o resultado de
     * "completa". O comentario sabia; o texto que chega no modelo, nao.
     *
     * Quando ha ramos, a linha "Evolui para" acima ja lista todos, e ela e a
     * resposta certa. Acrescentar uma escolha arbitraria seria pior que nao ter.
     */
    const cadeia: string[] = [];
    const visto = new Set<string>([species.id]);
    let atual: DatasetSpecies | undefined = species;
    let temRamo = false;

    while (atual && atual.evolvesInto.length > 0) {
      if (atual.evolvesInto.length > 1) {
        temRamo = true;
        break;
      }
      const proximoId: string | undefined = atual.evolvesInto[0];
      if (!proximoId || visto.has(proximoId)) break;
      visto.add(proximoId);
      const proximo: DatasetSpecies | undefined = data.species.find((x) => x.id === proximoId);
      if (!proximo) break;
      cadeia.push(proximo.name);
      atual = proximo;
    }

    if (!temRamo && cadeia.length > 0 && atual) {
      const pcFinal = computeCPAtLevel(data.cpm, atual.baseStats, PERFEITO, NIVEL_REF);
      linhas.push(
        `Linha evolutiva completa: ${species.name} → ${cadeia.join(" → ")}. ` +
          `A forma final é ${atual.name}: ataque ${faixa("atk", atual.baseStats.atk)}, ` +
          `defesa ${faixa("def", atual.baseStats.def)}, ` +
          `resistência ${faixa("hp", atual.baseStats.hp)}, ` +
          `PC máximo ${Math.round(pcFinal)} no nível ${NIVEL_REF} com IV perfeito. ` +
          `É ELA que decide se vale a pena evoluir.`,
      );
    }
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

  /*
   * ⚠️ PELO CANÔNICO, senão a IA jura que ele não tem o bicho.
   *
   * A comparação era de id cru, e a coleção guarda o id da FORMA: o Venusaur
   * dele está salvo como `venusaur_normal` e a ficha aberta pela Especies é
   * `venusaur`. O dossiê saía sem a linha "o jogador tem 1", e o modelo então
   * responde com toda a confiança que ele não tem nenhum — a mesma família do
   * defeito de tratar IV ausente como IV zero.
   */
  const canon = canonico(data.species);
  const meus = owned.filter((o) => canon(o.speciesId) === canon(species.id));
  if (meus.length > 0) {
    linhas.push(
      `O jogador tem ${meus.length}: ` +
        meus
          .map((o) => {
            /*
             * ⚠️ IV NÃO INFORMADO NÃO É IV ZERO.
             *
             * A Especies respondia "O IV do Bulbasaur do jogador é 0" sobre um
             * bicho que só tinha sido marcado como "eu tenho esse" — IV não
             * informado virava IV zero.
             *
             * Os `ivs` vêm zerados porque o tipo exige três números. O veredito
             * já sabia disso; o dossiê somava os zeros e entregava o resultado
             * ao modelo como fato medido — e o modelo repetiu, com a confiança
             * de quem recebeu um número.
             */
            if (o.ivDesconhecido) {
              const partes = ["IV NÃO informado (o jogador só marcou que tem)"];
              if (o.cp !== null) partes.push(`PC ${o.cp}`);
              if (o.level !== null) partes.push(`nível ${o.level}`);
              if (o.shadow) partes.push("sombroso");
              if (o.lucky) partes.push("lucky");
              return partes.join(" ");
            }

            const iv = o.ivs.atk + o.ivs.def + o.ivs.hp;
            /*
             * ⚠️ OS DOIS NÚMEROS, e a porcentagem primeiro.
             *
             * A tela mostrava 39/45 e 87%, o dossiê mandava só o 39, e a
             * Especies respondeu "39". Não
             * estava errada; estava falando outra língua. Quem joga fala em
             * porcentagem, e é isso que a própria tela do app mostra em letra
             * grande.
             */
            const partes = [
              `IV ${Math.round((iv / 45) * 100)}% (${iv} de 45; atk ${o.ivs.atk}, def ${o.ivs.def}, PS ${o.ivs.hp})`,
            ];
            if (o.cp !== null) partes.push(`PC ${o.cp}`);
            if (o.level !== null) partes.push(`nível ${o.level}`);
            if (o.shadow) partes.push("sombroso");
            if (o.lucky) partes.push("lucky");
            return partes.join(" ");
          })
          .join("; "),
    );
  } else {
    /*
     * ⚠️ A frase e a mesma; o que mudou e o que vem DEPOIS dela.
     *
     * Antes era so "O jogador não tem nenhum desta espécie na coleção." — e o
     * modelo tratou isso como A resposta. Perguntei "vale a pena evoluir ele?"
     * na ficha do Bulbasaur e levei:
     *
     *   "Não há Bulbasaur na coleção do jogador, então não há o que evoluir."
     *
     * Tecnicamente verdadeiro e completamente inutil. Quem esta lendo a ficha de
     * uma especie na Especies esta perguntando sobre A ESPECIE — se vale a pena
     * evoluir um Bulbasaur, em geral. A ausencia na colecao e contexto, nao
     * impedimento.
     *
     * O erro e da mesma familia de todos os outros deste arquivo: o modelo
     * respondeu com precisao a pergunta errada, porque o texto que eu mandei
     * fazia a informacao errada parecer a mais importante.
     */
    linhas.push(
      "O jogador não tem nenhum desta espécie na coleção. " +
        "Isso NÃO impede a resposta: perguntas sobre esta espécie devem ser " +
        "respondidas em geral, como se fosse um exemplar qualquer dela. Só " +
        "mencione a ausência se a pergunta for especificamente sobre o que o " +
        "jogador possui.",
    );
  }

  return linhas.join("\n");
}

/**
 * O que a Especies pode e nao pode fazer com o dossie.
 *
 * A referencia e a Especies da serie: la o aparelho responde qualquer pergunta
 * sobre o bicho, no tom de quem esta lendo um registro. Entao o tom aqui e esse
 * — direto, informativo, sem "olá" e sem "espero ter ajudado".
 *
 * A restricao que fica: os NUMEROS sao do dossie. O modelo pode raciocinar em
 * cima deles ("aguento alto e poucas fraquezas, entao segura bem"), que e o que
 * torna a resposta util, mas nao pode inventar um numero que nao esta ali. E a
 * mesma linha que o app inteiro respeita.
 */
export const DEX_SYSTEM = `Você é a Especies do TrainerKit, um app de o jogo.

Sua memória sobre esta especie inclui: atributos, tabela de tipos, aguento como
defensor de ginásio, posição nos rankings de raide e das três ligas, melhores
golpes, linha evolutiva, o que o jogador tem dele, e os melhores do jogo em
defesa e em ataque de raide para comparação.

Responda a pergunta a partir dele.

Regras rígidas:
- NUNCA cite o dossiê, "os dados fornecidos", "as informações que recebi" ou
  qualquer coisa parecida. Você É a Especies: esses números são a SUA memória, não
  um documento que alguém te passou. Diga "Dragonite segura bem", nunca "de
  acordo com o dossiê, Dragonite segura bem".
- O ÍNDICE DE AGUENTO não tem unidade. Não é vida, não é tempo, não é dano — é
  só uma escala pra comparar especie entre si. Então NUNCA escreva "aguenta
  58.633" e pare aí: quem lê pergunta "58.633 o quê?", e está certo em
  perguntar. Diga sempre a comparação, que é o que significa alguma coisa: "é a
  melhor parede do jogo", "aguenta metade do que um Blissey aguenta", "51% do
  melhor defensor que existe". Se for citar o número, chame de "índice" e ponha
  a comparação na mesma frase.
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
  "alta" só porque o resto da especie é bom, e não vira "alta" por estar na mesma
  frase que outro atributo que é alto. Cite atributos medianos separadamente ou não os
  cite.
- Não invente adjetivo pra número nenhum. Se a memória não deu a palavra, dê o
  número e siga.
- Comparações só valem contra o que está na sua memória (o Blissey de
  referência, os melhores do jogo). Não compare com uma especie que você não
  recebeu.
- Não gere, descreva nem ofereça imagens.
- Tom de aparelho: direto, informativo, sem saudação e sem se despedir.
- No máximo 4 frases curtas.`;

/**
 * O idioma da resposta, dito ANTES de tudo e pelo nome.
 *
 * ⚠️ ISTO ESTAVA QUEBRADO, e só apareceu quando a IA foi testada fora do
 * português — coisa que ninguém tinha feito. Testado:
 *
 *   pergunta em inglês  → resposta em PORTUGUÊS
 *   pergunta em japonês → resposta em PORTUGUÊS
 *   pergunta em alemão  → "Blissey hat einen BAIXO Angriff und eine MEDIANA
 *                          Verteidigung (…) einen hohen AGUENTOwert"
 *
 * O alemão é o caso que explica os três: as regras acima e o dossiê inteiro são
 * 2.000 caracteres de português, e a instrução de idioma era UMA frase no fim de
 * tudo. O modelo seguiu a massa, não a linha. E as palavras de faixa ("baixo",
 * "mediana") são strings portuguesas cravadas no dossiê — ele copiou como
 * chegaram, colando português no meio do alemão.
 *
 * Duas correções, e as duas importam:
 *   1. O idioma vem no TOPO e pelo NOME ("English"), não como "o idioma da
 *      pergunta" — que obriga o modelo a inferir antes de obedecer.
 *   2. As palavras de faixa são declaradas como português A TRADUZIR, com a
 *      ordem preservada. Sem isso, "mediana" vira "mediana" em qualquer língua.
 *
 * O dossiê continua em português de propósito: é a MESMA string pra todos os
 * idiomas, então cai no cache de prefixo da Groq (que não conta pro limite) e
 * não multiplica por dez a superfície onde eu posso errar um número.
 */
const NOMES: Record<string, string> = {
  "pt-BR": "Portuguese (Brazil)",
  en: "English",
  es: "Spanish (Spain)",
  "es-419": "Spanish (Latin America)",
  fr: "French",
  de: "German",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  ru: "Russian",
};

export function dexSystem(language: string): string {
  const nome = NOMES[language] ?? "Portuguese (Brazil)";

  // Português cai no prompt original sem cabeçalho: é o idioma em que ele já
  // está escrito, e uma instrução redundante só gastaria tokens.
  if (language === "pt-BR") return DEX_SYSTEM;

  /*
   * A lista de palavras PROIBIDAS, e não só a de traduções.
   *
   * ⚠️ Traduzir não bastou. Mesmo com o dossiê já em inglês, o alemão saiu com
   * "einen sehr hohen AGUENTOwert" — e a palavra não vinha mais do dossiê, vinha
   * DESTAS REGRAS, que continuam escritas em português e citam "índice de
   * aguento" ao explicar que ele não tem unidade.
   *
   * O modelo não distingue "português que eu devo obedecer" de "português que eu
   * posso copiar". Então a instrução deixa de ser "traduza" e passa a ser
   * "estas palavras não podem aparecer na sua resposta", que é verificável por
   * quem lê — inclusive por mim, no teste.
   */
  return (
    `WRITE YOUR ENTIRE ANSWER IN ${nome.toUpperCase()}.\n` +
    `The notes below are written in Portuguese. They are DATA, not your output language.\n` +
    `NEVER let these Portuguese words appear in your answer, not even inside a compound ` +
    `word: aguento, baixo, baixa, mediano, mediana, alto, alta, resistência, ataque, defesa.\n` +
    `Use the ${nome} equivalent instead: "muito baixo" = very low, "baixo" = low, ` +
    `"mediano/mediana" = average, "alto/alta" = high, "muito alto/alta" = very high, ` +
    `"índice de aguento" = bulk index.\n` +
    `Keep each band's meaning exactly — never promote a low or average stat to a high one ` +
    `while translating, and never call a especie strong in a stat the notes marked as ` +
    `average.\n\n${DEX_SYSTEM}`
  );
}
