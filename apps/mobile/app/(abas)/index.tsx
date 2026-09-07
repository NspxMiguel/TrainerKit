import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Key } from "@trainerkit/core";
import { useColecao } from "../../src/colecao";
import { useDados, type Especie } from "../../src/dados";
import { useT } from "../../src/i18n";
import { corDoTipo, Selo, tintaSobre } from "../../src/Selo";
import { useTema } from "../../src/tema";

/**
 * O INICIO.
 *
 * Ele nao existia: a saudacao e os atalhos moravam empilhados no topo da lista
 * de especies, junto da busca e da grade de 1.182 tiles. Dava uma tela que
 * fazia cinco coisas e nao respondia a pergunta que a pessoa abre o app pra
 * responder — "no que eu mexo hoje?".
 *
 * A ordem aqui e a do desenho: quem fala primeiro e o DESTAQUE (um bicho, com
 * a cor do tipo ocupando a tela), depois a acao que resolve em um passo
 * (escanear um print), depois os atalhos, e so entao a colecao.
 */
function saudacao(hora: number): Key {
  if (hora < 5) return "home.greeting.lateNight";
  if (hora < 12) return "home.greeting.morning";
  if (hora < 18) return "home.greeting.afternoon";
  return "home.greeting.night";
}

/** As duas primeiras letras — o mesmo monograma do selo, em tamanho de heroi. */
function monograma(nome: string): string {
  return nome.replace(/[^A-Za-zÀ-ÿ]/g, "").slice(0, 2).toUpperCase();
}

function Heroi({ especie }: { especie: Especie }) {
  const { t } = useT();
  const cor = corDoTipo(especie.types[0]);
  const tinta = tintaSobre(cor);

  return (
    <Link href={{ pathname: "/especie/[id]", params: { id: especie.id } }} asChild>
      <Pressable className="rounded-cartao-lg overflow-hidden" style={{ height: 268 }}>
        {/*
          O GRADIENTE E DO TIPO, e nao uma cor de marca. Foi assim que o violeta
          saiu do app sem a tela ficar cinza: a cor continua existindo, so que
          ela agora SIGNIFICA alguma coisa — Charizard e laranja porque e Fogo.
        */}
        <LinearGradient
          colors={[cor, `${cor}22`]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        {/* O monograma gigante e marca d'agua: ele da massa e movimento ao
            fundo sem depender de arte nenhuma — e o app e distribuido sem arte. */}
        <Text
          style={{
            position: "absolute",
            right: -10,
            top: 18,
            fontSize: 150,
            fontWeight: "800",
            color: tinta,
            opacity: 0.16,
          }}
        >
          {monograma(especie.name)}
        </Text>
        {/* Scrim: sem ele o texto branco some no meio do gradiente claro. */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)"]}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 170 }}
        />
        <View className="flex-1 justify-end p-5">
          <View className="self-start rounded-pilula px-3 py-1 mb-2 bg-black/35">
            <Text className="text-legenda text-white">{t("home.today").toUpperCase()}</Text>
          </View>
          <Text className="text-saudacao text-white">{especie.name}</Text>
          <Text className="text-corpo text-white/80 mt-1" numberOfLines={2}>
            {especie.types.map((x) => t(`type.${x}` as Key)).join(" · ")}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const ATALHOS: { rota: string; rotulo: Key; icone: string }[] = [
  { rota: "/time", rotulo: "team.title", icone: "person.3.fill" },
  { rota: "/ginasio", rotulo: "gym.title", icone: "shield.fill" },
  { rota: "/chocadeira", rotulo: "eggs.title", icone: "circle.dashed" },
  { rota: "/agenda", rotulo: "agenda.title", icone: "calendar" },
  { rota: "/colecao", rotulo: "especies.mine", icone: "tray.full.fill" },
  { rota: "/itens", rotulo: "items.short", icone: "bag.fill" },
];

export default function Inicio() {
  const { t } = useT();
  const { cores } = useTema();
  const { pronto, dados } = useDados();
  const { itens } = useColecao();
  const { top: alto, bottom: baixo } = useSafeAreaInsets();
  const [agora] = useState(() => new Date().getHours());

  /* O destaque e o primeiro do ranking de raide: e o unico "hoje" que o app
     consegue afirmar sem inventar evento. Quando a agenda tiver evento ativo,
     e ele que deve entrar aqui. */
  const destaque = useMemo(() => {
    const id = dados?.rankings?.raidOverall?.[0]?.speciesId;
    return id ? dados?.species.find((s) => s.id === id) : undefined;
  }, [dados]);

  const meus = useMemo(() => {
    if (!dados) return [];
    return (itens ?? [])
      .map((c) => dados.species.find((s) => s.id === c.speciesId))
      .filter((s): s is Especie => !!s)
      .slice(0, 12);
  }, [itens, dados]);

  if (!pronto) {
    return (
      <View className="flex-1 items-center justify-center bg-fundo">
        <ActivityIndicator color={cores.texto} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-fundo"
      contentContainerStyle={{ paddingBottom: baixo + 110 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4" style={{ paddingTop: alto + 8 }}>
        <Text className="text-saudacao text-texto mb-4">{t(saudacao(agora))}</Text>
        {destaque && <Heroi especie={destaque} />}

        {/* A ACAO PRINCIPAL, largura cheia e em pilula. E a unica coisa do app
            que resolve o problema inteiro em um passo, entao e a unica que
            ganha a cor de acento e a sombra de CTA. */}
        <Link href="/print" asChild>
          <Pressable
            className="rounded-pilula py-4 items-center mt-4 flex-row justify-center gap-2"
            style={{
              backgroundColor: cores.texto,
              shadowColor: cores.texto,
              shadowOpacity: 0.22,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <SymbolView name="viewfinder" size={17} tintColor={cores.fundo} fallback={<View />} />
            <Text className="text-corpo font-bold" style={{ color: cores.fundo }}>
              {t("scan.pick")}
            </Text>
          </Pressable>
        </Link>

        <View className="flex-row flex-wrap gap-2 mt-3">
          {ATALHOS.map((a) => (
            <Link key={a.rota} href={a.rota as never} asChild>
              <Pressable className="bg-superficie rounded-pilula px-4 py-3 flex-row items-center gap-2">
                <SymbolView
                  name={a.icone as never}
                  size={15}
                  tintColor={cores.texto3}
                  fallback={<View />}
                />
                <Text className="text-texto text-legenda">{t(a.rotulo)}</Text>
              </Pressable>
            </Link>
          ))}
        </View>

        {meus.length > 0 && (
          <>
            <Text className="text-texto3 text-legenda mt-6 mb-2">
              {t("especies.mine").toUpperCase()}
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={meus}
              keyExtractor={(s) => s.id}
              renderItem={({ item }) => (
                <Link href={{ pathname: "/especie/[id]", params: { id: item.id } }} asChild>
                  <Pressable className="items-center mr-3" style={{ width: 62 }}>
                    <Selo especie={item} tamanho={54} />
                    <Text className="text-texto text-legenda mt-1.5 text-center" numberOfLines={1}>
                      {item.name}
                    </Text>
                  </Pressable>
                </Link>
              )}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}
