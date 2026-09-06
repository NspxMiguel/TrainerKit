import { Link, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ACTION_KEYS, decide, tetoDePowerUp } from "@trainerkit/core";
import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { useSetup } from "../../src/setup";
import { useTema, type Paleta } from "../../src/tema";
import { Selo } from "../../src/Selo";

/**
 * A ficha da especie — e a PROVA de que o port funciona.
 *
 * ⚠️ O `decide` daqui e o MESMO arquivo que o app web usa: `packages/core`, sem
 * uma linha alterada, sem DOM. Se o veredito sair certo nesta tela, os 5.821
 * linhas de logica portaram — que era a aposta inteira de escolher React Native
 * em vez de Swift.
 */
/* O veredito e a unica cor com significado nesta tela, e por isso ela troca
   com o tema: `#3ddc97` da 10,5:1 sobre o cartao preto e 1,8:1 sobre o branco.
   O nome da acao e que e estavel — o tom, nao. */
const COR_ACAO: Record<string, keyof Paleta> = {
  investir: "investir",
  evoluir: "evoluir",
  guardar: "guardar",
  transferir: "transferir",
  descobrir: "descobrir",
};

export default function Ficha() {
  const { t } = useT();
  const { cores } = useTema();
  const { setup } = useSetup();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pronto, dados } = useDados();

  const especie = useMemo(() => dados?.species.find((s) => s.id === id) ?? null, [dados, id]);

  const veredito = useMemo(() => {
    if (!dados || !especie) return null;
    /*
     * 15/15/15 no nivel 20: a ficha e sobre a ESPECIE, nao sobre um bicho seu.
     * Quando a colecao existir, ela passa os valores reais.
     */
    return decide({
      name: especie.name,
      baseStats: especie.baseStats,
      ivs: { atk: 15, def: 15, hp: 15 },
      level: 20,
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
      evolvesInto: [],
    });
  }, [dados, especie]);

  if (!pronto) {
    return (
      <View className="flex-1 items-center justify-center bg-fundo">
        <ActivityIndicator color={cores.texto} />
      </View>
    );
  }

  if (!especie) {
    return (
      <View className="flex-1 items-center justify-center bg-fundo">
        <Text className="text-texto">{t("especies.noResults", { query: String(id) })}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      <View className="items-center">
        <Selo especie={especie} tamanho={112} />
        <Text className="text-texto text-2xl font-extrabold mt-4">{especie.name}</Text>
        <Text className="text-texto3 text-xs mt-1">
          {/* Os tipos TRADUZIDOS: o dicionario tem `type.grass` etc. Mostrar
              "grass / poison" seria o app falando o idioma do arquivo de dados
              em vez do idioma da pessoa. */}
          #{String(especie.dex).padStart(3, "0")} ·{" "}
          {especie.types.map((tp) => t(`type.${tp}` as never)).join(" / ")}
        </Text>
      </View>

      {/* Duas acoes: o IV do que ele TEM, e o IV do que ele esta VENDO. */}
      <Link href={{ pathname: "/iv/[id]", params: { id: especie.id } }} asChild>
        <Pressable className="bg-texto rounded-full py-4 items-center mt-7">
          <Text className="text-fundo font-bold text-base">{t("species.calcIV")}</Text>
        </Pressable>
      </Link>

      <Link href={{ pathname: "/encontro/[id]", params: { id: especie.id } }} asChild>
        <Pressable className="bg-superficie rounded-full py-4 items-center mt-3">
          <Text className="text-texto font-bold text-base">{t("pre.open")}</Text>
        </Pressable>
      </Link>

      <Link href={{ pathname: "/raide/[id]", params: { id: especie.id } }} asChild>
        <Pressable className="bg-superficie rounded-full py-4 items-center mt-3">
          <Text className="text-texto font-bold text-base">{t("raid.openBrowse")}</Text>
        </Pressable>
      </Link>

      {veredito && (
        <View className="bg-superficie rounded-3xl p-5 mt-7">
          <Text className="text-texto3 text-[11px] tracking-widest">
            {t("assistant.title").toUpperCase()}
          </Text>
          <Text
            className="text-xl font-bold mt-2"
            style={{ color: cores[COR_ACAO[veredito.action] ?? "texto"] }}
          >
            {/* A PALAVRA do veredito vem do dicionario, nao do enum: o `core`
                devolve `investir`, e `ACTION_KEYS` diz qual chave le isso nos
                dez idiomas. */}
            {t(ACTION_KEYS[veredito.action] as never)}
          </Text>
          <Text className="text-texto2 text-xs mt-2">
            {t("verdict.confidence", { percent: Math.round(veredito.confidence * 100) })}
          </Text>
        </View>
      )}

      <View className="bg-superficie rounded-3xl p-5 mt-3">
        <Text className="text-texto3 text-[11px] tracking-widest">
          {t("species.baseStats").toUpperCase()}
        </Text>
        {(
          [
            [t("common.attack"), especie.baseStats.atk],
            [t("common.defense"), especie.baseStats.def],
            [t("common.stamina"), especie.baseStats.hp],
          ] as const
        ).map(([rotulo, valor]) => (
          <View key={rotulo} className="flex-row items-center justify-between mt-3">
            <Text className="text-texto2 text-sm">{rotulo}</Text>
            <Text className="text-texto text-sm font-semibold">{valor}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
