import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ACTION_KEYS, ivPercentOf, ivTotalOf, type Action, type Key } from "@trainerkit/core";

import { useColecao, type Guardado } from "../../src/colecao";
import { useDados, type Especie } from "../../src/dados";
import { useT } from "../../src/i18n";
import { usePendencias, vereditoDe } from "../../src/pendencias";
import { Segmented } from "../../src/Segmented";
import { Selo } from "../../src/Selo";
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
}

export default function Pokedex() {
  const { t } = useT();
  const { cores } = useTema();
  const { pronto, erro, dados } = useDados();
  const { setup } = useSetup();
  const { itens } = useColecao();
  const alto = useSafeAreaInsets().top;
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<Aba>("todos");
  /* Grade ou lista, e só em "meus": a grade de todas as espécies existe para
     varrer por cor, e uma lista de 1.182 linhas não serve para nada disso. */
  const [emGrade, setEmGrade] = useState(true);

  const fila = usePendencias(dados);

  const termo = busca.trim().toLowerCase();

  const todas = useMemo(() => {
    if (!dados) return [];
    if (!termo) return dados.canonicas;
    return dados.canonicas.filter((s) => s.name.toLowerCase().includes(termo));
  }, [dados, termo]);

  const meus = useMemo<Meu[]>(() => {
    if (!dados || !itens) return [];
    const pendentes = new Set(fila.map((p) => p.guardado.id));
    return itens
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
        };
      })
      .filter((x): x is Meu => x !== null)
      /* Quem pede decisão primeiro: a lista existe para responder o que fazer,
         e o que já foi resolvido não precisa ser reencontrado. */
      .sort((a, b) => Number(b.pendente) - Number(a.pendente));
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
      <View className="px-4 pb-2" style={{ paddingTop: alto + 8 }}>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-titulo-tela text-texto">{t("tabs.pokedex")}</Text>
          {/* Grade/lista só faz sentido em "meus" — e só quando há o que ver. */}
          {aba === "meus" && meus.length > 0 && (
            <Toque
              onPress={() => setEmGrade((v) => !v)}
              className="rounded-pilula px-3 py-2"
              style={{ backgroundColor: cores.superficie }}
            >
              <Text className="text-texto2 text-legenda">
                {t(emGrade ? "collection.asListShort" : "collection.asGridShort")}
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

        <Text className="text-texto3 text-xs mt-4">
          {t("especies.count", { n: total.toLocaleString() })}
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
          key="grade-4"
          numColumns={4}
          keyExtractor={(s: Especie) => s.id}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 132, gap: 10 }}
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
              estiloExterno={{ flex: 1 }}
              className="flex-1 items-center bg-superficie rounded-tile py-3"
            >
                <Selo especie={item} tamanho={52} />
                <Text
                  className="text-texto text-[11px] font-semibold mt-2 text-center px-1"
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text className="text-texto3 text-[10px]">
                  #{String(item.dex).padStart(3, "0")}
                </Text>
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 132, gap: 10 }}
          renderItem={({ item }) => (
            <Toque
                onPress={() =>
                  router.push({ pathname: "/especie/[id]", params: { id: item.especie.id } })
                }
                className={
                  emGrade
                    ? "flex-1 items-center bg-superficie rounded-tile py-3"
                    : "flex-row items-center gap-3 bg-superficie rounded-cartao-sm p-3"
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
                  <Text className="text-texto3 text-legenda mt-0.5">
                    {item.guardado.ivDesconhecido
                      ? t("collection.ivUnknown")
                      : `${ivTotalOf(item.guardado.ivs)}/45 · ${Math.round(ivPercentOf(item.guardado.ivs))}%`}
                  </Text>
                </View>
                {!emGrade && (
                  <Text
                    className="text-legenda"
                    style={{ color: cores[COR_DA_ACAO[item.acao] ?? "texto3"] }}
                  >
                    {t(ACTION_KEYS[item.acao] as Key).toUpperCase()}
                  </Text>
                )}
              </Toque>
          )}
        />
      )}
    </View>
  );
}
