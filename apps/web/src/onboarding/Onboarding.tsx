import { useState } from "react";
import { createPortal } from "react-dom";

import { useT } from "../i18n/t.ts";
import { InstallGuide } from "../screens/InstallGuide.tsx";
import { useInstallState } from "../storage/install.ts";
import { IconDownload, IconGrid, IconSearch } from "../ui/Icons.tsx";
import { updateSetup, type UsageMode } from "./setup.ts";

/**
 * Primeira abertura.
 *
 * Tres telas que NAO ROLAM. Cada uma cabe inteira no aparelho e tem um botao
 * fixo embaixo — e assim que app se comporta; rolar pra achar o "continuar" e
 * comportamento de site.
 *
 * O idioma saiu daqui. Ele ja e detectado pelo aparelho no `language.ts`, e
 * quem quiser trocar acha em Ajustes. Pedir idioma na primeira tela era pedir
 * uma decisao que o sistema ja tinha tomado.
 */
const STEPS = 3;

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<UsageMode>("consulta");
  const [assistant, setAssistant] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const install = useInstallState();
  const { t } = useT();

  const finish = () => updateSetup({ done: true, mode, assistant, name: name.trim() });

  return createPortal(
    <div className="tk-onb" role="dialog" aria-modal="true" aria-label={t("onb.aria")}>
      {/* Pontos de progresso: o app diz quantas telas faltam antes de a pessoa
          precisar perguntar. Tres pontos e informacao; barra de porcentagem
          seria enfeite. */}
      <div className="tk-onb-dots" aria-hidden="true">
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} data-on={i <= step || undefined} />
        ))}
      </div>

      <div className="tk-onb-body">
        {step === 0 && (
          <>
            <div className="tk-onb-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h1 className="tk-onb-title">TrainerKit</h1>
            <p className="tk-onb-sub">{t("onb.tagline")}</p>

            <div className="tk-search tk-onb-field">
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
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="tk-onb-title">{t("onb.howToUse")}</h1>

            <div className="tk-onb-options">
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
                  <span className="tk-option-detail">{t("onb.mode.browseDetail")}</span>
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
                  <span className="tk-option-detail">{t("onb.mode.collectionDetail")}</span>
                </span>
              </button>

              <button
                type="button"
                className="tk-option"
                data-active={assistant || undefined}
                aria-pressed={assistant}
                onClick={() => setAssistant((a) => !a)}
              >
                <span className="tk-option-mark" aria-hidden="true">
                  {assistant ? "●" : "○"}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="tk-option-title">{t("onb.assistant")}</span>
                  <span className="tk-option-detail">{t("onb.assistantDetail")}</span>
                </span>
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="tk-onb-mark tk-onb-mark--small" aria-hidden="true">
              <IconDownload size={30} />
            </div>
            <h1 className="tk-onb-title">{t("onb.lastThing")}</h1>
            <p className="tk-onb-sub">
              {install.platform === "ios" ? t("onb.installIos") : t("onb.installOther")}
            </p>
          </>
        )}
      </div>

      {/* Rodape fixo: o botao de avancar fica sempre no mesmo lugar, nas tres
          telas, e nunca depende de rolagem pra aparecer. */}
      <div className="tk-onb-foot">
        {step < 2 ? (
          <button
            type="button"
            className="tk-btn tk-btn--primary tk-btn--block"
            onClick={() => setStep((s) => s + 1)}
          >
            {step === 0 ? t("onb.start") : t("onb.continue")}
          </button>
        ) : (
          <>
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
              className="tk-btn tk-btn--ghost tk-btn--block"
              onClick={finish}
            >
              {t("onb.skipInstall")}
            </button>
          </>
        )}
      </div>

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
    </div>,
    document.body,
  );
}
