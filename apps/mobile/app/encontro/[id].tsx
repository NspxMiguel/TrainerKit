import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import {
  ORIGENS,
  badgeFor,
  climaImporta,
  faixaDePC,
  ivPercentOf,
  ivTotalOf,
  lerEncontro,
  niveisDaOrigem,
  type OrigemDeEncontro,
} from "@trainerkit/core";
import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { useTema } from "../../src/tema";
import { Selo } from "../../src/Selo";

/**
 * O IV ANTES de capturar, pelo PC.
 *
 * ⚠️ A tela so responde quando a conta responde, e essa e a regra que sustenta
 * o app. Em raide, ovo e pesquisa o jogo FIXA o nivel, entao o PC determina o
 * IV e a resposta e exata. No selvagem o nivel e sorteado e sobram ~167
 * combinacoes: ali a tela diz que nao decide, com o numero na mao, em vez de
 * mostrar uma faixa com cara de medicao.
 */
export default function Encontro() {
  const { t, idioma } = useT();
  const { cores } = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dados } = useDados();
  const [origem, setOrigem] = useState<OrigemDeEncontro>("raide");
  const [clima, setClima] = useState(false);
  const [cp, setCp] = useState("");

  const especie = dados?.species.find((s) => s.id === id) ?? null;
  const climaVale = climaImporta(origem);
  const climaAtivo = clima && climaVale;

  const faixa = useMemo(
    () => (dados && especie ? faixaDePC(especie.baseStats, origem, dados.cpm, climaAtivo) : null),
    [dados, especie, origem, climaAtivo],
  );

  const nCp = Number(cp);
  const temCp = cp !== "" && Number.isInteger(nCp) && nCp >= 10;

  const leitura = useMemo(() => {
    if (!dados || !especie || !temCp) return null;
    return lerEncontro(
      { base: especie.baseStats, cp: nCp, origem, clima: climaAtivo },
      dados.cpm,
    );
  }, [dados, especie, temCp, nCp, origem, climaAtivo]);

  if (!especie || !faixa) return <View className="flex-1 bg-fundo" />;

  const niveis = niveisDaOrigem(origem, climaAtivo);
  const nivelTexto =
    niveis.length === 1 ? String(niveis[0]) : `${niveis[0]}–${niveis[niveis.length - 1]}`;
  const exato = leitura?.exato ?? null;
  const selo = exato ? badgeFor(ivTotalOf(exato)) : null;

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      <View className="flex-row items-center gap-3">
        <Selo especie={especie} tamanho={48} />
        <Text className="text-texto text-lg font-bold">{especie.name}</Text>
      </View>

      <Text className="text-texto2 text-sm leading-6 mt-4">{t("pre.why")}</Text>

      {/* A ORIGEM vem antes do PC de proposito: e ela, e nao o PC, que faz a
          conta existir. Pedir o numero primeiro sugeriria que o PC basta. */}
      <Text className="text-texto3 text-[11px] tracking-widest mt-6 mb-2">
        {t("pre.origin").toUpperCase()}
      </Text>
      <View className="flex-row gap-2">
        {ORIGENS.map((o) => (
          <TouchableOpacity
            key={o}
            onPress={() => setOrigem(o)}
            className={`flex-1 rounded-2xl py-3 items-center ${
              o === origem ? "bg-texto" : "bg-superficie"
            }`}
          >
            <Text
              className={`text-xs ${o === origem ? "text-fundo font-bold" : "text-texto2"}`}
              numberOfLines={1}
            >
              {t(`pre.origin.${o}` as never)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* O controle de clima SOME onde ele nao muda nada: um interruptor sem
          efeito nao e so inutil, ensina errado sobre a mecanica do jogo. */}
      {climaVale && (
        <TouchableOpacity
          onPress={() => setClima((v) => !v)}
          className={`rounded-2xl p-4 mt-3 ${clima ? "bg-texto" : "bg-superficie"}`}
        >
          <Text className={clima ? "text-fundo font-bold" : "text-texto2"}>
            {t("pre.weather")}
          </Text>
          <Text className={`text-xs mt-1 ${clima ? "text-fundo" : "text-texto3"}`}>
            {t("pre.weatherDetail")}
          </Text>
        </TouchableOpacity>
      )}

      <Text className="text-texto3 text-[11px] tracking-widest mt-6 mb-2">
        {t("pre.cp").toUpperCase()}
      </Text>
      <TextInput
        value={cp}
        onChangeText={setCp}
        keyboardType="number-pad"
        placeholder={String(faixa.max)}
        placeholderTextColor={cores.texto3}
        className="bg-superficie text-texto rounded-2xl px-4 py-3 text-base"
      />

      {/* A faixa aparece ANTES de digitar: e a metade da resposta que nao
          depende do PC. Quem ve "2.294 a 2.387" ja sabe que 2.387 e o 100%. */}
      <View className="bg-superficie rounded-3xl p-5 mt-4">
        <View className="flex-row justify-between">
          <Text className="text-texto2 text-sm">{t("pre.rangeLabel")}</Text>
          <Text className="text-texto text-sm font-semibold">
            {faixa.min.toLocaleString(idioma)} – {faixa.max.toLocaleString(idioma)}
          </Text>
        </View>
        <View className="flex-row justify-between mt-2">
          <Text className="text-texto2 text-sm">{t("pre.levelLabel")}</Text>
          <Text className="text-texto text-sm font-semibold">
            {nivelTexto}
            {leitura ? ` · IV ≥ ${leitura.piso}` : ""}
          </Text>
        </View>
      </View>

      {leitura?.impossivel && (
        <View className="bg-superficie rounded-3xl p-5 mt-3 border-l-4 border-guardar">
          <Text className="text-texto font-bold">{t("pre.impossible.title")}</Text>
          <Text className="text-texto2 text-sm mt-2 leading-5">
            {t("pre.impossible.body", {
              cp: nCp.toLocaleString(idioma),
              name: especie.name,
              min: faixa.min.toLocaleString(idioma),
              max: faixa.max.toLocaleString(idioma),
            })}
          </Text>
        </View>
      )}

      {leitura && !leitura.impossivel && (
        <View className="bg-superficie rounded-3xl p-5 mt-3">
          <Text className="text-texto3 text-[11px] tracking-widest">IV</Text>
          {exato && selo ? (
            <>
              <Text className="text-texto text-4xl font-extrabold mt-1">
                {ivTotalOf(exato)}
                <Text className="text-texto3 text-lg"> / 45</Text>
              </Text>
              <Text className="text-texto2 text-sm mt-1">
                {Math.round(ivPercentOf(exato))}% · {"★".repeat(selo.litStars)}
                {"☆".repeat(3 - selo.litStars)}
              </Text>
              <Text className="text-texto2 text-sm mt-3">
                {t("pre.exact", { atk: exato.atk, def: exato.def, hp: exato.hp })}
              </Text>
            </>
          ) : (
            <>
              <Text className="text-texto text-2xl font-extrabold mt-1">
                {leitura.totalMin}–{leitura.totalMax}
                <Text className="text-texto3 text-base"> / 45</Text>
              </Text>
              <Text className="text-texto2 text-sm mt-2 leading-5">
                {t("pre.combos", { n: leitura.ivs.length.toLocaleString(idioma) })}
                {origem === "selvagem" ? ` ${t("pre.wildWeak")}` : ""}
              </Text>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}
