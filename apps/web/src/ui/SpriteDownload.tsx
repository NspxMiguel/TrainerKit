import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

import { useT } from "../i18n/t.ts";
import type { DatasetSpecies } from "../data/useDataset.ts";
import { spriteUrl } from "../sprites/provider.ts";
import { useSpriteSettings } from "../sprites/settings.ts";
import {
  dismissPrefetch,
  formatMb,
  restorePrefetchPanel,
  sendPrefetchToBackground,
  startPrefetch,
  stopPrefetch,
  usePrefetch,
} from "../sprites/prefetch.ts";
import { IconDownload } from "./Icons.tsx";

/**
 * Todas as imagens que a fonte ativa sabe resolver.
 *
 * Sai vazio quando a fonte e "sem imagens" ou uma fonte do usuario — nesta
 * ultima a URL depende de leitura assincrona do IndexedDB, e baixar em massa
 * dali nao faria sentido: o arquivo ja esta no aparelho.
 */
function useUrls(species: readonly DatasetSpecies[]): string[] {
  const settings = useSpriteSettings();
  return useMemo(() => {
    const seen = new Set<string>();
    for (const s of species) {
      const url = spriteUrl({ spriteId: s.spriteId, dex: s.dex }, settings);
      if (url) seen.add(url);
    }
    return [...seen];
  }, [species, settings]);
}

/** O botao que oferece o download. Fica nos Ajustes, junto da escolha da fonte. */
export function SpriteDownloadButton({ species }: { species: readonly DatasetSpecies[] }) {
  const { t, language } = useT();
  const urls = useUrls(species);
  const pre = usePrefetch();

  if (urls.length === 0) return null;

  if (pre.status === "done") {
    return (
      <p className="tk-caption" style={{ margin: "10px 2px 0" }}>
        {t("prefetch.finished", {
          count: (pre.done - pre.failed).toLocaleString(language),
          size: formatMb(pre.bytes, language),
        })}
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        className="tk-btn tk-btn--secondary tk-btn--block"
        style={{ marginTop: 12 }}
        disabled={pre.status === "running"}
        onClick={() => void startPrefetch(urls)}
      >
        <IconDownload size={16} />
        {t("prefetch.start", { count: urls.length.toLocaleString(language) })}
      </button>
      {/* O tamanho vem ANTES de comecar. Um app que so mostra o quanto gastou
          depois de gastar esta avisando tarde demais. */}
      <p className="tk-caption" style={{ margin: "8px 2px 0", lineHeight: 1.5 }}>
        {t("prefetch.warning")}
      </p>
    </>
  );
}

/**
 * O painel de progresso.
 *
 * Duas saidas, e nada alem disso: fica olhando, ou manda
 * pro fundo e continua usando. "Parar" existe porque um download de centenas de
 * megabytes que nao da pra cancelar e uma armadilha.
 */
export function SpriteDownloadPanel() {
  const { t, language } = useT();
  const pre = usePrefetch();

  if (pre.status === "idle" || pre.background) return null;
  if (pre.status === "stopped") return null;

  const pct = pre.total === 0 ? 0 : Math.round((pre.done / pre.total) * 100);
  const finished = pre.status === "done";

  return createPortal(
    <div className="tk-scrim" role="dialog" aria-modal="true" aria-label={t("prefetch.title")}>
      <div className="tk-modal">
        <h2 className="tk-modal-title">
          {finished ? t("prefetch.doneTitle") : t("prefetch.title")}
        </h2>

        <div
          className="tk-progress"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${pct}%` }} />
        </div>

        <p className="tk-caption" style={{ marginTop: 10 }}>
          {t("prefetch.progress", {
            done: pre.done.toLocaleString(language),
            total: pre.total.toLocaleString(language),
            size: formatMb(pre.bytes, language),
          })}
          {pre.failed > 0 && ` · ${t("prefetch.failed", { count: pre.failed })}`}
        </p>

        <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
          {finished ? (
            <button
              type="button"
              className="tk-btn tk-btn--primary tk-btn--block"
              onClick={dismissPrefetch}
            >
              {t("common.close")}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="tk-btn tk-btn--primary tk-btn--block"
                onClick={sendPrefetchToBackground}
              >
                {t("prefetch.background")}
              </button>
              <button
                type="button"
                className="tk-btn tk-btn--ghost tk-btn--block"
                onClick={stopPrefetch}
              >
                {t("prefetch.stop")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * A tarja de segundo plano.
 *
 * Fica logo acima da barra de abas, fina, com o numero e nada mais. Existe
 * porque download invisivel e download que a pessoa nao sabe que pode parar —
 * tocar nela traz o painel de volta.
 */
export function SpriteDownloadStrip() {
  const { t } = useT();
  const pre = usePrefetch();
  const visible = pre.background && pre.status === "running";

  /*
   * A tarja avisa o resto do layout que existe.
   *
   * Ela mora logo acima da barra de abas, e o botao de adicionar da Colecao
   * mora no mesmo pedaco de tela — os dois se sobrepunham. Como o botao esta
   * dentro de outra tela, nao ha seletor CSS que os relacione; o atributo na
   * raiz e o mesmo caminho que `data-platform` ja usa.
   */
  useEffect(() => {
    if (!visible) return;
    document.documentElement.dataset.tkStrip = "1";
    return () => {
      delete document.documentElement.dataset.tkStrip;
    };
  }, [visible]);

  if (!visible) return null;

  const pct = pre.total === 0 ? 0 : Math.round((pre.done / pre.total) * 100);

  return (
    <button type="button" className="tk-strip" onClick={restorePrefetchPanel}>
      <span className="tk-strip-fill" style={{ width: `${pct}%` }} aria-hidden="true" />
      <span className="tk-strip-text">{t("prefetch.strip", { pct })}</span>
    </button>
  );
}
