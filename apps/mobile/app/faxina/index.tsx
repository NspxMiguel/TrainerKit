import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

import {
  fazGigantamax,
  planejarFaxina,
  type BichoFaxina,
  type EspecieFaxina,
} from "@trainerkit/core";
import { useColecao } from "../../src/colecao";
import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { Selo } from "../../src/Selo";

/**
 * A faxina.
 *
 * ⚠️ O APP NAO TRANSFERE NADA, e isso nao e letra miuda: ele nao fala com o
 * jogo e nao tem como falar. O que acontece aqui e a LISTA — quem transfere e
 * a pessoa, no jogo. Por isso o texto nunca diz "transferir por voce".
 *
 * A metade que parece dispensavel e a dos guardados COM O MOTIVO: uma faxina
 * que nao deixa auditar o que ficou de fora e uma faxina que se usa uma vez.
 */
export default function Faxina() {
  const { t } = useT();
  const { itens } = useColecao();
  const { dados } = useDados();

  const plano = useMemo(() => {
    if (!dados || !itens || itens.length === 0) return null;
    const especies = new Map<string, EspecieFaxina>();
    for (const g of itens) {
      if (especies.has(g.speciesId)) continue;
      const sp = dados.species.find((s) => s.id === g.speciesId);
      if (!sp) continue;
      especies.set(sp.id, {
        id: sp.id,
        baseStats: sp.baseStats,
        evolvesInto: [],
        candyToEvolve: null,
        legendary: sp.legendary ?? false,
        gigantamax: fazGigantamax(sp.id, (dados as never as { dynamax?: never }).dynamax),
      });
    }
    const bichos: BichoFaxina[] = itens.map((g) => ({
      id: g.id,
      speciesId: g.speciesId,
      ivs: g.ivs,
      level: g.level,
      lucky: g.lucky,
      shadow: g.shadow,
      ivDesconhecido: false,
    }));
    return planejarFaxina({
      bichos,
      especies,
      cpm: dados.cpm,
      levelCap: dados.version.levelCap,
    });
  }, [dados, itens]);

  if (!plano) {
    return (
      <View className="flex-1 bg-fundo items-center justify-center px-10">
        <Text className="text-texto3 text-sm text-center leading-6">{t("raid.emptyBody")}</Text>
      </View>
    );
  }

  const nome = (sid: string) => dados?.species.find((s) => s.id === sid);

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      <Text className="text-texto2 text-sm leading-6">{t("faxina.intro")}</Text>

      <Text className="text-texto3 text-[11px] tracking-widest mt-6 mb-2">
        {t("faxina.sure").toUpperCase()}
      </Text>
      <View className="bg-superficie rounded-3xl overflow-hidden">
        {plano.soltos.map((s, i) => {
          const sp = nome(s.speciesId);
          return (
            <View
              key={s.id}
              className="flex-row items-center gap-3 px-4 py-3"
              style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.08)" } : undefined}
            >
              {sp && <Selo especie={sp} tamanho={36} />}
              <View className="flex-1">
                <Text className="text-texto text-sm font-semibold">{sp?.name ?? s.speciesId}</Text>
                <Text className="text-texto3 text-[11px]" numberOfLines={2}>
                  {String(s.motivo)}
                </Text>
              </View>
            </View>
          );
        })}
        {plano.soltos.length === 0 && (
          <Text className="text-texto3 text-sm p-4">{t("rank.empty")}</Text>
        )}
      </View>
    </ScrollView>
  );
}
