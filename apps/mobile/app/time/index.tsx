import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

import { countDistinctTypes, pickTeam, type Candidate } from "@trainerkit/core";
import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { Selo } from "../../src/Selo";

/**
 * Seis bichos que se cobrem.
 *
 * ⚠️ NAO E "os seis melhores": e o time que cobre MAIS TIPOS. Seis dragoes com
 * o maior DPS da lista perdem pro mesmo counter seis vezes; `pickTeam` escolhe
 * pela variedade, e `countDistinctTypes` e o numero que mostra se deu certo.
 *
 * A nota do web vale aqui: o ranking de raide do dataset ja e a ordem de
 * qualidade, entao o candidato entra com o `score` dele e a escolha e sobre
 * cobertura, nao sobre forca.
 */
export default function Time() {
  const { t } = useT();
  const { dados } = useDados();

  const time = useMemo(() => {
    if (!dados?.rankings) return [];
    const cands: Candidate[] = [];
    for (const [i, r] of dados.rankings.raidOverall.entries()) {
      const sp = dados.species.find((s) => s.id === r.speciesId);
      if (!sp) continue;
      cands.push({
        speciesId: sp.id,
        name: sp.name,
        score: dados.rankings.raidOverall.length - i,
        types: sp.types,
      });
    }
    return pickTeam(cands, 6);
  }, [dados]);

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      <Text className="text-texto3 text-[11px] tracking-widest mb-2">
        {t("team.title").toUpperCase()}
      </Text>
      <View className="bg-superficie rounded-3xl overflow-hidden">
        {time.map((m, i) => {
          const sp = dados?.species.find((s) => s.id === m.speciesId);
          return (
            <View
              key={m.speciesId}
              className="flex-row items-center gap-3 px-4 py-3"
              style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.08)" } : undefined}
            >
              <Text className="text-texto3 text-xs w-4">{i + 1}</Text>
              {sp && <Selo especie={sp} tamanho={36} />}
              <Text className="flex-1 text-texto text-sm font-semibold">{m.name}</Text>
              <Text className="text-texto3 text-[11px]">{m.types.join(" / ")}</Text>
            </View>
          );
        })}
      </View>
      <Text className="text-texto3 text-xs mt-3 leading-5">
        {`${countDistinctTypes(time)} · ${t("team.variety")}`}
      </Text>
    </ScrollView>
  );
}
