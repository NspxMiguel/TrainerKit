import { opine, type AssistantInput, type Tone } from "@trainerkit/core";

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

  return (
    <>
      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        O que eu acho
      </div>

      <section className="tk-card" style={{ marginTop: 10 }}>
        <p
          style={{
            font: "700 16px/1.4 var(--tk-font)",
            color: TONE_COLOR[opinion.tone],
            margin: 0,
          }}
        >
          {opinion.headline}
        </p>

        {opinion.observations.length > 0 && (
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {opinion.observations.map((o) => (
              <div key={o.text} style={{ display: "flex", gap: 10 }}>
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
                    {o.text}
                  </span>
                  <span
                    className="tk-caption"
                    style={{ display: "block", marginTop: 2, fontFamily: "var(--tk-mono)" }}
                  >
                    {o.evidence}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="tk-caption" style={{ marginTop: 14, lineHeight: 1.5 }}>
          Isso não é IA — é o app lendo os próprios números. Cada frase acima tem o
          dado que a sustenta logo abaixo dela.
        </p>
      </section>
    </>
  );
}
