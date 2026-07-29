import { useEffect, useState } from "react";

import type { DatasetSource, DatasetSpecies } from "../data/useDataset.ts";
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
import { updateSetup, useSetup } from "../onboarding/setup.ts";
import { useInstallState } from "../storage/install.ts";
import {
  askUpdateAgain,
  checkForUpdate,
  forceReinstall,
  isMutedForever,
  useUpdate,
} from "../storage/updates.ts";
import { InstallGuide } from "./InstallGuide.tsx";
import { AiSettings } from "./AiSettings.tsx";
import { DataSourceSettings } from "./DataSourceSettings.tsx";
import { SpriteSettings } from "./SpriteSettings.tsx";
import { WipeDialog } from "../ui/WipeDialog.tsx";

interface Props {
  datasetLabel: string | null;
  persist: PersistState | null;
  /** Precisa da lista pra saber quantas imagens existem pra baixar. */
  species: readonly DatasetSpecies[];
  /** Procedencia declarada pelo dataset carregado. */
  sources?: DatasetSource[] | undefined;
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

/**
 * Tamanho legivel.
 *
 * Uma casa decimal so quando ela diz algo: "796,0 MB" finge uma precisao que
 * ninguem pediu e ainda ocupa dois caracteres a toa numa linha ja apertada.
 */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${Math.round(n / 1048576)} MB`;
  const gb = n / 1073741824;
  return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`;
}

export function SettingsScreen({ datasetLabel, persist, species, sources }: Props) {
  const update = useUpdate();
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const install = useInstallState();
  const language = useLanguage();
  const showTranslation = useShowTranslation();
  const { t } = useT();
  const setup = useSetup();
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

      {/* O onboarding promete "da pra trocar depois nos Ajustes" — e ate agora
          nao dava. Modo e assistente sao as duas escolhas daquele fluxo, e
          escolha de setup que nao se desfaz e armadilha. */}
      <div className="tk-overline" style={{ display: "block", marginTop: 28 }}>
        {t("settings.usage")}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {(["consulta", "colecao"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`tk-btn ${setup.mode === m ? "tk-btn--primary" : "tk-btn--secondary"}`}
            style={{ flex: 1, height: 44, padding: 0, fontSize: 13 }}
            aria-pressed={setup.mode === m}
            onClick={() => updateSetup({ mode: m })}
          >
            {m === "consulta" ? t("onb.mode.browse") : t("onb.mode.collection")}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="tk-option"
        data-active={setup.assistant || undefined}
        aria-pressed={setup.assistant}
        style={{ marginTop: 10 }}
        onClick={() => updateSetup({ assistant: !setup.assistant })}
      >
        <span className="tk-option-mark" aria-hidden="true">
          {setup.assistant ? "●" : "○"}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="tk-option-title">{t("onb.assistant")}</span>
          <span className="tk-option-detail">{t("onb.assistantDetail")}</span>
        </span>
      </button>

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
            {/*
              So o que o app usa. A cota saiu.

              `navigator.storage.estimate()` devolve `quota`, e o navegador
              calcula esse numero como uma FATIA DO DISCO LIVRE — daí os "77 GB"
              que apareciam. Nao e espaco reservado pro TrainerKit, nao e
              promessa, e muda sozinho conforme o disco enche. Dizer "2 MB de
              77 GB" sugeria um limite que nao existe e um numero que nao
              significa nada pra quem le.
            */}
            <span className="tk-row-value">{formatBytes(persist.usageBytes)}</span>
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

      <SpriteSettings species={species} />

      <DataSourceSettings datasetLabel={datasetLabel} sources={sources} />

      <AiSettings />

      {/*
        Atualizacao com estado visivel.

        Um app que se atualiza sozinho e magico quando funciona e enlouquecedor
        quando nao funciona, porque nao ha nada na tela pra olhar. Aqui da pra
        ver a data do build, procurar agora, e — se tudo mais falhar — apagar o
        cache e baixar de novo.
      */}
      <div className="tk-overline" style={{ display: "block", marginTop: 28 }}>
        {t("settings.updates")}
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        <div className="tk-row">
          <span className="tk-row-label">{t("settings.version", { version: "0.1.0" })}</span>
          <span className="tk-row-value" style={{ font: "500 11px var(--tk-mono)" }}>
            {t("settings.buildOf", { date: __TK_BUILD__ })}
          </span>
        </div>

        <button
          type="button"
          className="tk-btn tk-btn--secondary tk-btn--block"
          style={{ marginTop: 12 }}
          disabled={update.checking}
          onClick={() => {
            setUpdateMsg(null);
            void checkForUpdate().then((achou) => {
              // Se a pessoa tinha silenciado, procurar de propria vontade e
              // sinal de que quer ver de novo.
              if (achou) askUpdateAgain();
              setUpdateMsg(achou ? t("settings.updateFound") : t("settings.upToDate"));
            });
          }}
        >
          {update.checking ? t("settings.checking") : t("settings.checkUpdate")}
        </button>

        {updateMsg && (
          <p className="tk-caption" style={{ marginTop: 10 }}>
            {updateMsg}
          </p>
        )}

        {isMutedForever() && (
          <button
            type="button"
            className="tk-btn tk-btn--ghost tk-btn--block"
            style={{ height: 38, fontSize: 13, marginTop: 6 }}
            onClick={() => {
              askUpdateAgain();
              setUpdateMsg(null);
            }}
          >
            {t("settings.notifyAgain")}
          </button>
        )}

        <p className="tk-caption" style={{ marginTop: 14, lineHeight: 1.55 }}>
          {t("settings.forceUpdateDetail")}
        </p>
        <button
          type="button"
          className="tk-btn tk-btn--secondary tk-btn--block"
          style={{ marginTop: 8 }}
          onClick={() => void forceReinstall()}
        >
          {t("settings.forceUpdate")}
        </button>

        {/* Apagar tudo fica no fim da secao de manutencao, separado por uma
            linha, e NUNCA com aparencia de botao normal. O dialogo e que
            explica o que se perde e oferece o backup. */}
        <hr className="tk-sep" />
        <p className="tk-caption" style={{ lineHeight: 1.55 }}>
          {t("wipe.openDetail")}
        </p>
        <button
          type="button"
          className="tk-btn tk-btn--danger tk-btn--block"
          style={{ marginTop: 8 }}
          onClick={() => setWipeOpen(true)}
        >
          {t("wipe.open")}
        </button>
      </section>

      {wipeOpen && <WipeDialog onClose={() => setWipeOpen(false)} />}

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
