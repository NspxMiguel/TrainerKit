import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { coinMath, pickDefenders, rankDefenders, type DefenderInput } from "@trainerkit/core";
import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { useTema } from "../../src/tema";
import { Selo } from "../../src/Selo";
import { Titulo } from "../../src/Titulo";

/**
 * Quem deixar no ginasio.
 *
 * ⚠️ A CONTA DA MOEDA VEM ANTES DA LISTA, e nao e enfeite: ela muda mais o
 * resultado do que a escolha do defensor, e quase ninguem faz. O teto e por DIA
 * e por minuto SOMADO, entao dez ginasios medianos rendem muito mais que um
 * ginasio perfeito.
 *
 * A lista NAO depende de colecao — mesmo motivo da raide: sem colecao a tela
 * cairia num vazio, e "quem aguenta mais" e uma pergunta legitima pra quem
 * ainda nao cadastrou nada.
 */
export default function Ginasio() {
  const { t } = useT();
  const { cores } = useTema();
  const { dados } = useDados();
  const [ginasios, setGinasios] = useState(3);

  const conta = coinMath(ginasios);

  const defensores = useMemo(() => {
    if (!dados) return [];
    /* Candidatos: as especies de maior "couro" (defesa + PS), que e o que
       decide quanto tempo um defensor segura. Cem, nao as 1.182 — ranquear
       todas a cada abertura seria trabalho pra nada. */
    const pool = [...dados.canonicas]
      .sort((a, b) => b.baseStats.def + b.baseStats.hp - (a.baseStats.def + a.baseStats.hp))
      .slice(0, 100);
    const entrada: DefenderInput[] = pool.map((sp) => ({
      id: sp.id,
      speciesId: sp.id,
      name: sp.name,
      types: sp.types,
      baseStats: sp.baseStats,
      ivs: { atk: 15, def: 15, hp: 15 },
      level: 40,
    }));
    return pickDefenders(rankDefenders(entrada, dados.cpm, dados.typeChart, dados.typeOrder), 6);
  }, [dados]);

  return (
    <ScrollView
      className="flex-1 bg-fundo"
      contentContainerStyle={{ padding: 20 }}
      /* Sem isto o titulo grande do header nao reserva espaco e o
         conteudo nasce por baixo dele. */
      contentInsetAdjustmentBehavior="automatic"
    >
      <Titulo>{t("gym.title")}</Titulo>
      <Text className="text-texto3 text-[11px] tracking-widest mb-2">
        {t("gym.howMany").toUpperCase()}
      </Text>
      <View className="flex-row items-center gap-4 bg-superficie rounded-3xl p-4">
        <TouchableOpacity
          onPress={() => setGinasios((n) => Math.max(1, n - 1))}
          className="w-11 h-11 rounded-full bg-fundo items-center justify-center"
        >
          <Text className="text-texto text-xl">−</Text>
        </TouchableOpacity>
        <Text className="text-texto text-2xl font-extrabold flex-1 text-center">{ginasios}</Text>
        <TouchableOpacity
          onPress={() => setGinasios((n) => Math.min(20, n + 1))}
          className="w-11 h-11 rounded-full bg-fundo items-center justify-center"
        >
          <Text className="text-texto text-xl">+</Text>
        </TouchableOpacity>
      </View>
      <Text className="text-texto2 text-sm mt-3 leading-6">
        {`${Math.round(conta.minutesForCap)} min · ${conta.coinsPerHour.toFixed(1)} 🪙/h`}
      </Text>

      <Text className="text-texto3 text-[11px] tracking-widest mt-7 mb-2">
        {t("gym.title").toUpperCase()}
      </Text>
      <View className="bg-superficie rounded-3xl overflow-hidden">
        {defensores.map((d, i) => {
          const sp = dados?.species.find((s) => s.id === d.speciesId);
          return (
            <View
              key={d.id}
              className="flex-row items-center gap-3 px-4 py-3"
              style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : undefined}
            >
              <Text className="text-texto3 text-xs w-4">{i + 1}</Text>
              {sp && <Selo especie={sp} tamanho={36} />}
              <View className="flex-1">
                <Text className="text-texto text-corpo font-semibold">{d.name}</Text>
                {/* A FRAQUEZA NOMEADA, porque é ela que decide quem te derruba.
                    "Fraco a Lutador" é acionável; uma nota de 0 a 100 sozinha
                    não é — e era só isso que a linha mostrava. */}
                <Text className="text-texto3 text-legenda" numberOfLines={1}>
                  {d.weakTo.length === 0
                    ? t("gym.noWeak")
                    : t("gym.weakTo", {
                        types: d.weakTo.map((x) => t(`type.${x}` as never)).join(", "),
                      })}
                </Text>
              </View>
              <Text className="text-texto3 text-[11px]">{Math.round(d.bulk)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
