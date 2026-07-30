import { useState } from "react";

import { GROQ_MODELS, setGroqKey, setGroqModel, useGroq } from "../ai/groq.ts";
import {
  DEFAULT_LOCAL_MODEL,
  LOCAL_MODELS,
  ensureEngine,
  engineReady,
  hasWebGPU,
  type LoadProgress,
} from "../ai/local.ts";
import { setLocalModel, setProvider, useAi, type AiProvider } from "../ai/provider.ts";
import { useT } from "../i18n/t.ts";
import { Segmented } from "../ui/Segmented.tsx";

/**
 * De onde vem a IA: de lugar nenhum, da Groq, ou do proprio aparelho.
 *
 * Nenhuma das duas passa por servidor meu. A da Groq usa a chave do usuario e vai
 * direto ao provedor; a local roda na GPU do telefone. Era a unica forma de ter
 * IA sem virar um produto que precisa de backend, conta e politica de
 * privacidade.
 *
 * O padrao e DESLIGADO, e o download do modelo local nunca comeca sozinho: o
 * tamanho aparece antes, em megabytes, e a pessoa aperta. Um app que consome 900
 * MB do plano de dados de alguem sem avisar e um app que se desinstala.
 */
export function AiSettings() {
  const groq = useGroq();
  const ai = useAi();
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const webgpu = hasWebGPU();

  const modeloLocal =
    LOCAL_MODELS.find((m) => m.id === ai.localModel) ??
    LOCAL_MODELS.find((m) => m.id === DEFAULT_LOCAL_MODEL)!;
  const jaCarregado = engineReady(ai.localModel);

  const baixar = () => {
    setErro(null);
    setProgress({ fraction: 0, text: t("ai.local.starting") });
    void ensureEngine(ai.localModel, setProgress)
      .then(() => setProgress({ fraction: 1, text: t("ai.local.ready") }))
      .catch((e: unknown) => {
        setProgress(null);
        setErro(e instanceof Error ? e.message : String(e));
      });
  };

  return (
    <>
      {/* O titulo e o da folha (`SettingsSheet`): repetir "Assistente com IA"
          aqui daria dois titulos iguais um embaixo do outro. */}
      <p className="tk-caption" style={{ margin: "0 2px", lineHeight: 1.5 }}>
        {t("ai.what")}
      </p>
      <p className="tk-caption" style={{ margin: "6px 2px 14px", color: "var(--tk-pri)" }}>
        {t("ai.example")}
      </p>

      <Segmented
        ariaLabel={t("ai.title")}
        value={ai.provider}
        onChange={(p: AiProvider) => setProvider(p)}
        options={[
          { value: "off" as const, label: t("ai.off") },
          { value: "groq" as const, label: t("ai.provider.groq") },
          { value: "local" as const, label: t("ai.provider.local") },
        ]}
      />

      {/* ---------------------------------------------------------- desligado */}

      {ai.provider === "off" && (
        <p className="tk-caption" style={{ margin: "14px 2px 0", lineHeight: 1.5 }}>
          {t("ai.offDetail")}
        </p>
      )}

      {/* --------------------------------------------------------------- groq */}

      {ai.provider === "groq" && (
        <section className="tk-card" style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <p className="tk-caption" style={{ lineHeight: 1.5 }}>
            {t("ai.groqDetail")}
          </p>

          {/* `type="password"` porque uma chave de API na tela e uma chave de API
              num print — e prints deste app circulam por natureza. */}
          <div className="tk-search" style={{ height: 44 }}>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={groq.key ? "••••••••" : "gsk_…"}
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

          <Segmented
            ariaLabel={t("ai.title")}
            value={groq.model}
            onChange={setGroqModel}
            size="compact"
            options={GROQ_MODELS.map((m) => ({ value: m.id, label: m.label }))}
          />

          <p className="tk-caption" style={{ lineHeight: 1.5 }}>
            {t("ai.help")}
          </p>
        </section>
      )}

      {/* -------------------------------------------------------------- local */}

      {ai.provider === "local" && (
        <section className="tk-card" style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {/*
            Sem WebGPU nao ha conversa.

            iOS 26+, Chrome/Android 121+, Chrome e Edge no desktop. Em qualquer
            outro lugar o modelo simplesmente nao roda — e melhor dizer isso do
            que deixar a pessoa baixar 900 MB pra descobrir depois.
          */}
          {!webgpu ? (
            <div className="tk-banner tk-banner--warn" style={{ margin: 0 }}>
              <div className="tk-banner-text">
                <div className="tk-banner-title">{t("ai.local.noGpuTitle")}</div>
                <p className="tk-banner-body">{t("ai.local.noGpu")}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="tk-caption" style={{ lineHeight: 1.5 }}>
                {t("ai.local.what")}
              </p>

              <Segmented
                ariaLabel={t("ai.provider.local")}
                value={ai.localModel}
                onChange={(id) => {
                  setLocalModel(id);
                  setProgress(null);
                  setErro(null);
                }}
                size="compact"
                options={LOCAL_MODELS.map((m) => ({ value: m.id, label: m.label }))}
              />

              {/* O tamanho vem ANTES do botao, sempre. E o unico numero que
                  importa pra decisao, e esconde-lo seria a definicao de pegadinha. */}
              <div className="tk-row">
                <span className="tk-row-label">{t("ai.local.size")}</span>
                <span className="tk-row-value">
                  {t("ai.local.aboutMb", { mb: modeloLocal.vramMB.toLocaleString() })}
                </span>
              </div>

              {jaCarregado ? (
                <p className="tk-caption" style={{ color: "var(--tk-succ)" }}>
                  {t("ai.local.ready")}
                </p>
              ) : progress ? (
                <>
                  {/* Barra determinada quando o MLC sabe o total; quando nao sabe,
                      so o texto dele. Barra fingindo progresso e pior que nenhuma. */}
                  <div className="tk-meter">
                    <div
                      className="tk-meter-fill"
                      style={{
                        width: `${Math.round((progress.fraction ?? 0) * 100)}%`,
                        background: "var(--tk-pri)",
                      }}
                    />
                  </div>
                  <p className="tk-caption">{progress.text}</p>
                </>
              ) : (
                <button
                  type="button"
                  className="tk-btn tk-btn--primary tk-btn--block"
                  onClick={baixar}
                >
                  {t("ai.local.download")}
                </button>
              )}

              <p className="tk-caption" style={{ lineHeight: 1.5 }}>
                {t("ai.local.cacheNote")}
              </p>
            </>
          )}

          {erro && (
            <p className="tk-caption" style={{ color: "var(--tk-dang)" }}>
              {t("ai.local.failed", { reason: erro })}
            </p>
          )}
        </section>
      )}
    </>
  );
}
