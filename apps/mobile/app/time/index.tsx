import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { countDistinctTypes, pickTeam, type Candidate } from "@trainerkit/core";
import { useColecao } from "../../src/colecao";
import { useDados } from "../../src/dados";
import { Segmented } from "../../src/Segmented";
import { useT } from "../../src/i18n";
import { useTema } from "../../src/tema";
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
type Objetivo = "raide" | "pvp";
type Liga = "great" | "ultra" | "master";

export default function Time() {
  const { t } = useT();
  const { cores } = useTema();
  const { dados } = useDados();
  const { itens } = useColecao();
  const [objetivo, setObjetivo] = useState<Objetivo>("raide");
  const [liga, setLiga] = useState<Liga>("great");

  /* O que ele JÁ TEM, para o time dizer o que falta caçar. Sem isso a tela
     recomenda seis bichos sem dizer quais já estão na mochila. */
  const meus = useMemo(
    () => new Set((itens ?? []).map((g) => g.speciesId)),
    [itens],
  );

  const time = useMemo(() => {
    if (!dados?.rankings) return [];
    /* A LISTA MUDA COM O OBJETIVO. Antes era sempre o ranking de raide, então
       escolher "PvP" não teria efeito nenhum — pior que não ter a opção. */
    const lista =
      objetivo === "raide"
        ? dados.rankings.raidOverall
        : (dados.rankings.statProductByLeague[liga] ?? []);
    const cands: Candidate[] = [];
    for (const [i, r] of lista.entries()) {
      const sp = dados.species.find((s) => s.id === r.speciesId);
      if (!sp) continue;
      cands.push({
        speciesId: sp.id,
        name: sp.name,
        score: lista.length - i,
        types: sp.types,
      });
    }
    return pickTeam(cands, 6);
  }, [dados, objetivo, liga]);

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      <Text className="text-texto3 text-legenda mb-2">{t("team.goal").toUpperCase()}</Text>
      <Segmented
        rotuloAcessivel={t("team.goal")}
        valor={objetivo}
        opcoes={[
          { valor: "raide", rotulo: t("team.goal.raid") },
          { valor: "pvp", rotulo: t("team.goal.pvp") },
        ]}
        onEscolher={(v) => setObjetivo(v as Objetivo)}
      />

      {objetivo === "pvp" && (
        <View className="mt-3">
          <Text className="text-texto3 text-legenda mb-2">{t("team.league").toUpperCase()}</Text>
          <Segmented
            rotuloAcessivel={t("team.league")}
            valor={liga}
            opcoes={(["great", "ultra", "master"] as const).map((l) => ({
              valor: l,
              rotulo: t(`rank.league.${l}` as never),
            }))}
            onEscolher={(v) => setLiga(v as Liga)}
          />
        </View>
      )}

      <Text className="text-texto3 text-legenda mt-6 mb-2">
        {t("team.theTeam").toUpperCase()}
      </Text>
      <View className="bg-superficie rounded-cartao overflow-hidden">
        {time.map((m, i) => {
          const sp = dados?.species.find((s) => s.id === m.speciesId);
          const tenho = meus.has(m.speciesId);
          return (
            <View
              key={m.speciesId}
              className="flex-row items-center gap-3 px-4 py-3"
              style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : undefined}
            >
              <Text className="text-texto3 text-xs w-4">{i + 1}</Text>
              {sp && <Selo especie={sp} tamanho={36} />}
              <View className="flex-1">
                <Text className="text-texto text-corpo font-semibold">{m.name}</Text>
                <Text className="text-texto3 text-legenda">
                  {m.types.map((x) => t(`type.${x}` as never)).join(" / ")}
                </Text>
              </View>
              {/* TENHO ou CAÇAR. É a diferença entre uma lista de nomes e um
                  plano: o que falta é o que a pessoa vai atrás. */}
              {itens !== null && (
                <Text
                  className="text-legenda"
                  style={{ color: tenho ? cores.investir : cores.texto3 }}
                >
                  {t(tenho ? "team.have" : "team.hunt").toUpperCase()}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <Text className="text-texto3 text-xs mt-3 leading-5">
        {/* ⚠️ A frase JA diz o numero: "{n} tipos diferentes entre os {total}".
            Concatenar a contagem na frente e chamar `t` sem os dois argumentos
            imprimia "6 · {n} tipos diferentes entre os {total}". */}
        {t("team.variety", { n: countDistinctTypes(time), total: time.length })}
      </Text>

      <Text className="text-texto3 text-legenda mt-4 leading-4">
        {t(objetivo === "raide" ? "team.howBuilt" : "team.howBuiltPvp")}
      </Text>
    </ScrollView>
  );
}
