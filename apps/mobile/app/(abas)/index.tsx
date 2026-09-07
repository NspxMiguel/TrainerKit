import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ACTION_KEYS, degradeDoTipo, PARADAS_DO_DEGRADE, type Key } from "@trainerkit/core";
import { marcarFeito, useColecao } from "../../src/colecao";
import { usePendencias } from "../../src/pendencias";
import type { Action } from "@trainerkit/core";
import type { Guardado } from "../../src/colecao";
import { useDados, type Especie } from "../../src/dados";
import { useT } from "../../src/i18n";
import { corDoTipo, Selo, tintaSobre } from "../../src/Selo";
import { useTema } from "../../src/tema";
import { Toque } from "../../src/Toque";

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

function Heroi({
  especie,
  linha,
  acao,
  onFeito,
}: {
  especie: Especie;
  linha: string;
  /** A palavra do veredito, quando o herói é um bicho que pede decisão. */
  acao?: string;
  /** Marcar como resolvido sem abrir a ficha. */
  onFeito?: () => void;
}) {
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
        {/*
          O DEGRADÊ QUE SOBE — escuro em cima, a cor no meio, claro embaixo, na
          vertical. Ele estava errado aqui: era diagonal e terminava em
          transparente, o que só apaga a cor. Ele reconheceu de longe.
        */}
        <LinearGradient
          colors={degradeDoTipo(cor)}
          locations={PARADAS_DO_DEGRADE as unknown as [number, number, number]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
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
        {/*
          Scrim, e ELE É DISCRETO.

          ⚠️ Estava em 0,55 e apagava justamente o pé do degradê — a parte clara,
          que é o que dá a sensação de luz subindo. O pacote usa `rgba(10,12,16,.4)`
          e é esse o teto: escuro o suficiente para o texto branco passar em
          contraste, claro o suficiente para a cor continuar aparecendo por baixo.
        */}
        <LinearGradient
          colors={["transparent", "rgba(10,12,16,0.40)"]}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 130 }}
        />
        <View className="flex-1 justify-end p-5">
          <View className="self-start rounded-pilula px-3 py-1 mb-2 bg-black/35">
            <Text className="text-legenda text-white">{t("home.today").toUpperCase()}</Text>
          </View>
          <Text className="text-saudacao text-white">{especie.name}</Text>
          {/* Tipos MAIS o porquê. O desenho põe uma frase aqui — "Fogo · Voador ·
              IV 93 — vale cada grama de poeira hoje" — e só os tipos deixavam o
              herói dizendo o que a pessoa já vê na cor. */}
          <Text className="text-corpo text-white/85 mt-1" numberOfLines={2}>
            {especie.types.map((x) => t(`type.${x}` as Key)).join(" · ")}
            {linha ? ` — ${linha}` : ""}
          </Text>

          {/*
            A AÇÃO, dentro do herói.

            ⚠️ Ela existe porque o herói é uma PERGUNTA — "no que eu mexo hoje?"
            — e uma pergunta sem resposta ao lado é decoração. O botão redondo
            fecha a pendência sem abrir a ficha: quem já evoluiu não quer
            navegar duas telas para dizer isso.
          */}
          {acao && (
            <View className="flex-row items-center gap-2 mt-3">
              <View className="rounded-pilula px-4 py-2.5 bg-white">
                <Text className="text-legenda" style={{ color: "#111" }}>
                  {acao.toUpperCase()}
                </Text>
              </View>
              {onFeito && (
                <Pressable
                  onPress={(e) => {
                    /* Sem isto o toque sobe para o `Link` do herói e a ficha
                       abre por cima da ação que a pessoa acabou de concluir. */
                    e.stopPropagation();
                    onFeito();
                  }}
                  hitSlop={10}
                  accessibilityLabel={t("collection.markDone")}
                  className="rounded-pilula bg-black/40"
                  style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
                >
                  <SymbolView
                    name="checkmark"
                    size={16}
                    tintColor="#FFFFFF"
                    fallback={<Text style={{ color: "#fff" }}>✓</Text>}
                  />
                </Pressable>
              )}
            </View>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

/** Qual cor do tema pinta cada veredito — a mesma tabela da ficha. */
const COR_DA_ACAO: Record<string, "investir" | "evoluir" | "guardar" | "transferir"> = {
  investir: "investir",
  evoluir: "evoluir",
  guardar: "guardar",
  transferir: "transferir",
  descobrir: "investir",
};

const ATALHOS: { rota: string; rotulo: Key; icone: string }[] = [
  { rota: "/dex", rotulo: "dex.open", icone: "camera.viewfinder" },
  { rota: "/time", rotulo: "team.title", icone: "person.3.fill" },
  { rota: "/ginasio", rotulo: "gym.title", icone: "shield.fill" },
  { rota: "/chocadeira", rotulo: "eggs.title", icone: "circle.dashed" },
  { rota: "/agenda", rotulo: "agenda.title", icone: "calendar" },
  { rota: "/colecao", rotulo: "especies.mine", icone: "tray.full.fill" },
  { rota: "/itens", rotulo: "items.short", icone: "bag.fill" },
];

export default function Inicio() {
  const { t, tm } = useT();
  const { cores } = useTema();
  const { pronto, dados } = useDados();
  const { itens, recarregar } = useColecao();
  const { top: alto, bottom: baixo } = useSafeAreaInsets();
  const [agora] = useState(() => new Date().getHours());

  const fila = usePendencias(dados);

  /*
   * O DESTAQUE, em ordem de utilidade — e isto é o que o PWA faz.
   *
   * 1. O que PEDE DECISÃO. Se existe um bicho esperando uma escolha, ele é o
   *    assunto do dia: o app existe pra responder "no que eu mexo hoje?".
   * 2. Sem fila, o melhor atacante de raide — o único "hoje" que o app afirma
   *    sem inventar evento.
   *
   * O nativo só fazia o passo 2, então quem tinha a coleção inteira pedindo
   * decisão abria o app e via um bicho que nem é dele.
   */
  const pendente = fila[0] ?? null;

  const destaque = useMemo(() => {
    if (pendente) return pendente.especie;
    const id = dados?.rankings?.raidOverall?.[0]?.speciesId;
    return id ? dados?.species.find((s) => s.id === id) : undefined;
  }, [dados, pendente]);

  /* A frase do herói: o motivo do veredito quando há fila, e a posição no
     ranking quando não há. As duas vêm do core — nada inventado aqui. */
  const linhaDoDestaque = pendente ? tm(pendente.veredito.reason) : t("home.hero.topRaid");

  /*
   * A tira da coleção, com o VEREDITO de cada um.
   *
   * ⚠️ Quem pede decisão vem primeiro. Sem isso a tira mostrava os doze
   * primeiros guardados, em ordem de cadastro, e a pessoa tinha que abrir um
   * por um para descobrir qual deles queria alguma coisa dela.
   */
  const meus = useMemo(() => {
    if (!dados) return [];
    const pendentes = new Set(fila.map((p) => p.guardado.id));
    return (itens ?? [])
      .map((g) => {
        const especie = dados.species.find((s) => s.id === g.speciesId);
        if (!especie) return null;
        const p = fila.find((x) => x.guardado.id === g.id);
        return { g, especie, acao: p?.veredito.action ?? null };
      })
      .filter((x): x is { g: Guardado; especie: Especie; acao: Action | null } => x !== null)
      .sort((a, b) => Number(pendentes.has(b.g.id)) - Number(pendentes.has(a.g.id)))
      .slice(0, 12);
  }, [itens, dados, fila]);

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
        {destaque && (
          <Heroi
            especie={destaque}
            linha={linhaDoDestaque}
            {...(pendente
              ? {
                  acao: t(ACTION_KEYS[pendente.veredito.action] as Key),
                  onFeito: () => {
                    void marcarFeito(pendente.guardado.id, pendente.veredito.action).then(
                      recarregar,
                    );
                  },
                }
              : {})}
          />
        )}

        {/* A ACAO PRINCIPAL, largura cheia e em pilula. E a unica coisa do app
            que resolve o problema inteiro em um passo, entao e a unica que
            ganha a cor de acento e a sombra de CTA. */}
        <Link href="/print" asChild>
          <Toque
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
          </Toque>
        </Link>

        <View className="flex-row flex-wrap gap-2 mt-3">
          {ATALHOS.map((a) => (
            <Link key={a.rota} href={a.rota as never} asChild>
              <Toque className="bg-superficie rounded-pilula px-4 py-3 flex-row items-center gap-2">
                <SymbolView
                  name={a.icone as never}
                  size={15}
                  tintColor={cores.texto3}
                  fallback={<View />}
                />
                <Text className="text-texto text-legenda">{t(a.rotulo)}</Text>
              </Toque>
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
              keyExtractor={(x) => x.g.id}
              renderItem={({ item }) => (
                <Link
                  href={{ pathname: "/especie/[id]", params: { id: item.especie.id } }}
                  asChild
                >
                  <Toque className="items-center mr-3" style={{ width: 62 }}>
                    <Selo especie={item.especie} tamanho={54} />
                    <Text className="text-texto text-legenda mt-1.5 text-center" numberOfLines={1}>
                      {item.especie.name}
                    </Text>
                    {/* O rótulo do veredito embaixo, na cor dele — é o que o
                        desenho mostra e o que faz a tira valer mais que uma
                        lista de nomes. */}
                    {item.acao && (
                      <Text
                        className="text-legenda text-center mt-0.5"
                        numberOfLines={1}
                        style={{ color: cores[COR_DA_ACAO[item.acao] ?? "texto3"], fontSize: 9 }}
                      >
                        {t(ACTION_KEYS[item.acao] as Key).toUpperCase()}
                      </Text>
                    )}
                  </Toque>
                </Link>
              )}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}
