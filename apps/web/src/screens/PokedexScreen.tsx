import { useState } from "react";

import type { PokedexIntent } from "../App.tsx";
import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { useT } from "../i18n/t.ts";
import { IconCamera } from "../ui/Icons.tsx";
import { SpeciesBrowser, type SortId } from "../ui/SpeciesBrowser.tsx";
import { DexMode } from "./DexMode.tsx";
import { SpeciesDetail } from "./SpeciesDetail.tsx";

interface Props {
  dataset: DatasetState;
  /** De onde a pessoa veio, quando veio por um atalho da home. */
  intent?: PokedexIntent | null;
}

/**
 * Modo consulta.
 *
 * Existe porque nem todo mundo quer cadastrar colecao: as vezes a pergunta e so
 * "esse Pokemon presta?". Aqui a resposta sai sem cadastro nenhum, sem conta e
 * sem passo intermediario.
 */
export function PokedexScreen({ dataset, intent }: Props) {
  const [selected, setSelected] = useState<DatasetSpecies | null>(null);
  const [dexOpen, setDexOpen] = useState(false);
  const { t } = useT();

  if (dataset.status === "loading") {
    return (
      <>
        <h1 className="tk-h1">{t("pokedex.title")}</h1>
        <p className="tk-body">{t("common.loadingGameData")}</p>
      </>
    );
  }

  if (dataset.status === "error") {
    return (
      <>
        <h1 className="tk-h1">{t("pokedex.title")}</h1>
        <p className="tk-body">{t("pokedex.loadError", { message: dataset.message })}</p>
      </>
    );
  }

  return (
    <>
      <h1 className="tk-h1">{t("pokedex.title")}</h1>

      {/*
        O modo Pokedex mora AQUI, e nao na home.
        
        Ele estava como um dos tres botoes de acao da tela inicial, chamado
        "Pokédex" — do lado de uma ABA chamada Pokédex. O Miguel: "2 funcoes com
        o msm nome, pokedex e pokedex". Era a mesma redundancia que ele ja tinha
        apontado nos atalhos, e eu criei de novo.

        Aqui nao ha duas: a aba e a Pokedex, e este botao abre o APARELHO — que e
        outra coisa que a mesma aba faz, no lugar onde a pessoa ja esta olhando
        Pokemon.
      */}
      <button
        type="button"
        className="tk-dexopen"
        onClick={() => setDexOpen(true)}
      >
        <span className="tk-dexopen-lens" aria-hidden="true" />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="tk-dexopen-t">{t("dex.open")}</span>
          <span className="tk-dexopen-d">{t("dex.openDetail")}</span>
        </span>
        <IconCamera size={20} />
      </button>

      {/*
        Uma lista so, que se reordena.

        Eram duas atras de "Buscar | Melhores", e "Melhores" escondia quatro
        rankings atras de mais dois seletores — o Miguel: "coloca uma opção de
        filtro ao invés de simplesmente melhores". E a mesma pergunta ("qual
        Pokemon?") com a resposta ordenada pelo que importa naquele momento.
      */}
      <SpeciesBrowser
        data={dataset.data}
        onPick={setSelected}
        {...(intent?.view === "best"
          ? { initialSort: (intent.mode === "raid" ? "raid" : "great") as SortId }
          : {})}
      />

      {dexOpen && (
        <DexMode
          data={dataset.data}
          onClose={() => setDexOpen(false)}
          onOpenSpecies={(s) => {
            setDexOpen(false);
            setSelected(s);
          }}
        />
      )}

      {selected && (
        <SpeciesDetail
          species={selected}
          data={dataset.data}
          onClose={() => setSelected(null)}
          onPickSpecies={setSelected}
        />
      )}
    </>
  );
}
