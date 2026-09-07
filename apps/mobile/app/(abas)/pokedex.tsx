import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ACTION_KEYS,
  computeCPAtLevel,
  ivPercentOf,
  ivTotalOf,
  type Action,
  type Key,
} from "@trainerkit/core";

import { marcarFeito, useColecao, type Guardado } from "../../src/colecao";
import { useDados, type Especie } from "../../src/dados";
import { useT } from "../../src/i18n";
import { usePendencias, vereditoDe } from "../../src/pendencias";
import { Segmented } from "../../src/Segmented";
import { SymbolView } from "expo-symbols";

import { corDoTipo, Selo, tintaSobre } from "../../src/Selo";
import { TopoDeVidro } from "../../src/TopoDeVidro";
import { PerguntarColecao } from "../../src/PerguntarColecao";
import { useSetup } from "../../src/setup";
import { useTema } from "../../src/tema";
import { Toque } from "../../src/Toque";
import { Vidro } from "../../src/Vidro";

/**
 * A POKÉDEX — todas as espécies, e as suas.
 *
 * ⚠️ `FlatList` e não `.map()`. São 1.182 espécies canônicas: renderizar todas
 * de uma vez trava o arranque. A lista virtualizada desenha o que cabe na tela
 * e recicla o resto — é o equivalente nativo do que o navegador fazia de graça.
 *
 * ⚠️ AS DUAS ABAS SÃO A MESMA TELA, e isso é do PWA. Separar "todas" de "as
 * minhas" em telas diferentes obriga a decidir onde procurar antes de procurar
 * — e a busca digitada numa some ao trocar para a outra. Aqui o termo é o mesmo
 * dos dois lados.
 */
type Aba = "todos" | "meus";

/**
 * POR QUE ORDENAR.
 *
 * ⚠️ "MAIS USADOS" NÃO ESTÁ AQUI, e a ausência é proposital — é a mesma decisão
 * do PWA. O app não tem, e não tem como ter, dado sobre o que as pessoas usam:
 * isso exigiria telemetria de jogadores reais. Dava para chutar uma lista a
 * partir dos rankings e ela seria indistinguível de uma real para quem lê —
 * e seria a primeira mentira do app, depois da qual nenhum outro número daqui
 * mereceria crédito.
 *
 * Todas as opções abaixo saem de conta feita sobre o GAME_MASTER, e a tela diz
 * de onde vem a que estiver escolhida.
 */
type Ordem = "dex" | "cp" | "raid" | "great" | "ultra" | "master" | "atk" | "def" | "hp";

const ORDENS: ReadonlyArray<{ id: Ordem; chave: Key }> = [
  { id: "dex", chave: "filter.sort.dex" },
  { id: "cp", chave: "filter.sort.cp" },
  { id: "raid", chave: "filter.sort.raid" },
  { id: "great", chave: "rank.league.great" },
  { id: "ultra", chave: "rank.league.ultra" },
  { id: "master", chave: "rank.league.master" },
  { id: "atk", chave: "filter.sort.atk" },
  { id: "def", chave: "filter.sort.def" },
  { id: "hp", chave: "filter.sort.hp" },
];

/** De onde sai cada ordem, em uma frase. */
const POR_QUE: Record<Ordem, Key> = {
  dex: "filter.why.dex",
  cp: "filter.why.cp",
  raid: "filter.why.raid",
  great: "filter.why.league",
  ultra: "filter.why.league",
  master: "filter.why.league",
  atk: "filter.why.stat",
  def: "filter.why.stat",
  hp: "filter.why.stat",
};

const PERFEITO = { atk: 15, def: 15, hp: 15 };

/** O símbolo de cada veredito, como o print 2 os desenha. */
const SIMBOLO: Record<string, string> = {
  investir: "↑",
  evoluir: "✦",
  guardar: "◆",
  transferir: "→",
  descobrir: "?",
};

/** Qual cor do tema pinta cada veredito. */
const COR_DA_ACAO: Record<string, "investir" | "evoluir" | "guardar" | "transferir"> = {
  investir: "investir",
  evoluir: "evoluir",
  guardar: "guardar",
  transferir: "transferir",
  descobrir: "investir",
};

