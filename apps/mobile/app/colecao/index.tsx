import { File, Paths } from "expo-file-system";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, Share, Text, TextInput, View } from "react-native";

import { badgeFor, ivPercentOf, ivTotalOf } from "@trainerkit/core";
import {
  apagarColecao,
  colecaoAtiva,
  contarPorColecao,
  criarColecao,
  remover,
  trocarColecao,
  useColecao,
  COLECAO_PADRAO,
  type Guardado,
} from "../../src/colecao";
import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { useTema } from "../../src/tema";
import { Selo } from "../../src/Selo";

/**
 * EXPORTAR — e nao e conforto, e o que a politica de privacidade promete.
 *
 * A tela de privacidade cita a LGPD art. 18, que garante **acesso** aos seus
 * dados alem de exclusao. Apagar o app ja atendia a segunda metade; sem sair
 * com o dado, a primeira era so uma frase.
 *
 * ⚠️ O arquivo vai pro CACHE, nao pro documento. Ele existe pra ser entregue a
 * folha de compartilhamento e nada mais — deixar copia acumulando no diretorio
 * permanente e guardar dado do usuario que ninguem pediu pra guardar.
 *
 * Mesmo nome e mesmo formato do app web (`trainerkit-AAAA-MM-DD.json`, a lista
 * crua): um backup feito no celular tem que abrir no navegador, senao sao dois
 * apps com o mesmo nome e dois formatos.
 */
async function exportar(itens: Guardado[]): Promise<void> {
  const dia = new Date().toISOString().slice(0, 10);
  const arquivo = new File(Paths.cache, `trainerkit-${dia}.json`);
  if (arquivo.exists) arquivo.delete();
  arquivo.create();
  arquivo.write(JSON.stringify(itens, null, 2));
  await Share.share({ url: arquivo.uri, title: `trainerkit-${dia}.json` });
}

/** O que ele guardou. Vazio e um convite, nao um erro. */
export default function Colecao() {
  const { t } = useT();
  const { itens, colecoes, ativa, recarregar } = useColecao();
  const { dados } = useDados();
  const { cores } = useTema();
  const [erro, setErro] = useState(false);
  const [novo, setNovo] = useState("");
  const [contas, setContas] = useState<Record<string, number>>({});

  useEffect(() => {
    void contarPorColecao().then(setContas);
  }, [itens, colecoes]);

  /*
   * A BARRA DAS COLECOES fica FORA do `if (vazia)`: uma colecao nova nasce
   * vazia, e se a barra so aparecesse com bicho dentro a pessoa criaria uma e
   * perderia o caminho de volta pras outras.
   */
  const barra = (
    <View className="px-5 pt-4">
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={colecoes}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void trocarColecao(item.id)}
            onLongPress={() => {
              if (item.id !== COLECAO_PADRAO) void apagarColecao(item.id).then(recarregar);
            }}
            className="rounded-pilula px-4 py-2 mr-2"
            style={{
              backgroundColor: item.id === ativa ? cores.texto : cores.superficie,
            }}
          >
            <Text
              className="text-legenda"
              style={{ color: item.id === ativa ? cores.fundo : cores.texto2 }}
            >
              {item.nome} · {contas[item.id] ?? 0}
            </Text>
          </Pressable>
        )}
      />
      <View className="flex-row gap-2 mt-2">
        <TextInput
          value={novo}
          onChangeText={setNovo}
          placeholder={t("collection.newName")}
          placeholderTextColor={cores.texto3}
          className="flex-1 bg-superficie text-texto rounded-pilula px-4 py-2.5 text-legenda"
          onSubmitEditing={() => {
            if (novo.trim()) void criarColecao(novo).then((c) => trocarColecao(c.id)).then(() => setNovo(""));
          }}
          returnKeyType="done"
        />
      </View>
    </View>
  );

  if (!itens || itens.length === 0) {
    return (
      <View className="flex-1 bg-fundo">
        {barra}
        <View className="flex-1 items-center justify-center px-10">
        <Text className="text-texto text-base font-semibold text-center">
          {t("raid.emptyTitle")}
        </Text>
        <Text className="text-texto3 text-sm text-center mt-2 leading-6">
          {t("raid.emptyBody")}
        </Text>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-fundo"
      contentContainerStyle={{ padding: 20 }}
      data={itens}
      keyExtractor={(g) => g.id}
      ListHeaderComponent={barra}
      ListFooterComponent={
        <>
          <Text className="text-texto3 text-[11px] tracking-widest mt-7 mb-2">
            {t("collection.backup").toUpperCase()}
          </Text>
          <Pressable
            onPress={() => {
              setErro(false);
              exportar(itens ?? []).catch(() => setErro(true));
            }}
            className="rounded-full py-3.5 items-center"
            style={{ borderWidth: 1, borderColor: cores.linha }}
          >
            <Text className="text-texto text-[15px] font-semibold">{t("collection.export")}</Text>
          </Pressable>
          {erro && (
            <Text className="text-texto3 text-[12px] leading-5 mt-2">
              {t("collection.exportFailed")}
            </Text>
          )}
        </>
      }
      renderItem={({ item }) => {
        const sp = dados?.species.find((s) => s.id === item.speciesId);
        const selo = badgeFor(ivTotalOf(item.ivs));
        if (!sp) return null;
        return (
          <Link href={{ pathname: "/especie/[id]", params: { id: sp.id } }} asChild>
            <Pressable
              className="flex-row items-center gap-3 bg-superficie rounded-2xl p-3 mb-2"
              onLongPress={() => void remover(item.id)}
            >
              <Selo especie={sp} tamanho={44} />
              <View className="flex-1">
                <Text className="text-texto text-[15px] font-semibold">{sp.name}</Text>
                <Text className="text-texto3 text-xs">
                  {ivTotalOf(item.ivs)}/45 · {Math.round(ivPercentOf(item.ivs))}% · {t("iv.level")}{" "}
                  {item.level}
                </Text>
              </View>
              <Text className="text-guardar text-sm">
                {"★".repeat(selo.litStars)}
                {"☆".repeat(3 - selo.litStars)}
              </Text>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}
