import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  GREAT_LEAGUE,
  MASTER_LEAGUE,
  ULTRA_LEAGUE,
  computeCPAtLevel,
  ivPercentOf,
  ivTotalOf,
  rankOf,
  solveLevel,
  badgeFor,
  type IVs,
} from "@trainerkit/core";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { IVBar } from "../ui/IVBar.tsx";
import { ScanDropzone } from "../ui/ScanDropzone.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";

interface Props {
  species: DatasetSpecies;
  data: Dataset;
  onClose: () => void;
}

const LEAGUES = [GREAT_LEAGUE, ULTRA_LEAGUE, MASTER_LEAGUE];

export function IVCalculator({ species, data, onClose }: Props) {
  // `null` ate o print ser lido: sem print nao ha o que mostrar.
  const [ivs, setIvs] = useState<IVs | null>(null);
  const [cp, setCp] = useState("");
  const [hp, setHp] = useState("");

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
  const hasNumbers =
    Number.isInteger(cpNum) && cpNum >= 10 && Number.isInteger(hpNum) && hpNum >= 10;

  // As barras dao o IV; PC e PS servem so pra descobrir o NIVEL, que a
  // avaliacao nao mostra.
  const levels = useMemo(() => {
    if (!ivs || !hasNumbers) return null;
    return solveLevel(data.cpm, species.baseStats, ivs, { cp: cpNum, hp: hpNum });
  }, [ivs, hasNumbers, cpNum, hpNum, data.cpm, species.baseStats]);

  const ranks = useMemo(() => {
    if (!ivs) return null;
    return LEAGUES.map((league) => ({
      league,
      ranked: rankOf(data.cpm, species.baseStats, ivs, league),
    }));
  }, [ivs, data.cpm, species.baseStats]);

  const total = ivs ? ivTotalOf(ivs) : 0;
  const badge = ivs ? badgeFor(total) : null;

  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label="Calcular IV">
      <header className="tk-sheet-head">
        <button type="button" className="tk-sheet-close" onClick={onClose} aria-label="Voltar">
          ‹
        </button>
        <h2 className="tk-sheet-title">IV do meu {species.name}</h2>
        <span className="tk-beta">BETA</span>
      </header>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
        <SpeciesTile
          spriteId={species.spriteId}
          dex={species.dex}
          speciesId={species.id}
          name={species.name}
          types={species.types}
          size={72}
        />
        {ivs && badge ? (
          <div>
            {/* Numero inteiro: IV e contagem, nao medida. "48,9%" sugere uma
                precisao que nao existe — o que existe sao 22 pontos de 45. */}
            <div style={{ font: "800 34px/1.05 var(--tk-font)", letterSpacing: "-0.03em" }}>
              {total}
              <span style={{ font: "700 20px var(--tk-font)", color: "var(--tk-txt3)" }}>
                {" "}/ 45
              </span>
            </div>
            <div className="tk-caption">
              {Math.round(ivPercentOf(ivs))}% ·{" "}
              <span style={badge.pink ? { color: "var(--tk-dang)" } : undefined}>
                {"★".repeat(badge.litStars)}
                {"☆".repeat(3 - badge.litStars)}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ font: "700 17px var(--tk-font)" }}>{species.name}</div>
            <div className="tk-caption">#{String(species.dex).padStart(3, "0")}</div>
          </div>
        )}
      </div>

      <ScanDropzone onRead={setIvs} />

      {ivs && (
        <>
      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        O que ele leu
      </div>
      <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 18 }}>
        <IVBar label="Ataque" value={ivs.atk} />
        <IVBar label="Defesa" value={ivs.def} />
        <IVBar label="PS" value={ivs.hp} />
      </section>

      <p className="tk-caption" style={{ margin: "10px 2px 0", lineHeight: 1.5 }}>
        Confira as estrelas acima contra as do jogo — é a forma mais rápida de
        perceber uma leitura errada.
      </p>

      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        Descobrir o nível <span style={{ textTransform: "none" }}>(opcional)</span>
      </div>
      <section className="tk-card" style={{ marginTop: 10, display: "flex", gap: 12 }}>
        <label className="tk-field">
          <span className="tk-caption">PC</span>
          <div className="tk-search">
            <input
              type="number"
              inputMode="numeric"
              placeholder="3566"
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
              placeholder="172"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              aria-label="PS"
            />
          </div>
        </label>
      </section>

      {levels && (
        <div style={{ marginTop: 10 }}>
          {levels.length === 0 ? (
            <div className="tk-banner tk-banner--warn" role="alert">
              <div className="tk-banner-text">
                <div className="tk-banner-title">Esses números não fecham</div>
                <p className="tk-banner-body">
                  Nenhum nível dá PC {cpNum} com PS {hpNum} para um {species.name} com
                  esses IV. Confira as barras, os números — ou se é essa espécie mesmo.
                </p>
              </div>
            </div>
          ) : (
            <section className="tk-card">
              <div className="tk-row">
                <span className="tk-row-label">Nível</span>
                <span className="tk-row-value">
                  {levels.map((l) => l.level).join(" ou ")}
                </span>
              </div>
              <div className="tk-row">
                <span className="tk-row-label">PC no nível 40 com esses IV</span>
                <span className="tk-row-value">
                  {computeCPAtLevel(data.cpm, species.baseStats, ivs, 40).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="tk-row">
                <span className="tk-row-label">PC no nível {data.version.levelCap}</span>
                <span className="tk-row-value">
                  {computeCPAtLevel(
                    data.cpm,
                    species.baseStats,
                    ivs,
                    data.version.levelCap,
                  ).toLocaleString("pt-BR")}
                </span>
              </div>
            </section>
          )}
        </div>
      )}

      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        Posição em PvP
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        {ranks?.map(({ league, ranked }) => (
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
          Em liga com teto de PC o 100% costuma ser <em>pior</em>: ataque alto infla o PC e
          obriga a parar num nível mais baixo, custando defesa e PS. É por isso que a
          posição importa mais que a porcentagem.
        </p>
      </section>
        </>
      )}
    </div>,
    document.body,
  );
}
