import { Link } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";

import { badgeFor, ivPercentOf, ivTotalOf } from "@trainerkit/core";
import { useColecao, remover } from "../../src/colecao";
import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { Selo } from "../../src/Selo";

/** O que ele guardou. Vazio e um convite, nao um erro. */
export default function Colecao() {
  const { t } = useT();
  const { itens } = useColecao();
  const { dados } = useDados();

  if (!itens || itens.length === 0) {
    return (
      <View className="flex-1 bg-fundo items-center justify-center px-10">
        <Text className="text-texto text-base font-semibold text-center">
          {t("raid.emptyTitle")}
        </Text>
        <Text className="text-texto3 text-sm text-center mt-2 leading-6">
          {t("raid.emptyBody")}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-fundo"
      contentContainerStyle={{ padding: 20 }}
      data={itens}
      keyExtractor={(g) => g.id}
      renderItem={({ item }) => {
        const sp = dados?.species.find((s) => s.id === item.speciesId);
        const selo = badgeFor(ivTotalOf(item.ivs));
        if (!sp) return null;
        return (
          <Link href={{ pathname: "/especie/[id]", params: { id: sp.id } }} asChild>
            <Pressable
              className="flex-row items-center gap-3 bg-superficie rounded-2xl p-3 mb-2"
              onLongPress={() => void remover(item.id)}
            >
              <Selo especie={sp} tamanho={44} />
              <View className="flex-1">
                <Text className="text-texto text-[15px] font-semibold">{sp.name}</Text>
                <Text className="text-texto3 text-xs">
                  {ivTotalOf(item.ivs)}/45 · {Math.round(ivPercentOf(item.ivs))}% ·{" "}
                  {t("iv.level")} {item.level}
                </Text>
              </View>
              <Text className="text-guardar text-sm">
                {"★".repeat(selo.litStars)}
                {"☆".repeat(3 - selo.litStars)}
              </Text>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}
