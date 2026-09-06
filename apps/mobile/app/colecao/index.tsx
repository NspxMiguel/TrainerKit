import { File, Paths } from "expo-file-system";
import { Link } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Share, Text, View } from "react-native";

import { badgeFor, ivPercentOf, ivTotalOf } from "@trainerkit/core";
import { useColecao, remover, type Guardado } from "../../src/colecao";
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
  const { itens } = useColecao();
  const { dados } = useDados();
  const { cores } = useTema();
  const [erro, setErro] = useState(false);

  if (!itens || itens.length === 0) {
    return (
      <View className="flex-1 bg-fundo items-center justify-center px-10">
        <Text className="text-texto text-base font-semibold text-center">
          {t("raid.emptyTitle")}
        </Text>
        <Text className="text-texto3 text-sm text-center mt-2 leading-6">
          {t("raid.emptyBody")}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-fundo"
      contentContainerStyle={{ padding: 20 }}
      data={itens}
      keyExtractor={(g) => g.id}
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
