import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDados, type Especie } from "../../src/dados";
import { useT } from "../../src/i18n";
import { useTema } from "../../src/tema";
import { Toque } from "../../src/Toque";
import { Vidro } from "../../src/Vidro";
import { Selo } from "../../src/Selo";

/**
 * A lista de especies.
 *
 * ⚠️ `FlatList` E NAO `.map()`. Sao 2.472 especies: renderizar todas de uma vez
 * trava o arranque. A lista virtualizada desenha o que cabe na tela e recicla o
 * resto — e o equivalente nativo do que o navegador fazia de graca com scroll.
 */
export default function Pokedex() {
  const { t } = useT();
  const { cores } = useTema();
  const { pronto, erro, dados } = useDados();
  const alto = useSafeAreaInsets().top;
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return dados.canonicas;
    return dados.canonicas.filter((s) => s.name.toLowerCase().includes(termo));
  }, [dados, busca]);

  if (erro) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-texto text-base">{/* O MESMO nome da aba. A tela dizia "Espécies" e a aba dizia "Pokédex":
            dois nomes para o mesmo lugar, e quem navega perde a referência. */
          t("tabs.pokedex")}</Text>
        <Text className="text-texto3 text-xs mt-2 text-center">{erro}</Text>
      </View>
    );
  }

  if (!pronto) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={cores.texto} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-fundo">
      <View className="px-4 pb-2" style={{ paddingTop: alto + 8 }}>
        <Text className="text-titulo-tela text-texto mb-3">{/* O MESMO nome da aba. A tela dizia "Espécies" e a aba dizia "Pokédex":
            dois nomes para o mesmo lugar, e quem navega perde a referência. */
          t("tabs.pokedex")}</Text>
        {/* Busca em PILULA — controle de acao, entao raio 999 (tokens.css diz
            que cartao de conteudo fica em 20/26/28 e controle fica em pilula). */}
        {/* A BUSCA É VIDRO. O índice do pacote lista onde ele entra, e a busca
            está lá: ela flutua sobre a grade, que continua rolando por baixo. */}
        <Vidro raio={999} interativo>
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder={t("especies.searchPlaceholder")}
            placeholderTextColor={cores.texto3}
            className="text-texto px-5 py-3 text-corpo"
            style={{ color: cores.texto }}
          />
        </Vidro>
        <Text className="text-texto3 text-xs mt-4">
          {t("especies.count", { n: visiveis.length.toLocaleString() })}
        </Text>
      </View>

      {/*
        GRADE, e nao lista — e a mesma escolha do web.
        
        Mil e duzentas especies numa lista de uma coluna sao mil e duzentas
        rolagens; em grade cabem quatro por linha e o olho varre por COR, que e
        justamente o que o selo da especie oferece. `numColumns` num `FlatList`
        mantem a virtualizacao: so o que cabe na tela e desenhado.
      */}
      <FlatList
        data={visiveis}
        key="grade-4"
        numColumns={4}
        keyExtractor={(s: Especie) => s.id}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 132, gap: 10 }}
        renderItem={({ item }) => (
          <Link href={{ pathname: "/especie/[id]", params: { id: item.id } }} asChild>
            <Toque className="flex-1 items-center bg-superficie rounded-tile py-3">
              <Selo especie={item} tamanho={52} />
              <Text
                className="text-texto text-[11px] font-semibold mt-2 text-center px-1"
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text className="text-texto3 text-[10px]">#{String(item.dex).padStart(3, "0")}</Text>
            </Toque>
          </Link>
        )}
      />
    </View>
  );
}
