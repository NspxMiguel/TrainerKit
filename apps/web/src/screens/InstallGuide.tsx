import { useEffect } from "react";
import { createPortal } from "react-dom";

import { useT, type Key } from "../i18n/t.ts";
import type { Platform } from "../storage/install.ts";

interface Props {
  platform: Platform;
  promptInstall: (() => Promise<boolean>) | null;
  onClose: () => void;
}

interface Step {
  textKey: Key;
  /** Glifo que imita o icone real do sistema, pra achar o botao na tela. */
  glyph?: string;
}

const STEPS: Record<Platform, { titleKey: Key; browserKey: Key; steps: Step[] }> = {
  ios: {
    titleKey: "install.ios.title",
    browserKey: "install.ios.browser",
    steps: [
      { textKey: "install.ios.step1", glyph: "\u{F0202}" },
      { textKey: "install.ios.step2", glyph: "＋" },
      { textKey: "install.ios.step3" },
      { textKey: "install.ios.step4" },
    ],
  },
  android: {
    titleKey: "install.android.title",
    browserKey: "install.android.browser",
    steps: [
      { textKey: "install.android.step1", glyph: "⋮" },
      { textKey: "install.android.step2" },
      { textKey: "install.android.step3" },
      { textKey: "install.android.step4" },
    ],
  },
  desktop: {
    titleKey: "install.desktop.title",
    browserKey: "install.desktop.browser",
    steps: [
      { textKey: "install.desktop.step1", glyph: "⊕" },
      { textKey: "install.desktop.step2" },
    ],
  },
};

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

  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label={t(guide.titleKey)}>
      <header className="tk-sheet-head">
        <button type="button" className="tk-sheet-close" onClick={onClose} aria-label={t("common.close")}>
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
              {step.glyph && <span className="tk-step-glyph">{step.glyph}</span>}
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
  );
}
