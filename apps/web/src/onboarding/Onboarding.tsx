import { useState } from "react";
import { createPortal } from "react-dom";

import { LANGUAGES, setLanguage, useLanguage } from "../i18n/language.ts";
import { useT } from "../i18n/t.ts";
import { InstallGuide } from "../screens/InstallGuide.tsx";
import { useInstallState } from "../storage/install.ts";
import { IconDownload, IconGrid, IconSearch } from "../ui/Icons.tsx";
import { updateSetup, type UsageMode } from "./setup.ts";

/**
 * Primeira abertura.
 *
 * Tres passos curtos, e nenhum deles pede dado pessoal — o app nao tem conta e
 * nao manda nada pra lugar nenhum. O unico que muda de verdade a experiencia e
 * o modo de uso; os outros dois sao ajustes que podem ser trocados depois nos
 * Ajustes, e isso e dito na tela pra ninguem travar com medo de errar.
 */
export function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<UsageMode>("consulta");
  const [assistant, setAssistant] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const install = useInstallState();
  const language = useLanguage();
  const { t } = useT();

  const finish = () => updateSetup({ done: true, mode, assistant, name: name.trim() });

  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label={t("onb.aria")}>
      {step === 0 && (
        <>
          {/* A mesma marca do icone: tres barras crescentes e a decisao em
              verde. Antes eram as letras "TK", que diziam o nome e mais nada. */}
          <div className="tk-onb-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h1 className="tk-h1" style={{ marginTop: 24 }}>
            TrainerKit
          </h1>
          <p className="tk-body" style={{ lineHeight: 1.6 }}>
            {t("onb.tagline")}
          </p>
          <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
            {t("settings.language")}
          </div>
          <div className="tk-lang-grid">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                className="tk-lang"
                data-active={language === l.code || undefined}
                aria-pressed={language === l.code}
                onClick={() => setLanguage(l.code)}
              >
                <span aria-hidden="true" style={{ fontSize: 18 }}>
                  {l.flag}
                </span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
          <p className="tk-caption" style={{ marginTop: 8, lineHeight: 1.5 }}>
            {t("onb.languageNote")}
          </p>

          <label style={{ display: "block", marginTop: 22 }}>
            <span className="tk-caption">{t("onb.nameLabel")}</span>
            <div className="tk-search" style={{ marginTop: 6 }}>
              <input
                type="text"
                autoComplete="given-name"
                placeholder={t("onb.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                aria-label={t("onb.nameAria")}
              />
            </div>
          </label>
          <p className="tk-caption" style={{ marginTop: 8, lineHeight: 1.5 }}>
            {t("onb.nameNote")}
          </p>

          <button
            type="button"
            className="tk-btn tk-btn--primary tk-btn--block"
            style={{ marginTop: 22 }}
            onClick={() => setStep(1)}
          >
            {t("onb.start")}
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="tk-sheet-title" style={{ marginBottom: 6 }}>
            {t("onb.howToUse")}
          </h2>
          <p className="tk-caption" style={{ marginBottom: 18, lineHeight: 1.5 }}>
            {t("onb.changeLater")}
          </p>

          <div style={{ display: "grid", gap: 10 }}>
            <button
              type="button"
              className="tk-option"
              data-active={mode === "consulta" || undefined}
              aria-pressed={mode === "consulta"}
              onClick={() => setMode("consulta")}
            >
              <IconSearch size={20} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="tk-option-title">{t("onb.mode.browse")}</span>
                <span className="tk-option-detail">
                  {t("onb.mode.browseDetail")}
                </span>
              </span>
            </button>

            <button
              type="button"
              className="tk-option"
              data-active={mode === "colecao" || undefined}
              aria-pressed={mode === "colecao"}
              onClick={() => setMode("colecao")}
            >
              <IconGrid size={20} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="tk-option-title">{t("onb.mode.collection")}</span>
                <span className="tk-option-detail">
                  {t("onb.mode.collectionDetail")}
                </span>
              </span>
            </button>
          </div>

          <button
            type="button"
            className="tk-option"
            data-active={assistant || undefined}
            aria-pressed={assistant}
            style={{ marginTop: 22 }}
            onClick={() => setAssistant((a) => !a)}
          >
            <span className="tk-option-mark" aria-hidden="true">
              {assistant ? "●" : "○"}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="tk-option-title">{t("onb.assistant")}</span>
              <span className="tk-option-detail">
                {t("onb.assistantDetail")}
              </span>
            </span>
          </button>

          <button
            type="button"
            className="tk-btn tk-btn--primary tk-btn--block"
            style={{ marginTop: 26 }}
            onClick={() => setStep(2)}
          >
            {t("onb.continue")}
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="tk-sheet-title" style={{ marginBottom: 6 }}>
            {t("onb.lastThing")}
          </h2>
          <p className="tk-caption" style={{ marginBottom: 18, lineHeight: 1.5 }}>
            {install.platform === "ios" ? t("onb.installIos") : t("onb.installOther")}
          </p>

          <button
            type="button"
            className="tk-btn tk-btn--primary tk-btn--block"
            onClick={() => setGuideOpen(true)}
          >
            <IconDownload size={16} />
            {t("onb.seeHowToInstall")}
          </button>
          <button
            type="button"
            className="tk-btn tk-btn--secondary tk-btn--block"
            style={{ marginTop: 10 }}
            onClick={finish}
          >
            {t("onb.skipInstall")}
          </button>

          {guideOpen && (
            <InstallGuide
              platform={install.platform}
              promptInstall={install.promptInstall}
              onClose={() => {
                setGuideOpen(false);
                finish();
              }}
            />
          )}
        </>
      )}
    </div>,
    document.body,
  );
}
