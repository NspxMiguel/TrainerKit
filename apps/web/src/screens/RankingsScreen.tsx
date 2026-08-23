import { useState } from "react";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { moveLabel, useLanguage } from "../i18n/language.ts";
import { useT } from "../i18n/t.ts";
import { typeKey } from "../sprites/provider.ts";
import { Segmented } from "../ui/Segmented.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";

interface Props {
  data: Dataset;
  onPick: (s: DatasetSpecies) => void;
  /** Qual das duas listas abrir — vem do atalho que trouxe a pessoa aqui. */
  initialMode?: Mode;
}

type Mode = "raid" | "pvp";

const LEAGUES = ["great", "ultra", "master"] as const;

/**
 * Os melhores do jogo.
 *
 * Duas listas que respondem perguntas diferentes, e o app diz qual e qual.
 *
 * A de raide e ranking de verdade: DPS e aguente contra um alvo neutro, com a
 * formula fechada. A de PvP NAO e tier list — e stat product no teto da liga, e
 * a propria lista denuncia isso: o topo da Great sai Chansey, Bastiodon,
 * Carbink. Sao paredes que espremem atributo sob o limite de PC, e nenhuma
 * delas manda no meta. Chamar isso de "melhores da Great" seria mentira.
 *
 * Ambas vem prontas do dataset. O stat product levava 3 segundos no navegador —
 * conta fixa sobre dado fixo pertence ao build.
 */
export function RankingsScreen({ data, onPick, initialMode = "raid" }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [type, setType] = useState<string | null>(null);
  const [league, setLeague] = useState<(typeof LEAGUES)[number]>("great");
  const { t } = useT();
  const language = useLanguage();

  const rankings = data.rankings;
  if (!rankings) return <p className="tk-body">{t("common.loading")}</p>;

  const list =
    mode === "raid"
      ? type
        ? (rankings.raidByType[type] ?? [])
        : rankings.raidOverall
      : rankings.statProductByLeague[league];

  const speciesOf = (id: string) => data.species.find((s) => s.id === id);

  return (
    <>
      {/* Raide/PvP e subordinado a Buscar/Melhores, entao nao pode ter o
          mesmo peso: tres fileiras de botoes identicos empilhadas viram uma
          parede em que nada parece mais importante que nada. Chip menor
          resolve sem esconder a escolha. */}
      <div style={{ marginBottom: 10 }}>
        <Segmented
          ariaLabel={t("especies.best")}
          value={mode}
          onChange={setMode}
          size="compact"
          options={[
            { value: "raid" as const, label: t("rank.raid") },
            { value: "pvp" as const, label: t("rank.pvp") },
          ]}
        />
      </div>

      {mode === "raid" ? (
        <div className="tk-chips">
          <button
            type="button"
            className="tk-chip tk-chip--dim"
            data-on={type === null || undefined}
            onClick={() => setType(null)}
          >
            {t("rank.allTypes")}
          </button>
          {data.typeOrder.map((tp) => (
            <button
              key={tp}
              type="button"
              className="tk-chip tk-chip--dim"
              data-on={type === tp || undefined}
              onClick={() => setType(tp)}
            >
              {t(typeKey(tp) as "type.normal")}
            </button>
          ))}
        </div>
      ) : (
        <Segmented
          ariaLabel={t("rank.pvp")}
          value={league}
          onChange={setLeague}
          size="compact"
          options={LEAGUES.map((l) => ({
            value: l,
            label: t(`rank.league.${l}` as "rank.league.great"),
          }))}
        />
      )}

      {/* O aviso do PvP fica ACIMA da lista, nao numa nota de rodape: quem le a
          lista precisa saber o que ela e antes de acreditar nela. */}
      {mode === "pvp" && (
        <div className="tk-banner tk-banner--info" style={{ marginTop: 12 }}>
          <div className="tk-banner-text">
            <div className="tk-banner-title">{t("rank.notTierListTitle")}</div>
            <p className="tk-banner-body">{t("rank.notTierList")}</p>
          </div>
        </div>
      )}

      <section className="tk-card" style={{ marginTop: 12 }}>
        {list.map((entry, i) => {
          const sp = speciesOf(entry.speciesId);
          return (
            <button
              type="button"
              className="tk-row"
              key={entry.speciesId}
              onClick={() => sp && onPick(sp)}
            >
              <span
                className="tk-caption"
                style={{ width: 20, flex: "none", fontWeight: i === 0 ? 700 : 400 }}
              >
                {i + 1}
              </span>
              {sp && (
                <SpeciesTile
                  spriteId={sp.spriteId}
                  dex={sp.dex}
                  speciesId={sp.id}
                  name={sp.name}
                  types={sp.types}
                  size={36}
                />
              )}
              <span className="tk-row-label" style={i === 0 ? { fontWeight: 700 } : undefined}>
                {entry.name}
                {entry.fast && entry.charged && (
                  <span className="tk-caption" style={{ display: "block" }}>
                    {moveLabel(entry.fast.name, data.moveNames, entry.fast.id, language).primary}
                    {" + "}
                    {
                      moveLabel(entry.charged.name, data.moveNames, entry.charged.id, language)
                        .primary
                    }
                  </span>
                )}
              </span>
              <span
                className="tk-row-value"
                style={i === 0 ? { color: "var(--tk-succ)", fontWeight: 700 } : undefined}
              >
                {Math.round(entry.score)}
              </span>
            </button>
          );
        })}
        {list.length === 0 && <p className="tk-body">{t("rank.empty")}</p>}
      </section>

      <p className="tk-caption" style={{ margin: "10px 2px 0", lineHeight: 1.5 }}>
        {mode === "raid" ? t("rank.raidNote") : t("rank.pvpNote")}
      </p>
    </>
  );
}
