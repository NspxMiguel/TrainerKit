import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

import {
  fazGigantamax,
  planejarFaxina,
  tetoDePowerUp,
  type BichoFaxina,
  type EspecieFaxina,
} from "@trainerkit/core";
import { useColecao } from "../../src/colecao";
import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { useSetup } from "../../src/setup";
import { useTema } from "../../src/tema";
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
  const { cores } = useTema();
  const { setup } = useSetup();
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
      /*
       * O teto de QUEM ESTA JOGANDO, e nao o do jogo.
       *
       * `version.levelCap` e o teto de quem ja terminou. Para um treinador de
       * nivel 20 o app respondia sobre uma especie que aquela pessoa so
       * consegue levar ao nivel 22 — a mesma correcao que o web ja tinha, e que
       * so pode existir aqui depois de o setup nativo perguntar o nivel.
       */
      levelCap: tetoDePowerUp(setup.level, dados.version.levelCap),
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
              style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : undefined}
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
