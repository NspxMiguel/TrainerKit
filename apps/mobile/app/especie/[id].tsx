import { Link, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  ACTION_KEYS,
  CONTEXT_KEYS,
  buildDexEntry,
  GROQ_MODEL,
  computeCPAtLevel,
  decide,
  groqChat,
  custoDosMaxAtaques,
  fazGigantamax,
  groupIdenticalContexts,
  papelNaBatalhaMax,
  rankMovesets,
  shadowDamageMultiplier,
  tetoDePowerUp,
  withFrustration,
  type Key,
  type MoveWithPvp,
} from "@trainerkit/core";
import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { useIA } from "../../src/ia";
import { calar, falar } from "../../src/voz";
import { useSetup } from "../../src/setup";
import { useTema, type Paleta } from "../../src/tema";
import { Selo } from "../../src/Selo";

/**
 * A ficha da especie — e a PROVA de que o port funciona.
 *
 * ⚠️ O `decide` daqui e o MESMO arquivo que o app web usa: `packages/core`, sem
 * uma linha alterada, sem DOM. Se o veredito sair certo nesta tela, os 5.821
 * linhas de logica portaram — que era a aposta inteira de escolher React Native
 * em vez de Swift.
 */
/* O veredito e a unica cor com significado nesta tela, e por isso ela troca
   com o tema: `#3ddc97` da 10,5:1 sobre o cartao preto e 1,8:1 sobre o branco.
   O nome da acao e que e estavel — o tom, nao. */
/** As tres ligas, na ordem em que a melhor posicao e procurada. */
const LIGAS = ["great", "ultra", "master"] as const;

/** O arquetipo, em uma frase. As cinco chaves ja existem nos dez idiomas. */
const ARQUETIPO: Record<string, Key> = {
  monster: "dex.build.monster",
  glassCannon: "dex.build.glassCannon",
  wall: "dex.build.wall",
  balanced: "dex.build.balanced",
  frail: "dex.build.frail",
};

/* Os quatro papeis da Batalha Max, e a chave que diz cada um nos dez idiomas. */
const PAPEL_MAX: Record<string, Key> = {
  atacante: "species.maxRole.atacante",
  guarda: "species.maxRole.guarda",
  espirito: "species.maxRole.espirito",
  equilibrado: "species.maxRole.equilibrado",
};

const COR_ACAO: Record<string, keyof Paleta> = {
  investir: "investir",
  evoluir: "evoluir",
  guardar: "guardar",
  transferir: "transferir",
  descobrir: "descobrir",
};

