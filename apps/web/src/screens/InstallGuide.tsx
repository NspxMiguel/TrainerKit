import { useEffect } from "react";
import { createPortal } from "react-dom";

import { useT, type Key } from "../i18n/t.ts";
import type { Platform } from "../storage/install.ts";
import {
  GlyphAddToHome,
  GlyphAndroidMenu,
  GlyphInstallDesktop,
  GlyphIosShare,
} from "../ui/SystemGlyphs.tsx";

interface Props {
  platform: Platform;
  promptInstall: (() => Promise<boolean>) | null;
  onClose: () => void;
}

interface Step {
  textKey: Key;
  /** O botao do sistema que este passo manda apertar. */
  Glyph?: (props: { size?: number }) => React.ReactElement;
}

const STEPS: Record<Platform, { titleKey: Key; browserKey: Key; steps: Step[] }> = {
  ios: {
    titleKey: "install.ios.title",
    browserKey: "install.ios.browser",
    steps: [
      { textKey: "install.ios.step1", Glyph: GlyphIosShare },
      { textKey: "install.ios.step2", Glyph: GlyphAddToHome },
      { textKey: "install.ios.step3" },
      { textKey: "install.ios.step4" },
    ],
  },
  android: {
    titleKey: "install.android.title",
    browserKey: "install.android.browser",
    steps: [
      { textKey: "install.android.step1", Glyph: GlyphAndroidMenu },
      { textKey: "install.android.step2", Glyph: GlyphAddToHome },
      { textKey: "install.android.step3" },
      { textKey: "install.android.step4" },
    ],
  },
  desktop: {
    titleKey: "install.desktop.title",
    browserKey: "install.desktop.browser",
    steps: [
      { textKey: "install.desktop.step1", Glyph: GlyphInstallDesktop },
      { textKey: "install.desktop.step2" },
    ],
  },
};

/**
 * Onde fica o botao, desenhado.
 *
 * Dizer "na barra de baixo" e mandar procurar. A barra do Safari tem cinco
 * icones e o Compartilhar e o do meio; com o desenho a pessoa compara com o
 * proprio aparelho e acha em um segundo. E um desenho, nao uma foto: nao pesa
 * nada, fica nitido em qualquer tela e acompanha o tema claro/escuro.
 */
function SafariBar({ label }: { label: string }) {
  return (
    <figure className="tk-osbar" aria-label={label}>
      <span className="tk-osbar-icon" aria-hidden="true">
        ‹
      </span>
      <span className="tk-osbar-icon tk-osbar-icon--dim" aria-hidden="true">
        ›
      </span>
      <span className="tk-osbar-icon tk-osbar-icon--target">
        <GlyphIosShare size={19} />
      </span>
      <span className="tk-osbar-icon" aria-hidden="true">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
          <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14v16h4.5a1.5 1.5 0 0 0 1.5-1.5Z" />
        </svg>
      </span>
      <span className="tk-osbar-icon" aria-hidden="true">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
          <rect x="3" y="6" width="12" height="12" rx="2.5" />
          <path d="M8 6V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-1" />
        </svg>
      </span>
    </figure>
  );
}

/** Passo a passo de instalação, separado por sistema. */
export function InstallGuide({ platform, promptInstall, onClose }: Props) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { t } = useT();
  const guide = STEPS[platform];

  return (
    createPortal(
      <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label={t(guide.titleKey)}>
        <header className="tk-sheet-head">
          <button
            type="button"
            className="tk-sheet-close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ‹
          </button>
          <h2 className="tk-sheet-title">{t(guide.titleKey)}</h2>
        </header>

        <p className="tk-caption" style={{ margin: "18px 2px 12px", lineHeight: 1.5 }}>
          {t(guide.browserKey)}
        </p>

        <ol className="tk-steps">
          {guide.steps.map((step, i) => (
            <li key={step.textKey}>
              <span className="tk-step-num">{i + 1}</span>
              <span className="tk-step-text">
                {t(step.textKey)}
                {step.Glyph && (
                  <span className="tk-step-glyph" aria-hidden="true">
                    <step.Glyph size={17} />
                  </span>
                )}
                {/* So no primeiro passo do iPhone: e o unico em que a pessoa
                    precisa achar um botao fora do app. */}
                {platform === "ios" && i === 0 && (
                  <SafariBar label={t("install.ios.barAria")} />
                )}
              </span>
            </li>
          ))}
        </ol>

        {promptInstall && (
          <button
            type="button"
            className="tk-btn tk-btn--primary tk-btn--block"
            style={{ marginTop: 20 }}
            onClick={() => {
              void promptInstall().then((accepted) => {
                if (accepted) onClose();
              });
            }}
          >
            {t("install.now")}
          </button>
        )}

        <button
          type="button"
          className="tk-btn tk-btn--secondary tk-btn--block"
          style={{ marginTop: 10 }}
          onClick={onClose}
        >
          {t("common.close")}
        </button>
      </div>,
      document.body,
    )
  );
}
