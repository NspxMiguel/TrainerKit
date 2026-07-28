import { useState } from "react";

import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { SpeciesBrowser } from "../ui/SpeciesBrowser.tsx";
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

  if (dataset.status === "loading") {
    return (
      <>
        <h1 className="tk-h1">Pokédex</h1>
        <p className="tk-body">Carregando dados do jogo…</p>
      </>
    );
  }

  if (dataset.status === "error") {
    return (
      <>
        <h1 className="tk-h1">Pokédex</h1>
        <p className="tk-body">Não consegui carregar o dataset. {dataset.message}</p>
      </>
    );
  }

  return (
    <>
      <h1 className="tk-h1">Pokédex</h1>
      <SpeciesBrowser species={dataset.data.species} onPick={setSelected} />

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
