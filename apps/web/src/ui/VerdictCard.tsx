import { useState } from "react";

import { ACTION_LABELS, decide, formatTrace, type VerdictInput } from "@trainerkit/core";

const TONE: Record<string, string> = {
  investir: "var(--tk-succ)",
  evoluir: "var(--tk-pri)",
  guardar: "var(--tk-info)",
  transferir: "var(--tk-dang)",
};

/**
 * O veredito, com o rastro atras.
 *
 * A frase de motivo e UMA. Nunca duas — foi a regra do prototipo e ela esta
 * certa: duas frases viram parede de texto e o jogador para de ler.
 *
 * O rastro fica escondido atras de "como cheguei nisso", mas EXISTE. E a
 * diferenca entre um app que manda voce confiar e um que aceita ser conferido.
 */
export function VerdictCard(props: VerdictInput) {
  const verdict = decide(props);
  const [traceOpen, setTraceOpen] = useState(false);
  const color = TONE[verdict.action] ?? "var(--tk-txt)";

  return (
    <section className="tk-card" style={{ borderColor: color }}>
      <div className="tk-overline">Veredito</div>

      <div
        style={{
          font: "800 26px/1.1 var(--tk-font)",
          letterSpacing: "-0.02em",
          color,
          margin: "8px 0 6px",
        }}
      >
        {ACTION_LABELS[verdict.action]}
      </div>

      <p className="tk-body" style={{ color: "var(--tk-txt)" }}>
        {verdict.reason}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
        <div
          style={{
            flex: 1,
            height: 5,
            borderRadius: 3,
            background: "var(--tk-surf2)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.round(verdict.confidence * 100)}%`,
              height: "100%",
              background: color,
            }}
          />
        </div>
        <span className="tk-caption">
          confiança {Math.round(verdict.confidence * 100)}%
        </span>
      </div>

      <button
        type="button"
        className="tk-btn tk-btn--secondary tk-btn--block"
        style={{ height: 40, fontSize: 13, marginTop: 14 }}
        onClick={() => setTraceOpen((v) => !v)}
        aria-expanded={traceOpen}
      >
        {traceOpen ? "Esconder" : "Como cheguei nisso"}
      </button>

      {traceOpen && (
        <>
          <pre className="tk-trace">{formatTrace(props.name.toLowerCase(), verdict)}</pre>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {verdict.signals.map((s) => (
              <div key={s.rule} className="tk-caption" style={{ lineHeight: 1.45 }}>
                <span style={{ fontFamily: "var(--tk-mono)", color: "var(--tk-txt2)" }}>
                  {s.rule}
                </span>{" "}
                — {s.because}
              </div>
            ))}
          </div>
          <p className="tk-caption" style={{ marginTop: 12, lineHeight: 1.5 }}>
            A confiança é a concordância entre as regras. Quando duas puxam pra lados
            opostos, ela cai — e deve cair mesmo.
          </p>
        </>
      )}
    </section>
  );
}
