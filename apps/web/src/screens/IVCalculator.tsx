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
import { useT } from "../i18n/t.ts";
import { useSetup } from "../onboarding/setup.ts";
import { IVBar } from "../ui/IVBar.tsx";
import { addPokemon } from "../storage/collection.ts";
import { AmongYours } from "../ui/AmongYours.tsx";
import { AssistantCard } from "../ui/AssistantCard.tsx";
import { VerdictCard } from "../ui/VerdictCard.tsx";
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
  // Caminho de recuperacao: so aparece depois de o print falhar. Ate la a tela
  // fica no fluxo que o Miguel pediu — anexa e pronto.
  const setup = useSetup();
  const { t, language } = useT();
  const [manual, setManual] = useState(false);
  const [saved, setSaved] = useState(false);
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
        <button type="button" className="tk-sheet-close" onClick={onClose} aria-label={t("common.back")}>
          ‹
        </button>
        <h2 className="tk-sheet-title">{t("iv.title", { name: species.name })}</h2>
        <span className="tk-beta">{t("common.beta")}</span>
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
          <div style={{ minWidth: 0 }}>
            {/*
              A palavra IV, do tamanho que ela merece.

              O numero grande estava sozinho: "22 / 45" nao diz do que e. E IV e
              justamente o termo que o jogador ja conhece de fora do app — nao
              usar a palavra e trocar o nome que ele procura por um numero
              anonimo. Agora e IV primeiro, valor depois.
            */}
            <div className="tk-iv-label">IV</div>
            {/* Numero inteiro: IV e contagem, nao medida. "48,9%" sugere uma
                precisao que nao existe — o que existe sao 22 pontos de 45. */}
            <div className="tk-iv-total">
              {total}
              <span>/ 45</span>
            </div>
            <AmongYours
              species={species}
              ivs={ivs}
              allSpecies={data.species}
              alreadySaved={saved}
            />
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

      <ScanDropzone
        onRead={(read) => {
          setIvs(read);
          setManual(false);
        }}
        onFail={() => {
          setManual(true);
          setIvs((v) => v ?? { atk: 0, def: 0, hp: 0 });
        }}
      />

      {ivs && (
        <>
      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        {manual ? t("iv.enterByHand") : t("iv.whatItRead")}
      </div>
      <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 18 }}>
        <IVBar
          label={t("common.attack")}
          value={ivs.atk}
          {...(manual ? { onChange: (atk: number) => setIvs((v) => ({ ...v!, atk })) } : {})}
        />
        <IVBar
          label={t("common.defense")}
          value={ivs.def}
          {...(manual ? { onChange: (def: number) => setIvs((v) => ({ ...v!, def })) } : {})}
        />
        <IVBar
          label={t("common.stamina")}
          value={ivs.hp}
          {...(manual ? { onChange: (hp: number) => setIvs((v) => ({ ...v!, hp })) } : {})}
        />
      </section>


      <div style={{ marginTop: 20 }}>
        <VerdictCard
          name={species.name}
          baseStats={species.baseStats}
          ivs={ivs}
          level={levels?.[0]?.level ?? 20}
          cpm={data.cpm}
          levelCap={data.version.levelCap}
          evolvesInto={species.evolvesInto}
          candyToEvolve={
            species.evolvesInto[0]
              ? (species.candyToEvolve[species.evolvesInto[0]] ?? null)
              : null
          }
        />
      </div>

      {setup.mode === "colecao" && (
        <button
          type="button"
          className="tk-btn tk-btn--primary tk-btn--block"
          style={{ marginTop: 12 }}
          disabled={saved}
          onClick={() => {
            void addPokemon({
              speciesId: species.id,
              nickname: null,
              ivs,
              level: levels?.[0]?.level ?? null,
              cp: hasNumbers ? cpNum : null,
              hp: hasNumbers ? hpNum : null,
              lucky: false,
              shadow: false,
              doneAction: null,
            }).then(() => setSaved(true));
          }}
        >
          {saved ? t("iv.savedToCollection") : t("iv.saveToCollection")}
        </button>
      )}

      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        {t("iv.findLevel")}{" "}
        <span style={{ textTransform: "none" }}>{t("common.optional")}</span>
      </div>
      <section className="tk-card" style={{ marginTop: 10, display: "flex", gap: 12 }}>
        <label className="tk-field">
          <span className="tk-caption">{t("common.cp")}</span>
          <div className="tk-search">
            <input
              type="number"
              inputMode="numeric"
              placeholder="3566"
              value={cp}
              onChange={(e) => setCp(e.target.value)}
              aria-label={t("common.cp")}
            />
          </div>
        </label>
        <label className="tk-field">
          <span className="tk-caption">{t("common.stamina")}</span>
          <div className="tk-search">
            <input
              type="number"
              inputMode="numeric"
              placeholder="172"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              aria-label={t("common.stamina")}
            />
          </div>
        </label>
      </section>

      {levels && (
        <div style={{ marginTop: 10 }}>
          {levels.length === 0 ? (
            <div className="tk-banner tk-banner--warn" role="alert">
              <div className="tk-banner-text">
                <div className="tk-banner-title">{t("iv.impossible.title")}</div>
                <p className="tk-banner-body">
                  {t("iv.impossible.body", {
                    cp: cpNum.toLocaleString(language),
                    hp: hpNum,
                    name: species.name,
                  })}
                </p>
              </div>
            </div>
          ) : (
            <section className="tk-card">
              <div className="tk-row">
                <span className="tk-row-label">{t("iv.levelIs")}</span>
                <span className="tk-row-value">
                  {levels.map((l) => l.level).join(` ${t("iv.or")} `)}
                </span>
              </div>
              <div className="tk-row">
                <span className="tk-row-label">{t("iv.cpAt40")}</span>
                <span className="tk-row-value">
                  {computeCPAtLevel(data.cpm, species.baseStats, ivs, 40).toLocaleString(language)}
                </span>
              </div>
              <div className="tk-row">
                <span className="tk-row-label">
                  {t("iv.cpAtCap", { level: data.version.levelCap })}
                </span>
                <span className="tk-row-value">
                  {computeCPAtLevel(
                    data.cpm,
                    species.baseStats,
                    ivs,
                    data.version.levelCap,
                  ).toLocaleString(language)}
                </span>
              </div>
            </section>
          )}
        </div>
      )}

      {setup.assistant && (
        <AssistantCard
          name={species.name}
          baseStats={species.baseStats}
          cpm={data.cpm}
          levelCap={data.version.levelCap}
          ivs={ivs}
        />
      )}

      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        {t("iv.pvpPosition")}
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        {ranks?.map(({ league, ranked }) => (
          <div className="tk-row" key={league.id}>
            <span className="tk-row-label">{league.name}</span>
            <span className="tk-row-value">
              {ranked
                ? `#${ranked.rank.toLocaleString(language)} · ${(ranked.percent * 100).toFixed(1)}%`
                : t("iv.notEligible")}
            </span>
          </div>
        ))}
      </section>

      {/*
        Sair pelo fim da pagina.

        O unico jeito de fechar era o "‹" la em cima. Depois de ler o veredito,
        as ligas e o nivel, voltar exigia rolar a tela inteira de novo — e uma
        tela longa que so tem saida no topo prende quem chegou ate o fim, que e
        justamente quem leu tudo.

        Fica DENTRO do bloco que so existe com IV lido: sem print a tela cabe
        inteira, o "‹" esta a um dedo de distancia, e um segundo botao de
        fechar seria so mais uma coisa pra ler.
      */}
      <button
        type="button"
        className="tk-btn tk-btn--secondary tk-btn--block"
        style={{ marginTop: 28 }}
        onClick={onClose}
      >
        {t("common.done")}
      </button>
        </>
      )}
    </div>,
    document.body,
  );
}
