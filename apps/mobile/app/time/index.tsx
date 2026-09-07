import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  countDistinctTypes,
  pickTeam,
  rankMovesets,
  type Candidate,
  type MoveWithPvp,
} from "@trainerkit/core";
import { useColecao } from "../../src/colecao";
import { useDados, type Especie } from "../../src/dados";
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
  const [buscaChefe, setBuscaChefe] = useState("");
  const [chefe, setChefe] = useState<Especie | null>(null);

  /* O que ele JÁ TEM, para o time dizer o que falta caçar. Sem isso a tela
     recomenda seis bichos sem dizer quais já estão na mochila. */
  const meus = useMemo(
    () => new Set((itens ?? []).map((g) => g.speciesId)),
    [itens],
  );

  /* Sugestões do chefe, a partir de duas letras: com uma só a lista é o dex
     inteiro e não ajuda ninguém. */
  const sugestoes = useMemo(() => {
    const termo = buscaChefe.trim().toLowerCase();
    if (!dados || termo.length < 2) return [];
    return dados.canonicas.filter((s) => s.name.toLowerCase().includes(termo)).slice(0, 6);
  }, [dados, buscaChefe]);

  const time = useMemo(() => {
    if (!dados?.rankings) return [];
    /* A LISTA MUDA COM O OBJETIVO. Antes era sempre o ranking de raide, então
       escolher "PvP" não teria efeito nenhum — pior que não ter a opção. */
    /*
     * COM CHEFE ESCOLHIDO, a lista vira a dos counters do TIPO dele — que é o
     * que faz "monta um time" responder a raide de hoje em vez de devolver
     * sempre os mesmos seis melhores do jogo.
     */
    const porTipo = chefe
      ? chefe.types.flatMap((tp) => dados.rankings?.raidByType[tp] ?? [])
      : null;
    const lista =
      objetivo === "raide"
        ? (porTipo && porTipo.length > 0 ? porTipo : dados.rankings.raidOverall)
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
  }, [dados, objetivo, liga, chefe]);

  /* O melhor conjunto de cada um do time, no contexto escolhido. */
  const golpes = useMemo(() => {
    const m: Record<string, string> = {};
    if (!dados) return m;
    const porId = new Map<string, MoveWithPvp>();
    for (const g of [...dados.fastMoves, ...dados.chargedMoves]) porId.set(g.id, g as MoveWithPvp);
    for (const membro of time) {
      const sp = dados.species.find((s) => s.id === membro.speciesId);
      if (!sp) continue;
      /* ⚠️ Os ELITE entram marcados, e não misturados: é a marca `elite` que
         faz o `needsElite` sair certo do core, e sem ela o time recomendaria
         golpe de TM Elite sem avisar. */
      const juntar = (ids: readonly string[], elite: readonly string[]): MoveWithPvp[] =>
        [
          ...ids.map((i) => porId.get(i)),
          ...elite.map((i) => {
            const m = porId.get(i);
            return m ? { ...m, elite: true } : undefined;
          }),
        ].filter((x): x is MoveWithPvp => x !== undefined);

      const melhor = rankMovesets(
        juntar(sp.fastMoves, sp.eliteFastMoves),
        juntar(sp.chargedMoves, sp.eliteChargedMoves),
        objetivo === "raide" ? "raid" : "pvp",
        {
          attackerTypes: sp.types,
          chart: dados.typeChart,
          order: dados.typeOrder,
          stabMultiplier: 1.2,
        },
      )[0];
      if (!melhor) continue;
      m[sp.id] = `${melhor.fast.name} + ${melhor.charged.name}${melhor.needsElite ? " ✦" : ""}`;
    }
    return m;
  }, [dados, time, objetivo]);

  const temElite = Object.values(golpes).some((g) => g.endsWith("✦"));

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

      {objetivo === "raide" && (
        <View className="mt-3">
          <Text className="text-texto3 text-legenda mb-2">{t("team.bossName").toUpperCase()}</Text>
          {chefe ? (
            <View className="bg-superficie rounded-cartao px-4 py-3 flex-row items-center gap-3">
              <Selo especie={chefe} tamanho={32} />
              <View className="flex-1">
                <Text className="text-texto text-corpo font-semibold">{chefe.name}</Text>
                <Text className="text-texto3 text-legenda">
                  {chefe.types.map((x) => t(`type.${x}` as never)).join(" / ")}
                </Text>
              </View>
              <Pressable onPress={() => setChefe(null)} hitSlop={8}>
                <Text className="text-texto2 text-legenda">{t("team.dontKnow")}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                value={buscaChefe}
                onChangeText={setBuscaChefe}
                placeholder={t("team.bossPlaceholder")}
                placeholderTextColor={cores.texto3}
                className="bg-superficie rounded-pilula px-5 py-3 text-corpo"
                style={{ color: cores.texto }}
              />
              {sugestoes.length > 0 && (
                <View className="bg-superficie rounded-cartao mt-2 overflow-hidden">
                  {sugestoes.map((sp, i) => (
                    <Pressable
                      key={sp.id}
                      onPress={() => {
                        setChefe(sp);
                        setBuscaChefe("");
                      }}
                      className="flex-row items-center gap-3 px-4 py-2.5"
                      style={
                        i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : undefined
                      }
                    >
                      <Selo especie={sp} tamanho={28} />
                      <Text className="text-texto text-corpo flex-1">{sp.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Text className="text-texto3 text-legenda mt-2">{t("team.bossHint")}</Text>
            </>
          )}
        </View>
      )}

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
      {/* ⚠️ GRADE 3×2, e não lista. O print 7 mostra os seis como cartões numa
          grade: dá para ver o time INTEIRO de uma vez, que é a pergunta ("esse
          time está bom?"). Em lista, seis linhas de altura de dedo obrigam a
          rolar para ver o sexto. */}
      <View className="flex-row flex-wrap gap-2">
        {time.map((m, i) => {
          const sp = dados?.species.find((s) => s.id === m.speciesId);
          const tenho = meus.has(m.speciesId);
          return (
            <View
              key={m.speciesId}
              className="bg-superficie rounded-cartao-sm items-center px-2 py-3"
              style={{ flexBasis: "31%", flexGrow: 1 }}
            >
              {sp && <Selo especie={sp} tamanho={44} />}
              <Text
                className="text-texto text-legenda font-semibold mt-2 text-center"
                numberOfLines={1}
              >
                {m.name}
              </Text>
              {/* O GOLPE, e não só o tipo: montar o time sem saber com que
                  ataque não serve de nada, e é aqui que o ✦ avisa que aquele
                  conjunto depende de TM Elite — um dos itens mais raros do jogo. */}
              <Text
                className="text-texto3 text-center mt-0.5"
                numberOfLines={2}
                style={{ fontSize: 9, lineHeight: 12 }}
              >
                {golpes[m.speciesId] ?? m.types.map((x) => t(`type.${x}` as never)).join(" / ")}
              </Text>
              {/* TENHO ou CAÇAR. É a diferença entre uma lista de nomes e um
                  plano: o que falta é o que a pessoa vai atrás. */}
              {itens !== null && (
                <Text
                  className="mt-1"
                  style={{ fontSize: 9, color: tenho ? cores.investir : cores.texto3 }}
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

      {temElite && (
        <Text className="text-texto3 text-legenda mt-3 leading-4">{t("team.eliteNote")}</Text>
      )}

      <Text className="text-texto3 text-legenda mt-4 leading-4">
        {t(objetivo === "raide" ? "team.howBuilt" : "team.howBuiltPvp")}
      </Text>
    </ScrollView>
  );
}
