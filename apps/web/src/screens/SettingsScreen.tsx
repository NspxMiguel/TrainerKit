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
import { Segmented } from "../ui/Segmented.tsx";
import { SettingsSheet } from "../ui/SettingsSheet.tsx";
import { updateSetup, useSetup } from "../onboarding/setup.ts";
import { useGroq } from "../ai/groq.ts";
import { SOURCE_KEYS, useSpriteSettings } from "../sprites/settings.ts";
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

/** Qual assunto esta aberto. `null` e o indice. */
type Painel = "look" | "usage" | "lang" | "images" | "data" | "ai" | "storage" | "updates" | "about";

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

/** Uma linha do indice: assunto a esquerda, valor atual a direita. */
function Linha({
  label,
  value,
  onOpen,
  tone,
}: {
  label: string;
  value?: string | undefined;
  onOpen: () => void;
  tone?: "danger" | undefined;
}) {
  return (
    <button type="button" className="tk-row" onClick={onOpen} data-tone={tone}>
      <span className="tk-row-label">{label}</span>
      <span className="tk-row-value">
        {value !== undefined && value !== "" ? `${value} ` : ""}›
      </span>
    </button>
  );
}

/**
 * Ajustes como indice.
 *
 * Eram nove secoes abertas ao mesmo tempo, 2.780px de altura numa tela de 844 —
 * o Miguel: "ajustes ta bem bagunçadinho, da pra da uma organizada". O problema
 * nao era a ordem das secoes, era todas estarem abertas: ninguem entra em
 * Ajustes pra ler nove assuntos, entra pra mexer em UM.
 *
 * Agora cada assunto e uma linha com o valor atual do lado (Aparência ·
 * Escuro), e toca pra abrir a folha dele. A tela inicial cabe sem rolagem, dá
 * pra ver a configuracao inteira de relance, e cada assunto ganha a tela toda
 * quando e a vez dele.
 */
