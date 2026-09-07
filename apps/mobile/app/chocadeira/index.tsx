import { Link } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import {
  FONTE_CREDITO,
  nomesPossiveis,
  ordemDaDistancia,
  ovosUnicos,
  useOvos,
  type OvoAgenda,
} from "../../src/agenda";
import { useDados, type Especie } from "../../src/dados";
import { useT } from "../../src/i18n";
import { useTema } from "../../src/tema";
import { Selo } from "../../src/Selo";

/**
 * O que sai de cada ovo.
 *
 * ⚠️ O NUMERO QUE IMPORTA E O PC DO 100%. Ovo choca em nivel 20 com piso 10 de
 * IV, entao o PC determina o IV — e o `combatPower.max` da fonte E o PC de
 * 15/15/15. Quem esta olhando o ovo abrir ve UM numero na tela; saber de cor
 * qual e o perfeito e a diferenca entre guardar e transferir.
 */
export default function Chocadeira() {
  const { t, idioma } = useT();
  const { cores } = useTema();
  const estado = useOvos();
  const { dados } = useDados();

  const porNome = useMemo(() => {
    const m = new Map<string, Especie>();
    for (const s of dados?.species ?? []) m.set(s.name.toLowerCase(), s);
    return m;
  }, [dados]);

  const grupos = useMemo(() => {
    const m = new Map<string, OvoAgenda[]>();
    for (const o of ovosUnicos(estado.itens ?? [])) {
      const lista = m.get(o.eggType);
      if (lista) lista.push(o);
      else m.set(o.eggType, [o]);
    }
    return [...m.entries()].sort((a, b) => ordemDaDistancia(a[0]) - ordemDaDistancia(b[0]));
  }, [estado.itens]);

  const casar = (o: OvoAgenda): Especie | undefined => {
    for (const n of nomesPossiveis(o.name)) {
      const s = porNome.get(n.toLowerCase());
      if (s) return s;
    }
    return undefined;
  };

  if (estado.itens === null) {
    return (
      <View className="flex-1 bg-fundo items-center justify-center px-8">
        {estado.em === null ? (
          <ActivityIndicator color={cores.texto} />
        ) : (
          <Text className="text-texto2 text-sm text-center leading-6">{t("eggs.semRede")}</Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      {grupos.map(([distancia, ovos]) => (
        <View key={distancia} className="mt-4">
          <Text className="text-texto3 text-[11px] tracking-widest mb-2">
            {distancia}
            {ovos[0]?.isAdventureSync ? ` · ${t("eggs.sync")}` : ""}
          </Text>
          <View className="bg-superficie rounded-3xl overflow-hidden">
            {ovos.map((o, i) => {
              const sp = casar(o);
              const perfeito = o.combatPower?.max;
              const linha = (
                <View
                  className="flex-row items-center gap-3 px-4 py-3"
                  style={
                    i > 0
                      ? { borderTopWidth: 0.5, borderTopColor: cores.linha }
                      : undefined
                  }
                >
                  {sp ? (
                    <Selo especie={sp} tamanho={40} />
                  ) : (
                    <View className="w-10 h-10 rounded-xl bg-fundo" />
                  )}
                  <View className="flex-1">
                    {/* O nome do APP, traduzido — a fonte so fala ingles. */}
                    <Text className="text-texto text-sm font-semibold" numberOfLines={1}>
                      {sp?.name ?? o.name}
                    </Text>
                    {perfeito !== undefined && (
                      <Text className="text-texto3 text-[11px]">
                        {t("eggs.pcPerfeito", { cp: perfeito.toLocaleString(idioma) })}
                      </Text>
                    )}
                  </View>
                  {/* REGIONAL antes de brilhante: "não choca aqui" muda se vale
                      a pena andar atrás do ovo, e brilhante é só um bônus. Os
                      dois têm rótulo acessível — um asterisco sozinho não diz
                      nada para quem usa leitor de tela. */}
                  {o.isRegional && (
                    <Text
                      className="text-texto3 text-legenda"
                      accessibilityLabel={t("eggs.regional")}
                    >
                      {t("eggs.regional")}
                    </Text>
                  )}
                  {o.canBeShiny && (
                    <Text
                      className="text-guardar text-sm"
                      accessibilityLabel={t("eggs.shiny")}
                    >
                      ✦
                    </Text>
                  )}
                </View>
              );
              return sp ? (
                <Link
                  key={`${distancia}-${o.name}`}
                  href={{ pathname: "/especie/[id]", params: { id: sp.id } }}
                  asChild
                >
                  <Pressable>{linha}</Pressable>
                </Link>
              ) : (
                <View key={`${distancia}-${o.name}`}>{linha}</View>
              );
            })}
          </View>
        </View>
      ))}

      <Text className="text-texto3 text-xs mt-6 leading-5">
        {t("agenda.fonte", { fonte: FONTE_CREDITO })}
        {estado.em !== null &&
          ` · ${new Date(estado.em).toLocaleDateString(idioma, { day: "2-digit", month: "2-digit" })}`}
        {estado.offline ? ` · ${t("agenda.guardado")}` : ""}
      </Text>
    </ScrollView>
  );
}
