import { useState } from "react";

import {
  BUILTIN_DATASET,
  checkUrl,
  getDataSource,
  looksLikeDataset,
  setDataSource,
  useDataSource,
} from "../data/source.ts";
import { useT } from "../i18n/t.ts";

interface Props {
  datasetLabel: string | null;
}

/**
 * De onde vem o dado do jogo.
 *
 * Mesma ideia das fontes de imagem, e pelo mesmo motivo: o TrainerKit nao
 * hospeda dado de jogo como quem e dono dele — ele aponta. Trocar a fonte
 * desacopla o app de mim, e quem precisar de uma base mais nova que a minha
 * nao fica esperando meu deploy.
 *
 * O endereco e TESTADO antes de valer. Um JSON qualquer aceito em silencio
 * daria tela branca ou, muito pior, numeros calculados sobre lixo — o unico
 * tipo de erro que este app nao pode cometer.
 */
export function DataSourceSettings({ datasetLabel }: Props) {
  const source = useDataSource();
  const { t } = useT();
  const [url, setUrl] = useState(getDataSource() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const custom = source !== null;

  const apply = async () => {
    const target = url.trim();
    if (!target) return;
    const bad = checkUrl(target);
    if (bad) {
      setError(bad);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(target);
      if (!res.ok) throw new Error(`${res.status}`);
      const problem = looksLikeDataset(await res.json());
      if (problem) throw new Error(problem);
      setDataSource(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="tk-overline" style={{ display: "block", marginTop: 28 }}>
        {t("settings.gameData")}
      </div>

      <p className="tk-caption" style={{ margin: "8px 2px 0", lineHeight: 1.5 }}>
        {t("data.what")}
      </p>

      <section className="tk-card" style={{ marginTop: 10 }}>
        <div className="tk-row">
          <span className="tk-row-label">{t("settings.datasetVersion")}</span>
          <span className="tk-row-value">{datasetLabel ?? "—"}</span>
        </div>
        <button type="button" className="tk-row" onClick={() => setOpen((v) => !v)}>
          <span className="tk-row-label">{t("data.source")}</span>
          <span className="tk-row-value">
            {custom ? t("data.custom") : t("data.builtin")} ›
          </span>
        </button>
      </section>

      {open && (
        <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div className="tk-search" style={{ height: 44 }}>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={BUILTIN_DATASET}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label={t("data.sourceAria")}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="tk-btn tk-btn--primary"
              style={{ flex: 1, height: 44, fontSize: 14 }}
              disabled={busy || url.trim() === ""}
              onClick={() => void apply()}
            >
              {busy ? t("data.checking") : t("data.use")}
            </button>
            <button
              type="button"
              className="tk-btn tk-btn--secondary"
              style={{ flex: 1, height: 44, fontSize: 14 }}
              disabled={busy || !custom}
              onClick={() => {
                setDataSource(null);
                setUrl("");
                setError(null);
              }}
            >
              {t("data.reset")}
            </button>
          </div>

          {error && (
            <p className="tk-caption" style={{ color: "var(--tk-dang)" }}>
              {t("data.rejected", { reason: error })}
            </p>
          )}

          <p className="tk-caption" style={{ lineHeight: 1.5 }}>
            {t("data.help")}
          </p>
        </section>
      )}
    </>
  );
}
