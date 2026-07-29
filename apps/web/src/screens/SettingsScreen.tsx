import { useEffect, useState } from "react";

import type { PersistState } from "../storage/persist.ts";
import {
  LANGUAGES,
  setLanguage,
  setShowTranslation,
  useLanguage,
  useShowTranslation,
} from "../i18n/language.ts";
import { useT, type Key } from "../i18n/t.ts";
import { WheelPicker } from "../ui/WheelPicker.tsx";
import { useInstallState } from "../storage/install.ts";
import { InstallGuide } from "./InstallGuide.tsx";
import { AiSettings } from "./AiSettings.tsx";
import { DataSourceSettings } from "./DataSourceSettings.tsx";
import { SpriteSettings } from "./SpriteSettings.tsx";

interface Props {
  datasetLabel: string | null;
  persist: PersistState | null;
}

type Theme = "sistema" | "claro" | "escuro";

const THEME_KEY = "tk:tema";

const THEME_KEYS: Record<Theme, Key> = {
  sistema: "settings.theme.system",
  claro: "settings.theme.light",
  escuro: "settings.theme.dark",
};

function applyTheme(theme: Theme): void {
  const el = document.documentElement;
  if (theme === "sistema") el.removeAttribute("data-tk");
  else el.setAttribute("data-tk", theme === "claro" ? "light" : "dark");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(1)} GB`;
}

export function SettingsScreen({ datasetLabel, persist }: Props) {
  const install = useInstallState();
  const language = useLanguage();
  const showTranslation = useShowTranslation();
  const { t } = useT();
  const [guideOpen, setGuideOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme | null) ?? "sistema",
  );

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <>
      <h1 className="tk-h1">{t("settings.title")}</h1>

      <div className="tk-overline">{t("settings.appearance")}</div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {(["sistema", "claro", "escuro"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTheme(option)}
              className={`tk-btn ${theme === option ? "tk-btn--primary" : "tk-btn--secondary"}`}
              style={{ flex: 1, height: 44, padding: 0, fontSize: 13 }}
              aria-pressed={theme === option}
            >
              {t(THEME_KEYS[option])}
            </button>
          ))}
        </div>
      </section>

      <div className="tk-overline" style={{ display: "block", marginTop: 28 }}>
        {t("settings.storage")}
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        {install.installed ? (
          <div className="tk-row">
            <span className="tk-row-label">{t("settings.installed")}</span>
            <span className="tk-row-value">{t("settings.yes")}</span>
          </div>
        ) : (
          <button type="button" className="tk-row" onClick={() => setGuideOpen(true)}>
            <span className="tk-row-label">{t("settings.install")}</span>
            <span className="tk-row-value">{t("settings.seeHow")}</span>
          </button>
        )}
        <div className="tk-row">
          <span className="tk-row-label">{t("settings.dataProtected")}</span>
          <span
            className="tk-row-value"
            style={
              persist?.supported && !persist.persisted ? { color: "var(--tk-warn)" } : undefined
            }
          >
            {persist === null
              ? t("settings.checking")
              : !persist.supported
                ? t("settings.unsupported")
                : persist.persisted
                  ? t("settings.yes")
                  : t("settings.no")}
          </span>
        </div>
        {persist?.supported && persist.usageBytes !== null && (
          <div className="tk-row">
            <span className="tk-row-label">{t("settings.spaceUsed")}</span>
            <span className="tk-row-value">
              {formatBytes(persist.usageBytes)}
              {persist.quotaBytes !== null &&
                t("settings.spaceOf", { total: formatBytes(persist.quotaBytes) })}
            </span>
          </div>
        )}
      </section>

      <div className="tk-overline" style={{ display: "block", marginTop: 28 }}>
        {t("settings.language")}
      </div>
      {/* Roda em vez de grade: dez idiomas viravam vinte botoes ocupando
          meia tela. O idioma ja vem detectado do aparelho — isto aqui e a
          excecao, nao o caminho principal. */}
      <WheelPicker
        ariaLabel={t("settings.language")}
        value={language}
        onChange={setLanguage}
        options={LANGUAGES.map((l) => ({ value: l.code, label: l.label, glyph: l.flag }))}
      />
      {language !== "en" && (
        <button
          type="button"
          className="tk-option"
          data-active={showTranslation || undefined}
          aria-pressed={showTranslation}
          style={{ marginTop: 10 }}
          onClick={() => setShowTranslation(!showTranslation)}
        >
          <span className="tk-option-mark" aria-hidden="true">
            {showTranslation ? "●" : "○"}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="tk-option-title">{t("settings.showTranslation")}</span>
            <span className="tk-option-detail">
              {t("settings.showTranslationDetail")}
            </span>
          </span>
        </button>
      )}

      <SpriteSettings />

      <DataSourceSettings datasetLabel={datasetLabel} />

      <AiSettings />

      <div className="tk-overline" style={{ display: "block", marginTop: 28 }}>
        {t("settings.about")}
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        <p className="tk-caption" style={{ lineHeight: 1.6 }}>
          {t("settings.disclaimer")}
        </p>
        <p className="tk-caption" style={{ lineHeight: 1.6, marginTop: 10 }}>
          {t("settings.disclaimer2")}
        </p>
        <p className="tk-caption" style={{ marginTop: 12, color: "var(--tk-txt4)" }}>
          {t("settings.version", { version: "0.1.0" })}
        </p>
      </section>

      {guideOpen && (
        <InstallGuide
          platform={install.platform}
          promptInstall={install.promptInstall}
          onClose={() => setGuideOpen(false)}
        />
      )}
    </>
  );
}
