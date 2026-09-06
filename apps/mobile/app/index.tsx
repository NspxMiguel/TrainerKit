import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";

import { useDados, type Especie } from "../src/dados";
import { useT } from "../src/i18n";
import { useTema } from "../src/tema";
import { Selo } from "../src/Selo";

/**
 * A lista de especies.
 *
 * ⚠️ `FlatList` E NAO `.map()`. Sao 2.472 especies: renderizar todas de uma vez
 * trava o arranque. A lista virtualizada desenha o que cabe na tela e recicla o
 * resto — e o equivalente nativo do que o navegador fazia de graca com scroll.
 */
export default function Lista() {
  const { t } = useT();
  const { cores } = useTema();
  const { pronto, erro, dados } = useDados();
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
        <Text className="text-texto text-base">{t("especies.title")}</Text>
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
      <View className="px-4 pt-3 pb-2">
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder={t("especies.searchPlaceholder")}
          placeholderTextColor={cores.texto3}
          className="bg-superficie text-texto rounded-2xl px-4 py-3 text-base"
        />
        {/* Os atalhos que nao sao sobre UM bicho. Ficam no topo da Especies
            enquanto nao ha aba de Inicio — e o unico lugar que existe hoje. */}
        <View className="flex-row gap-2 mt-3">
          <Link href="/chocadeira" asChild>
            <Pressable className="flex-1 bg-superficie rounded-2xl py-3 items-center">
              <Text className="text-texto text-xs font-semibold">{t("eggs.title")}</Text>
            </Pressable>
          </Link>
          <Link href="/ajustes" asChild>
            <Pressable className="flex-1 bg-superficie rounded-2xl py-3 items-center">
              <Text className="text-texto text-xs font-semibold">{t("settings.title")}</Text>
            </Pressable>
          </Link>
          <Link href="/colecao" asChild>
            <Pressable className="flex-1 bg-superficie rounded-2xl py-3 items-center">
              <Text className="text-texto text-xs font-semibold">{t("especies.mine")}</Text>
            </Pressable>
          </Link>
          <Link href="/agenda" asChild>
            <Pressable className="flex-1 bg-superficie rounded-2xl py-3 items-center">
              <Text className="text-texto text-xs font-semibold">{t("agenda.title")}</Text>
            </Pressable>
          </Link>
        </View>

        <Text className="text-texto3 text-xs mt-3">
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
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}
        renderItem={({ item }) => (
          <Link href={{ pathname: "/especie/[id]", params: { id: item.id } }} asChild>
            <Pressable className="flex-1 items-center bg-superficie rounded-2xl py-3">
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
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}
