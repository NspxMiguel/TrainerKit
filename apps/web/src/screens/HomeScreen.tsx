import { useMemo, useState } from "react";

import { ACTION_KEYS, decide, type Action } from "@trainerkit/core";

import type { DatasetState } from "../data/useDataset.ts";
import { datasetLabel } from "../data/useDataset.ts";
import { useT, type Key } from "../i18n/t.ts";
import { useSetup } from "../onboarding/setup.ts";
import { useCollection } from "../storage/collection.ts";
import { useInstallState } from "../storage/install.ts";
import type { PersistState } from "../storage/persist.ts";
import { IconAlert, IconPlus } from "../ui/Icons.tsx";
import { InstallBanner } from "../ui/InstallBanner.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { InstallGuide } from "./InstallGuide.tsx";

interface Props {
  dataset: DatasetState;
  persist: PersistState | null;
}

const TONE: Record<Action, string> = {
  investir: "var(--tk-succ)",
  evoluir: "var(--tk-pri)",
  guardar: "var(--tk-info)",
  transferir: "var(--tk-dang)",
};

/**
 * O que a home mostra da colecao.
 *
 * Nao e a colecao inteira — para isso existe a aba. Aqui aparece so o que PEDE
 * ACAO: evoluir e transferir mudam o Pokemon, investir gasta recurso. "Guardar"
 * e o veredito de quem nao precisa fazer nada, e portanto nao merece espaco na
 * primeira tela.
 */
const PEDEM_ACAO: readonly Action[] = ["evoluir", "investir", "transferir"];

function greetingKey(): Key {
  const h = new Date().getHours();
  if (h < 5) return "home.greeting.lateNight";
  if (h < 12) return "home.greeting.morning";
  if (h < 18) return "home.greeting.afternoon";
  return "home.greeting.night";
}

