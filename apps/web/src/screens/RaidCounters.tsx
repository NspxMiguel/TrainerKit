import { useEffect, useMemo, useState } from "react";
import { useFolha } from "../ui/folha.ts";
import { createPortal } from "react-dom";

import {
  RAID_TIERS,
  bossCP,
  estimateRaid,
  rankCounters,
  rankMovesets,
  type CounterInput,
  type Move,
  type MoveWithPvp,
  type RaidBossInput,
  type RaidTier,
} from "@trainerkit/core";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { moveLabel, useLanguage } from "../i18n/language.ts";
import { useT } from "../i18n/t.ts";
import { useSetup } from "../onboarding/setup.ts";
import { useCollection } from "../storage/collection.ts";
import { Segmented } from "../ui/Segmented.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";

interface Props {
  boss: DatasetSpecies;
  data: Dataset;
  onClose: () => void;
}

const TIERS: readonly RaidTier[] = [1, 3, 5, "mega"];

/**
 * "Com os MEUS, eu derrubo esse chefe?"
 *
 * Todo site de Pokemon lista os melhores counters do jogo. Isso e util uma vez
 * e inutil sempre depois, porque a resposta nunca muda e quase nunca e sobre
 * voce — de nada adianta saber que o melhor counter e um Mega Rayquaza se voce
 * nao tem um.
 *
 * Aqui a lista sai da colecao. Se ela disser que voce precisa de tres pessoas,
 * e porque voce precisa mesmo.
 */
