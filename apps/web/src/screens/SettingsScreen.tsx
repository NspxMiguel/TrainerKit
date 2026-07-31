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
import { Segmented } from "../ui/Segmented.tsx";
import { SettingsSheet } from "../ui/SettingsSheet.tsx";
import { FeedbackScreen } from "./FeedbackScreen.tsx";
import { HelpProject } from "./HelpProject.tsx";
import { PrivacyScreen } from "./PrivacyScreen.tsx";
import { updateSetup, useSetup } from "../onboarding/setup.ts";
import { salvarTema, temaSalvo, type Tema } from "../ui/tema.ts";
import { useAi } from "../ai/provider.ts";
import { chosenVoiceName, voiceOn } from "../ui/dexVoice.ts";
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
import { VoiceSettings } from "./VoiceSettings.tsx";
import { WipeDialog } from "../ui/WipeDialog.tsx";

interface Props {
  datasetLabel: string | null;
  persist: PersistState | null;
  /** Precisa da lista pra saber quantas imagens existem pra baixar. */
  species: readonly DatasetSpecies[];
  /** Procedencia declarada pelo dataset carregado. */
  sources?: DatasetSource[] | undefined;
}

/*
 * O tipo do tema vem de `ui/tema.ts`, que e quem le e aplica. Duplicar a uniao
 * aqui era como o `applyTheme` acabou existindo em dois lugares e valendo em
 * um so.
 */
type Theme = Tema;

/** Qual assunto esta aberto. `null` e o indice. */
type Painel =
  | "look"
  | "usage"
  | "lang"
  | "images"
  | "voice"
  | "data"
  | "ai"
  | "storage"
  | "updates"
  | "about"
  | "privacy"
  | "feedback"
  | "help";

const THEME_KEYS: Record<Theme, Key> = {
  sistema: "settings.theme.system",
  claro: "settings.theme.light",
  escuro: "settings.theme.dark",
};

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
  const ai = useAi();
  const { t } = useT();
  const setup = useSetup();
  const [guideOpen, setGuideOpen] = useState(false);
  /*
   * ⚠️ A leitura e a aplicacao do tema mudaram pra `ui/tema.ts`, e nao por
   * organizacao: elas moravam AQUI, num `useEffect` desta tela, e esta tela so
   * monta quando alguem abre a aba. O tema salvo era ignorado no arranque.
   *
   * Aqui sobra o que e mesmo desta tela: o estado do controle.
   */
  const [theme, setTheme] = useState<Theme>(temaSalvo);

  useEffect(() => {
    salvarTema(theme);
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
        {/* A voz fica junto do resto da aparencia: e como o app se apresenta,
            nao um detalhe da Pokedex. */}
        <Linha
          label={t("voice.title")}
          value={voiceOn() ? (chosenVoiceName(language) ?? t("settings.yes")) : t("ai.off")}
          onOpen={() => setPainel("voice")}
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
          /* Os quatro casos, nomeados. Antes o `shared` caia no `else` e o
             indice anunciava "Groq" pra quem estava na chave compartilhada. */
          value={
            ai.provider === "off"
              ? t("ai.off")
              : ai.provider === "local"
                ? t("ai.provider.local")
                : ai.provider === "shared"
                  ? t("ai.provider.shared")
                  : t("ai.provider.groq")
          }
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
        {/* Privacidade e Feedback ficam junto do Sobre: sao as tres coisas que
            falam do projeto em si, nao do que ele calcula. */}
        <Linha label={t("privacy.title")} onOpen={() => setPainel("privacy")} />
        <Linha label={t("feedback.title")} onOpen={() => setPainel("feedback")} />
        <Linha label={t("help.title")} onOpen={() => setPainel("help")} />
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
          {/*
            ⚠️ LISTA INTEIRA, e a tela rola. NÃO uma roda.

            "quando digo idioma a tela inteira, digo ao invez de ser um scroll
            estatico, escrolar a tela toda. nao um tao pequuen."

            A roda mostrava TRÊS idiomas por vez numa janelinha de 132px, com
            rolagem própria dentro de uma tela que também rola. Duas rolagens
            aninhadas é o pior arranjo possível: o dedo cai na de dentro quando
            queria a de fora, e vice-versa — e nenhuma das duas mostra as dez
            opções que existem.

            Dez linhas é uma lista curta. Ela cabe na tela, rola com a página, e
            mostra tudo o que há sem ninguém precisar descobrir que aquele
            retângulo é arrastável. É o que o próprio sistema faz em Idioma e
            Região — lista, não seletor.

            ⚠️ Eu tinha ido pro lado OPOSTO antes: transformei a tela cheia numa
            folha baixa, porque li "abre tela inteira" como reclamação do
            tamanho. Era do CONTEÚDO.
          */}
          <div className="tk-card tk-lista-radio">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                className="tk-lista-radio-item"
                data-on={l.code === language || undefined}
                aria-pressed={l.code === language}
                onClick={() => setLanguage(l.code)}
              >
                <span className="tk-lista-radio-glifo" aria-hidden="true">
                  {l.flag}
                </span>
                <span className="tk-lista-radio-nome">{l.label}</span>
                {/* O ✓ à direita, e não um radinho à esquerda: o alinhamento do
                    sistema, e o que deixa a coluna dos nomes começar toda no
                    mesmo lugar. */}
                <span className="tk-lista-radio-check" aria-hidden="true">
                  {l.code === language ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>
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

      {painel === "voice" && (
        <SettingsSheet title={t("voice.title")} onClose={fechar}>
          <VoiceSettings />
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

      {painel === "privacy" && (
        <SettingsSheet title={t("privacy.title")} onClose={fechar}>
          <PrivacyScreen />
        </SettingsSheet>
      )}

      {painel === "help" && (
        <SettingsSheet title={t("help.title")} onClose={fechar}>
          {/* O botao leva direto pra tela da chave: instrucao que termina em
              "va procurar nos Ajustes" e instrucao que ninguem segue. */}
          <HelpProject onOpenAi={() => setPainel("ai")} />
        </SettingsSheet>
      )}

      {painel === "feedback" && (
        <SettingsSheet title={t("feedback.title")} onClose={fechar}>
          <FeedbackScreen />
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
