import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { buildDexEntry, tetoDePowerUp, type Key } from "@trainerkit/core";
import { useColecao } from "../../src/colecao";
import { useDados, type Especie } from "../../src/dados";
import { useT } from "../../src/i18n";
import { Selo } from "../../src/Selo";
import { useSetup } from "../../src/setup";
import { Vidro } from "../../src/Vidro";
import { calar, falar } from "../../src/voz";
import { marcarVisto, useVistos } from "../../src/vistos";

/**
 * O MODO POKEDEX.
 *
 * ⚠️ Esta tela existia so no PWA (`apps/web/src/screens/DexMode.tsx`) e era o
 * maior buraco de paridade do nativo. Ela carrega o pedido dele por inteiro:
 * *"quero q pareça muito com uma pokedex, até em aparencia, em funcionalidades"*.
 *
 * O que ela faz, e o que ela NAO faz:
 *
 *   FAZ    abre a camera de verdade, deixa escolher a especie e LE a ficha em
 *          voz alta com a voz do sistema — sem chave, sem conta, sem rede.
 *   NAO    reconhece a especie pela imagem. Isso precisa de modelo de visao, e
 *          no app a IA e a da pessoa (regra do projeto). Prometer identificacao
 *          automatica e ter um botao que nao identifica e pior que nao ter.
 *
 * A camera e FUNDO e nao conteudo: ela da o gesto de apontar, e a informacao
 * mora na folha de vidro por cima — que e exatamente o `5-modo-pokedex.png` do
 * desenho.
 */
const LIGAS = ["great", "ultra", "master"] as const;

const ARQUETIPO: Record<string, Key> = {
  monster: "dex.build.monster",
  glassCannon: "dex.build.glassCannon",
  wall: "dex.build.wall",
  balanced: "dex.build.balanced",
  frail: "dex.build.frail",
};