export function RaidCounters({ boss, data, onClose }: Props) {
  /* A folha sai animada: quem segura o no durante a saida e o `useFolha`. Todo
     caminho de fechamento passa por `fechar`, nunca pelo `onClose` cru — um que
     escape volta a piscar, e so aquele. */
  const { saindo, fechar } = useFolha(onClose);

  /*
   * O tier que a especie de fato ocupa, ate onde da pra saber.
   *
   * Antes abria sempre em 5, e ai o app anunciava "Machamp · 40.227 de PC ·
   * 15.000 de vida". A conta esta certa pra tier 5; o problema e que Machamp
   * nunca e chefe de tier 5, entao a primeira coisa que a tela mostrava era um
   * numero que nao existe no jogo.
   *
   * Lendario, mitico ou Ultra Beast abre em 5; o resto, em 3, que e onde mora
   * a maioria dos chefes normais. Continua trocavel — a lista real de chefes
   * muda a cada evento e nao esta no GAME_MASTER, entao isto e um palpite bom,
   * nao uma verdade.
   */
  const [tier, setTier] = useState<RaidTier>(boss.legendary ? 5 : 3);
  const { items } = useCollection();
  const setup = useSetup();
  const { t } = useT();
  const language = useLanguage();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);

  const moveById = (id: string): Move | null =>
    data.fastMoves.find((m) => m.id === id) ?? data.chargedMoves.find((m) => m.id === id) ?? null;

  const bossInput: RaidBossInput = useMemo(
    () => ({
      name: boss.name,
      types: boss.types,
      baseStats: boss.baseStats,
      tier,
      fastMoves: boss.fastMoves.map(moveById).filter((m): m is Move => m !== null),
      chargedMoves: boss.chargedMoves.map(moveById).filter((m): m is Move => m !== null),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boss, tier, data],
  );

  /**
   * Cada Pokemon entra com o melhor moveset DELE contra este chefe.
   *
   * O app nao sabe quais golpes o jogador tem equipado — a tela de avaliacao
   * nao mostra isso. Entao a conta e "o melhor que ele pode ter", e a tela diz
   * qual e: "seu Tyranitar e o melhor" sem dizer com que golpe e meio conselho.
   */
  const { counters, estimate } = useMemo(() => {
    if (!items) return { counters: [], estimate: null };

    const team: CounterInput[] = [];
    for (const owned of items) {
      const sp = data.species.find((s) => s.id === owned.speciesId);
      if (!sp) continue;

      const fast = sp.fastMoves.map(moveById).filter((m): m is Move => m !== null);
      const charged = sp.chargedMoves.map(moveById).filter((m): m is Move => m !== null);
      if (fast.length === 0 || charged.length === 0) continue;

      const best = rankMovesets(fast as MoveWithPvp[], charged as MoveWithPvp[], "raid", {
        attackerTypes: sp.types,
        chart: data.typeChart,
        order: data.typeOrder,
        stabMultiplier: data.settings.battle.sameTypeAttackBonusMultiplier,
        defenderTypes: boss.types,
      })[0];
      if (!best) continue;

      team.push({
        id: owned.id,
        name: sp.name,
        speciesId: sp.id,
        types: sp.types,
        baseStats: sp.baseStats,
        ivs: owned.ivs,
        level: owned.level ?? 20,
        shadow: owned.shadow,
        fast: best.fast,
        charged: best.charged,
      });
    }

    const ranked = rankCounters(
      team,
      bossInput,
      data.cpm,
      data.typeChart,
      data.typeOrder,
      data.settings.battle,
    );
    return { counters: ranked, estimate: estimateRaid(ranked, bossInput) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, bossInput, data, boss.types]);

  const spec = RAID_TIERS[tier];
  const speciesOf = (id: string) => data.species.find((s) => s.id === id);

  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label={t("raid.title")} data-saindo={saindo || undefined}>
      <header className="tk-sheet-head">
        <button
          type="button"
          className="tk-sheet-close"
          onClick={fechar}
          aria-label={t("common.back")}
        >
          ‹
        </button>
      </header>
      <h1 className="tk-h1">{t("raid.title")}</h1>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
        <SpeciesTile
          spriteId={boss.spriteId}
          dex={boss.dex}
          speciesId={boss.id}
          name={boss.name}
          types={boss.types}
          size={64}
        />
        <div>
          <div style={{ font: "800 20px/1.15 var(--tk-font)", letterSpacing: "-0.02em" }}>
            {boss.name}
          </div>
          <div className="tk-caption">
            {t("raid.bossCp", { cp: bossCP(bossInput).toLocaleString(language) })} ·{" "}
            {t("raid.bossHp", { hp: spec.hp.toLocaleString(language) })}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <Segmented
          ariaLabel={t("raid.title")}
          value={String(tier)}
          onChange={(v) => setTier(TIERS.find((x) => String(x) === v) ?? tier)}
          size="compact"
          options={TIERS.map((x) => ({
            value: String(x),
            label: x === "mega" ? t("raid.tierMega") : t("raid.tier", { n: x }),
          }))}
        />
      </div>

      {/* O veredito da raide vem antes da lista: a pergunta e "eu consigo?",
          nao "quem e o meu melhor". A lista explica a resposta. */}
      {estimate && counters.length > 0 ? (
        <section
          className="tk-card"
          style={{
            borderColor: estimate.canSolo
              ? "var(--tk-succ)"
              : estimate.beyondLobby
                ? "var(--tk-warn)"
                : "var(--tk-info)",
          }}
        >
          <div className="tk-overline">{t("raid.canYou")}</div>
          <div
            style={{
              font: "800 26px/1.1 var(--tk-font)",
              letterSpacing: "-0.02em",
              color: estimate.canSolo
                ? "var(--tk-succ)"
                : estimate.beyondLobby
                  ? "var(--tk-warn)"
                  : "var(--tk-info)",
              margin: "8px 0 6px",
            }}
          >
            {estimate.canSolo
              ? t("raid.solo")
              : estimate.beyondLobby
                ? t("raid.hopeless")
                : t("raid.needTrainers", { n: estimate.trainers })}
          </div>
          {/* O motivo e sempre o TEMPO — o aguente virou aviso, nao causa.
              Antes o texto dizia "falta gente, nao counter mais forte" quando o
              time era fragil, o que contradizia o proprio numero acima. */}
          <p className="tk-body" style={{ color: "var(--tk-txt)" }}>
            {estimate.beyondLobby
              ? t("raid.hopelessBody")
              : estimate.canSolo
                ? t("raid.soloIn", { seconds: Math.ceil(estimate.seconds) })
                : t("raid.limitedByDamage")}
            {!estimate.beyondLobby && estimate.frail && ` ${t("raid.frail")}`}
          </p>
        </section>
      ) : (
        <div className="tk-empty">
          <div className="tk-empty-title">{t("raid.emptyTitle")}</div>
          <p className="tk-body">
            {setup.mode === "colecao" ? t("raid.emptyBody") : t("raid.emptyBrowse")}
          </p>
        </div>
      )}

      {counters.length > 0 && (
        <>
          <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
            {t("raid.yourBest")}
          </div>
          <section className="tk-card" style={{ marginTop: 10 }}>
            {counters.slice(0, 6).map((c, i) => {
              const sp = speciesOf(c.speciesId);
              const fast = moveLabel(c.fast.name, data.moveNames, c.fast.id, language);
              const charged = moveLabel(c.charged.name, data.moveNames, c.charged.id, language);
              return (
                <div className="tk-row" key={c.id}>
                  <span
                    className="tk-caption"
                    style={{ width: 16, flex: "none", fontWeight: i === 0 ? 700 : 400 }}
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
                    {c.name}
                    <span className="tk-caption" style={{ display: "block" }}>
                      {fast.primary} + {charged.primary}
                    </span>
                  </span>
                  <span
                    className="tk-row-value"
                    style={i === 0 ? { color: "var(--tk-succ)", fontWeight: 700 } : undefined}
                  >
                    {Math.round(c.dps)}{" "}
                    <span className="tk-caption">{t("raid.dps")}</span>
                  </span>
                </div>
              );
            })}
          </section>
          <p className="tk-caption" style={{ margin: "10px 2px 0", lineHeight: 1.5 }}>
            {t("raid.movesetNote")}
          </p>
        </>
      )}
    </div>,
    document.body,
  );
}
