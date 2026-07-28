import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  EMPTY_APPRAISAL,
  GREAT_LEAGUE,
  MASTER_LEAGUE,
  MAX_STAT_RANGES,
  STAR_RANGES,
  ULTRA_LEAGUE,
  rankOf,
  solveIVs,
  summarize,
  toRange,
  type AppraisalInput,
  type StatKey,
} from "@trainerkit/core";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";

interface Props {
  species: DatasetSpecies;
  data: Dataset;
  onClose: () => void;
}

const STAT_LABELS: Record<StatKey, string> = {
  atk: "Ataque",
  def: "Defesa",
  hp: "PS",
};

const LEAGUES = [GREAT_LEAGUE, ULTRA_LEAGUE, MASTER_LEAGUE];

export function IVCalculator({ species, data, onClose }: Props) {
  const [cp, setCp] = useState("");
  const [hp, setHp] = useState("");
  const [appraisal, setAppraisal] = useState<AppraisalInput>(EMPTY_APPRAISAL);

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

  const cpNum = Number(cp);
  const hpNum = Number(hp);
  const ready = Number.isInteger(cpNum) && cpNum >= 10 && Number.isInteger(hpNum) && hpNum >= 10;

  const result = useMemo(() => {
    if (!ready) return null;
    return summarize(
      solveIVs(
        {
          base: species.baseStats,
          cp: cpNum,
          hp: hpNum,
          ...(toRange(appraisal) ? { appraisal: toRange(appraisal)! } : {}),
        },
        data.cpm,
      ),
    );
  }, [ready, cpNum, hpNum, appraisal, species.baseStats, data.cpm]);

  // Ranking de liga so faz sentido quando o IV ficou exato — com varias
  // combinacoes possiveis, mostrar UM rank seria escolher um palpite e
  // apresenta-lo como fato.
  const ranks = useMemo(() => {
    if (!result?.exact) return null;
    return LEAGUES.map((league) => ({
      league,
      ranked: rankOf(data.cpm, species.baseStats, result.exact!.ivs, league),
    }));
  }, [result, data.cpm, species.baseStats]);

  const toggleStat = (stat: StatKey) => {
    setAppraisal((a) => ({
      ...a,
      bestStats: a.bestStats.includes(stat)
        ? a.bestStats.filter((s) => s !== stat)
        : [...a.bestStats, stat],
    }));
  };

  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label="Calcular IV">
      <header className="tk-sheet-head">
        <button type="button" className="tk-sheet-close" onClick={onClose} aria-label="Voltar">
          ‹
        </button>
        <h2 className="tk-sheet-title">Calcular IV</h2>
      </header>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 22 }}>
        <SpeciesTile
          spriteId={species.spriteId}
          dex={species.dex}
          name={species.name}
          types={species.types}
          size={64}
        />
        <div>
          <div style={{ font: "700 17px var(--tk-font)" }}>{species.name}</div>
          <div className="tk-caption">#{String(species.dex).padStart(3, "0")}</div>
        </div>
      </div>

      <div className="tk-overline">O que aparece na tela do Pokémon</div>
      <section className="tk-card" style={{ marginTop: 10, display: "flex", gap: 12 }}>
        <label className="tk-field">
          <span className="tk-caption">PC</span>
          <div className="tk-search">
            <input
              type="number"
              inputMode="numeric"
              placeholder="2841"
              value={cp}
              onChange={(e) => setCp(e.target.value)}
              aria-label="PC"
            />
          </div>
        </label>
        <label className="tk-field">
          <span className="tk-caption">PS</span>
          <div className="tk-search">
            <input
              type="number"
              inputMode="numeric"
              placeholder="143"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              aria-label="PS"
            />
          </div>
        </label>
      </section>

      <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
        Avaliação do líder <span style={{ textTransform: "none" }}>(opcional)</span>
      </div>
      <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 14 }}>
        <div>
          <div className="tk-caption" style={{ marginBottom: 8 }}>
            Quantas estrelas
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STAR_RANGES.map((r) => (
              <button
                key={r.stars}
                type="button"
                className={`tk-btn ${appraisal.stars === r.stars ? "tk-btn--primary" : "tk-btn--secondary"}`}
                style={{ height: 40, fontSize: 13, padding: "0 12px" }}
                aria-pressed={appraisal.stars === r.stars}
                onClick={() =>
                  setAppraisal((a) => ({ ...a, stars: a.stars === r.stars ? null : r.stars }))
                }
              >
                {"★".repeat(r.stars)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="tk-caption" style={{ marginBottom: 8 }}>
            Quais stats o líder destacou
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["atk", "def", "hp"] as const).map((stat) => (
              <button
                key={stat}
                type="button"
                className={`tk-btn ${appraisal.bestStats.includes(stat) ? "tk-btn--primary" : "tk-btn--secondary"}`}
                style={{ flex: 1, height: 40, fontSize: 13, padding: 0 }}
                aria-pressed={appraisal.bestStats.includes(stat)}
                onClick={() => toggleStat(stat)}
              >
                {STAT_LABELS[stat]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="tk-caption" style={{ marginBottom: 8 }}>
            Como ele descreveu o maior stat
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {MAX_STAT_RANGES.map((r, i) => (
              <button
                key={r.label}
                type="button"
                className={`tk-btn ${appraisal.maxStatTier === i ? "tk-btn--primary" : "tk-btn--secondary"}`}
                style={{ height: 40, fontSize: 13, padding: "0 12px", justifyContent: "flex-start" }}
                aria-pressed={appraisal.maxStatTier === i}
                onClick={() =>
                  setAppraisal((a) => ({ ...a, maxStatTier: a.maxStatTier === i ? null : i }))
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {result && (
        <>
          <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
            Resultado
          </div>

          {result.impossible ? (
            <div className="tk-banner tk-banner--warn" style={{ marginTop: 10 }} role="alert">
              <div className="tk-banner-text">
                <div className="tk-banner-title">Esses números não existem juntos</div>
                <p className="tk-banner-body">
                  Nenhuma combinação de nível e IV dá PC {cpNum} com PS {hpNum} para{" "}
                  {species.name}. Confira se leu certo — ou se a avaliação marcada bate
                  mesmo com a do jogo.
                </p>
              </div>
            </div>
          ) : (
            <section className="tk-card" style={{ marginTop: 10 }}>
              {result.exact ? (
                <>
                  <div style={{ font: "800 34px/1.05 var(--tk-font)", letterSpacing: "-0.03em" }}>
                    {result.exact.percent.toFixed(1)}%
                  </div>
                  <div className="tk-caption" style={{ marginTop: 4 }}>
                    Ataque {result.exact.ivs.atk} · Defesa {result.exact.ivs.def} · PS{" "}
                    {result.exact.ivs.hp} · nível {result.exact.level}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ font: "800 28px/1.05 var(--tk-font)", letterSpacing: "-0.03em" }}>
                    {result.percentMin.toFixed(1)}% – {result.percentMax.toFixed(1)}%
                  </div>
                  <div className="tk-caption" style={{ marginTop: 4 }}>
                    {result.candidates.length} combinações possíveis. Marque a avaliação do
                    líder acima para estreitar.
                  </div>
                </>
              )}
            </section>
          )}

          {ranks && (
            <>
              <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
                Posição em PvP
              </div>
              <section className="tk-card" style={{ marginTop: 10 }}>
                {ranks.map(({ league, ranked }) => (
                  <div className="tk-row" key={league.id}>
                    <span className="tk-row-label">{league.name}</span>
                    <span className="tk-row-value">
                      {ranked
                        ? `#${ranked.rank.toLocaleString("pt-BR")} · ${(ranked.percent * 100).toFixed(1)}%`
                        : "não entra"}
                    </span>
                  </div>
                ))}
                <p className="tk-caption" style={{ marginTop: 12, lineHeight: 1.5 }}>
                  Em liga com teto de PC, o 100% costuma ser pior: ataque alto infla o PC e
                  obriga a parar num nível mais baixo, custando defesa e PS. Por isso a
                  posição importa mais que a porcentagem.
                </p>
              </section>
            </>
          )}
        </>
      )}

      <p className="tk-caption" style={{ marginTop: 22, lineHeight: 1.5 }}>
        As faixas da avaliação não vêm dos dados do jogo — são conhecidas só por
        engenharia reversa da comunidade. Se algum resultado divergir de um Pokémon
        seu que você já conhece, é aí que vale desconfiar.
      </p>
    </div>,
    document.body,
  );
}
