import { opine, type AssistantInput, type Tone } from "@trainerkit/core";

import { useT } from "../i18n/t.ts";

const TONE_COLOR: Record<Tone, string> = {
  bom: "var(--tk-succ)",
  neutro: "var(--tk-info)",
  ruim: "var(--tk-warn)",
};

/**
 * A opiniao do assistente.
 *
 * Cada frase vem acompanhada do numero que a sustenta, lado a lado. Isso e
 * deliberado: opiniao sem dado ao lado e so um app te mandando confiar nele, e o
 * ponto do TrainerKit e o contrario — mostrar POR QUE, para o jogador poder
 * discordar com base em algo.
 */
export function AssistantCard(props: AssistantInput) {
  const opinion = opine(props);
  const { t, tm } = useT();

  return (
    <>
      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        {t("assistant.title")}
      </div>

      <section className="tk-card tk-assistente" style={{ marginTop: 10 }}>
        <p
          style={{
            font: "700 16px/1.4 var(--tk-font)",
            color: TONE_COLOR[opinion.tone],
            margin: 0,
          }}
        >
          {tm(opinion.headline)}
        </p>

        {opinion.observations.length > 0 && (
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {opinion.observations.map((o) => (
              <div key={o.text.key} style={{ display: "flex", gap: 10 }}>
                <span
                  aria-hidden="true"
                  style={{
                    flex: "none",
                    width: 6,
                    borderRadius: 3,
                    background: TONE_COLOR[o.tone],
                  }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="tk-body" style={{ display: "block", color: "var(--tk-txt)" }}>
                    {tm(o.text)}
                  </span>
                  <span
                    className="tk-caption"
                    style={{ display: "block", marginTop: 2, fontFamily: "var(--tk-mono)" }}
                  >
                    {tm(o.evidence)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

      </section>
    </>
  );
}
