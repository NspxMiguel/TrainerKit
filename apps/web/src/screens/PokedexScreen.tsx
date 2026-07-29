import { useState } from "react";

import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { useT } from "../i18n/t.ts";
import { SpeciesBrowser } from "../ui/SpeciesBrowser.tsx";
import { RankingsScreen } from "./RankingsScreen.tsx";
import { SpeciesDetail } from "./SpeciesDetail.tsx";

interface Props {
  dataset: DatasetState;
}

/**
 * Modo consulta.
 *
 * Existe porque nem todo mundo quer cadastrar colecao: as vezes a pergunta e so
 * "esse Pokemon presta?". Aqui a resposta sai sem cadastro nenhum, sem conta e
 * sem passo intermediario.
 */
export function PokedexScreen({ dataset }: Props) {
  const [selected, setSelected] = useState<DatasetSpecies | null>(null);
  const { t } = useT();
  const [tab, setTab] = useState<"browse" | "best">("browse");

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

      {/* Buscar e "melhores" sao a mesma pergunta em duas direcoes: uma parte
          da especie, a outra do objetivo. Por isso dividem a aba em vez de
          virar uma quarta na barra de baixo. */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["browse", "best"] as const).map((x) => (
          <button
            key={x}
            type="button"
            className={`tk-btn ${tab === x ? "tk-btn--primary" : "tk-btn--secondary"}`}
            style={{ flex: 1, height: 40, fontSize: 13, padding: 0 }}
            aria-pressed={tab === x}
            onClick={() => setTab(x)}
          >
            {x === "browse" ? t("pokedex.browse") : t("pokedex.best")}
          </button>
        ))}
      </div>

      {tab === "browse" ? (
        <SpeciesBrowser species={dataset.data.species} onPick={setSelected} />
      ) : (
        <RankingsScreen data={dataset.data} onPick={setSelected} />
      )}

      {selected && (
        <SpeciesDetail
          species={selected}
          data={dataset.data}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
