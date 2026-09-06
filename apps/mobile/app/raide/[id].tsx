import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import {
  RAID_TIERS,
  effectiveness,
  rankCounters,
  rankMovesets,
  type CounterInput,
  type Move,
  type MoveWithPvp,
  type RaidTier,
} from "@trainerkit/core";
import { useDados, type Base, type Especie } from "../../src/dados";
import { useT } from "../../src/i18n";
import { useTema } from "../../src/tema";
import { Selo } from "../../src/Selo";

/**
 * Como derrubar este bicho numa raide.
 *
 * ⚠️ A LISTA NAO DEPENDE DE COLECAO. No web esta tela so respondia "voce
 * consegue?", e sem colecao caia num estado vazio — a unica pergunta que ela
 * nao respondia era a de quem ainda nao cadastrou nada. Aqui ela nasce
 * respondendo "o que existe de melhor", que e o que serve pra todo mundo.
 *
 * Ranquear as 1.182 a cada abertura seriam 1.182 buscas de moveset e a tela
 * travaria; o dataset ja traz o recorte pronto (30 gerais + 40 por tipo) e a
 * conta roda so em cima dele.
 */
const TIERS: RaidTier[] = [1, 3, 5, "mega"];

function poolDeCandidatos(dados: Base, tiposDoChefe: readonly string[]): string[] {
  const fortes = dados.typeOrder.filter(
    (tp) => effectiveness(dados.typeChart, dados.typeOrder, tp, tiposDoChefe) > 1,
  );
  const vistos = new Set<string>();
  const fora: string[] = [];
  const juntar = (lista: { speciesId: string }[] | undefined) => {
    for (const r of lista ?? []) {
      if (vistos.has(r.speciesId)) continue;
      vistos.add(r.speciesId);
      fora.push(r.speciesId);
    }
  };
  juntar(dados.rankings?.raidOverall);
  for (const tp of fortes) juntar(dados.rankings?.raidByType?.[tp]);
  return fora;
}

export default function Raide() {
  const { t, idioma } = useT();
  const { cores } = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dados } = useDados();
  const chefe = dados?.species.find((s) => s.id === id) ?? null;
  const [tier, setTier] = useState<RaidTier>(chefe?.legendary ? 5 : 3);

  const recomendados = useMemo(() => {
    if (!dados || !chefe) return [];
    const golpe = (gid: string): Move | null =>
      (dados.fastMoves.find((m) => m.id === gid) ??
        dados.chargedMoves.find((m) => m.id === gid) ??
        null) as Move | null;

    const chefeInput = {
      name: chefe.name,
      types: chefe.types,
      baseStats: chefe.baseStats,
      tier,
      fastMoves: chefe.fastMoves.map(golpe).filter((m): m is Move => m !== null),
      chargedMoves: chefe.chargedMoves.map(golpe).filter((m): m is Move => m !== null),
    };

    const time: CounterInput[] = [];
    for (const sid of poolDeCandidatos(dados, chefe.types)) {
      const sp = dados.species.find((x) => x.id === sid);
      if (!sp) continue;
      const rapidos = sp.fastMoves.map(golpe).filter((m): m is Move => m !== null);
      const carregados = sp.chargedMoves.map(golpe).filter((m): m is Move => m !== null);
      if (rapidos.length === 0 || carregados.length === 0) continue;
      const melhor = rankMovesets(rapidos as MoveWithPvp[], carregados as MoveWithPvp[], "raid", {
        attackerTypes: sp.types,
        chart: dados.typeChart,
        order: dados.typeOrder,
        stabMultiplier: dados.settings.battle.sameTypeAttackBonusMultiplier ?? 1.2,
        defenderTypes: chefe.types,
      })[0];
      if (!melhor) continue;
      /* Nivel 40 e 15/15/15: a lista e sobre o que EXISTE, nao sobre um bicho
         seu. 40 e o teto sem doce XL — o que se alcanca sem moer. */
      time.push({
        id: sp.id,
        name: sp.name,
        speciesId: sp.id,
        types: sp.types,
        baseStats: sp.baseStats,
        ivs: { atk: 15, def: 15, hp: 15 },
        level: 40,
        shadow: false,
        fast: melhor.fast,
        charged: melhor.charged,
      });
    }

    return rankCounters(
      time,
      chefeInput,
      dados.cpm,
      dados.typeChart,
      dados.typeOrder,
      dados.settings.battle as never,
    );
  }, [dados, chefe, tier]);

  if (!chefe || !dados) return <View className="flex-1 bg-fundo" />;

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      <View className="flex-row items-center gap-3">
        <Selo especie={chefe} tamanho={48} />
        <Text className="text-texto text-lg font-bold">{chefe.name}</Text>
      </View>

      {/* ⚠️ `raid.tier` e "Tier {n}", nao um titulo — chamar sem o `n` imprimia
          "TIER {N}" na tela. O cabecalho nomeia a escolha atual, entao ele tem
          o numero de verdade; e o "Mega" tem chave propria, porque la o numero
          nao existe. */}
      <Text className="text-texto3 text-[11px] tracking-widest mt-6 mb-2">
        {(tier === "mega" ? t("raid.tierMega") : t("raid.tier", { n: tier })).toUpperCase()}
      </Text>
      <View className="flex-row gap-2">
        {TIERS.map((tr) => (
          <TouchableOpacity
            key={String(tr)}
            onPress={() => setTier(tr)}
            className={`flex-1 rounded-2xl py-3 items-center ${
              tr === tier ? "bg-texto" : "bg-superficie"
            }`}
          >
            <Text className={tr === tier ? "text-fundo font-bold" : "text-texto2"}>
              {tr === "mega" ? t("raid.tierMega") : String(tr)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="text-texto3 text-[11px] tracking-widest mt-7 mb-2">
        {t("raid.recommended").toUpperCase()}
      </Text>
      <View className="bg-superficie rounded-3xl overflow-hidden">
        {recomendados.slice(0, 8).map((c, i) => {
          const sp = dados.species.find((s) => s.id === c.speciesId) as Especie | undefined;
          return (
            <View
              key={c.id}
              className="flex-row items-center gap-3 px-4 py-3"
              style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : undefined}
            >
              <Text className="text-texto3 text-xs w-4">{i + 1}</Text>
              {sp && <Selo especie={sp} tamanho={36} />}
              <View className="flex-1">
                <Text className="text-texto text-sm font-semibold" numberOfLines={1}>
                  {c.name}
                </Text>
                <Text className="text-texto3 text-[11px]" numberOfLines={1}>
                  {c.fast.name} + {c.charged.name}
                </Text>
              </View>
              <Text className="text-texto text-sm font-semibold">
                {Math.round(c.dps)} <Text className="text-texto3 text-[11px]">{t("raid.dps")}</Text>
              </Text>
            </View>
          );
        })}
      </View>
      <Text className="text-texto3 text-xs mt-3 leading-5">{t("raid.recommendedNote")}</Text>
      <Text className="text-texto3 text-xs mt-4 leading-5">
        {RAID_TIERS[tier].hp.toLocaleString(idioma)} PS · {RAID_TIERS[tier].seconds}s
      </Text>
    </ScrollView>
  );
}