export default function ModoPokedex() {
  const { t, idioma } = useT();
  const { dados } = useDados();
  const { setup } = useSetup();
  const { itens } = useColecao();
  const { total: vistos } = useVistos();
  const router = useRouter();
  const { top: alto, bottom: baixo } = useSafeAreaInsets();

  const [permissao, pedirPermissao] = useCameraPermissions();
  const [busca, setBusca] = useState("");
  const [escolhida, setEscolhida] = useState<Especie | null>(null);
  const [lendo, setLendo] = useState(false);

  /* A camera so liga depois de a pessoa entrar na tela: pedir permissao na
     abertura do app assustaria sem explicar pra que serve. */
  useEffect(() => {
    if (permissao && !permissao.granted && permissao.canAskAgain) void pedirPermissao();
  }, [permissao, pedirPermissao]);

  useEffect(() => () => calar(), []);

  const achados = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    return dados.canonicas.filter((s) => s.name.toLowerCase().includes(termo)).slice(0, 12);
  }, [dados, busca]);

  /* As mesmas tres frases da lente da ficha, e pela mesma funcao do core — duas
     copias de `buildDexEntry` seria a primeira correcao valendo num app so. */
  const ficha = useMemo(() => {
    if (!dados || !escolhida) return null;
    const tipoPrimario = escolhida.types[0] ?? "normal";
    const posRaide = (dados.rankings?.raidByType[tipoPrimario] ?? []).findIndex(
      (r) => r.speciesId === escolhida.id,
    );
    let melhorLiga: { league: "great" | "ultra" | "master"; position: number } | null = null;
    for (const liga of LIGAS) {
      const pos = (dados.rankings?.statProductByLeague[liga] ?? []).findIndex(
        (r) => r.speciesId === escolhida.id,
      );
      if (pos >= 0 && (melhorLiga === null || pos + 1 < melhorLiga.position)) {
        melhorLiga = { league: liga, position: pos + 1 };
      }
    }
    return buildDexEntry({
      name: escolhida.name,
      dex: escolhida.dex,
      types: escolhida.types,
      baseStats: escolhida.baseStats,
      cpm: dados.cpm,
      levelCap: tetoDePowerUp(setup.level, dados.version.levelCap),
      evolvesInto: escolhida.evolvesInto,
      raidRank: posRaide >= 0 ? { type: tipoPrimario, position: posRaide + 1 } : null,
      leagueRank: melhorLiga,
    });
  }, [dados, escolhida, setup.level]);

  const linhas = useMemo(() => {
    if (!ficha) return [];
    const l = [t(ARQUETIPO[ficha.build]!), t(ficha.evolves ? "dex.line.evolves" : "dex.line.final")];
    if (ficha.raidRank) {
      l.push(
        t("dex.line.raid", {
          type: t(`type.${ficha.raidRank.type}` as Key),
          position: ficha.raidRank.position,
        }),
      );
    }
    return l;
  }, [ficha, t]);

  const escolher = (s: Especie) => {
    setEscolhida(s);
    setBusca("");
    void marcarVisto(s.id);
  };

  const ouvir = () => {
    if (lendo) {
      calar();
      setLendo(false);
      return;
    }
    if (!escolhida) return;
    falar([escolhida.name, ...linhas].join(". "), idioma);
    setLendo(true);
  };

  const capturados = itens?.length ?? 0;

  return (
    <View className="flex-1" style={{ backgroundColor: "#000" }}>
      {permissao?.granted && (
        <CameraView style={{ position: "absolute", inset: 0 }} facing="back" />
      )}

      {/* O ACENTO VERMELHO E SO DA LENTE, e nao da tela. E o unico vermelho do
          app, e ele existe pra dizer "isto e a Pokedex" sem pintar tudo. */}
      <View style={{ position: "absolute", top: alto + 14, left: 18 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Vidro raio={999} interativo style={{ width: 40, height: 40 }}>
            <View className="flex-1 items-center justify-center">
              <SymbolView
                name="xmark"
                size={16}
                tintColor="#FFFFFF"
                fallback={<Text style={{ color: "#fff" }}>×</Text>}
              />
            </View>
          </Vidro>
        </Pressable>
      </View>
      <View
        style={{ position: "absolute", top: alto + 20, right: 22 }}
        className="flex-row items-center gap-2"
      >
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#E4483B" }} />
        <Text className="text-legenda" style={{ color: "#FFFFFF" }}>
          {t("dex.title").toUpperCase()}
        </Text>
      </View>

      {/* A FOLHA DE VIDRO. Ela sobe do rodape e leva tudo que e informacao — a
          camera fica sendo so o gesto de apontar. */}
      <View style={{ position: "absolute", left: 12, right: 12, bottom: Math.max(baixo, 12) }}>
        <Vidro raio={28} style={{ padding: 18 }}>
          <View className="flex-row gap-4">
            <Text className="text-legenda" style={{ color: "#FFFFFF" }}>
              {t("dex.seen", { n: vistos })}
            </Text>
            <Text className="text-legenda" style={{ color: "#FFFFFF" }}>
              {t("dex.caught", { n: capturados })}
            </Text>
          </View>

          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder={t("dex.pick")}
            placeholderTextColor="rgba(255,255,255,0.5)"
            className="rounded-pilula px-4 py-3 text-corpo mt-3"
            style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#FFFFFF" }}
          />

          {achados.length > 0 && (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              data={achados}
              keyExtractor={(s) => s.id}
              className="mt-3"
              renderItem={({ item }) => (
                <Pressable onPress={() => escolher(item)} className="items-center mr-3 w-16">
                  <Selo especie={item} tamanho={48} />
                  <Text
                    className="text-legenda mt-1 text-center"
                    numberOfLines={1}
                    style={{ color: "#FFFFFF" }}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              )}
            />
          )}

          {escolhida && ficha && (
            <View className="mt-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-titulo-cartao" style={{ color: "#FFFFFF" }}>
                  {escolhida.name}
                </Text>
                <Pressable onPress={ouvir} hitSlop={10} className="flex-row items-center gap-1.5">
                  <SymbolView
                    name={lendo ? "speaker.slash.fill" : "speaker.wave.2.fill"}
                    size={15}
                    tintColor="#FFFFFF"
                    fallback={<Text style={{ color: "#fff" }}>♪</Text>}
                  />
                  <Text className="text-legenda" style={{ color: "#FFFFFF" }}>
                    {t(lendo ? "dex.voiceOff" : "dex.speak")}
                  </Text>
                </Pressable>
              </View>
              {linhas.map((linha) => (
                <Text
                  key={linha}
                  className="text-corpo mt-2"
                  style={{ color: "rgba(255,255,255,0.82)" }}
                >
                  {linha}
                </Text>
              ))}
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/especie/[id]", params: { id: escolhida.id } })
                }
                className="rounded-pilula py-3 items-center mt-4"
                style={{ backgroundColor: "#FFFFFF" }}
              >
                <Text className="text-corpo font-bold" style={{ color: "#000000" }}>
                  {t("dex.openFull")}
                </Text>
              </Pressable>
            </View>
          )}

          {permissao && !permissao.granted && (
            <Text className="text-legenda mt-3" style={{ color: "rgba(255,255,255,0.7)" }}>
              {t("dex.cameraDeniedNative")}
            </Text>
          )}
        </Vidro>
      </View>
    </View>
  );
}
