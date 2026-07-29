import { useMemo, useState } from "react";

import { ACTION_LABELS, decide, ivTotalOf } from "@trainerkit/core";

import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { exportJson, importJson, removePokemon, useCollection } from "../storage/collection.ts";
import { IconPlus } from "../ui/Icons.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { SpeciesDetail } from "./SpeciesDetail.tsx";
import { SpeciesPicker } from "./SpeciesPicker.tsx";

interface Props {
  dataset: DatasetState;
}

const TONE: Record<string, string> = {
  investir: "var(--tk-succ)",
  evoluir: "var(--tk-pri)",
  guardar: "var(--tk-info)",
  transferir: "var(--tk-dang)",
};

export function CollectionScreen({ dataset }: Props) {
  const { items, reload } = useCollection();
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState<DatasetSpecies | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const ready = dataset.status === "ready";
  const species = ready ? dataset.data.species : [];

  // Um veredito custa alguns milissegundos porque ranqueia 4.096 combinacoes de
  // IV em tres ligas. Recalcular tudo a cada re-render — abrir uma folha, digitar
  // no backup — travaria a tela numa colecao grande.
  const rows = useMemo(() => {
    if (!ready || items === null) return null;

    return items.map((owned) => {
      const s = species.find((x) => x.id === owned.speciesId);
      if (!s) return { owned, species: null, verdict: null };

      const verdict = decide({
        name: s.name,
        baseStats: s.baseStats,
        ivs: owned.ivs,
        level: owned.level ?? 20,
        cpm: dataset.data.cpm,
        levelCap: dataset.data.version.levelCap,
        evolvesInto: s.evolvesInto,
        candyToEvolve: s.evolvesInto[0]
          ? (s.candyToEvolve[s.evolvesInto[0]] ?? null)
          : null,
        lucky: owned.lucky,
        shadow: owned.shadow,
      });

      return { owned, species: s, verdict };
    });
  }, [items, ready, species, dataset]);

  const download = async () => {
    const json = await exportJson();
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `trainerkit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File) => {
    try {
      const count = await importJson(await file.text());
      reload();
      setMessage(`${count} Pokémon importados.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <h1 className="tk-h1">Coleção</h1>

      {rows === null ? (
        <p className="tk-body">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="tk-empty">
          <div className="tk-empty-mark">
            <IconPlus size={26} />
          </div>
          <div className="tk-empty-title">Nenhum Pokémon salvo</div>
          <p className="tk-body">
            Escaneie o print da avaliação e salve. O veredito aparece aqui.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map(({ owned, species: s, verdict }) => {
            if (!s || !verdict) return null;

            return (
              <div key={owned.id} className="tk-owned">
                <button
                  type="button"
                  className="tk-owned-main"
                  onClick={() => setOpen(s)}
                >
                  <SpeciesTile
                    spriteId={s.spriteId}
                    dex={s.dex}
                    speciesId={s.id}
                    name={s.name}
                    types={s.types}
                    size={48}
                  />
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span style={{ display: "block", font: "700 15px var(--tk-font)" }}>
                      {s.name}
                    </span>
                    <span className="tk-caption" style={{ display: "block" }}>
                      {ivTotalOf(owned.ivs)}/45
                      {owned.cp !== null && ` · PC ${owned.cp.toLocaleString("pt-BR")}`}
                      {owned.level !== null && ` · nível ${owned.level}`}
                    </span>
                  </span>
                  <span
                    style={{
                      font: "700 12px var(--tk-font)",
                      color: TONE[verdict.action],
                      flex: "none",
                    }}
                  >
                    {ACTION_LABELS[verdict.action]}
                  </span>
                </button>
                <button
                  type="button"
                  className="tk-owned-remove"
                  aria-label={`Remover ${s.name}`}
                  onClick={() => void removePokemon(owned.id)}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Backup fica sempre visivel, nao escondido atras de "avancado": e a
          unica coisa que sobrevive se o navegador despejar os dados. */}
      <div className="tk-overline" style={{ display: "block", marginTop: 28 }}>
        Backup
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="tk-btn tk-btn--secondary"
            style={{ flex: 1, height: 44, fontSize: 13 }}
            onClick={() => void download()}
          >
            Exportar
          </button>
          <label
            className="tk-btn tk-btn--secondary"
            style={{ flex: 1, height: 44, fontSize: 13, cursor: "pointer" }}
          >
            Importar
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {message && (
          <p className="tk-caption" style={{ marginTop: 10 }}>
            {message}
          </p>
        )}
      </section>

      <button
        type="button"
        className="tk-fab"
        aria-label="Adicionar Pokémon"
        disabled={!ready}
        onClick={() => setPicking(true)}
      >
        <IconPlus size={26} />
      </button>

      {picking && ready && (
        <SpeciesPicker
          species={species}
          onPick={(s) => {
            setOpen(s);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {open && ready && (
        <SpeciesDetail species={open} data={dataset.data} onClose={() => setOpen(null)} />
      )}
    </>
  );
}
