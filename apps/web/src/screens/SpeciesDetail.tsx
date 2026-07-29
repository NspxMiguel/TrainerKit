import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  CONTEXT_KEYS,
  GREAT_LEAGUE,
  MASTER_LEAGUE,
  ULTRA_LEAGUE,
  computeCPAtLevel,
  rankMovesets,
  shadowDamageMultiplier,
  topSpreads,
  withFrustration,
  type Context,
  type League,
  type MoveWithPvp,
} from "@trainerkit/core";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { moveLabel, useLanguage, useShowTranslation } from "../i18n/language.ts";
import { useT, type Key } from "../i18n/t.ts";
import { useSetup } from "../onboarding/setup.ts";
import { typeColor, typeKey } from "../sprites/provider.ts";
import { AssistantCard } from "../ui/AssistantCard.tsx";
import { IconSwords } from "../ui/Icons.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { IVCalculator } from "./IVCalculator.tsx";
import { RaidCounters } from "./RaidCounters.tsx";

interface Props {
  species: DatasetSpecies;
  data: Dataset;
  onClose: () => void;
}

const PERFECT = { atk: 15, def: 15, hp: 15 };

const LEAGUES: readonly League[] = [GREAT_LEAGUE, ULTRA_LEAGUE, MASTER_LEAGUE];

