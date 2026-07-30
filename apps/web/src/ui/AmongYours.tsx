import { useMemo } from "react";

import { ivTotalOf, type IVs } from "@trainerkit/core";

import type { DatasetSpecies } from "../data/useDataset.ts";
import { useT } from "../i18n/t.ts";
import { useSetup } from "../onboarding/setup.ts";
import { useCollection } from "../storage/collection.ts";

interface Props {
  species: DatasetSpecies;
  ivs: IVs;
  /** Todas as especies, pra achar a familia evolutiva. */
  allSpecies: readonly DatasetSpecies[];
  /**
   * Este ja foi salvo? Muda o total.
   *
   * Enquanto ele nao esta na colecao, ele mesmo precisa entrar na conta —
   * senao da pra ficar em segundo lugar entre um, que foi exatamente o que o
   * app escreveu: "O seu #2 entre 1 dessa família".
   */
  alreadySaved?: boolean;
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
export function AmongYours({ species, ivs, allSpecies, alreadySaved = false }: Props) {
  const { items } = useCollection();
  const setup = useSetup();
  const { t } = useT();

  const posicao = useMemo(() => {
    // Modo so consulta: nao ha "os seus" pra comparar com. Sobrevive colecao
    // antiga no IndexedDB de quem trocou de modo, e comparar com ela seria
    // responder pela colecao que a pessoa acabou de dizer que nao quer ter.
    if (setup.mode !== "colecao") return null;
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
    // Salvo, ele ja esta em `daFamilia`; ainda nao salvo, entra na conta agora.
    return { total: daFamilia.length + (alreadySaved ? 0 : 1), lugar: melhores + 1 };
  }, [items, setup.mode, species.familyId, ivs, allSpecies, alreadySaved]);

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
