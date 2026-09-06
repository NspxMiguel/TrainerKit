import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { decide } from "@trainerkit/core";
import { useDados } from "../../src/dados";
import { Selo } from "../../src/Selo";

/**
 * A ficha da especie — e a PROVA de que o port funciona.
 *
 * ⚠️ O `decide` daqui e o MESMO arquivo que o app web usa: `packages/core`, sem
 * uma linha alterada, sem DOM. Se o veredito sair certo nesta tela, os 5.821
 * linhas de logica portaram — que era a aposta inteira de escolher React Native
 * em vez de Swift.
 */
const COR_ACAO: Record<string, string> = {
  investir: "#3ddc97",
  evoluir: "#9f8bff",
  guardar: "#ffc55c",
  transferir: "#9aa6b8",
  descobrir: "#a8adba",
};

export default function Ficha() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pronto, dados } = useDados();

  const especie = useMemo(
    () => dados?.species.find((s) => s.id === id) ?? null,
    [dados, id],
  );

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
      levelCap: dados.version.levelCap,
      evolvesInto: [],
    });
  }, [dados, especie]);

  if (!pronto) {
    return (
      <View className="flex-1 items-center justify-center bg-fundo">
        <ActivityIndicator color="#f4f6fa" />
      </View>
    );
  }

  if (!especie) {
    return (
      <View className="flex-1 items-center justify-center bg-fundo">
        <Text className="text-texto">Espécie não encontrada.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      <View className="items-center">
        <Selo especie={especie} tamanho={112} />
        <Text className="text-texto text-2xl font-extrabold mt-4">{especie.name}</Text>
        <Text className="text-texto3 text-xs mt-1">
          #{String(especie.dex).padStart(3, "0")} · {especie.types.join(" / ")}
        </Text>
      </View>

      {veredito && (
        <View className="bg-superficie rounded-3xl p-5 mt-7">
          <Text className="text-texto3 text-[11px] tracking-widest">O QUE EU ACHO</Text>
          <Text
            className="text-xl font-bold mt-2"
            style={{ color: COR_ACAO[veredito.action] ?? "#f4f6fa" }}
          >
            {veredito.action}
          </Text>
          <Text className="text-texto2 text-xs mt-2">
            confiança {Math.round(veredito.confidence * 100)}%
          </Text>
        </View>
      )}

      <View className="bg-superficie rounded-3xl p-5 mt-3">
        <Text className="text-texto3 text-[11px] tracking-widest">STATS BASE</Text>
        {(
          [
            ["Ataque", especie.baseStats.atk],
            ["Defesa", especie.baseStats.def],
            ["PS", especie.baseStats.hp],
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