/** Quantas linhas do topo mostrar. Dez cabe na tela e ja basta pra caçar. */
const TOP_SPREADS = 10;

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
  const [raidOpen, setRaidOpen] = useState(false);
  const [context, setContext] = useState<Context>("general");
  const [shadow, setShadow] = useState(false);
  const [league, setLeague] = useState<League>(GREAT_LEAGUE);
  const setup = useSetup();
  const language = useLanguage();
  const { t } = useT();
  useShowTranslation(); // re-renderiza ao ligar/desligar a traducao

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

  // Sombroso nao aprende nada a mais — ele PERDE um slot para a Frustracao, que
  // TM comum nao remove. Por isso o modo sombroso injeta o golpe em vez de so
  // aplicar um multiplicador: e a Frustracao que muda a recomendacao.
  const frustration = moveById("frustration");
  const chargedPool = collect(species.chargedMoves, species.eliteChargedMoves);
  const movesets = rankMovesets(
    collect(species.fastMoves, species.eliteFastMoves),
    shadow ? withFrustration(chargedPool, frustration) : chargedPool,
    context,
    {
      attackerTypes: species.types,
      chart: data.typeChart,
      order: data.typeOrder,
      stabMultiplier: 1.2,
    },
  );

  // Quanto custa continuar com a Frustracao.
  //
  // A conta e "e se ela fosse o UNICO carregado" — que e o estado em que o
  // sombroso sai da luta contra a Rocket, antes de o jogador pagar o segundo
  // slot de golpe. Medir contra a lista completa dava um numero pequeno e
  // enganoso: com dois slots, a Frustracao vira so uma isca ruim, e o app
  // diria que ela quase nao atrapalha. Atrapalha, e muito, no caso comum.
  //
  // Medido sempre em PvP, mesmo quando outro contexto esta selecionado: e onde
  // a Frustracao doi mais e onde o numero e mais facil de ler. As duas notas
  // saem da MESMA lista de propósito — `rankMovesets` normaliza pela melhor de
  // cada chamada, entao notas de listas diferentes nao se comparam.
  const custoDaFrustracao = (() => {
    if (!shadow || !frustration) return null;

    const juntos = rankMovesets(
      collect(species.fastMoves, species.eliteFastMoves),
      withFrustration(chargedPool, frustration),
      "pvp",
      {
        attackerTypes: species.types,
        chart: data.typeChart,
        order: data.typeOrder,
        stabMultiplier: 1.2,
      },
    );

    const livre = juntos.find((m) => !m.isFrustration);
    const presa = juntos.find((m) => m.isFrustration);
    if (!livre || !presa) return null;
    return Math.round((1 - presa.score / livre.score) * 100);
  })();

  // Ranquear 4.096 combinacoes nao e barato; sem memo isso rodaria de novo a
  // cada clique no seletor de moveset, que nao tem nada a ver com a liga.
  // Ranquear 4.096 combinacoes nao e barato; sem memo isso rodaria de novo a
  // cada clique no seletor de moveset, que nao tem nada a ver com a liga.
  const spreads = useMemo(
    () => topSpreads(data.cpm, species.baseStats, league, TOP_SPREADS),
    [data.cpm, species.baseStats, league],
  );

  // A especie nem encosta no teto da liga: todo mundo sobe ate o nivel maximo e
  // o teto de PC nao restringe nada. Muda o que ha para explicar embaixo.
  const semTeto =
    league.cpCap !== null && (spreads[0]?.level ?? 0) >= data.version.levelCap;

  const evolutions = species.evolvesInto
    .map((id) => data.species.find((s) => s.id === id))
    .filter((s): s is DatasetSpecies => s !== undefined);

  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label={species.name}>
      <header className="tk-sheet-head">
        <button type="button" className="tk-sheet-close" onClick={onClose} aria-label={t("common.back")}>
          ‹
        </button>
        <h2 className="tk-sheet-title">{t("pokedex.title")}</h2>
      </header>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 22 }}>
        <SpeciesTile
          spriteId={species.spriteId}
          dex={species.dex}
          speciesId={species.id}
          name={species.name}
          types={species.types}
          size={116}
        />
        {/* O nome vive aqui, ao lado do sprite — nao so no cabecalho.
            Antes ficava um bloco vazio neste ponto porque a dex e os tipos
            comecavam alinhados ao topo, e o olho procurava o nome no vazio. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "800 22px/1.15 var(--tk-font)", letterSpacing: "-0.02em" }}>
            {species.name}
          </div>
          <div className="tk-species-dex" style={{ margin: "4px 0 10px" }}>
            #{String(species.dex).padStart(3, "0")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {species.types.map((tp) => (
              <span
                key={tp}
                style={{
                  font: "700 11px var(--tk-font)",
                  padding: "5px 10px",
                  borderRadius: "var(--tk-r-chip)",
                  background: typeColor(tp),
                  color: "#fff",
                }}
              >
                {t(typeKey(tp) as "type.normal")}
              </span>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="tk-btn tk-btn--primary tk-btn--block"
        onClick={() => setCalcOpen(true)}
      >
        {t("species.calcIV")}
      </button>

      {/* A outra pergunta que se faz olhando uma especie: "consigo derrubar
          esse numa raide?". A resposta sai da colecao, nao de uma lista fixa. */}
      <button
        type="button"
        className="tk-quick"
        style={{ marginTop: 10, marginBottom: 22 }}
        onClick={() => setRaidOpen(true)}
      >
        <span className="tk-quick-mark" aria-hidden="true">
          <IconSwords size={22} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="tk-quick-title">{t("raid.open")}</span>
          <span className="tk-quick-detail">{t("raid.openDetail")}</span>
        </span>
        <span className="tk-quick-go" aria-hidden="true">
          ›
        </span>
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
        {t("species.baseStats")}
      </div>
      <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <StatBar label={t("common.attack")} value={species.baseStats.atk} />
        <StatBar label={t("common.defense")} value={species.baseStats.def} />
        <StatBar label={t("common.stamina")} value={species.baseStats.hp} />
      </section>

      <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
        {t("species.maxCP")}
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 24 }}>
          {[40, 50, data.version.levelCap].map((level) => (
            <div key={level}>
              <div style={{ font: "800 22px/1.1 var(--tk-font)", letterSpacing: "-0.02em" }}>
                {cpAt(level).toLocaleString(language)}
              </div>
              <div className="tk-caption">{t("common.level")} {level}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
        {t("species.bestMoves")}
      </div>

      <div style={{ display: "flex", gap: 6, margin: "10px 0" }}>
        {(["general", "raid", "pvp", "rocket"] as const).map((c) => (
          <button
            key={c}
            type="button"
            className={`tk-btn ${context === c ? "tk-btn--primary" : "tk-btn--secondary"}`}
            style={{ flex: 1, height: 40, fontSize: 12, padding: 0 }}
            aria-pressed={context === c}
            onClick={() => setContext(c)}
          >
            {t(CONTEXT_KEYS[c].title as Key)}
          </button>
        ))}
      </div>

      <p className="tk-caption" style={{ margin: "0 2px 10px", lineHeight: 1.45 }}>
        {t(CONTEXT_KEYS[context].detail as Key)}
      </p>

      {/* Chip, nao botao de bloco: o sombroso e um filtro do que esta abaixo,
          nao a acao principal da tela — quem compete por essa atencao e o
          "Calcular IV do meu" la em cima. */}
      <button
        type="button"
        className={`tk-btn ${shadow ? "tk-btn--primary" : "tk-btn--secondary"}`}
        style={{ height: 34, fontSize: 12, padding: "0 14px", marginBottom: 10 }}
        aria-pressed={shadow}
        onClick={() => setShadow((v) => !v)}
      >
        {shadow ? t("species.shadowToggleOn") : t("species.shadowToggle")}
      </button>

      {shadow && (
        <p className="tk-caption" style={{ margin: "0 2px 10px", lineHeight: 1.45 }}>
          {t("species.shadowNote", {
            percent: Math.round((shadowDamageMultiplier(data.settings.battle) - 1) * 100),
          })}
          {custoDaFrustracao !== null &&
            t("species.frustrationCost", { percent: custoDaFrustracao })}
        </p>
      )}

      <section className="tk-card">
        {movesets.length === 0 ? (
          <p className="tk-body">{t("species.noMoves")}</p>
        ) : (
          movesets.slice(0, 5).map((m, i) => (
            <div
              className="tk-row"
              key={`${m.fast.id}/${m.charged.id}/${m.bait?.id ?? ""}`}
            >
              <span
                className="tk-row-label"
                style={i === 0 ? { fontWeight: 700 } : undefined}
              >
                {[m.fast, m.charged].map((mv, k) => {
                  const l = moveLabel(mv.name, data.moveNames, mv.id, language);
                  return (
                    <span key={mv.id}>
                      {k > 0 && " + "}
                      {l.primary}
                      {l.secondary && (
                        <span className="tk-caption"> ({l.secondary})</span>
                      )}
                    </span>
                  );
                })}
                {/* A isca e conselho, nao enfeite: e o segundo carregado, que
                    custa doce e poeira. Dizer qual e faz parte da resposta. */}
                {m.bait && (
                  <span className="tk-caption" style={{ display: "block" }}>
                    {t("species.bait", { move: moveLabel(m.bait.name, data.moveNames, m.bait.id, language).primary })}
                  </span>
                )}
                {m.isFrustration && (
                  <span
                    className="tk-caption"
                    style={{ display: "block", color: "var(--tk-dang)" }}
                  >
                    {t("species.stuckOnFrustration")}
                  </span>
                )}
                {m.needsElite && (
                  <span className="tk-caption" style={{ display: "block" }}>
                    {t("species.needsElite")}
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
      </section>

      {/* O IV que se procura, por liga.
          A tela do jogo mostra porcentagem, e porcentagem e a metrica errada
          aqui: em liga com teto o 100% quase sempre perde. */}
      <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
        {t("spread.title")}
      </div>

      <div style={{ display: "flex", gap: 6, margin: "10px 0" }}>
        {LEAGUES.map((l) => (
          <button
            key={l.id}
            type="button"
            className={`tk-btn ${league.id === l.id ? "tk-btn--primary" : "tk-btn--secondary"}`}
            style={{ flex: 1, height: 40, fontSize: 12, padding: 0 }}
            aria-pressed={league.id === l.id}
            onClick={() => setLeague(l)}
          >
            {l.name.replace(" League", "")}
          </button>
        ))}
      </div>

      {/* Grade propria em vez de `tk-row`: sao dez linhas de numeros curtos, e
          o espacamento de linha de formulario deixava a tabela com mais de mil
          pixels de altura, com o IV quebrando em duas linhas. */}
      <section className="tk-card">
        <div className="tk-spread-head">
          <span>{t("spread.rank")}</span>
          <span>{t("spread.atk")}</span>
          <span>{t("spread.def")}</span>
          <span>{t("spread.hp")}</span>
          <span>{t("spread.level")}</span>
          <span>{t("spread.cp")}</span>
        </div>

        {spreads.map((sp) => (
          <div
            key={`${sp.ivs.atk}-${sp.ivs.def}-${sp.ivs.hp}`}
            className={`tk-spread${sp.rank === 1 ? " tk-spread--top" : ""}`}
          >
            <span>{sp.rank}</span>
            <span>{sp.ivs.atk}</span>
            <span>{sp.ivs.def}</span>
            <span>{sp.ivs.hp}</span>
            <span className="tk-spread-dim">{sp.level}</span>
            <span>{sp.cp.toLocaleString(language)}</span>
          </div>
        ))}

        {/* A explicacao segue a TABELA, nao a liga: Azumarill na Ultra nem
            chega ao teto, entao o topo dele E 15/15/15 — e o texto padrao
            ficava dizendo o contrario logo acima da tabela. */}
        <p className="tk-caption" style={{ marginTop: 12, lineHeight: 1.5 }}>
          {league.cpCap === null
            ? t("spread.noCap")
            : semTeto
              ? t("spread.cantReach", {
                  name: species.name,
                  cap: league.cpCap.toLocaleString(language),
                  level: data.version.levelCap,
                  maxCp: cpAt(data.version.levelCap).toLocaleString(language),
                })
              : t("spread.capped", { cap: league.cpCap.toLocaleString(language) })}
        </p>
      </section>

      {evolutions.length > 0 && (
        <>
          <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
            {t("species.evolvesInto")}
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
                  <span className="tk-row-value">
                    {t("species.candy", { count: species.candyToEvolve[e.id]! })}
                  </span>
                )}
              </div>
            ))}
          </section>
        </>
      )}

      {calcOpen && (
        <IVCalculator species={species} data={data} onClose={() => setCalcOpen(false)} />
      )}
      {raidOpen && (
        <RaidCounters boss={species} data={data} onClose={() => setRaidOpen(false)} />
      )}
    </div>,
    document.body,
  );
}
