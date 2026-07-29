import { useMemo } from "react";

import { GREAT_LEAGUE, topSpreads } from "@trainerkit/core";

import type { Dataset } from "../data/useDataset.ts";
import { useT, type Key } from "../i18n/t.ts";
import { IconSpark } from "./Icons.tsx";

interface Props {
  data: Dataset;
}

/**
 * A dica do dia.
 *
 * Existe porque um app que só responde quando perguntado nunca ensina nada — e
 * quase tudo que o TrainerKit sabe é contraintuitivo. Que o 100% costuma ser
 * PIOR em liga com teto, que ataque 15 vale mais que IV total em raide, que o
 * líder da Rocket bloqueia seus dois primeiros carregados: isso muda como se
 * joga, e ficava enterrado em telas que a pessoa só abre depois de já ter
 * decidido errado.
 *
 * Todas saem de DADO REAL, calculado na hora. Nenhuma é frase decorativa —
 * seria a coisa mais fácil e a mais fora do espírito do app.
 */
export function DidYouKnow({ data }: Props) {
  const { t, language } = useT();

  const tip = useMemo(() => {
    // Uma por dia, estável: reabrir o app dez vezes não vira roleta.
    const day = Math.floor(Date.now() / 86_400_000);

    // O exemplo do teto de PC é calculado, não escrito: a espécie muda e o
    // número sai do próprio ranking.
    const showcase = ["azumarill", "medicham", "skarmory", "bastiodon", "umbreon"];
    const pick = showcase[day % showcase.length]!;
    const sp = data.species.find((s) => s.id === pick);
    const best = sp ? topSpreads(data.cpm, sp.baseStats, GREAT_LEAGUE, 1)[0] : undefined;

    const tips: Array<{ key: Key; params?: Record<string, string | number> }> = [
      ...(sp && best
        ? [
            {
              key: "tip.capped" as Key,
              params: {
                name: sp.name,
                atk: best.ivs.atk,
                def: best.ivs.def,
                hp: best.ivs.hp,
              },
            },
          ]
        : []),
      { key: "tip.raidAttack" },
      { key: "tip.shadow" },
      { key: "tip.rocket" },
      { key: "tip.bars" },
      { key: "tip.lucky" },
      {
        key: "tip.species",
        params: {
          count: data.species
            .filter((s) => s.cosmeticOf === null)
            .length.toLocaleString(language),
        },
      },
    ];

    return tips[day % tips.length]!;
  }, [data, language]);

  return (
    <section className="tk-tip">
      <span className="tk-tip-mark" aria-hidden="true">
        <IconSpark size={16} />
      </span>
      <span>
        <span className="tk-tip-label">{t("tip.title")}</span>
        <span className="tk-tip-text">{t(tip.key, tip.params)}</span>
      </span>
    </section>
  );
}
