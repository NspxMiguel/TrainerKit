import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { buildDexEntry, identificarEspecie, tetoDePowerUp, type Key } from "@trainerkit/core";
import { useColecao } from "../../src/colecao";
import { useIA } from "../../src/ia";
import { useDados, type Especie } from "../../src/dados";
import { useT } from "../../src/i18n";
import { Selo } from "../../src/Selo";
import { useSetup } from "../../src/setup";
import { Vidro } from "../../src/Vidro";
import { calar, falar } from "../../src/voz";
import { useVozLigada } from "../../src/vozLigada";
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
 *   SEMPRE abre a camera de verdade, deixa escolher a especie e LE a ficha em
 *          voz alta com a voz do sistema — sem chave, sem conta, sem rede.
 *   COM     CHAVE, identifica a especie pela camera ou por uma foto da galeria.
 *
 * ⚠️ Isto dizia que o app NAO identificava por imagem, alegando que "a IA e a
 * da pessoa". A alegacao nao separava os dois apps: no web ela tambem e, e e a
 * chave dela que faz a chamada. O que faltava era o codigo atravessar, e ele
 * atravessou — `identificarEspecie` no `packages/core`. Sem chave os botoes nao
 * aparecem, que e a parte que continua valendo: um botao que responde
 * "configure a IA" promete o que o app nao entrega.
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
  const { chave } = useIA();
  const camera = useRef<CameraView>(null);
  const [identificando, setIdentificando] = useState(false);
  /* `null` = nunca tentou. `true` = tentou e o modelo não soube. Sem os dois
     estados, a tela ou mente ("não soube" antes de qualquer foto) ou some com o
     recado no exato momento em que ele importa. */
  const [naoSoube, setNaoSoube] = useState(false);
  const [lendo, setLendo] = useState(false);
  const { ligada: vozLigada, alternar: alternarVoz } = useVozLigada();

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

  /*
   * A LOCUÇÃO INTEIRA, na ordem em que a série fala.
   *
   * ⚠️ Eram três linhas — arquétipo, evolui/final e raide — e o `buildDexEntry`
   * já devolvia tipos, atributos e PC máximo. A ficha do PWA lê tudo isso; a
   * nativa jogava metade fora, e é justamente a metade que faz a locução soar
   * como uma Pokédex em vez de um resumo.
   */
  const linhas = useMemo(() => {
    if (!ficha) return [];
    const l: string[] = [
      t("dex.line.types", {
        types: ficha.types.map((x) => t(`type.${x}` as Key)).join(" / "),
      }),
      t(ARQUETIPO[ficha.build]!),
      t("dex.line.stats", {
        atk: ficha.baseStats.atk,
        def: ficha.baseStats.def,
        hp: ficha.baseStats.hp,
      }),
      t("dex.line.maxCp", {
        cp: ficha.maxCP.toLocaleString(idioma),
        level: tetoDePowerUp(setup.level, dados?.version.levelCap ?? 50),
      }),
      t(ficha.evolves ? "dex.line.evolves" : "dex.line.final"),
    ];
    if (ficha.raidRank) {
      l.push(
        t("dex.line.raid", {
          type: t(`type.${ficha.raidRank.type}` as Key),
          position: ficha.raidRank.position,
        }),
      );
    }
    if (ficha.leagueRank) {
      l.push(
        t("dex.line.league", {
          league: t(`rank.league.${ficha.leagueRank.league}` as Key),
          position: ficha.leagueRank.position,
        }),
      );
    }
    return l;
  }, [ficha, t, idioma, setup.level, dados]);

  const escolher = (s: Especie) => {
    setEscolhida(s);
    setBusca("");
    void marcarVisto(s.id);
    /* Com a voz ligada ela fala SOZINHA ao escolher — é o que uma Pokédex faz.
       Calar antes evita duas locuções sobrepostas ao folhear rápido. */
    calar();
    setLendo(false);
  };

  /**
   * IDENTIFICAR PELA IMAGEM.
   *
   * ⚠️ O nome que volta do modelo NÃO abre ficha nenhuma sozinho: ele é casado
   * contra o dataset primeiro. Modelo de visão devolve nome inventado com a
   * mesma voz com que acerta, e mostrar a ficha do bicho errado é pior que
   * dizer "não soube" — porque a pessoa acredita.
   *
   * O casamento é frouxo de propósito (`includes` nos dois sentidos): o modelo
   * responde "Mr. Mime" onde o dataset tem "Mr. Mime", mas responde "Nidoran"
   * onde o dataset tem "Nidoran♀" — exigir igualdade jogaria fora um acerto.
   */
  const identificarDe = (dataUrl: string) => {
    if (!chave) return;
    setIdentificando(true);
    setNaoSoube(false);
    identificarEspecie(chave, dataUrl)
      .then((nome) => {
        if (!nome || !dados) {
          setNaoSoube(true);
          return;
        }
        const alvo = nome.toLowerCase();
        const achada =
          dados.canonicas.find((e) => e.name.toLowerCase() === alvo) ??
          dados.canonicas.find(
            (e) => e.name.toLowerCase().includes(alvo) || alvo.includes(e.name.toLowerCase()),
          );
        if (achada) escolher(achada);
        else setNaoSoube(true);
      })
      /* A mensagem da Groq (limite de cota, chave recusada) diz o que fazer;
         um "deu erro" nosso não diz. Ela vai pro campo de busca, que é o único
         lugar de texto livre desta tela. */
      .catch((e: Error) => setBusca(e.message.slice(0, 80)))
      .finally(() => setIdentificando(false));
  };

  /** A câmera já está de pé como fundo — tirar a foto é só pedir o quadro. */
  const identificarDaCamera = () => {
    if (!camera.current || identificando) return;
    setIdentificando(true);
    void camera.current
      .takePictureAsync({ base64: true, quality: 0.5, imageType: "jpg" })
      .then((foto) => {
        if (!foto?.base64) {
          setIdentificando(false);
          return;
        }
        identificarDe(`data:image/jpeg;base64,${foto.base64}`);
      })
      .catch(() => setIdentificando(false));
  };

  const identificarDaGaleria = () => {
    if (identificando) return;
    void ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.5,
    }).then((r) => {
      const b64 = r.canceled ? null : r.assets[0]?.base64;
      if (b64) identificarDe(`data:image/jpeg;base64,${b64}`);
    });
  };

  /*
   * ANTERIOR e PRÓXIMO, na ordem da dex — e circular.
   *
   * ⚠️ É o que faz o modo virar uma Pokédex de verdade em vez de uma busca com
   * câmera atrás: dá para FOLHEAR. Circular porque parar no 1 e no último
   * obrigaria a rolar mil e cento e oitenta nomes para voltar ao começo.
   */
  const ordenadas = useMemo(
    () => (dados ? [...dados.canonicas].sort((a, b) => a.dex - b.dex) : []),
    [dados],
  );

  const pular = (passo: number) => {
    if (ordenadas.length === 0) return;
    const atual = escolhida ? ordenadas.findIndex((s) => s.id === escolhida.id) : -1;
    const proximo = ordenadas[(atual + passo + ordenadas.length) % ordenadas.length];
    if (proximo) escolher(proximo);
  };

  /* A locução dispara quando as LINHAS mudam, e não no `escolher`: as linhas
     dependem do dataset e do idioma, e falar antes delas ficarem prontas leria
     a ficha do bicho anterior. */
  useEffect(() => {
    if (!vozLigada || !escolhida || linhas.length === 0) return;
    falar([escolhida.name, ...linhas].join(". "), idioma);
    setLendo(true);
  }, [escolhida, linhas, vozLigada, idioma]);

  const capturados = itens?.length ?? 0;

  return (
    <View className="flex-1" style={{ backgroundColor: "#000" }}>
      {permissao?.granted && (
        <CameraView ref={camera} style={{ position: "absolute", inset: 0 }} facing="back" />
      )}

      {/* O ACENTO VERMELHO E SO DA LENTE, e nao da tela. E o unico vermelho do
          app, e ele existe pra dizer "isto e a Pokedex" sem pintar tudo. */}
      {/* ⚠️ A PÍLULA VAI NO CENTRO e o × à direita — é o print 5. Antes o ×
          ficava à esquerda e o rótulo à direita, o que lia como duas coisas
          soltas em vez de um cabeçalho. */}
      <View
        style={{ position: "absolute", top: alto + 10, left: 0, right: 0 }}
        className="items-center"
      >
        <Vidro raio={999} style={{ paddingHorizontal: 14, paddingVertical: 7 }}>
          <View className="flex-row items-center gap-2">
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#E4483B" }} />
            <Text className="text-legenda" style={{ color: "#FFFFFF" }}>
              {t("dex.title").toUpperCase()}
            </Text>
          </View>
        </Vidro>
      </View>
      <View style={{ position: "absolute", top: alto + 8, right: 18 }}>
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

      {/*
        A MIRA.

        ⚠️ Quatro cantos e um círculo, e ela não é enfeite: sem nada no meio da
        tela a câmera parece travada, e a pessoa não sabe onde apontar. O
        círculo é o único vermelho do app e marca a lente — o mesmo acento da
        pílula lá em cima.
      */}
      {permissao?.granted && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: "26%", left: 0, right: 0 }}
          className="items-center"
        >
          <View style={{ width: 210, height: 170 }}>
            {/* Cada canto acende só duas bordas: as duas que se encontram
                nele. Quatro `View` é mais barato que um SVG e não pede pacote. */}
            {(
              [
                { cima: true, esq: true },
                { cima: true, esq: false },
                { cima: false, esq: true },
                { cima: false, esq: false },
              ] as const
            ).map((c, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  width: 34,
                  height: 34,
                  borderColor: "rgba(255,255,255,0.75)",
                  ...(c.cima ? { top: 0 } : { bottom: 0 }),
                  ...(c.esq ? { left: 0 } : { right: 0 }),
                  borderTopWidth: c.cima ? 2 : 0,
                  borderBottomWidth: c.cima ? 0 : 2,
                  borderLeftWidth: c.esq ? 2 : 0,
                  borderRightWidth: c.esq ? 0 : 2,
                }}
              />
            ))}
            <View
              style={{
                position: "absolute",
                alignSelf: "center",
                top: 50,
                width: 68,
                height: 68,
                borderRadius: 34,
                borderWidth: 2,
                borderColor: "#E4483B",
              }}
            />
          </View>
        </View>
      )}

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

          {/* IDENTIFICAR PELA IMAGEM — os dois caminhos do PWA.
              ⚠️ Só COM CHAVE. Sem ela os botões nem aparecem: um botão de
              identificar que responde "configure a IA" promete o que o app não
              entrega, que é justamente o motivo pelo qual esta tela nasceu sem
              a função. Com chave, ela existe — a mesma regra da ficha. */}
          {chave && (
            <View className="flex-row gap-2 mt-3">
              <Pressable
                onPress={identificarDaCamera}
                disabled={identificando || !permissao?.granted}
                className="flex-1 rounded-pilula py-3 items-center"
                style={{
                  backgroundColor: "rgba(228,72,59,0.85)",
                  opacity: identificando ? 0.5 : 1,
                }}
              >
                <Text className="text-legenda font-semibold" style={{ color: "#FFFFFF" }}>
                  {t(identificando ? "dex.identifying" : "dex.scanNow")}
                </Text>
              </Pressable>
              <Pressable
                onPress={identificarDaGaleria}
                disabled={identificando}
                className="rounded-pilula py-3 px-4 items-center"
                style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
              >
                <SymbolView
                  name="photo"
                  size={16}
                  tintColor="#FFFFFF"
                  fallback={<Text style={{ color: "#fff" }}>{t("dex.photo")}</Text>}
                />
              </Pressable>
            </View>
          )}
          {naoSoube && (
            <Text
              className="text-legenda mt-2 leading-4"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {t("dex.notSure")}
            </Text>
          )}

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
                <View className="flex-row items-center gap-2 flex-1">
                  {/* FOLHEAR. É o que faz o modo virar Pokédex em vez de busca
                      com câmera atrás. */}
                  <Pressable
                    onPress={() => pular(-1)}
                    hitSlop={10}
                    accessibilityLabel={t("dex.prev")}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 20 }}>‹</Text>
                  </Pressable>
                  <Text
                    className="text-titulo-cartao flex-1"
                    numberOfLines={1}
                    style={{ color: "#FFFFFF" }}
                  >
                    {escolhida.name}
                  </Text>
                  <Pressable
                    onPress={() => pular(1)}
                    hitSlop={10}
                    accessibilityLabel={t("dex.next")}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 20 }}>›</Text>
                  </Pressable>
                </View>
                {/* O INTERRUPTOR DA VOZ, e não só "falar de novo": quem não
                    quer locução não quer ser perguntado a cada espécie. A
                    escolha fica salva. */}
                <Pressable
                  onPress={() => {
                    if (vozLigada) calar();
                    setLendo(false);
                    alternarVoz();
                  }}
                  hitSlop={10}
                  className="flex-row items-center gap-1.5 ml-3"
                >
                  <SymbolView
                    name={vozLigada ? "speaker.wave.2.fill" : "speaker.slash.fill"}
                    size={15}
                    tintColor={vozLigada ? "#FFFFFF" : "rgba(255,255,255,0.5)"}
                    fallback={<Text style={{ color: "#fff" }}>♪</Text>}
                  />
                  <Text
                    className="text-legenda"
                    style={{ color: vozLigada ? "#FFFFFF" : "rgba(255,255,255,0.5)" }}
                  >
                    {t(vozLigada ? "dex.voiceOn" : "dex.voiceOff")}
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
              {/* A ONDA DA VOZ.
                  ⚠️ Ela só existe enquanto ele está falando, e as barras são
                  estáticas: uma onda animada precisaria do nível de áudio, que
                  o `expo-speech` não expõe. Fingir o nível seria desenhar um
                  número que o app não tem — a onda aqui diz "está falando", e
                  só isso. */}
              {lendo && (
                <View className="flex-row items-end gap-1 mt-3" style={{ height: 18 }}>
                  {[6, 12, 18, 10, 15, 8, 14, 5, 11, 16, 7, 13].map((h, i) => (
                    <View
                      key={i}
                      style={{
                        width: 3,
                        height: h,
                        borderRadius: 2,
                        backgroundColor: "rgba(120,190,255,0.9)",
                      }}
                    />
                  ))}
                </View>
              )}

              {/* Duas pílulas, como o print 5: abrir a ficha e calar a voz. */}
              <View className="flex-row gap-2 mt-4">
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/especie/[id]", params: { id: escolhida.id } })
                  }
                  className="rounded-pilula py-3 items-center flex-1"
                  style={{ backgroundColor: "#2E9EFF" }}
                >
                  <Text className="text-corpo font-bold" style={{ color: "#FFFFFF" }}>
                    {t("dex.openFull")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (vozLigada) calar();
                    setLendo(false);
                    alternarVoz();
                  }}
                  className="rounded-pilula py-3 items-center flex-1"
                  style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
                >
                  <Text className="text-corpo font-semibold" style={{ color: "#FFFFFF" }}>
                    {t(vozLigada ? "dex.voiceOff" : "dex.voiceOn")}
                  </Text>
                </Pressable>
              </View>
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