export default function Ficha() {
  const { t, idioma } = useT();
  const { cores } = useTema();
  const { setup } = useSetup();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pronto, dados } = useDados();
  /*
   * SOMBROSO e um FILTRO do que esta abaixo, nao um dado da especie.
   *
   * Sombroso nao aprende nada a mais — ele PERDE um slot para a Frustracao, que
   * TM comum nao remove. Por isso ligar isto injeta o golpe no bolso de
   * carregados e reordena tudo, em vez de so mostrar um aviso.
   */
  const [sombroso, setSombroso] = useState(false);
  const { chave } = useIA();
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);
  const [pensando, setPensando] = useState(false);
  const [falandoAgora, setFalandoAgora] = useState(false);

  /*
   * A LENTE FALADA — é o que o modo Lente do web faz, e a única metade dele que
   * atravessou. A voz do sistema lê as mesmas frases que estão na tela; nada é
   * gerado na hora e nada sai do aparelho.
   */
  const ouvirLente = () => {
    if (!lente) return;
    if (falandoAgora) {
      calar();
      setFalandoAgora(false);
      return;
    }
    const frases = [
      t("dex.line.name", { name: especie?.name ?? "", dex: String(especie?.dex ?? "") }),
      t(ARQUETIPO[lente.build]!),
      t(lente.evolves ? "dex.line.evolves" : "dex.line.final"),
      lente.raidRank
        ? t("dex.line.raid", {
            type: t(`type.${lente.raidRank.type}` as never),
            position: lente.raidRank.position,
          })
        : "",
    ].filter(Boolean);
    falar(frases.join(" "), idioma);
    setFalandoAgora(true);
  };

  const especie = useMemo(() => dados?.species.find((s) => s.id === id) ?? null, [dados, id]);

  const veredito = useMemo(() => {
    if (!dados || !especie) return null;
    /*
     * 15/15/15 no nivel 20: a ficha e sobre a ESPECIE, nao sobre um bicho seu.
     * Quando a colecao existir, ela passa os valores reais.
     */
    return decide({
      name: especie.name,
      baseStats: especie.baseStats,
      ivs: { atk: 15, def: 15, hp: 15 },
      level: 20,
      cpm: dados.cpm,
      /*
       * O teto de QUEM ESTA JOGANDO, e nao o do jogo.
       *
       * `version.levelCap` e o teto de quem ja terminou. Para um treinador de
       * nivel 20 o app respondia sobre uma especie que aquela pessoa so
       * consegue levar ao nivel 22 — a mesma correcao que o web ja tinha, e que
       * so pode existir aqui depois de o setup nativo perguntar o nivel.
       */
      levelCap: tetoDePowerUp(setup.level, dados.version.levelCap),
      /*
       * ⚠️ ISTO ERA `[]` FIXO, e o veredito nunca dizia "Evoluir".
       *
       * A regra que produz esse veredito le exatamente este campo
       * (`verdict.ts`: "if (input.evolvesInto.length > 0)"). Com a lista sempre
       * vazia, um Bulbasaur — que tem `evolvesInto: ["ivysaur"]` no arquivo
       * desde sempre — caia na regra de quem NAO evolui. O dado ja estava no
       * `.tkdata`; o que faltava era o tipo declarar e alguem passar.
       */
      evolvesInto: especie.evolvesInto,
    });
    /* `setup.level` na lista: sem ele, trocar o nivel em Ajustes nao recalcula a
       ficha que ja esta aberta, e a tela passa a mostrar o teto de antes. */
  }, [dados, especie, setup.level]);

  /*
   * OS GOLPES RECOMENDADOS, agrupados por contexto.
   *
   * `groupIdenticalContexts` junta os contextos que recomendam o MESMO conjunto:
   * em muita especie, "tudo", raide e PvP dao a mesma resposta e so Rocket muda.
   * Quatro abas identicas nao sao quatro opcoes, sao quatro chances de a pessoa
   * achar que perdeu alguma coisa por nao tocar em todas.
   */
  const grupos = useMemo(() => {
    if (!dados || !especie) return [];
    const porId = new Map<string, MoveWithPvp>();
    for (const g of [...dados.fastMoves, ...dados.chargedMoves]) porId.set(g.id, g);
    const juntar = (ids: string[], elite: string[]): MoveWithPvp[] =>
      [
        ...ids.map((i) => porId.get(i)),
        ...elite.map((i) => {
          const m = porId.get(i);
          return m ? { ...m, elite: true } : undefined;
        }),
      ].filter((m): m is MoveWithPvp => m !== undefined);

    const carregados = juntar(especie.chargedMoves, especie.eliteChargedMoves);
    const frustracao = porId.get("frustration");
    return groupIdenticalContexts(
      juntar(especie.fastMoves, especie.eliteFastMoves),
      sombroso && frustracao ? withFrustration(carregados, frustracao) : carregados,
      {
        attackerTypes: especie.types,
        chart: dados.typeChart,
        order: dados.typeOrder,
        /* 1.2 e o bonus de mesmo tipo do jogo, o mesmo literal do app web. */
        stabMultiplier: 1.2,
      },
    );
  }, [dados, especie, sombroso]);

  /**
   * QUANTO A FRUSTRACAO CUSTA, em porcento, contra o melhor conjunto livre.
   *
   * ⚠️ As duas notas saem da MESMA chamada de proposito: `rankMovesets`
   * normaliza pela melhor de cada chamada, entao nota de listas diferentes nao
   * se compara. Medido em PvP porque e onde a Frustracao doi mais e onde o
   * numero e mais facil de ler.
   */
  const custoDaFrustracao = useMemo(() => {
    if (!dados || !especie || !sombroso) return null;
    const porId = new Map<string, MoveWithPvp>();
    for (const g of [...dados.fastMoves, ...dados.chargedMoves]) porId.set(g.id, g);
    const frustracao = porId.get("frustration");
    if (!frustracao) return null;
    const juntar = (ids: string[], elite: string[]): MoveWithPvp[] =>
      [
        ...ids.map((i) => porId.get(i)),
        ...elite.map((i) => {
          const m = porId.get(i);
          return m ? { ...m, elite: true } : undefined;
        }),
      ].filter((m): m is MoveWithPvp => m !== undefined);

    const juntos = rankMovesets(
      juntar(especie.fastMoves, especie.eliteFastMoves),
      withFrustration(juntar(especie.chargedMoves, especie.eliteChargedMoves), frustracao),
      "pvp",
      {
        attackerTypes: especie.types,
        chart: dados.typeChart,
        order: dados.typeOrder,
        stabMultiplier: 1.2,
      },
    );
    const livre = juntos.find((m) => !m.isFrustration);
    const presa = juntos.find((m) => m.isFrustration);
    if (!livre || !presa) return null;
    return Math.round((1 - presa.score / livre.score) * 100);
  }, [dados, especie, sombroso]);

  /**
   * A BATALHA MAX — a mecanica que o app nativo ignorava.
   *
   * ⚠️ O bloco NAO afirma que a especie "pode Dynamax". Isso e propriedade do
   * jogo e nao do dataset; o que da pra afirmar e o custo dos Max Ataques do
   * grupo dela e o papel que os stats base sugerem. `ligado` some a tela
   * inteira quando o jogo desliga a mecanica na temporada.
   */
  const max = useMemo(() => {
    if (!dados?.dynamax?.ligado || !especie) return null;
    return {
      gigantamax: fazGigantamax(especie.id, dados.dynamax),
      papel: papelNaBatalhaMax(especie.baseStats),
      custo: custoDosMaxAtaques(especie.maxGrupo, dados.dynamax),
    };
  }, [dados, especie]);

  /**
   * A LENTE — o que a ficha diz em NUMERO, dito em frase.
   *
   * ⚠️ Nao e repeticao do resto da tela. Tres coisas so aparecem aqui, e nenhuma
   * delas esta nos numeros: o ARQUETIPO ("bate forte e cai rapido"), a POSICAO
   * dele entre os atacantes do proprio tipo, e a melhor colocacao dele nas
   * ligas. Sao as tres perguntas que um numero de ataque nao responde.
   *
   * O modo Lente do web tambem fala, fotografa e usa camera — nada disso existe
   * aqui, e por isso o que veio foi o texto. Prometer a locucao sem ter voz
   * seria pior que nao ter a tela.
   */
  const lente = useMemo(() => {
    if (!dados || !especie) return null;
    const tipoPrimario = especie.types[0] ?? "normal";
    const listaRaide = dados.rankings?.raidByType[tipoPrimario] ?? [];
    const posRaide = listaRaide.findIndex((r) => r.speciesId === especie.id);

    let melhorLiga: { league: "great" | "ultra" | "master"; position: number } | null = null;
    for (const liga of LIGAS) {
      const pos = (dados.rankings?.statProductByLeague[liga] ?? []).findIndex(
        (r) => r.speciesId === especie.id,
      );
      if (pos >= 0 && (melhorLiga === null || pos + 1 < melhorLiga.position)) {
        melhorLiga = { league: liga, position: pos + 1 };
      }
    }

    return buildDexEntry({
      name: especie.name,
      dex: especie.dex,
      types: especie.types,
      baseStats: especie.baseStats,
      cpm: dados.cpm,
      levelCap: tetoDePowerUp(setup.level, dados.version.levelCap),
      evolvesInto: especie.evolvesInto,
      raidRank: posRaide >= 0 ? { type: tipoPrimario, position: posRaide + 1 } : null,
      leagueRank: melhorLiga,
    });
  }, [dados, especie, setup.level]);

  /*
   * Os tres tetos de PC, e o terceiro NAO e um teto a mais: e o Melhor Amigo.
   *
   * E a pergunta que se faz na hora de gastar 100.000 de poeira — ate onde eu
   * compro, e o que o Melhor Amigo adiciona de graca por cima. O `Set` remove a
   * coluna repetida quando 40 e o proprio teto da temporada.
   */
  const tetos = useMemo(() => {
    if (!dados || !especie) return [];
    const teto = dados.version.levelCap;
    return [...new Set([40, teto, teto + 1])].map((nivel) => ({
      nivel,
      pc: computeCPAtLevel(dados.cpm, especie.baseStats, { atk: 15, def: 15, hp: 15 }, nivel),
      melhorAmigo: nivel > teto,
    }));
  }, [dados, especie]);

  if (!pronto) {
    return (
      <View className="flex-1 items-center justify-center bg-fundo">
        <ActivityIndicator color={cores.texto} />
      </View>
    );
  }

  if (!especie) {
    return (
      <View className="flex-1 items-center justify-center bg-fundo">
        <Text className="text-texto">{t("especies.noResults", { query: String(id) })}</Text>
      </View>
    );
  }

  /**
   * PERGUNTAR SOBRE A ESPÉCIE — com a chave de quem pergunta.
   *
   * ⚠️ O modelo NÃO inventa número: os fatos vão no `system`, calculados aqui
   * pelo `packages/core`, e a instrução é responder a partir deles. Deixar o
   * modelo lembrar de stat base é como o app passa a mentir com voz de certeza.
   *
   * Sem chave a caixa nem aparece — um campo dizendo "configure a IA" seria
   * propaganda ocupando espaço de quem não pediu.
   */
  const perguntar = () => {
    if (!chave || !especie || !veredito || pergunta.trim() === "") return;
    setPensando(true);
    setResposta(null);
    const fatos = [
      `${especie.name} (#${especie.dex}), tipo ${especie.types.join("/")}`,
      `stats base: ataque ${especie.baseStats.atk}, defesa ${especie.baseStats.def}, PS ${especie.baseStats.hp}`,
      `veredito do app: ${veredito.action} (confianca ${Math.round(veredito.confidence * 100)}%)`,
      tetos.length > 0
        ? `PC maximo com IV perfeito: ${tetos.map((x) => `${x.pc} no nivel ${x.nivel}`).join(", ")}`
        : "",
      grupos[0]?.movesets[0]
        ? `melhor conjunto: ${grupos[0].movesets[0].fast.name} + ${grupos[0].movesets[0].charged.name}`
        : "",
      lente?.raidRank
        ? `entre os atacantes de ${lente.raidRank.type}, e o numero ${lente.raidRank.position} para raides`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    groqChat(
      chave,
      GROQ_MODEL,
      [
        {
          role: "system",
          content:
            `Voce responde sobre Pokemon GO em ${idioma}, em no maximo 3 frases curtas. ` +
            `Use SOMENTE os fatos abaixo; se a resposta nao estiver neles, diga que nao sabe. ` +
            `Nao invente numero.\n\n${fatos}`,
        },
        { role: "user", content: pergunta.trim() },
      ],
      { maxTokens: 220 },
    )
      .then(setResposta)
      /* A mensagem da Groq (401, 429, modelo fora do catalogo) vale mais que um
         "deu erro" nosso: ela diz o que fazer. */
      .catch((e: Error) => setResposta(e.message))
      .finally(() => setPensando(false));
  };

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      <View className="items-center">
        <Selo especie={especie} tamanho={112} />
        <Text className="text-texto text-2xl font-extrabold mt-4">{especie.name}</Text>
        <Text className="text-texto3 text-xs mt-1">
          {/* Os tipos TRADUZIDOS: o dicionario tem `type.grass` etc. Mostrar
              "grass / poison" seria o app falando o idioma do arquivo de dados
              em vez do idioma da pessoa. */}
          #{String(especie.dex).padStart(3, "0")} ·{" "}
          {especie.types.map((tp) => t(`type.${tp}` as never)).join(" / ")}
        </Text>
      </View>

      {/* Duas acoes: o IV do que ele TEM, e o IV do que ele esta VENDO. */}
      <Link href={{ pathname: "/iv/[id]", params: { id: especie.id } }} asChild>
        <Pressable className="bg-texto rounded-full py-4 items-center mt-7">
          <Text className="text-fundo font-bold text-base">{t("species.calcIV")}</Text>
        </Pressable>
      </Link>

      <Link href={{ pathname: "/encontro/[id]", params: { id: especie.id } }} asChild>
        <Pressable className="bg-superficie rounded-full py-4 items-center mt-3">
          <Text className="text-texto font-bold text-base">{t("pre.open")}</Text>
        </Pressable>
      </Link>

      <Link href={{ pathname: "/raide/[id]", params: { id: especie.id } }} asChild>
        <Pressable className="bg-superficie rounded-full py-4 items-center mt-3">
          <Text className="text-texto font-bold text-base">{t("raid.openBrowse")}</Text>
        </Pressable>
      </Link>

      {veredito && (
        <View className="bg-superficie rounded-3xl p-5 mt-7">
          <Text className="text-texto3 text-[11px] tracking-widest">
            {t("assistant.title").toUpperCase()}
          </Text>
          <Text
            className="text-xl font-bold mt-2"
            style={{ color: cores[COR_ACAO[veredito.action] ?? "texto"] }}
          >
            {/* A PALAVRA do veredito vem do dicionario, nao do enum: o `core`
                devolve `investir`, e `ACTION_KEYS` diz qual chave le isso nos
                dez idiomas. */}
            {t(ACTION_KEYS[veredito.action] as never)}
          </Text>
          <Text className="text-texto2 text-xs mt-2">
            {t("verdict.confidence", { percent: Math.round(veredito.confidence * 100) })}
          </Text>
        </View>
      )}

      {/* Pilula, e nao botao de bloco: sombroso filtra o que vem abaixo, entao
          ele pertence visualmente aos golpes e nao a barra de acoes do topo. */}
      <Pressable
        onPress={() => setSombroso((v) => !v)}
        className="self-start rounded-full px-4 py-2 mt-7"
        style={{
          backgroundColor: sombroso ? cores.texto : cores.superficie,
          borderWidth: 1,
          borderColor: sombroso ? cores.texto : cores.linha,
        }}
      >
        <Text
          className="text-[13px] font-semibold"
          style={{ color: sombroso ? cores.fundo : cores.texto2 }}
        >
          {t(sombroso ? "species.shadowToggleOn" : "species.shadowToggle")}
        </Text>
      </Pressable>

      {sombroso && dados && (
        <Text className="text-texto3 text-[12px] leading-5 mt-2">
          {t("species.shadowNote", {
            percent: Math.round((shadowDamageMultiplier(dados.settings.battle) - 1) * 100),
          })}
          {custoDaFrustracao !== null
            ? t("species.frustrationCost", { percent: custoDaFrustracao })
            : ""}
        </Text>
      )}

      {/* ── GOLPES ─────────────────────────────────────────────────────────
          Um bloco por grupo de contexto. Quando os quatro coincidem sai um
          bloco so, e a legenda diz que os quatro coincidem — que informa mais
          do que quatro abas com a mesma resposta. */}
      {grupos.map((g) => (
        <View key={g.contexts.join("+")} className="bg-superficie rounded-3xl p-5 mt-3">
          <Text className="text-texto3 text-[11px] tracking-widest">
            {g.contexts
              .map((c) => t(CONTEXT_KEYS[c].title as never))
              .join(" · ")
              .toUpperCase()}
          </Text>

          {g.movesets.length === 0 ? (
            <Text className="text-texto2 text-sm mt-3">{t("species.noMoves")}</Text>
          ) : (
            g.movesets.slice(0, 3).map((m, i) => (
              <View
                key={`${m.fast.id}-${m.charged.id}`}
                className="mt-3"
                style={
                  i > 0
                    ? { borderTopWidth: 0.5, borderTopColor: cores.linha, paddingTop: 12 }
                    : undefined
                }
              >
                <Text className={`text-[15px] ${i === 0 ? "text-texto font-bold" : "text-texto2"}`}>
                  {m.fast.name} + {m.charged.name}
                </Text>
                {/* ✦ e a marca de TM Elite — um dos itens mais raros do jogo.
                    Sem dizer isso, a recomendacao manda comprar o que nao se
                    compra. */}
                {m.needsElite && (
                  <Text className="text-texto3 text-[12px] mt-1">✦ {t("species.needsElite")}</Text>
                )}
                {m.isFrustration && (
                  <Text className="text-texto3 text-[12px] mt-1">
                    {t("species.stuckOnFrustration")}
                  </Text>
                )}
              </View>
            ))
          )}

          {/* Quando os contextos concordam sobre o MELHOR e divergem embaixo, a
              tela precisa dizer de quem e a ordem que esta mostrando — senao a
              unificacao vira uma afirmacao falsa sobre os outros tres. */}
          {g.contexts.length > 1 && (
            <Text className="text-texto3 text-[12px] mt-3">
              {/* ⚠️ As duas frases tem `{contexts}`, e a segunda tem `{principal}`
                  tambem. Chamar `t` sem eles imprime a chave crua na tela — o
                  placeholder nao some sozinho. */}
              {g.mesmaLista
                ? t("species.sameForAll", {
                    contexts: g.contexts.map((c) => t(CONTEXT_KEYS[c].title as never)).join(", "),
                  })
                : t("species.sameBest", {
                    contexts: g.contexts.map((c) => t(CONTEXT_KEYS[c].title as never)).join(", "),
                    principal: t(CONTEXT_KEYS[g.contexts[0]!].title as never),
                  })}
            </Text>
          )}
        </View>
      ))}

      {/* ── EVOLUCAO ───────────────────────────────────────────────────────── */}
      {especie.evolvesInto.length > 0 && (
        <View className="bg-superficie rounded-3xl p-5 mt-3">
          <Text className="text-texto3 text-[11px] tracking-widest">
            {t("species.evolvesInto").toUpperCase()}
          </Text>
          {especie.evolvesInto.map((idEvo, i) => {
            const alvoEvo = dados?.species.find((x) => x.id === idEvo) ?? null;
            const doces = especie.candyToEvolve[idEvo] ?? null;
            return (
              <Link key={idEvo} href={{ pathname: "/especie/[id]", params: { id: idEvo } }} asChild>
                <Pressable
                  className="flex-row items-center justify-between mt-3"
                  style={
                    i > 0
                      ? { borderTopWidth: 0.5, borderTopColor: cores.linha, paddingTop: 12 }
                      : undefined
                  }
                >
                  <Text className="text-texto text-[15px] flex-1">{alvoEvo?.name ?? idEvo}</Text>
                  {doces !== null && (
                    <Text className="text-texto2 text-sm">
                      {t("species.candy", { count: doces })}
                    </Text>
                  )}
                  <Text className="text-texto3 text-base ml-2">›</Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      )}

      {/* ── PERGUNTAR (só com chave) ────────────────────────────────────────── */}
      {chave && (
        <View className="bg-superficie rounded-3xl p-5 mt-3">
          <Text className="text-texto3 text-[11px] tracking-widest">
            {t("dex.ask").toUpperCase()}
          </Text>
          <TextInput
            value={pergunta}
            onChangeText={setPergunta}
            onSubmitEditing={perguntar}
            returnKeyType="send"
            placeholder={t("dex.askPlaceholder")}
            placeholderTextColor={cores.texto3}
            className="text-texto text-[15px] mt-3"
          />
          {pensando && <Text className="text-texto3 text-[13px] mt-3">{t("ai.thinking")}</Text>}
          {resposta && !pensando && (
            <Text className="text-texto2 text-[13px] leading-5 mt-3">{resposta}</Text>
          )}
        </View>
      )}

      {/* ── LENTE ──────────────────────────────────────────────────────────── */}
      {lente && (
        <View className="bg-superficie rounded-3xl p-5 mt-3">
          <View className="flex-row items-center">
            <Text className="flex-1 text-texto3 text-[11px] tracking-widest">
              {t("dex.title").toUpperCase()}
            </Text>
            {/* A voz do sistema: sem chave, sem conta, sem rede. */}
            <Pressable onPress={ouvirLente} hitSlop={10}>
              <Text className="text-texto2 text-[12px] font-semibold">
                {t(falandoAgora ? "dex.voiceOff" : "dex.speak")}
              </Text>
            </Pressable>
          </View>
          <Text className="text-texto2 text-[13px] leading-5 mt-3">
            {t(ARQUETIPO[lente.build]!)}
          </Text>
          <Text className="text-texto2 text-[13px] leading-5 mt-2">
            {t(lente.evolves ? "dex.line.evolves" : "dex.line.final")}
          </Text>
          {lente.raidRank && (
            <Text className="text-texto2 text-[13px] leading-5 mt-2">
              {t("dex.line.raid", {
                type: t(`type.${lente.raidRank.type}` as never),
                position: lente.raidRank.position,
              })}
            </Text>
          )}
          {lente.leagueRank && (
            <Text className="text-texto2 text-[13px] leading-5 mt-2">
              {t("dex.line.league", {
                league: t(`rank.league.${lente.leagueRank.league}` as never),
                position: lente.leagueRank.position,
              })}
            </Text>
          )}
        </View>
      )}

      {/* ── BATALHA MAX ────────────────────────────────────────────────────── */}
      {max && (
        <View className="bg-superficie rounded-3xl p-5 mt-3">
          <Text className="text-texto3 text-[11px] tracking-widest">
            {t("species.maxBattle").toUpperCase()}
          </Text>

          {max.gigantamax && (
            <View className="flex-row items-center justify-between mt-3">
              <Text className="text-texto2 text-sm">{t("species.gigantamax")}</Text>
              <Text className="text-texto text-sm font-semibold">{t("common.yes")}</Text>
            </View>
          )}

          <View className="flex-row items-center justify-between mt-3">
            <Text className="text-texto2 text-sm">{t("species.maxRole")}</Text>
            <Text className="text-texto text-sm font-semibold">{t(PAPEL_MAX[max.papel]!)}</Text>
          </View>

          {max.custo && (
            <View className="flex-row items-center justify-between mt-3">
              <Text className="text-texto2 text-sm flex-1">{t("species.maxCost")}</Text>
              <Text className="text-texto text-sm font-semibold ml-3">
                {/* A soma dos TRES caminhos (ataque, guarda, espirito): e o que
                    custa subir a especie inteira, que e a pergunta real. */}
                {t("species.maxCostValue", {
                  candy: max.custo.ataque.doces + max.custo.guarda.doces + max.custo.espirito.doces,
                  xl:
                    max.custo.ataque.docesXL +
                    max.custo.guarda.docesXL +
                    max.custo.espirito.docesXL,
                })}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── TETOS DE PC ────────────────────────────────────────────────────── */}
      {tetos.length > 0 && (
        <View className="bg-superficie rounded-3xl p-5 mt-3">
          <Text className="text-texto3 text-[11px] tracking-widest">
            {t("species.maxCP").toUpperCase()}
          </Text>
          <View className="flex-row mt-3">
            {tetos.map((x) => (
              <View key={x.nivel} className="flex-1">
                <Text className="text-texto text-[22px] font-extrabold">{x.pc}</Text>
                <Text className="text-texto3 text-[12px] mt-0.5">
                  {x.melhorAmigo ? t("species.bestBuddy") : `${t("common.level")} ${x.nivel}`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View className="bg-superficie rounded-3xl p-5 mt-3">
        <Text className="text-texto3 text-[11px] tracking-widest">
          {t("species.baseStats").toUpperCase()}
        </Text>
        {(
          [
            [t("common.attack"), especie.baseStats.atk],
            [t("common.defense"), especie.baseStats.def],
            [t("common.stamina"), especie.baseStats.hp],
          ] as const
        ).map(([rotulo, valor]) => (
          <View key={rotulo} className="flex-row items-center justify-between mt-3">
            <Text className="text-texto2 text-sm">{rotulo}</Text>
            <Text className="text-texto text-sm font-semibold">{valor}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