export function HomeScreen({ dataset, persist }: Props) {
  const install = useInstallState();
  const setup = useSetup();
  const { items } = useCollection();
  const { t, tm, language } = useT();
  const [guideOpen, setGuideOpen] = useState(false);

  const ready = dataset.status === "ready";
  const data = ready ? dataset.data : null;

  const pendencias = useMemo(() => {
    if (!data || !items || items.length === 0) return null;

    const decided = items.flatMap((owned) => {
      const s = data.species.find((x) => x.id === owned.speciesId);
      if (!s) return [];

      const verdict = decide({
        name: s.name,
        baseStats: s.baseStats,
        ivs: owned.ivs,
        level: owned.level ?? 20,
        cpm: data.cpm,
        levelCap: data.version.levelCap,
        evolvesInto: s.evolvesInto,
        candyToEvolve: s.evolvesInto[0]
          ? (s.candyToEvolve[s.evolvesInto[0]] ?? null)
          : null,
        lucky: owned.lucky,
        shadow: owned.shadow,
      });

      return [{ id: owned.id, species: s, verdict }];
    });

    // Ordena pela ordem de PEDEM_ACAO e, dentro dela, pela confianca: o que o
    // app tem mais certeza aparece primeiro, porque e o conselho mais util.
    const agir = decided
      .filter((d) => PEDEM_ACAO.includes(d.verdict.action))
      .sort(
        (a, b) =>
          PEDEM_ACAO.indexOf(a.verdict.action) - PEDEM_ACAO.indexOf(b.verdict.action) ||
          b.verdict.confidence - a.verdict.confidence,
      );

    return { total: decided.length, agir };
  }, [items, data]);

  // Armazenamento sem garantia de durabilidade. So avisa quando ha risco real:
  // navegador que suporta modo persistente mas ainda nao concedeu.
  const atRisk = persist?.supported === true && !persist.persisted;

  const showInstall = !install.installed && !install.dismissed;

  return (
    <>
      {/* A saudacao e o nome do app estavam empilhados e liam como uma frase
          so — "Boa noite TrainerKit". Quem cumprimenta e a pessoa, nao o app. */}
      <p className="tk-greeting">{t(greetingKey())}</p>
      <h1 className="tk-h1">{setup.name.trim() || t("home.trainer")}</h1>

      {showInstall && (
        <InstallBanner
          platform={install.platform}
          atRisk={atRisk}
          onOpen={() => setGuideOpen(true)}
          onDismiss={install.dismiss}
        />
      )}

      {/* Ja instalado mas o navegador ainda nao garantiu o armazenamento: e o
          caso raro em que instalar nao resolveu, entao o aviso muda de conselho. */}
      {install.installed && atRisk && (
        <div className="tk-banner tk-banner--warn" role="status">
          <IconAlert size={20} />
          <div className="tk-banner-text">
            <div className="tk-banner-title">{t("home.atRisk.title")}</div>
            <p className="tk-banner-body">{t("home.atRisk.body")}</p>
          </div>
        </div>
      )}

      {dataset.status === "loading" && <p className="tk-body">{t("common.loadingGameData")}</p>}

      {dataset.status === "error" && (
        <div className="tk-banner tk-banner--warn" role="alert">
          <IconAlert size={20} />
          <div className="tk-banner-text">
            <div className="tk-banner-title">{t("home.datasetError.title")}</div>
            <p className="tk-banner-body">{t("home.datasetError.body", { message: dataset.message })}</p>
          </div>
        </div>
      )}

      {dataset.status === "ready" && (
        <>
          <section className="tk-card">
            <div className="tk-overline">{t("home.gameData")}</div>
            <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
              <div>
                <div style={{ font: "800 26px/1.1 var(--tk-font)", letterSpacing: "-0.02em" }}>
                  {dataset.data.species
                    .filter((s) => s.cosmeticOf === null)
                    .length.toLocaleString(language)}
                </div>
                <div className="tk-caption">{t("home.species")}</div>
              </div>
              <div>
                <div style={{ font: "800 26px/1.1 var(--tk-font)", letterSpacing: "-0.02em" }}>
                  {dataset.data.fastMoves.length + dataset.data.chargedMoves.length}
                </div>
                <div className="tk-caption">{t("home.moves")}</div>
              </div>
              <div>
                <div style={{ font: "800 26px/1.1 var(--tk-font)", letterSpacing: "-0.02em" }}>
                  {dataset.data.version.levelCap}
                </div>
                <div className="tk-caption">{t("home.maxLevel")}</div>
              </div>
            </div>
            <p className="tk-caption" style={{ marginTop: 14 }}>
              {t("home.datasetLine", { date: datasetLabel(dataset.data.version) })}
            </p>
          </section>

          <h2 className="tk-h2">{t("home.yourCollection")}</h2>

          {!pendencias ? (
            <div className="tk-empty">
              <div className="tk-empty-mark">
                <IconPlus size={26} />
              </div>
              <div className="tk-empty-title">{t("home.empty.title")}</div>
              <p className="tk-body">{t("home.empty.body")}</p>
            </div>
          ) : pendencias.agir.length === 0 ? (
            <section className="tk-card">
              <div style={{ font: "700 15px var(--tk-font)" }}>
                {pendencias.total === 1
                  ? t("home.nothingPending.one")
                  : t("home.nothingPending.many", { count: pendencias.total })}
              </div>
            </section>
          ) : (
            <section className="tk-card" style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ font: "700 15px var(--tk-font)" }}>
                  {pendencias.agir.length === 1
                    ? t("home.needsDecision.one")
                    : t("home.needsDecision.many", { count: pendencias.agir.length })}
                </div>
                <p className="tk-caption" style={{ marginTop: 4 }}>
                  {pendencias.total === 1
                    ? t("home.ofSaved.one", { count: pendencias.total })
                    : t("home.ofSaved.many", { count: pendencias.total })}
                </p>
              </div>

              {pendencias.agir.slice(0, 3).map((d) => (
                <div
                  key={d.id}
                  style={{ display: "flex", gap: 12, alignItems: "center" }}
                >
                  <SpeciesTile
                    spriteId={d.species.spriteId}
                    dex={d.species.dex}
                    speciesId={d.species.id}
                    name={d.species.name}
                    types={d.species.types}
                    size={40}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", font: "600 14px var(--tk-font)" }}>
                      {d.species.name}
                    </span>
                    <span className="tk-caption" style={{ display: "block" }}>
                      {tm(d.verdict.reason)}
                    </span>
                  </span>
                  <span
                    style={{
                      font: "700 12px var(--tk-font)",
                      color: TONE[d.verdict.action],
                      flex: "none",
                    }}
                  >
                    {t(ACTION_KEYS[d.verdict.action] as Key)}
                  </span>
                </div>
              ))}

              {pendencias.agir.length > 3 && (
                <p className="tk-caption">
                  {t("home.andMore", { count: pendencias.agir.length - 3 })}
                </p>
              )}
            </section>
          )}
        </>
      )}

      {guideOpen && (
        <InstallGuide
          platform={install.platform}
          promptInstall={install.promptInstall}
          onClose={() => setGuideOpen(false)}
        />
      )}
    </>
  );
}
