import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ACTION_KEYS,
  CONTEXT_KEYS,
  buildDexEntry,
  GROQ_MODEL,
  computeCPAtLevel,
  ivPercentOf,
  decide,
  degradeDoTipo,
  groqChat,
  custoDosMaxAtaques,
  fazGigantamax,
  groupIdenticalContexts,
  papelNaBatalhaMax,
  PARADAS_DO_DEGRADE,
  rankMovesets,
  rotuloDoGolpe,
  shadowDamageMultiplier,
  tetoDePowerUp,
  withFrustration,
  type Key,
  type MoveWithPvp,
} from "@trainerkit/core";
import { useDados, type Especie } from "../../src/dados";
import { useT } from "../../src/i18n";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";

import { useIA } from "../../src/ia";
import { marcarVisto } from "../../src/vistos";
import { useTraducao } from "../../src/traducao";
import { definirMeuMotivo, guardar, remover, useColecao } from "../../src/colecao";
import { BlocoSpreads, BlocoTroca, BlocoUsos } from "../../src/BlocosDaFicha";
import { Segmented } from "../../src/Segmented";
import { Cascata } from "../../src/Cascata";
import { EntreOsSeus } from "../../src/EntreOsSeus";
import { Toque } from "../../src/Toque";
import { calar, falar } from "../../src/voz";
import { useSetup } from "../../src/setup";
import { useTema, type Paleta } from "../../src/tema";
import { corDoTipo, tintaSobre } from "../../src/Selo";
import { useImagens } from "../../src/imagens";
import { arquivoLocal } from "../../src/offline";
import { Vidro } from "../../src/Vidro";

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

/**
 * A ARTE NA FAIXA DA FICHA.
 *
 * ⚠️ Componente à parte pelo mesmo motivo do herói: a imagem pode falhar, e um
 * `useState` dentro da ficha faria a tela inteira renderizar de novo a cada
 * carga. Falhando, ela some e a faixa volta a ser cor e número — que é o
 * estado de qualquer espécie sem arquivo, em qualquer fonte.
 */
function ArteDaFicha({ especie }: { especie: Especie }) {
  const { fonte, urlDaEspecie } = useImagens();
  const [falhou, setFalhou] = useState(false);
  const local = arquivoLocal(especie.spriteId, fonte);
  const url = falhou ? null : (local ?? urlDaEspecie(especie));
  if (!url) return null;
  return (
    <Image
      source={{ uri: url }}
      onError={() => setFalhou(true)}
      resizeMode="contain"
      style={{ flex: 1, width: "100%", opacity: 0.95 }}
    />
  );
}

