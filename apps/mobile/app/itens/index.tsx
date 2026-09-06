import { EVOLUCOES_POR_ITEM, ITENS_DO_GUIA, NOME_DO_ITEM, type Key } from "@trainerkit/core";
import { Link } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { useTema } from "../../src/tema";

/**
 * PRA QUE SERVE CADA ITEM.
 *
 * "o jogo te entrega o item e não explica nada" — e é literalmente isso: o
 * GAME_MASTER **não traz nome nem descrição de item**, eles moram nos arquivos
 * de tradução do próprio jogo. O que ele traz é melhor do que a descrição:
 * **quais espécies cada item evolui**, par a par.
 *
 * Então esta tela não é um texto que eu escrevi sobre a Pedra de Sinnoh — é a
 * lista, tirada do arquivo, das 24 evoluções que ela destrava hoje. No dia em
 * que o jogo adicionar a 25ª, `itens.test.ts` falha e o mapa é regerado.
 *
 * ⚠️ ITEM SEM NOME NÃO É ESQUECIMENTO. Alguns templates novos
 * (`ITEM_OTHER_EVOLUTION_STONE_*`) não têm nome público que eu possa afirmar, e
 * inventar um seria pior que omitir: a pessoa procuraria no jogo um nome que
 * não existe. Eles aparecem pelas evoluções que destravam, que é o que ela
 * precisa saber de qualquer jeito.
 */
export default function Itens() {
  const { t } = useT();
  const { cores } = useTema();
  const { dados } = useDados();

  /* Nome da espécie pelo id — o mapa vem em id (`gloom`), a tela mostra nome. */
  const nome = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of dados?.species ?? []) m.set(s.id, s.name);
    return m;
  }, [dados]);

  /*
   * Os que têm nome primeiro, e dentro disso o que destrava mais evolução.
   *
   * Não é estética: a Pedra de Sinnoh sozinha responde a 24 perguntas, e é a
   * dúvida que mais aparece. Ordenar por id deixaria ela no meio da lista.
   */
  const evolucao = useMemo(
    () =>
      Object.entries(EVOLUCOES_POR_ITEM)
        .map(([id, pares]) => ({ id, pares, nome: NOME_DO_ITEM[id] }))
        .sort((a, b) =>
          a.nome && !b.nome ? -1 : !a.nome && b.nome ? 1 : b.pares.length - a.pares.length,
        ),
    [],
  );

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      <Text className="text-texto text-[28px] font-extrabold">{t("items.title")}</Text>
      <Text className="text-texto2 text-[15px] leading-6 mt-2">{t("items.intro")}</Text>

      <Text className="text-texto3 text-[11px] tracking-widest mt-7 mb-2">
        {t("items.evolution")}
      </Text>
      {evolucao.map((item) => (
        <View key={item.id} className="bg-superficie rounded-3xl p-5 mb-2">
          <Text className="text-texto text-[15px] font-bold">
            {item.nome ?? t("items.unnamed")}
          </Text>
          {item.pares.map(([de, para]) => (
            <Link
              key={`${de}-${para}`}
              href={{ pathname: "/especie/[id]", params: { id: para } }}
              asChild
            >
              <Pressable className="flex-row items-center mt-2">
                <Text className="flex-1 text-texto2 text-[13px]">
                  {t("items.evolves", { de: nome.get(de) ?? de, para: nome.get(para) ?? para })}
                </Text>
                <Text className="text-texto3 text-base">›</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ))}

      <Text className="text-texto3 text-[11px] tracking-widest mt-5 mb-2">{t("items.other")}</Text>
      {ITENS_DO_GUIA.map((item, i) => (
        <View
          key={item.id}
          className="bg-superficie rounded-3xl p-5"
          style={i > 0 ? { marginTop: 8, borderTopColor: cores.linha } : undefined}
        >
          <Text className="text-texto text-[15px] font-bold">
            {NOME_DO_ITEM[item.id] ?? item.id}
          </Text>
          <Text className="text-texto2 text-[13px] leading-5 mt-2">
            {t(item.explicacao as Key)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
