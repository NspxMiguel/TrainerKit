import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";

import {
  FONTE_CREDITO,
  emCartaz,
  rolandoAgora,
  semEntidades,
  useEventos,
  type EventoAgenda,
} from "../../src/agenda";
import { pedirPermissao, limpar, reagendar } from "../../src/avisos";
import { useT } from "../../src/i18n";
import { useTema } from "../../src/tema";
import { Vidro } from "../../src/Vidro";
import { acompanharEventoAtual, pararAtividade, suportaAtividade } from "../../src/atividade";
import { Titulo } from "../../src/Titulo";

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
  const { cores } = useTema();
  const estado = useEventos();
  /* `null` = desligado. Um número = quantos alarmes o iOS aceitou registrar. */
  const [avisos, setAvisos] = useState<number | null>(null);
  const [negado, setNegado] = useState(false);
  const [atividade, setAtividade] = useState<string | null>(null);

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
      if (rolandoAgora(e, agora)) {
        agoraL.push(e);
        continue;
      }
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
          <ActivityIndicator color={cores.texto} />
        ) : (
          <Text className="text-texto2 text-sm text-center leading-6">{t("agenda.semRede")}</Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-fundo"
      contentContainerStyle={{ padding: 20 }}
      /* Sem isto o titulo grande do header nao reserva espaco e o
         conteudo nasce por baixo dele. */
      contentInsetAdjustmentBehavior="automatic"
    >
      <Titulo>{t("agenda.title")}</Titulo>
      {/*
        ME AVISA — notificação LOCAL, não push.

        ⚠️ Não há servidor, não há token de aparelho e não há conta: o app agenda
        no próprio iOS um alarme para uma data que ele já conhece, porque a lista
        de eventos já está baixada. Push exigiria um servidor guardando o token
        de cada pessoa, que é exatamente o que a tela de Privacidade afirma que
        não existe — e a afirmação vale mais que a notificação.

        A permissão só é pedida QUANDO A PESSOA LIGA. O iOS só pergunta uma vez;
        pedir na abertura, antes de ela saber o que o app faz, é como se ganha um
        "não" definitivo.
      */}
      <Pressable
        onPress={() => {
          if (avisos !== null) {
            void limpar().then(() => setAvisos(null));
            return;
          }
          void pedirPermissao().then((ok) => {
            if (!ok) {
              setNegado(true);
              return;
            }
            setNegado(false);
            void reagendar(estado.itens ?? []).then(setAvisos);
          });
        }}
        className="rounded-full py-3 items-center mb-4"
        style={{ borderWidth: 1, borderColor: avisos !== null ? cores.texto : cores.linha }}
      >
        <Text className="text-texto text-[13px] font-semibold">
          {avisos === null
            ? `${t("alerts.title")} · ${t("alerts.off")}`
            : t("alerts.on", { n: avisos })}
        </Text>
      </Pressable>
      {negado && (
        <Text className="text-texto3 text-[12px] leading-4 mb-4">{t("alerts.denied")}</Text>
      )}

      {/*
        A LIVE ACTIVITY não é o mesmo que o aviso acima, e por isso é outro
        botão: o aviso diz que um evento VAI começar; a atividade fica na tela
        de bloqueio ENQUANTO ele acontece, contando quanto falta. O botão só
        aparece onde a ponte nativa existe — em simulador sem a extensão
        compilada, ou em Android, ele simplesmente não está lá.
      */}
      {suportaAtividade() && (
        <Pressable
          onPress={() => {
            if (atividade) {
              void pararAtividade().then(() => setAtividade(null));
              return;
            }
            void acompanharEventoAtual(estado.itens ?? [], cores.texto).then((e) =>
              setAtividade(e ? semEntidades(e.name) : null),
            );
          }}
          className="rounded-full py-3 items-center mb-4"
          style={{ borderWidth: 1, borderColor: atividade ? cores.texto : cores.linha }}
        >
          <Text className="text-texto text-[13px] font-semibold" numberOfLines={1}>
            {atividade
              ? t("liveActivity.on", { nome: atividade })
              : `${t("liveActivity.title")} · ${t("alerts.off")}`}
          </Text>
        </Pressable>
      )}

      {grupos.map((g) => (
        <View key={g.chave} className="mt-4">
          <Text className="text-texto3 text-[11px] tracking-widest mb-2">
            {g.titulo.toUpperCase()}
          </Text>
          {/*
            VIDRO SÓ NO QUE ESTÁ ROLANDO AGORA.

            ⚠️ Vidro em toda lista de evento viraria sopa — ele marca o que
            flutua, e "flutuar" aqui é o que está acontecendo enquanto a pessoa
            olha. Os grupos "depois" e "acabou" continuam em superfície sólida:
            se tudo brilha, nada brilha, e a pessoa perde justamente a linha que
            importa.
          */}
          <Vidro
            raio={26}
            interativo={g.chave === "agora"}
            ativo={g.chave === "agora"}
            {...(g.chave === "agora"
              ? {}
              : {
                  style: {
                    backgroundColor: cores.superficie,
                    borderRadius: 26,
                    overflow: "hidden" as const,
                  },
                })}
          >
            {g.itens.map((e, i) => (
              <Pressable
                key={e.eventID}
                onPress={() => void Linking.openURL(e.link)}
                className="px-4 py-3 flex-row items-center gap-3"
                style={{
                  ...(i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : {}),
                  ...(g.chave === "agora"
                    ? { borderLeftWidth: 3, borderLeftColor: cores.texto }
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
          </Vidro>
        </View>
      ))}
      <Text className="text-texto3 text-xs mt-6 leading-5">
        {t("agenda.fonte", { fonte: FONTE_CREDITO })}
      </Text>
    </ScrollView>
  );
}
