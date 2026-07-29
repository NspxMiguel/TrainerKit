import { useMemo } from "react";

import { ivTotalOf, type IVs } from "@trainerkit/core";

import type { DatasetSpecies } from "../data/useDataset.ts";
import { useT } from "../i18n/t.ts";
import { useCollection } from "../storage/collection.ts";

interface Props {
  species: DatasetSpecies;
  ivs: IVs;
  /** Todas as especies, pra achar a familia evolutiva. */
  allSpecies: readonly DatasetSpecies[];
}

/**
 * "Esse aqui e melhor que os que voce ja tem?"
 *
 * E a pergunta do momento em que se joga: voce acabou de pegar o quarto
 * Machamp e precisa decidir na hora se guarda ou manda embora. O app sabia o IV
 * e sabia a colecao, mas nunca cruzava os dois — dizia "45 de 45, investir" sem
 * mencionar que voce ja tinha tres iguais.
 *
 * Compara pela FAMILIA, nao pela especie: quem tem um Machamp de 96% nao quer
 * ouvir que o Machoke novo e "o melhor Machoke" dele. Eles competem pelo mesmo
 * lugar.
 */
export function AmongYours({ species, ivs, allSpecies }: Props) {
  const { items } = useCollection();
  const { t } = useT();

  const posicao = useMemo(() => {
    if (!items || items.length === 0) return null;

    const familia = species.familyId;
    if (!familia) return null;

    const daFamilia = items.filter((o) => {
      const sp = allSpecies.find((s) => s.id === o.speciesId);
      return sp?.familyId === familia;
    });
    if (daFamilia.length === 0) return null;

    const meu = ivTotalOf(ivs);
    const melhores = daFamilia.filter((o) => ivTotalOf(o.ivs) > meu).length;
    return { total: daFamilia.length, lugar: melhores + 1 };
  }, [items, species.familyId, ivs, allSpecies]);

  if (!posicao) return null;

  const primeiro = posicao.lugar === 1;

  return (
    <p className={`tk-among${primeiro ? " tk-among--top" : ""}`}>
      {primeiro
        ? t("among.best", { count: posicao.total })
        : t("among.rank", { place: posicao.lugar, count: posicao.total })}
    </p>
  );
}
