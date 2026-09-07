import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
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
import { DicaDoDia } from "../../src/DicaDoDia";
import { useSetup } from "../../src/setup";
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
  quantos = 0,
}: {
  especie: Especie;
  linha: string;
  /** A palavra do veredito, quando o herói é um bicho que pede decisão. */
  acao?: string;
  /** Marcar como resolvido sem abrir a ficha. */
  onFeito?: () => void;
  /** Quantos pedem decisão — vira os pontinhos embaixo do herói. */
  quantos?: number;
}) {
  const { t } = useT();
  const { cores } = useTema();
  const cor = corDoTipo(especie.types[0]);
  const tinta = tintaSobre(cor);

  return (
    <Link href={{ pathname: "/especie/[id]", params: { id: especie.id } }} asChild>
      {/* ⚠️ SEM raio e SEM margem: no desenho o herói encosta nas duas bordas e
          na barra de status. Com cantos arredondados ele lê como "mais um
          cartão"; full-bleed ele É a tela. */}
      <Pressable className="overflow-hidden" style={{ height: 372 }}>
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
            alignSelf: "center",
            top: 10,
            /* ⚠️ ELE TRANSBORDA de propósito: no desenho o monograma é largo o
               bastante para ser cortado pelas duas bordas, e é esse corte que
               faz ele ler como textura e não como palavra. */
            fontSize: 250,
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
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 190 }}
        />
        <View className="flex-1 justify-end items-center px-5 pb-5">
          <View className="rounded-pilula px-3 py-1 mb-2 bg-black/35">
            <Text className="text-legenda text-white">{t("home.today").toUpperCase()}</Text>
          </View>
          <Text className="text-saudacao text-white text-center">{especie.name}</Text>
          {/* Tipos MAIS o porquê. O desenho põe uma frase aqui — "Fogo · Voador ·
              IV 93 — vale cada grama de poeira hoje" — e só os tipos deixavam o
              herói dizendo o que a pessoa já vê na cor. */}
          <Text className="text-corpo text-white/85 mt-1 text-center" numberOfLines={2}>
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
            <View className="flex-row items-center gap-2 mt-4">
              <View className="rounded-pilula px-6 py-3 bg-white">
                <Text className="text-corpo font-bold" style={{ color: "#111" }}>
                  {acao}
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

          {/* OS PONTINHOS. Eles dizem quantos ainda esperam decisão — no desenho
              são o que promete que há mais de um assunto. Um só não desenha
              nada: um ponto sozinho não é um carrossel. */}
          {quantos > 1 && (
            <View className="flex-row gap-1.5 mt-4 self-center">
              {Array.from({ length: Math.min(quantos, 5) }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === 0 ? 14 : 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: i === 0 ? "#FFFFFF" : "rgba(255,255,255,0.45)",
                  }}
                />
              ))}
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

/**
 * OS ATALHOS — e são DOIS.
 *
 * ⚠️ Eram sete, e sete pílulas pequenas viravam uma parede que competia com a
 * ação principal. O desenho põe só estes dois, e os outros cinco continuam
 * alcançáveis: Modo Pokédex e Itens pela aba Pokédex, agenda e chocadeira pela
 * agenda, contas pelo avatar da saudação.
 */
const ATALHOS: { rota: string; rotulo: Key; icone: string }[] = [
  { rota: "/time", rotulo: "team.title", icone: "person.3.fill" },
  { rota: "/ginasio", rotulo: "gym.title", icone: "shield.fill" },
];

