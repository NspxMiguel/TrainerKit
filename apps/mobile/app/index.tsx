import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";

import { useDados, type Especie } from "../src/dados";
import { Selo } from "../src/Selo";

/**
 * A lista de especies.
 *
 * ⚠️ `FlatList` E NAO `.map()`. Sao 2.472 especies: renderizar todas de uma vez
 * trava o arranque. A lista virtualizada desenha o que cabe na tela e recicla o
 * resto — e o equivalente nativo do que o navegador fazia de graca com scroll.
 */
export default function Lista() {
  const { pronto, erro, dados } = useDados();
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return dados.species;
    return dados.species.filter((s) => s.name.toLowerCase().includes(termo));
  }, [dados, busca]);

  if (erro) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-texto text-base">Não consegui ler a base.</Text>
        <Text className="text-texto3 text-xs mt-2 text-center">{erro}</Text>
      </View>
    );
  }

  if (!pronto) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#f4f6fa" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-fundo">
      <View className="px-4 pt-3 pb-2">
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome"
          placeholderTextColor="#767c8c"
          className="bg-superficie text-texto rounded-2xl px-4 py-3 text-base"
        />
        <Text className="text-texto3 text-xs mt-2">
          {visiveis.length.toLocaleString("pt-BR")} espécies
        </Text>
      </View>

      <FlatList
        data={visiveis}
        keyExtractor={(s: Especie) => s.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <Link href={{ pathname: "/especie/[id]", params: { id: item.id } }} asChild>
            <Pressable className="flex-row items-center gap-3 py-2.5">
              <Selo especie={item} tamanho={44} />
              <View className="flex-1">
                <Text className="text-texto text-[15px] font-semibold">{item.name}</Text>
                <Text className="text-texto3 text-xs">
                  #{String(item.dex).padStart(3, "0")}
                </Text>
              </View>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}