export default function Ficha() {
  const { t, tm, idioma } = useT();
  const { cores } = useTema();
  /* O cabecalho e transparente nesta tela, entao a faixa colorida cresce pelo
     inset em vez de comecar abaixo dele. */
  const alto = useSafeAreaInsets().top;
  const router = useRouter();
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
  /* Aberto por padrao: o rastro E o argumento do app. Escondido por padrao
     ele vira nota de rodape, e ninguem abre nota de rodape. */
  const [rastro, setRastro] = useState(true);
  const [confirmandoTirar, setConfirmandoTirar] = useState(false);
  const [indiceDoGrupo, setIndiceDoGrupo] = useState(0);
  const [discordando, setDiscordando] = useState(false);
  const { mostrar: traduzir } = useTraducao();
  const { itens, recarregar } = useColecao();
  const { chave } = useIA();
  const [pergunta, setPergunta] = useState("");
  const [aberto, setAberto] = useState(false);
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

  /*
   * O EXEMPLAR GUARDADO desta espécie, se houver.
   *
   * ⚠️ O primeiro, e não "o melhor": quem tem dois Charizard vê a ficha do que
   * guardou antes. Escolher o de maior IV pareceria esperto e faria a tela
   * mudar de assunto sozinha quando a pessoa guardasse um terceiro.
   */
  const salvo = useMemo(
    () => (itens ?? []).find((g) => g.speciesId === id) ?? null,
    [itens, id],
  );

  /* VISTO ao abrir a ficha. E o mais perto de "encontrei" que um app fora do
     jogo consegue afirmar sem inventar — e e o que faz a Pokedex ter progresso. */
  useEffect(() => {
    if (especie) void marcarVisto(especie.id);
  }, [especie]);

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

  /* CLAMP no índice: espécies diferentes têm números de grupo diferentes, e
     voltar de um Charizard (4 grupos) para um Caterpie (1) deixaria o índice
     apontando para um grupo que não existe. */
  const grupoAtivo = grupos[Math.min(indiceDoGrupo, grupos.length - 1)] ?? null;

  /* O PC DELE — não o da espécie. É o número que a pessoa vê no jogo, e o único
     jeito de conferir que a calculadora acertou o exemplar certo. */
  const pcDoSalvo = useMemo(() => {
    if (!dados || !especie || !salvo || salvo.ivDesconhecido) return null;
    return computeCPAtLevel(dados.cpm, especie.baseStats, salvo.ivs, salvo.level);
  }, [dados, especie, salvo]);
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
    <View className="flex-1 bg-fundo">
    <ScrollView
      className="flex-1 bg-fundo"
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/*
        O CABECALHO NA COR DO TIPO.

        Era um selo de 112px centralizado sobre fundo preto — correto e mudo. O
        desenho pinta a faixa inteira com a cor do TIPO primario e poe o
        monograma gigante como marca d'agua atras: a pessoa reconhece de que
        bicho e a tela antes de ler o nome.
      */}
      <View style={{ height: 176 + alto, overflow: "hidden" }}>
        <LinearGradient
          colors={degradeDoTipo(corDoTipo(especie.types[0]))}
          locations={PARADAS_DO_DEGRADE as unknown as [number, number, number]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        {/* ⚠️ O NÚMERO DA DEX, e não o monograma. "ao invez de ET, coloque o
            numero do pokemon" — ele rejeitou as duas letras no herói do Início,
            e a ficha continuava com elas. `numberOfLines={1}` porque três
            dígitos quebravam em duas linhas quando a fonte crescia. */}
        <Text
          numberOfLines={1}
          style={{
            position: "absolute",
            right: -6,
            bottom: -30,
            fontSize: 132,
            lineHeight: 132,
            letterSpacing: -6,
            fontWeight: "800",
            color: tintaSobre(corDoTipo(especie.types[0])),
            opacity: 0.15,
          }}
        >
          {String(especie.dex).padStart(3, "0")}
        </Text>

        {/* A ARTE DA ESPÉCIE, na faixa colorida.
            ⚠️ O herói do Início já mostrava a foto e a ficha — que é A tela
            daquele bicho — não mostrava nada além da cor. Ela fica à esquerda
            do número e atrás do nome, que é onde sobra espaço na faixa. */}
        <View
          pointerEvents="none"
          style={{ position: "absolute", right: 8, bottom: 0, top: alto, width: 150 }}
        >
          <ArteDaFicha especie={especie} />
        </View>

        <View className="flex-1 justify-end px-5 pb-4">
          <Text className="text-titulo-tela text-white">{especie.name}</Text>
          <View className="flex-row gap-2 mt-2">
            {/* Os tipos TRADUZIDOS, em chip: o dicionario tem `type.grass` etc.
                Mostrar "grass / poison" seria o app falando o idioma do arquivo
                de dados em vez do idioma da pessoa. */}
            {especie.types.map((tp) => (
              <View key={tp} className="rounded-pilula px-3 py-1 bg-black/30">
                <Text className="text-legenda text-white">{t(`type.${tp}` as never)}</Text>
              </View>
            ))}
            <View className="rounded-pilula px-3 py-1 bg-black/30">
              <Text className="text-legenda text-white">
                #{String(especie.dex).padStart(3, "0")}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="px-5 pt-5">
      <Cascata>

      {/*
        ⚠️ O VEREDITO É O HERÓI DA TELA, e antes era mais um cartão igual aos
        outros — a resposta que o app inteiro existe pra dar, com o mesmo peso
        visual de "stats base".

        Agora ele é vidro (a única superfície de vidro da ficha, pra o destaque
        não se diluir), com tipografia própria e a palavra grande. A cor continua
        sendo a do veredito, que é a única cor com significado nesta tela.
      */}
      {veredito && (
        <>
          <Vidro raio={26} style={{ marginTop: 28, padding: 20 }}>
            {/* ⚠️ SEM o rótulo "O QUE EU ACHO" em cima: no desenho a palavra
                do veredito vem sozinha, com o símbolo colado nela. O rótulo
                repetia em legenda o que a palavra já diz em 24px. */}
            <Text
              className="text-veredito"
              style={{
                color: cores[COR_ACAO[veredito.action] ?? "texto"],
                letterSpacing: 0.7,
              }}
            >
              {"✦  "}
              {/* A PALAVRA do veredito vem do dicionario, nao do enum: o `core`
                  devolve `investir`, e `ACTION_KEYS` diz qual chave le isso nos
                  dez idiomas. */}
              {t(ACTION_KEYS[veredito.action] as never)}
            </Text>

            {/* O MOTIVO, que faltava. O `core` sempre devolveu `verdict.reason`
                e a ficha nativa mostrava so a palavra — a pessoa lia "Evoluir"
                sem uma linha dizendo por que. E o site mostra. */}
            <Text className="text-corpo text-texto2 mt-2">{tm(veredito.reason)}</Text>

            {/* A BARRA DE CONFIANCA. O numero sozinho ("88%") e abstrato; a
                barra e o que faz "as regras concordam" virar uma quantidade
                que o olho le sem contar. */}
            {/* AS REGRAS CONCORDAM · 88% — rótulo à esquerda e o número na cor
                do veredito à direita, que é como o desenho põe. A porcentagem
                solta numa legenda cinza não era lida. */}
            <View className="flex-row items-baseline justify-between mt-4">
              <Text className="text-texto3 text-legenda">{t("verdict.agree").toUpperCase()}</Text>
              <Text
                className="text-legenda"
                style={{ color: cores[COR_ACAO[veredito.action] ?? "texto"] }}
              >
                {Math.round(veredito.confidence * 100)}%
              </Text>
            </View>
            <View
              className="rounded-pilula mt-2 overflow-hidden"
              style={{ height: 4, backgroundColor: cores.linha }}
            >
              <View
                className="rounded-pilula"
                style={{
                  height: 4,
                  width: `${Math.round(veredito.confidence * 100)}%`,
                  backgroundColor: cores[COR_ACAO[veredito.action] ?? "texto"],
                }}
              />
            </View>
          </Vidro>

          {/*
            O RASTRO — "POR QUE · N REGRAS".

            E o que separa este app de um numero na tela: a decisao mostra a
            conta. Cada linha e um sinal do `core`, com o peso a direita em
            MONOESPACADA, porque coluna de numero so alinha em fonte de largura
            fixa — e desalinhado o olho para de conseguir comparar.

            Cartao comum, e nao vidro: vidro em tudo vira sopa, e nesta tela ele
            e do veredito. `signals.length` e a condicao (e nao a acao), porque
            um veredito sem sinal nenhum nao tem rastro pra abrir.
          */}
          {veredito.signals.length > 0 && (
            <View className="bg-superficie rounded-cartao mt-3 px-4 py-3">
              <Pressable
                onPress={() => setRastro((v) => !v)}
                className="flex-row items-center justify-between py-1"
              >
                <Text className="text-texto3 text-legenda">
                  {/* Singular tem chave propria: "1 REGRAS" existia na tela e e o tipo
                      de erro que so aparece com o dado real. */
                  veredito.signals.length === 1
                    ? t("verdict.why1")
                    : t("verdict.why", { n: veredito.signals.length })}
                </Text>
                <Text className="text-texto2 text-legenda">
                  {t(rastro ? "verdict.hide" : "verdict.show")}
                </Text>
              </Pressable>

              {rastro &&
                veredito.signals.map((sinal, i) => (
                  <View
                    key={`${sinal.rule}-${i}`}
                    className="flex-row items-start justify-between gap-3 py-2.5"
                    style={i > 0 ? { borderTopWidth: 1, borderTopColor: cores.linha } : undefined}
                  >
                    <Text className="text-corpo text-texto flex-1">{tm(sinal.because)}</Text>
                    <Text
                      className="text-legenda"
                      style={{
                        fontFamily: "Menlo",
                        color: cores[COR_ACAO[sinal.towards] ?? "texto3"],
                      }}
                    >
                      {/* Peso de 0 a 1 vira inteiro com sinal: e como o desenho
                          mostra (+42, +31, −8) e como se le de relance. O sinal
                          e MENOS quando a regra puxa pra outro lado que nao o
                          veredito — ela pesou CONTRA o que ficou decidido. */}
                      {sinal.towards === veredito.action ? "+" : "−"}
                      {Math.round(sinal.weight * 100)}
                    </Text>
                  </View>
                ))}
            </View>
          )}
        </>
      )}

      {/* ── ENTRE OS SEUS ──────────────────────────────────────────────────
          "Esse aqui é melhor que os que eu já tenho?" — a pergunta do momento
          em que se joga, e a única que cruza o IV com a coleção. */}
      {salvo && !salvo.ivDesconhecido && dados && (
        <EntreOsSeus
          especie={especie}
          ivs={salvo.ivs}
          todas={dados.species}
          jaSalvo
        />
      )}

      {/* A LINHA SECA DE NÚMEROS.

          ⚠️ Ela vem DEPOIS do rastro e ANTES das ações, que é onde o desenho a
          põe: quem já leu o veredito e o porquê quer conferir os números antes
          de apertar o botão. Solta lá embaixo, junto dos atributos base, ela
          respondia tarde demais.

          Só existe para quem TEM o bicho — são os números DELE, não da espécie. */}
      {salvo && !salvo.ivDesconhecido && (
        <Text className="text-texto3 text-legenda mt-3 text-center">
          {[
            `${t("common.cp")} ${pcDoSalvo?.toLocaleString(idioma) ?? "—"}`,
            `IV ${Math.round(ivPercentOf(salvo.ivs))}%`,
            `${t("common.level")} ${salvo.level}`,
          ].join("  ·  ")}
        </Text>
      )}

      {/*
        DISCORDO.

        ⚠️ O veredito continua na tela; o que ele perde é o direito de COBRAR.
        Um app que insiste em transferir um bicho que a pessoa já disse que vai
        guardar não está conversando, está repetindo.

        ⚠️ O motivo é ESCOLHIDO e não digitado: três razões cobrem o caso todo
        ("gosto", "eu uso", "é um desafio meu"), e um campo livre viraria um
        diário que ninguém relê.
      */}
      {salvo && (
        <View className="mt-3">
          {salvo.meuMotivo ? (
            <View className="bg-superficie rounded-cartao px-4 py-3 flex-row items-center">
              <Text className="text-texto2 text-corpo flex-1">
                {t("verdict.mine.kept")} · {t(`verdict.mine.${salvo.meuMotivo}` as never)}
              </Text>
              <Pressable
                onPress={() => void definirMeuMotivo(salvo.id, null).then(recarregar)}
                hitSlop={8}
              >
                <Text className="text-texto text-legenda font-semibold">
                  {t("verdict.mine.undo")}
                </Text>
              </Pressable>
            </View>
          ) : discordando ? (
            <View className="bg-superficie rounded-cartao px-4 py-3">
              <Text className="text-texto3 text-legenda mb-2">
                {t("verdict.disagree.title")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {(["gosto", "uso", "desafio"] as const).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => {
                      void definirMeuMotivo(salvo.id, m).then(() => {
                        setDiscordando(false);
                        recarregar();
                      });
                    }}
                    className="rounded-pilula px-4 py-2"
                    style={{ borderWidth: 1, borderColor: cores.linha }}
                  >
                    <Text className="text-texto2 text-legenda">
                      {t(`verdict.mine.${m}` as never)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setDiscordando(true)}
              className="self-start rounded-pilula px-4 py-2"
              style={{ borderWidth: 1, borderColor: cores.linha }}
            >
              <Text className="text-texto3 text-legenda">{t("verdict.disagree")}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/*
        TENHO ESSE — guardar sem saber o IV.

        ⚠️ Existe porque a coleção não pode exigir a calculadora. Quem acabou de
        capturar quer marcar que tem, e descobrir o IV depois; obrigar a avaliar
        primeiro faz a pessoa não guardar nada. O IV entra como desconhecido e a
        própria ficha oferece calcular logo abaixo.
      */}
      {!salvo && (
        <Toque
          onPress={() => {
            void guardar({
              speciesId: especie.id,
              ivs: { atk: 0, def: 0, hp: 0 },
              /* MARCADO como não medido: sem isso a coleção mostraria 0% e o
                 veredito mandaria transferir um bicho que ninguém avaliou. */
              ivDesconhecido: true,
              level: setup.level,
              shadow: false,
              lucky: false,
            }).then(recarregar);
          }}
          className="bg-superficie rounded-pilula py-4 items-center mt-7"
        >
          <Text className="text-texto font-bold text-base">{t("species.iHaveThis")}</Text>
        </Toque>
      )}

      {/* Duas acoes: o IV do que ele TEM, e o IV do que ele esta VENDO. */}
      {/* ⚠️ A AÇÃO PRINCIPAL LEVA A COR DO VEREDITO, com brilho — é o que o
          desenho faz: o botão continua a frase do cartão de cima ("Evoluir" →
          "Evoluir agora"). Branco ele era só mais um botão. */}
      <Link href={{ pathname: "/iv/[id]", params: { id: especie.id } }} asChild>
        <Toque
          className={`rounded-pilula py-4 items-center ${salvo ? "mt-7" : "mt-3"}`}
          style={{
            backgroundColor: veredito ? cores[COR_ACAO[veredito.action] ?? "texto"] : cores.texto,
            shadowColor: veredito ? cores[COR_ACAO[veredito.action] ?? "texto"] : cores.texto,
            shadowOpacity: 0.38,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          <Text className="font-bold text-base" style={{ color: "#FFFFFF" }}>
            {t(salvo ? "species.seeMyIV" : "species.calcIV")}
          </Text>
        </Toque>
      </Link>

      {/* ⚠️ AS DUAS SECUNDÁRIAS DIVIDEM A LINHA, e não empilham.
          Eram quatro botões de largura cheia entre o veredito e o resto da
          ficha — uma escada que empurrava tudo. O desenho põe uma primária e
          UMA secundária lado a lado; aqui são duas, porque as duas respondem
          perguntas diferentes ("ainda não peguei" e "como derrubo"). */}
      <View className="flex-row gap-2 mt-3">
        <Link href={{ pathname: "/encontro/[id]", params: { id: especie.id } }} asChild>
          <Toque
            estiloExterno={{ flex: 1 }}
            className="bg-superficie rounded-pilula py-3.5 items-center justify-center"
          >
            <Text className="text-texto2 font-semibold text-corpo" numberOfLines={1}>
              {t("pre.short")}
            </Text>
          </Toque>
        </Link>
        <Link href={{ pathname: "/raide/[id]", params: { id: especie.id } }} asChild>
          <Toque
            estiloExterno={{ flex: 1 }}
            className="bg-superficie rounded-pilula py-3.5 items-center justify-center"
          >
            <Text className="text-texto2 font-semibold text-corpo" numberOfLines={1}>
              {t("raid.short")}
            </Text>
          </Toque>
        </Link>
      </View>

      {/*
        TIRAR DA COLEÇÃO, em DOIS passos.

        ⚠️ Um passo só apagaria por toque errado, e não há desfazer — a coleção
        mora no aparelho. O segundo toque é o desfazer que não existe.
      */}
      {salvo && (
        <Toque
          onPress={() => {
            if (!confirmandoTirar) {
              setConfirmandoTirar(true);
              return;
            }
            void remover(salvo.id).then(() => {
              setConfirmandoTirar(false);
              recarregar();
            });
          }}
          className="rounded-pilula py-3.5 items-center mt-3"
          style={{ borderWidth: 1, borderColor: confirmandoTirar ? cores.transferir : cores.linha }}
        >
          <Text
            className="font-semibold text-corpo"
            style={{ color: confirmandoTirar ? cores.transferir : cores.texto2 }}
          >
            {t(confirmandoTirar ? "collection.removeSure" : "collection.remove")}
          </Text>
        </Toque>
      )}

      {/* ── TROCA ──────────────────────────────────────────────────────────
          Só para quem TEM o bicho: a conta é sobre os IV atuais dele, e sem
          espécie guardada não existe "antes" para comparar. */}
      {salvo && !salvo.ivDesconhecido && (
        <BlocoTroca
          ivs={salvo.ivs}
          baseStats={especie.baseStats}
          lucky={salvo.lucky}
          shadow={salvo.shadow}
          tm={tm}
        />
      )}

      {/* ── PRA QUE SERVE ──────────────────────────────────────────────────── */}
      {dados && <BlocoUsos especie={especie} dados={dados} />}

      <View className="bg-superficie rounded-cartao p-5 mt-3">
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

      {/* ── TETOS DE PC ────────────────────────────────────────────────────── */}
      {tetos.length > 0 && (
        <View className="bg-superficie rounded-cartao p-5 mt-3">
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

      {/* ── BATALHA MAX ────────────────────────────────────────────────────── */}
      {max && (
        <View className="bg-superficie rounded-cartao p-5 mt-3">
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

      {/* ── LENTE ──────────────────────────────────────────────────────────── */}
      {lente && (
        <View className="bg-superficie rounded-cartao p-5 mt-3">
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

      {/* Pílula, e não botão de bloco: sombroso filtra o que vem abaixo, então
          ele pertence visualmente aos golpes e não à barra de ações do topo. */}
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

      {/* ── MELHORES GOLPES ────────────────────────────────────────────────
          ⚠️ UM grupo por vez, com seletor — e não os quatro empilhados, que era
          o que o nativo fazia. Quatro cartões de golpe seguidos ocupam a tela
          inteira e a pessoa perde o que estava procurando; o PWA já resolvia
          isso com um segmented, e é dele que esta tela vem. */}
      <Text className="text-texto3 text-legenda mt-7 mb-2">
        {t("species.bestMoves").toUpperCase()}
      </Text>

      {grupos.length > 1 && (
        <View className="mb-3">
          <Segmented
            rotuloAcessivel={t("species.bestMoves")}
            valor={String(indiceDoGrupo)}
            opcoes={grupos.map((g, i) => ({
              valor: String(i),
              rotulo: g.contexts.map((c) => t(CONTEXT_KEYS[c].title as never)).join(" · "),
            }))}
            onEscolher={(v) => setIndiceDoGrupo(Number(v))}
          />
        </View>
      )}

      {grupoAtivo && (
        <View className="bg-superficie rounded-cartao p-5">
          {/* A frase que diz DE QUEM é a lista. Com um grupo só ela explica o
              contexto; com vários, diz o que os outros têm em comum. */}
          <Text className="text-texto3 text-legenda leading-4">
            {grupoAtivo.contexts.length === 1
              ? t(CONTEXT_KEYS[grupoAtivo.contexts[0]!].detail as never)
              : grupoAtivo.mesmaLista
                ? t("species.sameForAll", {
                    contexts: grupoAtivo.contexts
                      .map((c) => t(CONTEXT_KEYS[c].title as never))
                      .join(", "),
                  })
                : t("species.sameBest", {
                    contexts: grupoAtivo.contexts
                      .map((c) => t(CONTEXT_KEYS[c].title as never))
                      .join(", "),
                    principal: t(CONTEXT_KEYS[grupoAtivo.contexts[0]!].title as never),
                  })}
          </Text>

          {grupoAtivo.movesets.length === 0 ? (
            <Text className="text-texto2 text-corpo mt-3">{t("species.noMoves")}</Text>
          ) : (
            /* CINCO, e não três: é quantos o PWA mostra, e a quarta e a quinta
               linha são justamente onde aparece a alternativa sem TM Elite. */
            grupoAtivo.movesets.slice(0, 5).map((m, i) => (
              <View
                key={`${m.fast.id}-${m.charged.id}`}
                className="mt-3 flex-row items-start gap-3"
                style={
                  i > 0
                    ? { borderTopWidth: 0.5, borderTopColor: cores.linha, paddingTop: 12 }
                    : undefined
                }
              >
                <View className="flex-1">
                  {/* ⚠️ INGLÊS EM CIMA, tradução embaixo — e o inglês PRIMEIRO
                      não é preferência: é o idioma em que os nomes de golpe
                      circulam em guia e em vídeo. Procurar "Ataque de Chamas"
                      no YouTube não acha nada, e "Flame Charge" dentro do jogo
                      em português também não. */}
                  <Text
                    className={`text-corpo ${i === 0 ? "text-texto font-bold" : "text-texto2"}`}
                  >
                    {m.fast.name} + {m.charged.name}
                  </Text>
                  {(() => {
                    const f = rotuloDoGolpe(m.fast.name, dados?.moveNames, m.fast.id, idioma, traduzir);
                    const c = rotuloDoGolpe(
                      m.charged.name,
                      dados?.moveNames,
                      m.charged.id,
                      idioma,
                      traduzir,
                    );
                    if (!f.secundario && !c.secundario) return null;
                    return (
                      <Text className="text-texto3 text-legenda mt-0.5">
                        {f.secundario ?? f.principal} + {c.secundario ?? c.principal}
                      </Text>
                    );
                  })()}
                  {/* ✦ e a marca de TM Elite — um dos itens mais raros do jogo.
                      Sem dizer isso, a recomendacao manda comprar o que nao se
                      compra. */}
                  {m.needsElite && (
                    <Text className="text-texto3 text-legenda mt-1">
                      ✦ {t("species.needsElite")}
                    </Text>
                  )}
                  {m.isFrustration && (
                    <Text className="text-texto3 text-legenda mt-1">
                      {t("species.stuckOnFrustration")}
                    </Text>
                  )}
                </View>
                {/* A NOTA, que o nativo não mostrava. Sem ela as cinco linhas
                    parecem cinco opções iguais, e a diferença entre a primeira e
                    a quinta costuma ser grande. */}
                <Text
                  className="text-legenda"
                  style={{
                    fontFamily: "Menlo",
                    color: i === 0 ? cores.texto : cores.texto3,
                  }}
                >
                  {Math.round(m.score * 100)}
                </Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* ── OS MELHORES IV POR LIGA ────────────────────────────────────────── */}
      {dados && (
        <BlocoSpreads
          especie={especie}
          dados={dados}
          tetoDeNivel={tetoDePowerUp(setup.level, dados.version.levelCap)}
        />
      )}

      {/* ── EVOLUCAO ───────────────────────────────────────────────────────── */}
      {especie.evolvesInto.length > 0 && (
        <View className="bg-superficie rounded-cartao p-5 mt-3">
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
      </Cascata>
      </View>
    </ScrollView>

      {/*
        FECHAR, em vidro, sobre a faixa colorida.

        ⚠️ Ele é da TELA e não da barra de navegação: o cabeçalho colorido vai
        até a borda de cima, e qualquer barra — mesmo transparente — reserva
        altura e corta a cor. Em vidro porque é o que o índice do pacote manda
        para "botões de fechar sobre o cabeçalho colorido".
      */}
      {/* ⚠️ × À DIREITA, e não ‹ à esquerda. O desenho fecha a ficha com um
          × no canto direito porque ela é uma FOLHA que sobe, não uma tela numa
          pilha — e a folha se fecha, não se volta. O gesto de arrastar continua
          funcionando para quem prefere. */}
      <View style={{ position: "absolute", top: alto + 8, right: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={t("common.back")}>
          <Vidro raio={999} interativo style={{ width: 40, height: 40 }}>
            <View className="flex-1 items-center justify-center">
              <SymbolView
                name="xmark"
                size={15}
                tintColor="#FFFFFF"
                fallback={<Text style={{ color: "#fff", fontSize: 18 }}>×</Text>}
              />
            </View>
          </Vidro>
        </Pressable>
      </View>

      {/*
        O BOTAO FLUTUANTE DA IA.

        A caixa de perguntar vivia enterrada no fim da rolagem, depois de golpes,
        ligas e Batalha Max — quem quisesse perguntar tinha que passar por tudo.
        Agora ela e um painel que sobe, e o botao fica sempre alcancavel.

        ⚠️ So aparece COM CHAVE, e isso e regra do projeto e nao economia de
        tela: no app a IA e a da pessoa, com a chave dela. Um botao que abrisse
        "configure a IA" prometeria um recurso que o app nao da.
      */}
      {chave && (
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", right: 18, bottom: 24, left: 18 }}
        >
          {aberto && (
            <Vidro raio={26} style={{ padding: 18, marginBottom: 12 }}>
              <Text className="text-texto3 text-legenda">{t("dex.ask").toUpperCase()}</Text>
              <TextInput
                value={pergunta}
                onChangeText={setPergunta}
                onSubmitEditing={perguntar}
                returnKeyType="send"
                autoFocus
                placeholder={t("dex.askPlaceholder")}
                placeholderTextColor={cores.texto3}
                className="text-texto text-corpo mt-3"
              />
              {pensando && <Text className="text-texto3 text-legenda mt-3">{t("ai.thinking")}</Text>}
              {resposta && !pensando && (
                <Text className="text-texto2 text-corpo mt-3">{resposta}</Text>
              )}
            </Vidro>
          )}
          <View className="items-end">
            <Pressable onPress={() => setAberto((v) => !v)} accessibilityLabel={t("dex.ask")}>
              <Vidro raio={999} interativo ativo={aberto} style={{ width: 54, height: 54 }}>
                <View className="flex-1 items-center justify-center">
                  <SymbolView
                    name={aberto ? "xmark" : "sparkles"}
                    size={22}
                    tintColor={cores.texto}
                    fallback={<Text style={{ color: cores.texto, fontSize: 22 }}>+</Text>}
                  />
                </View>
              </Vidro>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

