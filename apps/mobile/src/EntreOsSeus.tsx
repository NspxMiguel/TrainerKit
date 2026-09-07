import { useMemo } from "react";
import { Text, View } from "react-native";

import { ivTotalOf, type IVs } from "@trainerkit/core";

import { useColecao } from "./colecao";
import type { Especie } from "./dados";
import { useT } from "./i18n";

/**
 * "ESSE AQUI É MELHOR QUE OS QUE EU JÁ TENHO?"
 *
 * É a pergunta do momento em que se joga: você acabou de pegar o quarto
 * Machamp e precisa decidir na hora se guarda ou manda embora. O app sabia o IV
 * e sabia a coleção, e nunca cruzava os dois — dizia "45 de 45, investir" sem
 * mencionar que você já tinha três iguais.
 *
 * ⚠️ Compara pela FAMÍLIA, não pela espécie. Quem tem um Machamp de 96% não
 * quer ouvir que o Machoke novo é "o melhor Machoke" dele: eles competem pelo
 * mesmo lugar.
 */
export function EntreOsSeus({
  especie,
  ivs,
  todas,
  jaSalvo = false,
}: {
  especie: Especie;
  ivs: IVs;
  todas: readonly Especie[];
  /** Já está na coleção? Se não, ele entra na conta agora. */
  jaSalvo?: boolean;
}) {
  const { itens } = useColecao();
  const { t } = useT();

  const posicao = useMemo(() => {
    if (!itens || itens.length === 0) return null;
    const familia = especie.familyId;
    if (!familia) return null;

    const daFamilia = itens.filter(
      (g) => todas.find((s) => s.id === g.speciesId)?.familyId === familia,
    );
    if (daFamilia.length === 0) return null;

    const meu = ivTotalOf(ivs);
    const melhores = daFamilia.filter((g) => ivTotalOf(g.ivs) > meu).length;
    /* Salvo, ele já está em `daFamilia`; ainda não salvo, entra agora — senão
       a tela escreveria "o seu #2 entre 1 dessa família". */
    return { total: daFamilia.length + (jaSalvo ? 0 : 1), lugar: melhores + 1 };
  }, [itens, especie.familyId, ivs, todas, jaSalvo]);

  if (!posicao) return null;

  return (
    <View className="bg-superficie rounded-cartao px-4 py-3 mt-3">
      <Text className="text-texto2 text-corpo">
        {posicao.lugar === 1
          ? t("among.best", { count: posicao.total })
          : t("among.rank", { place: posicao.lugar, count: posicao.total })}
      </Text>
    </View>
  );
}
