import { useState } from "react";

import type { PokedexIntent } from "../App.tsx";
import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { useT } from "../i18n/t.ts";
import { Segmented } from "../ui/Segmented.tsx";
import { SpeciesBrowser } from "../ui/SpeciesBrowser.tsx";
import { RankingsScreen } from "./RankingsScreen.tsx";
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
  const { t } = useT();
  /*
   * O estado inicial basta — nao precisa de efeito pra sincronizar.
   *
   * O `<main key={tab}>` do App remonta esta tela a cada troca de aba, entao
   * chegar pelo atalho SEMPRE passa por uma montagem nova. Um efeito aqui so
   * criaria o risco de sobrescrever a escolha que a pessoa fizer depois.
   */
  const [tab, setTab] = useState<"browse" | "best">(intent?.view ?? "browse");

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
      <div style={{ marginBottom: 14 }}>
        <Segmented
          ariaLabel={t("pokedex.title")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "browse" as const, label: t("pokedex.browse") },
            { value: "best" as const, label: t("pokedex.best") },
          ]}
        />
      </div>

      {tab === "browse" ? (
        <SpeciesBrowser species={dataset.data.species} onPick={setSelected} />
      ) : (
        <RankingsScreen
          data={dataset.data}
          onPick={setSelected}
          {...(intent?.view === "best" ? { initialMode: intent.mode } : {})}
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