interface Meu {
  guardado: Guardado;
  especie: Especie;
  acao: Action;
  pendente: boolean;
  /** O PC DELE, não o da espécie — é como se acha o exemplar na tela do jogo. */
  pc: number | null;
}

export default function Pokedex() {
  const { t, idioma } = useT();
  const { cores } = useTema();
  const { pronto, erro, dados } = useDados();
  const { setup } = useSetup();
  const { itens, recarregar } = useColecao();
  const alto = useSafeAreaInsets().top;
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<Aba>("todos");
  /* Grade ou lista, e só em "meus": a grade de todas as espécies existe para
     varrer por cor, e uma lista de 1.182 linhas não serve para nada disso. */
  /* ⚠️ LISTA por padrão em "meus", e não grade: o print 2 mostra uma lista, e
     é o formato certo para ela — a grade serve para varrer 1.182 espécies por
     cor, e a coleção se lê por veredito, que é texto. */
  const [emGrade, setEmGrade] = useState(false);
  /*
   * ⚠️ ESTADO SEPARADO PARA "TODOS", e não o mesmo `emGrade`.
   *
   * As duas abas querem padrões OPOSTOS: a de todas nasce em grade (mil e
   * cento e oitenta espécies se varrem por cor) e a coleção nasce em lista
   * (ela se lê por veredito, que é texto). Um estado só faria escolher numa
   * aba estragar a outra.
   */
  const [todasEmGrade, setTodasEmGrade] = useState(true);
  const [ordem, setOrdem] = useState<Ordem>("dex");
  /*
   * O TIPO, e um só por vez.
   *
   * ⚠️ Multi-seleção parece mais poderosa e responde uma pergunta que ninguém
   * faz: "me mostra os de Fogo OU de Água" não é como se procura bicho. O que
   * se procura é "quem eu tenho de Fogo", e para isso um tipo basta — tocar de
   * novo no mesmo limpa.
   */
  const [tipo, setTipo] = useState<string | null>(null);
  /* Fechado por padrão: a tela abre para VER a lista, não para filtrá-la. */
  const [filtroAberto, setFiltroAberto] = useState(false);

  const fila = usePendencias(dados);

  /* Quantos o veredito manda transferir — é o número que a faixa da faxina
     mostra, e ela só existe se ele for maior que zero. */
  const podemSair = useMemo(
    () => fila.filter((p) => p.veredito.action === "transferir").length,
    [fila],
  );

  const termo = busca.trim().toLowerCase();

  /* A nota de cada espécie na ordem escolhida. Vazio em "dex", que não precisa
     de nota nenhuma — é o número dela. */
  const notas = useMemo(() => {
    const m = new Map<string, number>();
    if (!dados || ordem === "dex") return m;

    const daLiga = (chave: "great" | "ultra" | "master") =>
      dados.rankings?.statProductByLeague[chave] ?? [];

    if (ordem === "raid") {
      const lista = dados.rankings?.raidOverall ?? [];
      lista.forEach((r, i) => m.set(r.speciesId, lista.length - i));
      return m;
    }
    if (ordem === "great" || ordem === "ultra" || ordem === "master") {
      const lista = daLiga(ordem);
      lista.forEach((r, i) => m.set(r.speciesId, lista.length - i));
      return m;
    }
    for (const s of dados.canonicas) {
      m.set(
        s.id,
        ordem === "cp"
          ? computeCPAtLevel(dados.cpm, s.baseStats, PERFEITO, dados.version.levelCap)
          : ordem === "atk"
            ? s.baseStats.atk
            : ordem === "def"
              ? s.baseStats.def
              : s.baseStats.hp,
      );
    }
    return m;
  }, [dados, ordem]);

  const todas = useMemo(() => {
    if (!dados) return [];
    const porTipo = tipo ? dados.canonicas.filter((s) => s.types.includes(tipo)) : dados.canonicas;
    const base = termo ? porTipo.filter((s) => s.name.toLowerCase().includes(termo)) : porTipo;
    if (ordem === "dex") return [...base].sort((a, b) => a.dex - b.dex);

    /*
     * ⚠️ QUEM NÃO TEM NOTA VAI PRO FIM, e não pro topo.
     *
     * Os rankings prontos só trazem 30 ou 60 nomes; o resto do jogo não aparece
     * neles. Sem este cuidado, "melhor de raide" colocaria as mil espécies sem
     * nota, empatadas em zero, na frente da lista.
     */
    return [...base].sort((a, b) => {
      const na = notas.get(a.id);
      const nb = notas.get(b.id);
      if (na === undefined && nb === undefined) return a.dex - b.dex;
      if (na === undefined) return 1;
      if (nb === undefined) return -1;
      return nb - na || a.dex - b.dex;
    });
  }, [dados, termo, tipo, ordem, notas]);

  const meus = useMemo<Meu[]>(() => {
    if (!dados || !itens) return [];
    const pendentes = new Set(fila.map((p) => p.guardado.id));
    return (
      itens
        .map((g) => {
          const especie = dados.species.find((s) => s.id === g.speciesId);
          if (!especie) return null;
          if (termo && !especie.name.toLowerCase().includes(termo)) return null;
          const veredito = vereditoDe(g, especie, dados, setup.level);
          return {
            guardado: g,
            especie,
            acao: veredito.action,
            pendente: pendentes.has(g.id),
            pc: g.ivDesconhecido
              ? null
              : computeCPAtLevel(dados.cpm, especie.baseStats, g.ivs, g.level),
          };
        })
        .filter((x): x is Meu => x !== null)
        /* Quem pede decisão primeiro: a lista existe para responder o que fazer,
         e o que já foi resolvido não precisa ser reencontrado. */
        .sort((a, b) => Number(b.pendente) - Number(a.pendente))
    );
  }, [dados, itens, termo, setup.level, fila]);

  if (erro) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-texto text-base">{t("tabs.pokedex")}</Text>
        <Text className="text-texto3 text-xs mt-2 text-center">{erro}</Text>
      </View>
    );
  }

  if (!pronto) {
    return (
      <View className="flex-1 items-center justify-center bg-fundo">
        <ActivityIndicator color={cores.texto} />
      </View>
    );
  }

  const total = aba === "todos" ? todas.length : meus.length;

  return (
    <View className="flex-1 bg-fundo">
      <TopoDeVidro />
      <View className="px-4 pb-2" style={{ paddingTop: alto + 8 }}>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-titulo-tela text-texto">{t("tabs.pokedex")}</Text>
          {/* Grade/lista nas DUAS abas — e só quando há o que ver. */}
          {(aba === "meus" ? meus.length > 0 : todas.length > 0) && (
            <Toque
              onPress={() => (aba === "meus" ? setEmGrade((v) => !v) : setTodasEmGrade((v) => !v))}
              className="rounded-pilula px-3 py-2"
              style={{ backgroundColor: cores.superficie }}
            >
              <Text className="text-texto2 text-legenda">
                {t(
                  (aba === "meus" ? emGrade : todasEmGrade)
                    ? "collection.asListShort"
                    : "collection.asGridShort",
                )}
              </Text>
            </Toque>
          )}
        </View>

        {/* ⚠️ A CONTAGEM ENTRA NO RÓTULO. Sem ela a pessoa não sabe se "meus"
            está vazio ou se o filtro é que não achou nada. */}
        <View className="mb-3">
          <Segmented
            rotuloAcessivel={t("tabs.pokedex")}
            valor={aba}
            opcoes={[
              { valor: "todos", rotulo: `${t("especies.all")} · ${todas.length}` },
              { valor: "meus", rotulo: `${t("especies.mine")} · ${meus.length}` },
            ]}
            onEscolher={(v) => setAba(v as Aba)}
          />
        </View>

        {/* ⚠️ A BUSCA E O FILTRO NA MESMA LINHA, como no site.
            A ordenação e os dezoito tipos eram duas fileiras que rolavam de
            lado e ficavam CORTADAS na borda — "Ultra Master Ataque" começando
            no meio de uma palavra. Isso não é filtro, é sujeira: quem chega não
            sabe que aquilo rola, e quem sabe não acha o que quer. Atrás de um
            botão elas cabem inteiras. */}
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Vidro raio={999} interativo>
              <TextInput
                value={busca}
                onChangeText={setBusca}
                placeholder={t("especies.searchPlaceholder")}
                placeholderTextColor={cores.texto3}
                className="px-5 py-3 text-corpo"
                style={{ color: cores.texto }}
              />
            </Vidro>
          </View>
          <Pressable
            onPress={() => setFiltroAberto((v) => !v)}
            accessibilityLabel={t("filter.sortBy")}
            className="rounded-cartao-sm items-center justify-center"
            style={{
              width: 46,
              backgroundColor:
                filtroAberto || tipo || ordem !== "dex" ? cores.texto : cores.superficie,
            }}
          >
            <SymbolView
              name="slider.horizontal.3"
              size={18}
              tintColor={filtroAberto || tipo || ordem !== "dex" ? cores.fundo : cores.texto2}
              fallback={<Text style={{ color: cores.texto2, fontSize: 16 }}>≡</Text>}
            />
          </Pressable>
        </View>

        {/* A ORDEM, e só na aba de todas: "meus" já é ordenado por pendência,
            que é a pergunta daquela lista. */}
        {aba === "todos" && filtroAberto && (
          <View className="mt-3">
            <Segmented
              rotuloAcessivel={t("filter.sortBy")}
              valor={ordem}
              opcoes={ORDENS.map((o) => ({ valor: o.id, rotulo: t(o.chave) }))}
              onEscolher={(v) => setOrdem(v as Ordem)}
            />
            {/* OS 18 TIPOS. Rolam na horizontal porque não cabem, e cada um
                usa a PRÓPRIA cor: a lista de tipos é lida por cor antes de ser
                lida por nome, e uma fileira monocromática desperdiça isso. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-2"
              contentContainerStyle={{ gap: 6, paddingRight: 20 }}
            >
              {(dados?.typeOrder ?? []).map((tp) => {
                const escolhido = tipo === tp;
                const cor = corDoTipo(tp);
                return (
                  <Pressable
                    key={tp}
                    onPress={() => setTipo((v) => (v === tp ? null : tp))}
                    className="rounded-pilula px-3 py-1.5"
                    style={{
                      backgroundColor: escolhido ? cor : cores.superficie,
                      borderWidth: 1,
                      borderColor: escolhido ? cor : cores.linha,
                    }}
                  >
                    <Text
                      className="text-[12px] font-semibold"
                      style={{ color: escolhido ? tintaSobre(cor) : cores.texto2 }}
                    >
                      {t(`type.${tp}` as Key)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* A FAIXA DA FAXINA. Ela só aparece quando há mesmo o que transferir —
            um atalho permanente para uma tela vazia ensina a ignorá-lo. */}
        {/* O CARTÃO DO MODO POKÉDEX.
            ⚠️ Ele fica aqui, logo abaixo da busca, e não escondido num atalho
            do Início: é o print 2 do pacote, e o motivo é que a Pokédex é onde
            a pessoa está quando quer apontar a câmera para um bicho. */}
        {aba === "meus" && (
          <Toque
            onPress={() => router.push("/dex")}
            className="rounded-cartao px-4 py-3 mt-3 flex-row items-center gap-3"
            style={{ backgroundColor: cores.superficie }}
          >
            <View
              className="rounded-pilula items-center justify-center"
              style={{ width: 38, height: 38, backgroundColor: "#E4483B" }}
            >
              <SymbolView
                name="camera.viewfinder"
                size={17}
                tintColor="#FFFFFF"
                fallback={<View />}
              />
            </View>
            <View className="flex-1">
              <Text className="text-texto text-corpo font-semibold">{t("dex.open")}</Text>
              <Text className="text-texto3 text-legenda mt-0.5" numberOfLines={2}>
                {t("dex.openDetail")}
              </Text>
            </View>
            <Text className="text-texto3 text-base">›</Text>
          </Toque>
        )}

        {/* A PERGUNTA SOBRE A COLEÇÃO INTEIRA — só na aba que tem coleção. */}
        {aba === "meus" && <PerguntarColecao itens={itens ?? []} especies={dados?.species ?? []} />}

        {aba === "meus" && podemSair > 0 && (
          <Toque
            onPress={() => router.push("/faxina")}
            className="rounded-cartao-sm px-4 py-3 mt-3 flex-row items-center justify-between"
            style={{ backgroundColor: cores.superficie }}
          >
            <Text className="text-texto text-corpo">{t("faxina.title")}</Text>
            <Text className="text-texto3 text-legenda">
              {t(podemSair === 1 ? "faxina.openDetail.one" : "faxina.openDetail.many", {
                count: podemSair,
              })}
            </Text>
          </Toque>
        )}

        <Text className="text-texto3 text-xs mt-4">
          {t("especies.count", { n: total.toLocaleString() })}
          {aba === "todos" && ordem !== "dex" ? ` · ${t(POR_QUE[ordem])}` : ""}
        </Text>
      </View>

      {aba === "todos" ? (
        /*
          GRADE, e não lista — a mesma escolha do web. Mil e cento e oitenta
          espécies numa coluna são mil e cento e oitenta rolagens; em grade cabem
          quatro por linha e o olho varre por COR, que é o que o selo oferece.
        */
        <FlatList
          data={todas}
          key={todasEmGrade ? "todas-grade-3" : "todas-lista"}
          /* ⚠️ TRÊS, e não quatro: com quatro o nome da espécie cabia em
             11px e ainda cortava ("Rattata (Alo..."). O site usa três, e é
             o que deixa o selo grande o suficiente para varrer por cor. */
          numColumns={todasEmGrade ? 3 : 1}
          keyExtractor={(s: Especie) => s.id}
          {...(todasEmGrade ? { columnWrapperStyle: { gap: 10 } } : {})}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96, gap: 10 }}
          renderItem={({ item }) => (
            /*
              ⚠️ `router.push` e NAO `<Link asChild>`.
              O `Link` clona o filho e passa uma `ref`; com um componente proprio
              no meio o toque simplesmente nao navegava — sem erro, sem aviso, a
              grade inteira muda. Chamar o roteador direto tira a clonagem da
              equacao e o `Toque` volta a ser so um botao.
            */
            <Toque
              onPress={() => router.push({ pathname: "/especie/[id]", params: { id: item.id } })}
              /* ⚠️ `flex: 1` SÓ na camada de fora. Ele na de dentro também
                 esticava o tile até a altura da linha inteira, e a grade virava
                 colunas ocas com o bicho no pé. */
              {...(todasEmGrade ? { estiloExterno: { flex: 1 } } : {})}
              className={
                todasEmGrade
                  ? "items-center bg-superficie rounded-tile py-3"
                  : "flex-row items-center gap-3 bg-superficie rounded-cartao-sm px-4 py-3"
              }
            >
              <Selo especie={item} tamanho={todasEmGrade ? 52 : 44} />
              <View className={todasEmGrade ? "items-center" : "flex-1"}>
                <Text
                  className={`text-texto font-semibold ${todasEmGrade ? "text-[11px] mt-2 text-center px-1" : "text-corpo"}`}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text className={`text-texto3 ${todasEmGrade ? "text-[10px]" : "text-legenda"}`}>
                  #{String(item.dex).padStart(3, "0")}
                  {/* Na lista há largura para dizer o TIPO, que é justamente o
                      que a grade comunica por cor e a lista perderia. */}
                  {todasEmGrade
                    ? ""
                    : ` · ${item.types.map((tp) => t(`type.${tp}` as Key)).join(" / ")}`}
                </Text>
              </View>
            </Toque>
          )}
        />
      ) : meus.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text className="text-texto text-corpo font-semibold text-center">
            {termo ? t("collection.noMatch.title") : t("collection.empty.title")}
          </Text>
          <Text className="text-texto3 text-legenda text-center mt-2 leading-5">
            {termo ? t("collection.noMatch.body", { q: busca.trim() }) : t("collection.empty.body")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={meus}
          key={emGrade ? "meus-grade" : "meus-lista"}
          numColumns={emGrade ? 3 : 1}
          keyExtractor={(m) => m.guardado.id}
          {...(emGrade ? { columnWrapperStyle: { gap: 10 } } : {})}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96, gap: 10 }}
          renderItem={({ item, index }) => (
            <Toque
              onPress={() =>
                router.push({ pathname: "/especie/[id]", params: { id: item.especie.id } })
              }
              className={
                emGrade
                  ? "items-center bg-superficie rounded-tile py-3"
                  : "flex-row items-center gap-3 bg-superficie px-3 py-3"
              }
              /* A borda esquerda na cor do veredito é o que faz a lista ser
                   varrível: dá para achar "o que transferir" sem ler nome nenhum. */
              style={
                emGrade
                  ? undefined
                  : {
                      borderLeftWidth: 3,
                      borderLeftColor: item.pendente
                        ? cores[COR_DA_ACAO[item.acao] ?? "linha"]
                        : "transparent",
                      /* O cartão é a LISTA inteira: só a primeira e a última
                           linha arredondam, e o meio fica reto. */
                      borderTopLeftRadius: index === 0 ? 20 : 0,
                      borderTopRightRadius: index === 0 ? 20 : 0,
                      borderBottomLeftRadius: index === meus.length - 1 ? 20 : 0,
                      borderBottomRightRadius: index === meus.length - 1 ? 20 : 0,
                      overflow: "hidden",
                    }
              }
            >
              <Selo especie={item.especie} tamanho={emGrade ? 52 : 44} />
              <View className={emGrade ? "items-center" : "flex-1"}>
                <Text
                  className={`text-texto font-semibold ${emGrade ? "text-[11px] mt-2 text-center px-1" : "text-corpo"}`}
                  numberOfLines={1}
                >
                  {item.especie.name}
                </Text>
                {/* ⚠️ IV, PC e NÍVEL — os três, como o print 2. Só o IV não
                      identifica o exemplar: quem tem dois Machamp de 96% precisa
                      do PC para saber qual é qual na tela do jogo. */}
                <Text className="text-texto3 text-legenda mt-0.5" numberOfLines={1}>
                  {item.guardado.ivDesconhecido
                    ? t("collection.ivUnknown")
                    : `IV ${Math.round(ivPercentOf(item.guardado.ivs))}% · ${t("common.cp")} ${
                        item.pc?.toLocaleString(idioma) ?? "—"
                      } · ${t("common.level")} ${item.guardado.level}`}
                </Text>
              </View>
              {!emGrade && (
                <Pressable
                  /*
                      MARCAR COMO FEITO sem abrir a ficha.
                      ⚠️ Sem isto a única forma de tirar um bicho da fila era
                      abrir a ficha dele, e quem acabou de evoluir seis quer
                      dizer isso seis vezes, não navegar doze telas.
                    */
                  onPress={() => {
                    void marcarFeito(item.guardado.id, item.pendente ? item.acao : null).then(
                      recarregar,
                    );
                  }}
                  hitSlop={8}
                  accessibilityLabel={t(
                    item.pendente ? "collection.markDone" : "collection.undoDone",
                  )}
                  /* ⚠️ CHIP PREENCHIDO, e não contornado: no print 2 o
                       veredito é uma pastilha com a cor por dentro, e é ela que
                       faz a lista ser varrível de longe. Contorno some contra o
                       fundo escuro. */
                  className="rounded-pilula px-3 py-1.5"
                  style={{
                    backgroundColor: item.pendente
                      ? `${cores[COR_DA_ACAO[item.acao] ?? "linha"]}26`
                      : "transparent",
                    borderWidth: 1,
                    borderColor: item.pendente
                      ? `${cores[COR_DA_ACAO[item.acao] ?? "linha"]}4D`
                      : cores.linha,
                  }}
                >
                  <Text
                    className="text-legenda"
                    style={{
                      color: item.pendente
                        ? cores[COR_DA_ACAO[item.acao] ?? "texto3"]
                        : cores.texto3,
                    }}
                  >
                    {item.pendente
                      ? `${SIMBOLO[item.acao] ?? ""} ${t(ACTION_KEYS[item.acao] as Key).toUpperCase()}`
                      : "✓"}
                  </Text>
                </Pressable>
              )}
            </Toque>
          )}
        />
      )}
    </View>
  );
}
