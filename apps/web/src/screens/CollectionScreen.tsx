import { useState } from "react";

import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { IconPlus } from "../ui/Icons.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { SpeciesPicker } from "./SpeciesPicker.tsx";

interface Props {
  dataset: DatasetState;
}

export function CollectionScreen({ dataset }: Props) {
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<DatasetSpecies | null>(null);

  const ready = dataset.status === "ready";

  return (
    <>
      <h1 className="tk-h1">Coleção</h1>

      {picked ? (
        // Provisorio: confirma que a escolha chegou ate aqui. O proximo passo do
        // fluxo (PC/PS/avaliacao -> veredito) entra na fase 2.
        <section className="tk-card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <SpeciesTile
            spriteId={picked.spriteId}
            dex={picked.dex}
            name={picked.name}
            types={picked.types}
            size={64}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 16px var(--tk-font)" }}>{picked.name}</div>
            <div className="tk-caption">
              #{String(picked.dex).padStart(3, "0")} · {picked.types.join(" / ")}
            </div>
            <div className="tk-caption" style={{ marginTop: 4 }}>
              Ataque {picked.baseStats.atk} · Defesa {picked.baseStats.def} · PS{" "}
              {picked.baseStats.hp}
            </div>
          </div>
        </section>
      ) : (
        <div className="tk-empty">
          <div className="tk-empty-mark">
            <IconPlus size={26} />
          </div>
          <div className="tk-empty-title">Nenhum Pokémon salvo</div>
          <p className="tk-body">
            Quando você adicionar o primeiro, ele aparece aqui com o veredito:
            investir, evoluir, guardar ou transferir.
          </p>
        </div>
      )}

      <button
        type="button"
        className="tk-fab"
        aria-label="Adicionar Pokémon"
        disabled={!ready}
        onClick={() => setPicking(true)}
        style={ready ? undefined : { opacity: 0.5 }}
      >
        <IconPlus size={26} />
      </button>

      {picking && ready && (
        <SpeciesPicker
          species={dataset.data.species}
          onPick={(s) => {
            setPicked(s);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
