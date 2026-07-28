import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  CONTEXT_LABELS,
  computeCPAtLevel,
  rankMovesets,
  type Context,
  type MoveWithPvp,
} from "@trainerkit/core";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { useSetup } from "../onboarding/setup.ts";
import { typeColor, typeName } from "../sprites/provider.ts";
import { AssistantCard } from "../ui/AssistantCard.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { IVCalculator } from "./IVCalculator.tsx";

interface Props {
  species: DatasetSpecies;
  data: Dataset;
  onClose: () => void;
}

const PERFECT = { atk: 15, def: 15, hp: 15 };

/**
 * O maior stat base que existe no jogo, usado para escalar as barras.
 * Fixo de proposito: se fosse relativo a especie exibida, toda especie
 * pareceria igualmente forte.
 */
const STAT_SCALE = 300;

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 58, font: "500 12px var(--tk-font)", color: "var(--tk-txt3)" }}>
        {label}
      </span>
      <span style={{ width: 34, font: "700 13px var(--tk-mono)" }}>{value}</span>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: "var(--tk-surf2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(100, (value / STAT_SCALE) * 100)}%`,
            height: "100%",
            background: "var(--tk-pri)",
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
}

export function SpeciesDetail({ species, data, onClose }: Props) {
  const [calcOpen, setCalcOpen] = useState(false);
  const [context, setContext] = useState<Context>("general");
  const setup = useSetup();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cpAt = (level: number) =>
    computeCPAtLevel(data.cpm, species.baseStats, PERFECT, level);

  const moveName = (id: string): string =>
    data.fastMoves.find((m) => m.id === id)?.name ??
    data.chargedMoves.find((m) => m.id === id)?.name ??
    id;

  const moveById = (id: string): MoveWithPvp | null => {
    const fast = data.fastMoves.find((m) => m.id === id);
    if (fast) return fast as MoveWithPvp;
    const charged = data.chargedMoves.find((m) => m.id === id);
    return charged ? (charged as MoveWithPvp) : null;
  };

  const collect = (ids: string[], elite: string[]): MoveWithPvp[] =>
    [
      ...ids.map((id) => moveById(id)),
      ...elite.map((id) => {
        const m = moveById(id);
        return m ? { ...m, elite: true } : null;
      }),
    ].filter((m): m is MoveWithPvp => m !== null);

  const movesets = rankMovesets(
    collect(species.fastMoves, species.eliteFastMoves),
    collect(species.chargedMoves, species.eliteChargedMoves),
    context,
    {
      attackerTypes: species.types,
      chart: data.typeChart,
      order: data.typeOrder,
      stabMultiplier: 1.2,
    },
  );

  const evolutions = species.evolvesInto
    .map((id) => data.species.find((s) => s.id === id))
    .filter((s): s is DatasetSpecies => s !== undefined);

  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label={species.name}>
      <header className="tk-sheet-head">
        <button type="button" className="tk-sheet-close" onClick={onClose} aria-label="Voltar">
          ‹
        </button>
        <h2 className="tk-sheet-title">{species.name}</h2>
      </header>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 22 }}>
        <SpeciesTile
          spriteId={species.spriteId}
          dex={species.dex}
          speciesId={species.id}
          name={species.name}
          types={species.types}
          size={116}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tk-species-dex" style={{ marginBottom: 8 }}>
            #{String(species.dex).padStart(3, "0")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {species.types.map((t) => (
              <span
                key={t}
                style={{
                  font: "700 11px var(--tk-font)",
                  padding: "5px 10px",
                  borderRadius: "var(--tk-r-chip)",
                  background: typeColor(t),
                  color: "#fff",
                }}
              >
                {typeName(t)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="tk-btn tk-btn--primary tk-btn--block"
        style={{ marginBottom: 22 }}
        onClick={() => setCalcOpen(true)}
      >
        Calcular IV do meu
      </button>

      {setup.assistant && (
        <AssistantCard
          name={species.name}
          baseStats={species.baseStats}
          cpm={data.cpm}
          levelCap={data.version.levelCap}
        />
      )}

      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        Stats base
      </div>
      <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <StatBar label="Ataque" value={species.baseStats.atk} />
        <StatBar label="Defesa" value={species.baseStats.def} />
        <StatBar label="PS" value={species.baseStats.hp} />
      </section>

      <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
        PC máximo com IV perfeito
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 24 }}>
          {[40, 50, data.version.levelCap].map((level) => (
            <div key={level}>
              <div style={{ font: "800 22px/1.1 var(--tk-font)", letterSpacing: "-0.02em" }}>
                {cpAt(level).toLocaleString("pt-BR")}
              </div>
              <div className="tk-caption">nível {level}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
        Melhores ataques
      </div>

      <div style={{ display: "flex", gap: 6, margin: "10px 0" }}>
        {(["general", "raid", "pvp"] as const).map((c) => (
          <button
            key={c}
            type="button"
            className={`tk-btn ${context === c ? "tk-btn--primary" : "tk-btn--secondary"}`}
            style={{ flex: 1, height: 40, fontSize: 13, padding: 0 }}
            aria-pressed={context === c}
            onClick={() => setContext(c)}
          >
            {CONTEXT_LABELS[c].title}
          </button>
        ))}
      </div>

      <p className="tk-caption" style={{ margin: "0 2px 10px", lineHeight: 1.45 }}>
        {CONTEXT_LABELS[context].detail}
      </p>

      <section className="tk-card">
        {movesets.length === 0 ? (
          <p className="tk-body">Sem dados de ataque para esta espécie.</p>
        ) : (
          movesets.slice(0, 5).map((m, i) => (
            <div className="tk-row" key={`${m.fast.id}/${m.charged.id}`}>
              <span
                className="tk-row-label"
                style={i === 0 ? { fontWeight: 700 } : undefined}
              >
                {m.fast.name} + {m.charged.name}
                {m.needsElite && (
                  <span className="tk-caption" style={{ display: "block" }}>
                    exige TM Elite
                  </span>
                )}
              </span>
              <span
                className="tk-row-value"
                style={i === 0 ? { color: "var(--tk-succ)", fontWeight: 700 } : undefined}
              >
                {Math.round(m.score * 100)}
              </span>
            </div>
          ))
        )}
        <p className="tk-caption" style={{ marginTop: 12, lineHeight: 1.5 }}>
          A nota compara os movesets DESTE Pokémon entre si — 100 é o melhor dele,
          não o melhor do jogo.
        </p>
      </section>

      {evolutions.length > 0 && (
        <>
          <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
            Evolui para
          </div>
          <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 12 }}>
            {evolutions.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <SpeciesTile
                  spriteId={e.spriteId}
                  dex={e.dex}
                  speciesId={e.id}
                  name={e.name}
                  types={e.types}
                  size={44}
                />
                <span className="tk-row-label">{e.name}</span>
                {species.candyToEvolve[e.id] !== undefined && (
                  <span className="tk-row-value">{species.candyToEvolve[e.id]} doces</span>
                )}
              </div>
            ))}
          </section>
        </>
      )}

      <p className="tk-caption" style={{ marginTop: 22, lineHeight: 1.5 }}>
        O ranking de melhor moveset por contexto — PvP, raide, uso geral — entra
        numa próxima versão. Por enquanto os ataques aparecem só listados.
      </p>
      {calcOpen && (
        <IVCalculator species={species} data={data} onClose={() => setCalcOpen(false)} />
      )}
    </div>,
    document.body,
  );
}
