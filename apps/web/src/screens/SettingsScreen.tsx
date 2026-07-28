import { useEffect, useState } from "react";

import type { PersistState } from "../storage/persist.ts";
import {
  LANGUAGES,
  setLanguage,
  setShowTranslation,
  useLanguage,
  useShowTranslation,
} from "../i18n/language.ts";
import { useInstallState } from "../storage/install.ts";
import { InstallGuide } from "./InstallGuide.tsx";
import { SpriteSettings } from "./SpriteSettings.tsx";

interface Props {
  datasetLabel: string | null;
  persist: PersistState | null;
}

type Theme = "sistema" | "claro" | "escuro";

const THEME_KEY = "tk:tema";

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
      <h1 className="tk-h1">Ajustes</h1>

      <div className="tk-overline">Aparência</div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {(["sistema", "claro", "escuro"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`tk-btn ${theme === t ? "tk-btn--primary" : "tk-btn--secondary"}`}
              style={{ flex: 1, height: 44, padding: 0, fontSize: 13 }}
              aria-pressed={theme === t}
            >
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <div className="tk-overline" style={{ display: "block", marginTop: 28 }}>
        Armazenamento
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        {install.installed ? (
          <div className="tk-row">
            <span className="tk-row-label">Instalado na tela de início</span>
            <span className="tk-row-value">Sim</span>
          </div>
        ) : (
          <button type="button" className="tk-row" onClick={() => setGuideOpen(true)}>
            <span className="tk-row-label">Instalar na tela de início</span>
            <span className="tk-row-value">ver como ›</span>
          </button>
        )}
        <div className="tk-row">
          <span className="tk-row-label">Dados protegidos</span>
          <span
            className="tk-row-value"
            style={
              persist?.supported && !persist.persisted ? { color: "var(--tk-warn)" } : undefined
            }
          >
            {persist === null
              ? "verificando…"
              : !persist.supported
                ? "não suportado"
                : persist.persisted
                  ? "sim"
                  : "não"}
          </span>
        </div>
        {persist?.supported && persist.usageBytes !== null && (
          <div className="tk-row">
            <span className="tk-row-label">Espaço usado</span>
            <span className="tk-row-value">
              {formatBytes(persist.usageBytes)}
              {persist.quotaBytes !== null && ` de ${formatBytes(persist.quotaBytes)}`}
            </span>
          </div>
        )}
      </section>

      <div className="tk-overline" style={{ display: "block", marginTop: 28 }}>
        Idioma
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
            <span className="tk-option-title">Mostrar tradução dos ataques</span>
            <span className="tk-option-detail">
              Counter (Contra-atacar). Desligado, fica só o inglês.
            </span>
          </span>
        </button>
      )}

      <SpriteSettings />

      <div className="tk-overline" style={{ display: "block", marginTop: 28 }}>
        Dados do jogo
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        <div className="tk-row">
          <span className="tk-row-label">Versão da base</span>
          <span className="tk-row-value">{datasetLabel ?? "—"}</span>
        </div>
      </section>

      <div className="tk-overline" style={{ display: "block", marginTop: 28 }}>
        Sobre
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        <p className="tk-caption" style={{ lineHeight: 1.6 }}>
          App independente feito por fãs, sem vínculo com Scopely Explore (ex-Niantic),
          The Pokémon Company ou Nintendo. Marcas pertencem aos seus titulares.
        </p>
        <p className="tk-caption" style={{ lineHeight: 1.6, marginTop: 10 }}>
          Funciona só por leitura de prints que você fornece. Não acessa os servidores do
          jogo, e nenhuma imagem sai do aparelho.
        </p>
        <p className="tk-caption" style={{ marginTop: 12, color: "var(--tk-txt4)" }}>
          Versão 0.1.0
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
