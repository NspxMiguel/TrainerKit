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
  const [ivs, setIvs] = useState<IVs>({ atk: 15, def: 15, hp: 15 });
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

  const total = ivTotalOf(ivs);
  const percent = ivPercentOf(ivs);
  const badge = badgeFor(total);

  const cpNum = Number(cp);
  const hpNum = Number(hp);
  const hasNumbers =
    Number.isInteger(cpNum) && cpNum >= 10 && Number.isInteger(hpNum) && hpNum >= 10;

  // As barras dao o IV; PC e PS servem so pra descobrir o NIVEL, que a
  // avaliacao nao mostra.
  const levels = useMemo(() => {
    if (!hasNumbers) return null;
    return solveLevel(data.cpm, species.baseStats, ivs, { cp: cpNum, hp: hpNum });
  }, [hasNumbers, cpNum, hpNum, ivs, data.cpm, species.baseStats]);

  const ranks = useMemo(
    () =>
      LEAGUES.map((league) => ({
        league,
        ranked: rankOf(data.cpm, species.baseStats, ivs, league),
      })),
    [ivs, data.cpm, species.baseStats],
  );

  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label="Calcular IV">
      <header className="tk-sheet-head">
        <button type="button" className="tk-sheet-close" onClick={onClose} aria-label="Voltar">
          ‹
        </button>
        <h2 className="tk-sheet-title">IV do meu {species.name}</h2>
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
        <div>
          <div style={{ font: "800 34px/1.05 var(--tk-font)", letterSpacing: "-0.03em" }}>
            {percent.toFixed(1)}%
          </div>
          <div className="tk-caption">
            {total} de 45 ·{" "}
            <span style={badge.pink ? { color: "var(--tk-dang)" } : undefined}>
              {"★".repeat(badge.litStars)}
              {"☆".repeat(3 - badge.litStars)}
            </span>
          </div>
        </div>
      </div>

      <ScanDropzone onRead={setIvs} />

      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        Ou copie as barras à mão
      </div>
      <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 18 }}>
        <IVBar label="Ataque" value={ivs.atk} onChange={(atk) => setIvs((v) => ({ ...v, atk }))} />
        <IVBar label="Defesa" value={ivs.def} onChange={(def) => setIvs((v) => ({ ...v, def }))} />
        <IVBar label="PS" value={ivs.hp} onChange={(hp) => setIvs((v) => ({ ...v, hp }))} />
      </section>

      <p className="tk-caption" style={{ margin: "10px 2px 0", lineHeight: 1.5 }}>
        Cada barra tem 3 blocos de 5 pontos e anda de 1 em 1, e fica vermelha
        quando o stat é 15. Confira as estrelas acima contra as do jogo — é a
        forma mais rápida de perceber uma barra lida errado.
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
          Em liga com teto de PC o 100% costuma ser <em>pior</em>: ataque alto infla o PC e
          obriga a parar num nível mais baixo, custando defesa e PS. É por isso que a
          posição importa mais que a porcentagem.
        </p>
      </section>
    </div>,
    document.body,
  );
}