export default function Inicio() {
  const { t, tm } = useT();
  const { cores } = useTema();
  const { pronto, dados } = useDados();
  const { itens, recarregar } = useColecao();
  const router = useRouter();
  const { top: alto, bottom: baixo } = useSafeAreaInsets();
  const [agora] = useState(() => new Date().getHours());
  const { setup } = useSetup();

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

  /*
   * O ESQUELETO, e não um giro no meio da tela.
   *
   * ⚠️ Um `ActivityIndicator` centralizado diz "espere" e some; o esqueleto diz
   * O QUE vai aparecer, e a tela não pula quando o dado chega — que é o defeito
   * que a lista de lançamento do projeto chama pelo nome.
   */
  if (!pronto) {
    return (
      <View className="flex-1 bg-fundo px-4" style={{ paddingTop: alto + 8 }}>
        <View className="rounded-cartao-sm bg-superficie mb-4" style={{ height: 34, width: 180 }} />
        <View className="rounded-cartao-lg bg-superficie" style={{ height: 268 }} />
        <View className="rounded-pilula bg-superficie mt-4" style={{ height: 52 }} />
        <View className="flex-row gap-2 mt-3">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              className="rounded-pilula bg-superficie"
              style={{ height: 40, flex: 1 }}
            />
          ))}
        </View>
      </View>
    );
  }

  const nome = setup.nome.trim() || t("home.trainer");

  return (
    <ScrollView
      className="flex-1 bg-fundo"
      /* ⚠️ 24 e não 110: a barra agora é a do sistema, e ela ajusta o inset da
         rolagem sozinha. O respiro grande era para a barra flutuante desenhada
         à mão, e com a nativa ele vira um buraco no fim da lista. */
      contentContainerStyle={{ paddingBottom: baixo + 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ⚠️ A SAUDAÇÃO E O HERÓI VÊM COLADOS, e a busca desceu.
          Eu tinha posto a busca entre os dois, e ela empurrava o herói para
          baixo da dobra — no desenho ele ocupa quase metade da tela logo de
          cara, e é isso que faz a tela ter um assunto. */}
      <View className="px-4 flex-row items-center gap-3" style={{ paddingTop: alto + 8 }}>
        {/* UMA LINHA. "Boa tarde, Treinador." quebrava em duas e empurrava o
            herói; encolher a fonte é melhor que perder a primeira dobra. */}
        <Text
          className="text-saudacao text-texto flex-1"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {t(saudacao(agora))}, {nome}.
        </Text>
        {/* O AVATAR, com a inicial. É o que o desenho põe no canto e o que dá o
            caminho para as contas — hoje o único lugar onde se troca de coleção. */}
        <Toque
          onPress={() => router.push("/colecao")}
          accessibilityLabel={t("colecoes.title")}
          className="rounded-pilula items-center justify-center"
          style={{ width: 38, height: 38, backgroundColor: cores.superficie }}
        >
          <Text className="text-texto text-corpo font-bold">
            {nome.slice(0, 1).toUpperCase()}
          </Text>
        </Toque>
      </View>

      {/* O HERÓI É FULL-BLEED: sem margem lateral, encostando nas duas bordas.
          Com margem ele lê como "mais um cartão"; sem, ele é a tela. */}
      {destaque && (
        <Heroi
          especie={destaque}
          linha={linhaDoDestaque}
          quantos={fila.length}
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

      <View className="px-4">
        {/* A ACAO PRINCIPAL, largura cheia e em pilula.
            ⚠️ AZUL e não branca: no desenho ela é a única coisa com COR de
            acento na tela, e é assim que ela se separa dos atalhos. Branca ela
            competia com o herói. */}
        <Link href="/print" asChild>
          <Toque
            className="rounded-pilula py-4 items-center mt-5 flex-row justify-center gap-2"
            style={{
              backgroundColor: cores.evoluir,
              shadowColor: cores.evoluir,
              shadowOpacity: 0.42,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <SymbolView name="viewfinder" size={17} tintColor="#FFFFFF" fallback={<View />} />
            <Text className="text-corpo font-bold" style={{ color: "#FFFFFF" }}>
              {t("scan.pick")}
            </Text>
          </Toque>
        </Link>

        {/* ⚠️ DOIS atalhos, não sete. O desenho põe só "Monta um time" e
            "Ginásio" — os outros cinco viraram uma parede de pílulas que
            competia com a ação principal. O resto continua alcançável: Modo
            Pokédex e Itens pela Pokédex, agenda e chocadeira pelos eventos. */}
        <View className="flex-row gap-2 mt-3">
          {ATALHOS.map((a) => (
            <Link key={a.rota} href={a.rota as never} asChild>
              <Toque
                estiloExterno={{ flex: 1 }}
                className="bg-superficie rounded-pilula py-3.5 items-center justify-center flex-row gap-2"
              >
                <SymbolView
                  name={a.icone as never}
                  size={15}
                  tintColor={cores.texto3}
                  fallback={<View />}
                />
                <Text className="text-texto text-corpo font-semibold">{t(a.rotulo)}</Text>
              </Toque>
            </Link>
          ))}
        </View>

        {meus.length > 0 && (
          <>
            {/* DUAS LEGENDAS, uma em cada ponta — é o que o desenho põe, e é a
                que está à direita que dá o motivo de olhar a tira. */}
            <View className="flex-row items-baseline justify-between mt-7 mb-3">
              <Text className="text-texto3 text-legenda">
                {t("home.yourCollection").toUpperCase()}
              </Text>
              {fila.length > 0 && (
                <Text className="text-legenda" style={{ color: cores.evoluir }}>
                  {t(
                    fila.length === 1 ? "home.needsDecision.one" : "home.needsDecision.many",
                    { count: fila.length },
                  ).toUpperCase()}
                </Text>
              )}
            </View>
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
                  {/* CÍRCULOS GRANDES: no desenho a tira é a segunda coisa que
                      o olho pega, e um selo de 54 com o nome embaixo lia como
                      lista. 64 com o rótulo colorido é o que a torna varrível. */}
                  <Toque className="items-center mr-4" style={{ width: 68 }}>
                    <Selo especie={item.especie} tamanho={64} />
                    {/* O rótulo do veredito embaixo, na cor dele — é o que o
                        desenho mostra e o que faz a tira valer mais que uma
                        lista de nomes. */}
                    <Text
                      className="text-legenda text-center mt-2"
                      numberOfLines={1}
                      style={{
                        color: item.acao
                          ? cores[COR_DA_ACAO[item.acao] ?? "texto3"]
                          : cores.texto3,
                        fontSize: 9,
                      }}
                    >
                      {item.acao
                        ? t(ACTION_KEYS[item.acao] as Key).toUpperCase()
                        : item.especie.name.toUpperCase()}
                    </Text>
                  </Toque>
                </Link>
              )}
            />
          </>
        )}
        {/* A dica só aparece quando NÃO há pendência: com fila aberta o assunto
            da tela é a fila, e ensinar por cima disso é ruído. */}
        {!pendente && dados && <DicaDoDia dados={dados} />}
      </View>
    </ScrollView>
  );
}
