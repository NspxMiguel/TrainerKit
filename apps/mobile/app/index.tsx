import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";

import { useDados, type Especie } from "../src/dados";
import type { Key } from "@trainerkit/core";
import { useT } from "../src/i18n";
import { useTema } from "../src/tema";
import { Selo } from "../src/Selo";

/**
 * A lista de especies.
 *
 * ⚠️ `FlatList` E NAO `.map()`. Sao 2.472 especies: renderizar todas de uma vez
 * trava o arranque. A lista virtualizada desenha o que cabe na tela e recicla o
 * resto — e o equivalente nativo do que o navegador fazia de graca com scroll.
 */
/**
 * A SAUDACAO, pela hora do aparelho.
 *
 * ⚠️ Os quatro nomes sao os mesmos do app web, e a "madrugada" nao e enfeite:
 * em portugues "boa noite" as 3 da manha soa errado, e o dicionario ja tinha a
 * chave separada pra isso nos dez idiomas.
 */
function saudacao(hora: number): Key {
  if (hora < 5) return "home.greeting.lateNight";
  if (hora < 12) return "home.greeting.morning";
  if (hora < 18) return "home.greeting.afternoon";
  return "home.greeting.night";
}

export default function Lista() {
  const { t } = useT();
  const { cores } = useTema();
  const { pronto, erro, dados } = useDados();
  const [busca, setBusca] = useState("");
  /* Calculada uma vez por montagem: a saudacao nao precisa acompanhar o relogio
     segundo a segundo, e um `setInterval` aqui so gastaria bateria. */
  const [agora] = useState(() => new Date().getHours());

  /**
   * OS MELHORES ATACANTES DE RAIDE — o conteudo do Inicio do web que faltava.
   *
   * O ranking ja vem pronto no dataset; aqui e so a tira. Oito cabem numa
   * rolagem horizontal sem competir com a grade de baixo, e cada um leva direto
   * pra ficha — que e onde a pergunta "e esse, presta?" se responde.
   */
  const melhores = useMemo(() => {
    if (!dados?.rankings?.raidOverall) return [];
    return dados.rankings.raidOverall
      .slice(0, 8)
      .map((r) => {
        const sp = dados.species.find((x) => x.id === r.speciesId);
        return sp
          ? { sp, golpes: [r.fast?.name, r.charged?.name].filter(Boolean).join(" + ") }
          : null;
      })
      .filter((x): x is { sp: Especie; golpes: string } => x !== null);
  }, [dados]);

  const visiveis = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return dados.canonicas;
    return dados.canonicas.filter((s) => s.name.toLowerCase().includes(termo));
  }, [dados, busca]);

  if (erro) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-texto text-base">{t("especies.title")}</Text>
        <Text className="text-texto3 text-xs mt-2 text-center">{erro}</Text>
      </View>
    );
  }

  if (!pronto) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={cores.texto} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-fundo">
      <View className="px-4 pt-3 pb-2">
        <Text className="text-texto text-[22px] font-extrabold mb-3">{t(saudacao(agora))}</Text>
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder={t("especies.searchPlaceholder")}
          placeholderTextColor={cores.texto3}
          className="bg-superficie text-texto rounded-2xl px-4 py-3 text-base"
        />
        {/* Os atalhos que nao sao sobre UM bicho. Ficam no topo da Especies
            enquanto nao ha aba de Inicio — e o unico lugar que existe hoje. */}
        <View className="flex-row gap-2 mt-3">
          <Link href="/chocadeira" asChild>
            <Pressable className="flex-1 bg-superficie rounded-2xl py-3 items-center">
              <Text className="text-texto text-xs font-semibold">{t("eggs.title")}</Text>
            </Pressable>
          </Link>
          <Link href="/ajustes" asChild>
            <Pressable className="flex-1 bg-superficie rounded-2xl py-3 items-center">
              <Text className="text-texto text-xs font-semibold">{t("settings.title")}</Text>
            </Pressable>
          </Link>
          <Link href="/colecao" asChild>
            <Pressable className="flex-1 bg-superficie rounded-2xl py-3 items-center">
              <Text className="text-texto text-xs font-semibold">{t("especies.mine")}</Text>
            </Pressable>
          </Link>
          <Link href="/agenda" asChild>
            <Pressable className="flex-1 bg-superficie rounded-2xl py-3 items-center">
              <Text className="text-texto text-xs font-semibold">{t("agenda.title")}</Text>
            </Pressable>
          </Link>
        </View>

        {/* A tira so aparece quando ninguem esta buscando: durante a busca o
            assunto e o que foi digitado, e uma recomendacao fixa no meio do
            caminho e ruido. */}
        {busca.trim() === "" && melhores.length > 0 && (
          <>
            <Text className="text-texto3 text-[11px] tracking-widest mt-4 mb-2">
              {t("usos.tira").toUpperCase()}
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={melhores}
              keyExtractor={(m) => m.sp.id}
              renderItem={({ item, index }) => (
                <Link href={{ pathname: "/especie/[id]", params: { id: item.sp.id } }} asChild>
                  <Pressable
                    className="bg-superficie rounded-2xl p-3 mr-2 items-center"
                    style={{ width: 108 }}
                  >
                    <Selo especie={item.sp} tamanho={40} />
                    <Text
                      className="text-texto text-[12px] font-semibold mt-2 text-center"
                      numberOfLines={1}
                    >
                      {item.sp.name}
                    </Text>
                    <Text className="text-texto3 text-[10px] mt-0.5">#{index + 1}</Text>
                  </Pressable>
                </Link>
              )}
            />
          </>
        )}

        <Text className="text-texto3 text-xs mt-4">
          {t("especies.count", { n: visiveis.length.toLocaleString() })}
        </Text>
      </View>

      {/*
        GRADE, e nao lista — e a mesma escolha do web.
        
        Mil e duzentas especies numa lista de uma coluna sao mil e duzentas
        rolagens; em grade cabem quatro por linha e o olho varre por COR, que e
        justamente o que o selo da especie oferece. `numColumns` num `FlatList`
        mantem a virtualizacao: so o que cabe na tela e desenhado.
      */}
      <FlatList
        data={visiveis}
        key="grade-4"
        numColumns={4}
        keyExtractor={(s: Especie) => s.id}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}
        renderItem={({ item }) => (
          <Link href={{ pathname: "/especie/[id]", params: { id: item.id } }} asChild>
            <Pressable className="flex-1 items-center bg-superficie rounded-2xl py-3">
              <Selo especie={item} tamanho={52} />
              <Text
                className="text-texto text-[11px] font-semibold mt-2 text-center px-1"
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text className="text-texto3 text-[10px]">#{String(item.dex).padStart(3, "0")}</Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}