export function SettingsScreen({ datasetLabel, persist, species, sources }: Props) {
  const update = useUpdate();
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [painel, setPainel] = useState<Painel | null>(null);
  const install = useInstallState();
  const language = useLanguage();
  const showTranslation = useShowTranslation();
  const sprites = useSpriteSettings();
  const groq = useGroq();
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

  const fechar = () => setPainel(null);

  const idioma = LANGUAGES.find((l) => l.code === language)?.label ?? language;
  // `SOURCE_KEYS` guarda a chave como `string` solto, e `t()` exige `Key`. O
  // estreitamento e explicito aqui em vez de mentir na tipagem do modulo.
  const fonteDeImagem = sprites.source.startsWith("src:")
    ? t("sprites.custom")
    : t((SOURCE_KEYS[sprites.source as "off"]?.title ?? "sprites.title") as Key);
  const protegido =
    persist === null
      ? t("settings.checking")
      : !persist.supported
        ? t("settings.unsupported")
        : persist.persisted
          ? t("settings.yes")
          : t("settings.no");

  return (
    <>
      <h1 className="tk-h1">{t("settings.title")}</h1>

      {/* Como o app se parece e como ele fala com você. */}
      <section className="tk-card">
        <Linha
          label={t("settings.appearance")}
          value={t(THEME_KEYS[theme])}
          onOpen={() => setPainel("look")}
        />
        <Linha
          label={t("settings.usage")}
          value={setup.mode === "consulta" ? t("onb.mode.browse") : t("onb.mode.collection")}
          onOpen={() => setPainel("usage")}
        />
        <Linha label={t("settings.language")} value={idioma} onOpen={() => setPainel("lang")} />
        <Linha
          label={t("sprites.title")}
          value={fonteDeImagem}
          onOpen={() => setPainel("images")}
        />
      </section>

      {/* De onde vem o que o app mostra, e quem paga a IA. */}
      <section className="tk-card" style={{ marginTop: 14 }}>
        <Linha
          label={t("settings.gameData")}
          value={datasetLabel ?? undefined}
          onOpen={() => setPainel("data")}
        />
        <Linha
          label={t("ai.title")}
          value={groq.key ? t("ai.on") : t("ai.off")}
          onOpen={() => setPainel("ai")}
        />
      </section>

      {/* Manutencao: onde os dados moram e como o app se atualiza. */}
      <section className="tk-card" style={{ marginTop: 14 }}>
        <Linha
          label={t("settings.storage")}
          value={protegido}
          onOpen={() => setPainel("storage")}
        />
        <Linha
          label={t("settings.updates")}
          value={t("settings.version", { version: "0.1.0" })}
          onOpen={() => setPainel("updates")}
        />
        <Linha label={t("settings.about")} onOpen={() => setPainel("about")} />
      </section>

      {/*
        Apagar tudo, num cartao proprio.

        Estava enterrado no fim da secao de atualizacoes, que e o lugar onde
        ninguem procura e — pior — onde alguem tropeça. Sozinho e em vermelho ele
        fica achavel de propósito e impossivel de confundir com o resto.
      */}
      <section className="tk-card" style={{ marginTop: 14 }}>
        <Linha label={t("wipe.open")} onOpen={() => setWipeOpen(true)} tone="danger" />
      </section>

      {painel === "look" && (
        <SettingsSheet title={t("settings.appearance")} onClose={fechar}>
          <Segmented
            ariaLabel={t("settings.appearance")}
            value={theme}
            onChange={setTheme}
            options={(["sistema", "claro", "escuro"] as const).map((o) => ({
              value: o,
              label: t(THEME_KEYS[o]),
            }))}
          />
        </SettingsSheet>
      )}

      {painel === "usage" && (
        <SettingsSheet title={t("settings.usage")} onClose={fechar}>
          {/* O onboarding promete "da pra trocar depois nos Ajustes" — e ate
              uma versao atras nao dava. Escolha de setup que nao se desfaz e
              armadilha. */}
          <Segmented
            ariaLabel={t("settings.usage")}
            value={setup.mode}
            onChange={(mode) => updateSetup({ mode })}
            options={[
              { value: "consulta" as const, label: t("onb.mode.browse") },
              { value: "colecao" as const, label: t("onb.mode.collection") },
            ]}
          />

          <button
            type="button"
            className="tk-option"
            data-active={setup.assistant || undefined}
            aria-pressed={setup.assistant}
            style={{ marginTop: 14 }}
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
        </SettingsSheet>
      )}

      {painel === "lang" && (
        <SettingsSheet title={t("settings.language")} onClose={fechar}>
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
              style={{ marginTop: 12 }}
              onClick={() => setShowTranslation(!showTranslation)}
            >
              <span className="tk-option-mark" aria-hidden="true">
                {showTranslation ? "●" : "○"}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="tk-option-title">{t("settings.showTranslation")}</span>
                <span className="tk-option-detail">{t("settings.showTranslationDetail")}</span>
              </span>
            </button>
          )}
        </SettingsSheet>
      )}

      {painel === "images" && (
        <SettingsSheet title={t("sprites.title")} onClose={fechar}>
          <SpriteSettings species={species} />
        </SettingsSheet>
      )}

      {painel === "data" && (
        <SettingsSheet title={t("settings.gameData")} onClose={fechar}>
          <DataSourceSettings datasetLabel={datasetLabel} sources={sources} />
        </SettingsSheet>
      )}

      {painel === "ai" && (
        <SettingsSheet title={t("ai.title")} onClose={fechar}>
          <AiSettings />
        </SettingsSheet>
      )}

      {painel === "storage" && (
        <SettingsSheet title={t("settings.storage")} onClose={fechar}>
          <section className="tk-card">
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
                  persist?.supported && !persist.persisted
                    ? { color: "var(--tk-warn)" }
                    : undefined
                }
              >
                {protegido}
              </span>
            </div>
            {persist?.supported && persist.usageBytes !== null && (
              <div className="tk-row">
                <span className="tk-row-label">{t("settings.spaceUsed")}</span>
                {/*
                  So o que o app usa. A cota saiu.

                  `navigator.storage.estimate()` devolve `quota`, e o navegador
                  calcula esse numero como uma FATIA DO DISCO LIVRE — daí os "77
                  GB" que apareciam. Nao e espaco reservado pro TrainerKit, nao e
                  promessa, e muda sozinho conforme o disco enche.
                */}
                <span className="tk-row-value">{formatBytes(persist.usageBytes)}</span>
              </div>
            )}
          </section>
        </SettingsSheet>
      )}

      {painel === "updates" && (
        <SettingsSheet title={t("settings.updates")} onClose={fechar}>
          {/*
            Atualizacao com estado visivel.

            Um app que se atualiza sozinho e magico quando funciona e
            enlouquecedor quando nao funciona, porque nao ha nada na tela pra
            olhar. Aqui da pra ver a data do build, procurar agora, e — se tudo
            mais falhar — apagar o cache e baixar de novo.
          */}
          <section className="tk-card">
            <div className="tk-row">
              <span className="tk-row-label">
                {t("settings.version", { version: "0.1.0" })}
              </span>
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
                  // Procurar de propria vontade e sinal de que quer ver de novo.
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
          </section>
        </SettingsSheet>
      )}

      {painel === "about" && (
        <SettingsSheet title={t("settings.about")} onClose={fechar}>
          <section className="tk-card">
            <p className="tk-caption" style={{ lineHeight: 1.6 }}>
              {t("settings.disclaimer")}
            </p>
            <p className="tk-caption" style={{ lineHeight: 1.6, marginTop: 10 }}>
              {t("settings.disclaimer2")}
            </p>
          </section>
        </SettingsSheet>
      )}

      {wipeOpen && <WipeDialog onClose={() => setWipeOpen(false)} />}

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
