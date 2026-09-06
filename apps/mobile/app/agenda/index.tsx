import { useMemo } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";

import {
  FONTE_CREDITO,
  emCartaz,
  rolandoAgora,
  semEntidades,
  useEventos,
  type EventoAgenda,
} from "../../src/agenda";
import { useT } from "../../src/i18n";

/**
 * O que esta acontecendo.
 *
 * ⚠️ E A UNICA TELA QUE NAO RESPONDE SOBRE UM BICHO — e por isso ela existe: o
 * resto do app responde "o que faco com este aqui", e ninguem respondia "o que
 * ta rolando esta semana", que e a pergunta mais frequente.
 *
 * Agrupado por QUANDO e nao por tipo, porque a pergunta e temporal. E dentro do
 * "agora" a ordem e pelo que ACABA antes: uma temporada de dois meses nao e tao
 * urgente quanto uma hora de raide.
 */
export default function Agenda() {
  const { t, idioma } = useT();
  const estado = useEventos();

  const grupos = useMemo(() => {
    const agora = Date.now();
    const lista = emCartaz(estado.itens ?? [], agora);
    const fimDeHoje = new Date();
    fimDeHoje.setHours(23, 59, 59, 999);
    const fimDaSemana = new Date(fimDeHoje);
    fimDaSemana.setDate(fimDaSemana.getDate() + 7);

    const agoraL: EventoAgenda[] = [];
    const hoje: EventoAgenda[] = [];
    const semana: EventoAgenda[] = [];
    const depois: EventoAgenda[] = [];
    for (const e of lista) {
      if (rolandoAgora(e, agora)) { agoraL.push(e); continue; }
      const inicio = e.start ? Date.parse(e.start) : NaN;
      if (Number.isNaN(inicio)) depois.push(e);
      else if (inicio <= fimDeHoje.getTime()) hoje.push(e);
      else if (inicio <= fimDaSemana.getTime()) semana.push(e);
      else depois.push(e);
    }
    agoraL.sort((a, b) => {
      const fa = a.end ? Date.parse(a.end) : Infinity;
      const fb = b.end ? Date.parse(b.end) : Infinity;
      return (Number.isNaN(fa) ? Infinity : fa) - (Number.isNaN(fb) ? Infinity : fb);
    });
    return [
      { chave: "agora", titulo: t("agenda.agora"), itens: agoraL },
      { chave: "hoje", titulo: t("agenda.hoje"), itens: hoje },
      { chave: "semana", titulo: t("agenda.semana"), itens: semana },
      { chave: "depois", titulo: t("agenda.depois"), itens: depois },
    ].filter((g) => g.itens.length > 0);
  }, [estado.itens, t]);

  const quando = (e: EventoAgenda): string => {
    if (!e.start) return "";
    const i = new Date(e.start);
    if (Number.isNaN(i.getTime())) return "";
    return `${i.toLocaleDateString(idioma, { day: "2-digit", month: "short" })} · ${i.toLocaleTimeString(idioma, { hour: "2-digit", minute: "2-digit" })}`;
  };

  const ate = (e: EventoAgenda): string => {
    if (!e.end) return t("agenda.agoraCurto");
    const f = new Date(e.end);
    if (Number.isNaN(f.getTime())) return t("agenda.agoraCurto");
    const hoje = new Date();
    const mesmoDia =
      f.getFullYear() === hoje.getFullYear() &&
      f.getMonth() === hoje.getMonth() &&
      f.getDate() === hoje.getDate();
    return t("agenda.ate", {
      quando: mesmoDia
        ? f.toLocaleTimeString(idioma, { hour: "2-digit", minute: "2-digit" })
        : f.toLocaleDateString(idioma, { day: "2-digit", month: "short" }),
    });
  };

  if (estado.itens === null) {
    return (
      <View className="flex-1 bg-fundo items-center justify-center px-8">
        {estado.em === null ? (
          <ActivityIndicator color="#f4f6fa" />
        ) : (
          <Text className="text-texto2 text-sm text-center leading-6">{t("agenda.semRede")}</Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      {grupos.map((g) => (
        <View key={g.chave} className="mt-4">
          <Text className="text-texto3 text-[11px] tracking-widest mb-2">
            {g.titulo.toUpperCase()}
          </Text>
          <View className="bg-superficie rounded-3xl overflow-hidden">
            {g.itens.map((e, i) => (
              <Pressable
                key={e.eventID}
                onPress={() => void Linking.openURL(e.link)}
                className="px-4 py-3 flex-row items-center gap-3"
                style={{
                  ...(i > 0
                    ? { borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.08)" }
                    : {}),
                  ...(g.chave === "agora"
                    ? { borderLeftWidth: 3, borderLeftColor: "#f4f6fa" }
                    : {}),
                }}
              >
                <View className="flex-1">
                  <Text className="text-texto3 text-[10px] tracking-wider" numberOfLines={1}>
                    {semEntidades(e.heading).toUpperCase()}
                  </Text>
                  <Text className="text-texto text-sm font-semibold" numberOfLines={1}>
                    {semEntidades(e.name)}
                  </Text>
                </View>
                <Text className="text-texto2 text-[11px]">
                  {g.chave === "agora" ? ate(e) : quando(e)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <Text className="text-texto3 text-xs mt-6 leading-5">
        {t("agenda.fonte", { fonte: FONTE_CREDITO })}
      </Text>
    </ScrollView>
  );
}
