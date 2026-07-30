import { useState } from "react";

import { GROQ_MODELS, setGroqKey, setGroqModel, useGroq } from "../ai/groq.ts";
import { useT } from "../i18n/t.ts";

/**
 * A chave da IA.
 *
 * Fica no aparelho e vai direto pro provedor. Nao ha servidor no meio, nao ha
 * conta e nao ha cobranca — quem paga a inferencia e quem a pediu. Era a unica
 * forma de ter isto sem virar um produto que precisa de backend, autenticacao e
 * politica de privacidade.
 *
 * O campo e `type="password"` porque uma chave de API na tela e uma chave de
 * API num print — e prints deste app circulam por natureza.
 */
export function AiSettings() {
  const groq = useGroq();
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* O titulo agora e o da folha (`SettingsSheet`): repetir "Assistente com
          IA" aqui daria dois titulos iguais um embaixo do outro. */}
      <p className="tk-caption" style={{ margin: "0 2px", lineHeight: 1.5 }}>
        {t("ai.what")}
      </p>
      <p className="tk-caption" style={{ margin: "6px 2px 0", color: "var(--tk-pri)" }}>
        {t("ai.example")}
      </p>

      <section className="tk-card" style={{ marginTop: 10 }}>
        <button type="button" className="tk-row" onClick={() => setOpen((v) => !v)}>
          <span className="tk-row-label">{t("ai.key")}</span>
          <span
            className="tk-row-value"
            style={groq.key ? { color: "var(--tk-succ)" } : undefined}
          >
            {groq.key ? t("ai.on") : t("ai.off")} ›
          </span>
        </button>
      </section>

      {open && (
        <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div className="tk-search" style={{ height: 44 }}>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="gsk_…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={t("ai.keyAria")}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="tk-btn tk-btn--primary"
              style={{ flex: 1, height: 44, fontSize: 14 }}
              disabled={draft.trim() === ""}
              onClick={() => {
                setGroqKey(draft);
                setDraft("");
              }}
            >
              {t("ai.save")}
            </button>
            <button
              type="button"
              className="tk-btn tk-btn--secondary"
              style={{ flex: 1, height: 44, fontSize: 14 }}
              disabled={!groq.key}
              onClick={() => setGroqKey(null)}
            >
              {t("ai.clear")}
            </button>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {GROQ_MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`tk-btn ${groq.model === m.id ? "tk-btn--primary" : "tk-btn--secondary"}`}
                style={{ flex: 1, height: 38, fontSize: 12, padding: 0 }}
                aria-pressed={groq.model === m.id}
                onClick={() => setGroqModel(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <p className="tk-caption" style={{ lineHeight: 1.5 }}>
            {t("ai.help")}
          </p>
        </section>
      )}
    </>
  );
}
