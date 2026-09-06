import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { badgeFor, ivPercentOf, ivTotalOf, solveIVs, type IVCandidate } from "@trainerkit/core";
import { guardar } from "../../src/colecao";
import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { Selo } from "../../src/Selo";

/**
 * O IV pelas tres barras da avaliacao.
 *
 * ⚠️ O `solveIVs` e o mesmo do web — forca bruta sobre os 109 niveis e as 4.096
 * combinacoes, sem aproximar nada. A tela so junta os quatro numeros que o jogo
 * mostra (PC, PS, poeira nao, as estrelas e o stat destacado) e le a resposta.
 *
 * A estrela e o stat destacado sao o que ESTREITA: com PC e PS sozinhos sobram
 * dezenas de combinacoes; com a avaliacao junto quase sempre sobra uma.
 */
const ESTRELAS = [
  { rotulo: "0–22", min: 0, max: 22 },
  { rotulo: "23–29", min: 23, max: 29 },
  { rotulo: "30–36", min: 30, max: 36 },
  { rotulo: "37–45", min: 37, max: 45 },
] as const;

const STATS = ["atk", "def", "hp"] as const;

export default function Calculadora() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dados } = useDados();
  const [cp, setCp] = useState("");
  const [hp, setHp] = useState("");
  const [faixa, setFaixa] = useState(3);
  const [melhores, setMelhores] = useState<Set<"atk" | "def" | "hp">>(new Set());

  const especie = dados?.species.find((s) => s.id === id) ?? null;

  const candidatos = useMemo<IVCandidate[]>(() => {
    if (!dados || !especie) return [];
    const nCp = Number(cp);
    const nHp = Number(hp);
    if (!Number.isInteger(nCp) || !Number.isInteger(nHp) || nCp < 10 || nHp < 1) return [];
    const f = ESTRELAS[faixa]!;
    return solveIVs(
      {
        base: especie.baseStats,
        cp: nCp,
        hp: nHp,
        appraisal: {
          totalMin: f.min,
          totalMax: f.max,
          ...(melhores.size > 0 ? { bestStats: [...melhores] } : {}),
        },
      },
      dados.cpm,
    );
  }, [dados, especie, cp, hp, faixa, melhores]);

  if (!especie) return <View className="flex-1 bg-fundo" />;

  const unico = candidatos.length === 1 ? candidatos[0]! : null;
  const selo = unico ? badgeFor(ivTotalOf(unico.ivs)) : null;

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      <View className="flex-row items-center gap-3">
        <Selo especie={especie} tamanho={48} />
        <Text className="text-texto text-lg font-bold">{especie.name}</Text>
      </View>

      <View className="flex-row gap-3 mt-5">
        <View className="flex-1">
          <Text className="text-texto3 text-[11px] tracking-widest mb-2">
            {t("iv.cp").toUpperCase()}
          </Text>
          <TextInput
            value={cp}
            onChangeText={setCp}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor="#767c8c"
            className="bg-superficie text-texto rounded-2xl px-4 py-3 text-base"
          />
        </View>
        <View className="flex-1">
          <Text className="text-texto3 text-[11px] tracking-widest mb-2">
            {t("iv.hp").toUpperCase()}
          </Text>
          <TextInput
            value={hp}
            onChangeText={setHp}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor="#767c8c"
            className="bg-superficie text-texto rounded-2xl px-4 py-3 text-base"
          />
        </View>
      </View>

      {/* As estrelas da avaliacao: e o que corta o espaco de busca de milhares
          pra dezenas, e sem elas o PC sozinho quase nunca decide. */}
      <Text className="text-texto3 text-[11px] tracking-widest mt-6 mb-2">
        {t("iv.appraisalTitle").toUpperCase()}
      </Text>
      <View className="flex-row gap-2">
        {ESTRELAS.map((f, i) => (
          <TouchableOpacity
            key={f.rotulo}
            onPress={() => setFaixa(i)}
            className={`flex-1 rounded-2xl py-3 items-center ${
              i === faixa ? "bg-texto" : "bg-superficie"
            }`}
          >
            <Text className={i === faixa ? "text-fundo font-bold" : "text-texto2"}>
              {f.rotulo}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="text-texto3 text-[11px] tracking-widest mt-6 mb-2">
        {t("iv.bestStats").toUpperCase()}
      </Text>
      <View className="flex-row gap-2">
        {STATS.map((st) => {
          const on = melhores.has(st);
          return (
            <TouchableOpacity
              key={st}
              onPress={() =>
                setMelhores((antes) => {
                  const novo = new Set(antes);
                  if (novo.has(st)) novo.delete(st);
                  else novo.add(st);
                  return novo;
                })
              }
              className={`flex-1 rounded-2xl py-3 items-center ${on ? "bg-texto" : "bg-superficie"}`}
            >
              <Text className={on ? "text-fundo font-bold" : "text-texto2"}>
                {t(st === "atk" ? "common.attack" : st === "def" ? "common.defense" : "common.stamina")}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="bg-superficie rounded-3xl p-5 mt-7">
        {unico ? (
          <>
            <Text className="text-texto3 text-[11px] tracking-widest">IV</Text>
            <Text className="text-texto text-4xl font-extrabold mt-1">
              {ivTotalOf(unico.ivs)}
              <Text className="text-texto3 text-lg"> / 45</Text>
            </Text>
            <Text className="text-texto2 text-sm mt-1">
              {Math.round(ivPercentOf(unico.ivs))}% · {"★".repeat(selo?.litStars ?? 0)}
              {"☆".repeat(3 - (selo?.litStars ?? 0))}
            </Text>
            <Text className="text-texto2 text-sm mt-3">
              {unico.ivs.atk} / {unico.ivs.def} / {unico.ivs.hp} · {t("iv.level")} {unico.level}
            </Text>

            {/* Guardar so aparece quando a conta FECHOU numa combinacao. Salvar
                uma faixa seria guardar uma duvida, e a colecao existe pra
                responder depois — nao pra repetir a pergunta. */}
            <TouchableOpacity
              onPress={() => {
                void guardar({
                  speciesId: especie.id,
                  ivs: unico.ivs,
                  level: unico.level,
                  shadow: false,
                  lucky: false,
                }).then(() => Alert.alert(t("iv.savedToCollection")));
              }}
              className="bg-texto rounded-full py-4 items-center mt-5"
            >
              <Text className="text-fundo font-bold">{t("iv.saveToCollection")}</Text>
            </TouchableOpacity>
          </>
        ) : candidatos.length === 0 ? (
          <Text className="text-texto2 text-sm">{t("iv.noMatch")}</Text>
        ) : (
          <>
            <Text className="text-texto3 text-[11px] tracking-widest">IV</Text>
            <Text className="text-texto text-2xl font-extrabold mt-1">
              {Math.min(...candidatos.map((c) => ivTotalOf(c.ivs)))}–
              {Math.max(...candidatos.map((c) => ivTotalOf(c.ivs)))}
              <Text className="text-texto3 text-base"> / 45</Text>
            </Text>
            <Text className="text-texto2 text-sm mt-2">
              {t("iv.candidates", { n: candidatos.length })}
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}
