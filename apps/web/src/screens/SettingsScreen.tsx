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
import { IconeAjuste, type SeloAjustes } from "../ui/IconesAjustes.tsx";
import { Segmented } from "../ui/Segmented.tsx";
import { SettingsSheet } from "../ui/SettingsSheet.tsx";
import { FeedbackScreen } from "./FeedbackScreen.tsx";
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
import { DataSourceSettings, textoIdade } from "./DataSourceSettings.tsx";
import { SpriteSettings } from "./SpriteSettings.tsx";
import { VoiceSettings } from "./VoiceSettings.tsx";
import { WipeDialog } from "../ui/WipeDialog.tsx";
import { useOffline } from "../storage/offline.ts";
import { formatBytes } from "../storage/tamanho.ts";
import { SpriteDownloadButton } from "../ui/SpriteDownload.tsx";
import { usePrefetch } from "../sprites/prefetch.ts";

interface Props {
  datasetLabel: string | null;
  /** Idade da base em dias, ou `null` se ela nao carimba. Ver `datasetIdadeDias`. */
  datasetIdade: number | null;
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
  /*
   * ⚠️ "help" SAIU: "tire o ajude o projeto".
   *
   * A tela explicava por que usar a sua própria chave já é a ajuda que o projeto
   * precisa, e dava os links pra criar as chaves da Groq e da ElevenLabs. As
   * duas coisas continuam existindo onde importam — o campo da chave da Groq
   * mora em "Assistente com IA" e o da ElevenLabs em "Voz da Pokédex", cada um
   * com o seu link. O que se perdeu foi uma terceira porta pra chegar neles.
   */;

const THEME_KEYS: Record<Theme, Key> = {
  sistema: "settings.theme.system",
  claro: "settings.theme.light",
  escuro: "settings.theme.dark",
};

/**
 * Os aparelhos em que o app foi DE FATO testado, e que o "Sobre" nomeia.
 *
 * ⚠️ ESCRITO UMA VEZ, e não dez. A frase mora nos dez dicionários; a lista de
 * aparelhos entra nela por parâmetro. Se fosse escrita dentro de cada tradução,
 * o dia em que ele testar num terceiro telefone daria nove arquivos desatualizados
 * e nenhum aviso — e a frase perde o efeito exatamente por ser específica.
 *
 * Não é uma lista de "aparelhos suportados": é o contrário disso. Ela existe pra
 * dizer onde o app NUNCA rodou.
 */
const APARELHOS_TESTADOS = ["Poco X3 Pro", "iPhone 17 Pro"];

/**
 * Uma linha do índice: selo, assunto, valor atual, chevron.
 *
 * ⚠️ O SELO veio do handoff (opção 5g) e faltava. "kd ajustes tipo apple? ta la
 * no claude desing po."
 *
 * A estrutura já estava certa — grupos, valor à direita, seta —, mas sem os
 * selos a tela é uma lista de rótulos cinza. Eles são o que deixa achar uma
 * linha sem ler: pela posição e pela cor. Ver `IconesAjustes.tsx`.
 */
function Linha({
  selo,
  label,
  value,
  onOpen,
  tone,
}: {
  selo: SeloAjustes;
  label: string;
  value?: string | undefined;
  onOpen: () => void;
  tone?: "danger" | undefined;
}) {
  return (
    <button type="button" className="tk-row" onClick={onOpen} data-tone={tone}>
      <IconeAjuste selo={selo} />
      {/*
        ⚠️ O RÓTULO E O VALOR NUM GRUPO PRÓPRIO — o selo e a seta ficam fora.

        A linha quebra em duas quando o idioma é comprido (alemão, francês,
        russo). Com os quatro filhos no mesmo flex, quem descia junto era
        também a SETA: numa linha de rótulo longo e valor vazio — "Apagar todos
        os dados do app" — ela ia sozinha pra segunda linha e ficava um `›`
        solto embaixo do texto.

        Quebrar é do miolo, não da moldura. O selo abre a linha e a seta fecha,
        sempre, em qualquer idioma; o que se reorganiza é o que está entre eles.
      */}
      <span className="tk-row-meio">
        <span className="tk-row-label">{label}</span>
        <span className="tk-row-value">{value !== undefined && value !== "" ? value : ""}</span>
      </span>
      {/* A seta como SVG, e não o caractere "›": o glifo muda de desenho e de
          peso conforme a fonte que o sistema resolve, e numa coluna de nove
          linhas essa variação aparece. O handoff desenha 8×14. */}
      <svg
        className="tk-row-seta"
        width="8"
        height="14"
        viewBox="0 0 8 14"
        aria-hidden="true"
      >
        <path
          d="M1 1l6 6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/**
 * Ajustes como indice.
 *
 * Eram nove secoes abertas ao mesmo tempo, 2.780px de altura numa tela de 844 —
 * ou seja, mais de tres telas de rolagem so pra atravessar. O problema
 * nao era a ordem das secoes, era todas estarem abertas: ninguem entra em
 * Ajustes pra ler nove assuntos, entra pra mexer em UM.
 *
 * Agora cada assunto e uma linha com o valor atual do lado (Aparência ·
 * Escuro), e toca pra abrir a folha dele. A tela inicial cabe sem rolagem, dá
 * pra ver a configuracao inteira de relance, e cada assunto ganha a tela toda
 * quando e a vez dele.
 */
export function SettingsScreen({ datasetLabel, datasetIdade, persist, species, sources }: Props) {
  const update = useUpdate();
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [painel, setPainel] = useState<Painel | null>(null);
  const install = useInstallState();
  const language = useLanguage();
  const showTranslation = useShowTranslation();
  const sprites = useSpriteSettings();
  /* Remede quando um download termina: `pre.done` sobe e a chave muda. Sem
     isto o cartao continuaria dizendo "sob demanda" com as imagens ja no
     aparelho, ate alguem fechar e reabrir Ajustes. */
  const pre = usePrefetch();
  const offline = useOffline(species.length, `${pre.status}:${pre.done}`);
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
          selo="aparencia"
          label={t("settings.appearance")}
          value={t(THEME_KEYS[theme])}
          onOpen={() => setPainel("look")}
        />
        <Linha
          selo="uso"
          label={t("settings.usage")}
          value={setup.mode === "consulta" ? t("onb.mode.browse") : t("onb.mode.collection")}
          onOpen={() => setPainel("usage")}
        />
        <Linha
          selo="idioma" label={t("settings.language")} value={idioma} onOpen={() => setPainel("lang")} />
        <Linha
          selo="imagens"
          label={t("sprites.title")}
          value={fonteDeImagem}
          onOpen={() => setPainel("images")}
        />
        {/* A voz fica junto do resto da aparencia: e como o app se apresenta,
            nao um detalhe da Pokedex. */}
        <Linha
          selo="voz"
          label={t("voice.title")}
          value={voiceOn() ? (chosenVoiceName(language) ?? t("settings.yes")) : t("ai.off")}
          onOpen={() => setPainel("voice")}
        />
      </section>

      {/* De onde vem o que o app mostra, e quem paga a IA. */}
      <section className="tk-card" style={{ marginTop: 14 }}>
        <Linha
          selo="dados"
          label={t("settings.gameData")}
          /* Data e idade na mesma linha: "07/08 · de 2 dias". Sozinha, a data
             nao distingue dois dias de dois anos — ver `datasetIdadeDias`. */
          value={
            datasetLabel
              ? [datasetLabel, textoIdade(t, datasetIdade)].filter(Boolean).join(" · ")
              : undefined
          }
          onOpen={() => setPainel("data")}
        />
        <Linha
          selo="ia"
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
          selo="armazenamento"
          label={t("settings.storage")}
          value={protegido}
          onOpen={() => setPainel("storage")}
        />
        <Linha
          selo="atualizacoes"
          label={t("settings.updates")}
          value={t("settings.version", { version: __TK_VERSAO__ })}
          onOpen={() => setPainel("updates")}
        />
        <Linha
          selo="sobre" label={t("settings.about")} onOpen={() => setPainel("about")} />
        {/* Privacidade e Feedback ficam junto do Sobre: sao as tres coisas que
            falam do projeto em si, nao do que ele calcula. */}
        <Linha
          selo="privacidade" label={t("privacy.title")} onOpen={() => setPainel("privacy")} />
        <Linha
          selo="feedback" label={t("feedback.title")} onOpen={() => setPainel("feedback")} />
      </section>

      {/*
        Apagar tudo, num cartao proprio.

        Estava enterrado no fim da secao de atualizacoes, que e o lugar onde
        ninguem procura e — pior — onde alguem tropeça. Sozinho e em vermelho ele
        fica achavel de propósito e impossivel de confundir com o resto.
      */}
      <section className="tk-card" style={{ marginTop: 14 }}>
        <Linha
          selo="armazenamento" label={t("wipe.open")} onOpen={() => setWipeOpen(true)} tone="danger" />
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
        <SettingsSheet title={t("settings.language")} onClose={fechar} cheia>
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
        <SettingsSheet title={t("sprites.title")} onClose={fechar} cheia>
          <SpriteSettings species={species} />
        </SettingsSheet>
      )}

      {painel === "voice" && (
        <SettingsSheet title={t("voice.title")} onClose={fechar} cheia>
          <VoiceSettings />
        </SettingsSheet>
      )}

      {painel === "data" && (
        <SettingsSheet title={t("settings.gameData")} onClose={fechar}>
          <DataSourceSettings
            datasetLabel={datasetLabel}
            datasetIdade={datasetIdade}
            sources={sources}
          />
        </SettingsSheet>
      )}

      {painel === "ai" && (
        <SettingsSheet title={t("ai.title")} onClose={fechar} cheia>
          <AiSettings />
        </SettingsSheet>
      )}

      {painel === "storage" && (
        <SettingsSheet title={t("settings.storage")} onClose={fechar}>
          {/*
            ⚠️ ESTE CARTAO MEDE. Ele nao simula progresso.

            O handoff pede "um cartao com barra de progresso e a lista do que
            esta sendo baixado: especies e evolucoes, tabela de tipos e
            counters, regras de veredito, os prints do usuario, e a voz neural".

            Quatro desses cinco nao tem o que baixar — o `gamedata.json` (que E
            as especies, as evolucoes, os tipos e os counters, tudo no mesmo
            arquivo) e o codigo das regras entram no PRE-CACHE do service
            worker, e os prints nunca sairam do aparelho. Uma barra enchendo por
            cima de coisas que ja estao la seria carregamento de mentira.

            Entao a lista pergunta ao `CacheStorage` e mostra a resposta. Ver
            `storage/offline.ts`, inclusive pro que ficou de fora e por que.
          */}
          <p className="tk-caption" style={{ margin: "0 2px 8px", lineHeight: 1.5 }}>
            {t("offline.sub")}
          </p>
          <section className="tk-card">
            {offline?.map((item) => (
              <div className="tk-row" key={item.id}>
                <span className="tk-row-label">{t(`offline.${item.id}` as const)}</span>
                <span
                  className="tk-row-value"
                  style={item.estado === "guardado" ? { color: "var(--tk-succ)" } : undefined}
                >
                  {/* A contagem so aparece nas imagens, e so enquanto faltam:
                      "1.182 de 1.182" ao lado de "No aparelho" e ruido. */}
                  {item.estado === "pendente" && item.contagem && item.contagem.feito > 0
                    ? t("offline.imagensConta", {
                        feito: item.contagem.feito,
                        total: item.contagem.total,
                      })
                    : t(item.estado === "guardado" ? "offline.guardado" : "offline.pendente")}
                </span>
              </div>
            ))}
          </section>

          {/*
            O UNICO que falta de verdade: ~150 MB de imagens.

            Reaproveita o botao que ja existe em Ajustes → Imagens, com o mesmo
            aviso de tamanho ANTES de comecar e o mesmo progresso. Duas telas
            baixando a mesma coisa com desenhos diferentes e como o app "parece
            tres apps".
          */}
          <SpriteDownloadButton species={species} />

          <section className="tk-card" style={{ marginTop: 12 }}>
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
                {t("settings.version", { version: __TK_VERSAO__ })}
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
        <SettingsSheet title={t("privacy.title")} onClose={fechar} cheia>
          <PrivacyScreen />
        </SettingsSheet>
      )}

      {painel === "feedback" && (
        <SettingsSheet title={t("feedback.title")} onClose={fechar}>
          <FeedbackScreen />
        </SettingsSheet>
      )}

      {painel === "about" && (
        <SettingsSheet title={t("settings.about")} onClose={fechar} cheia>
          {/*
            QUEM FEZ E ONDE FOI TESTADO vem ANTES do aviso de marca registrada.

            A ordem nao e detalhe: o aviso legal e o que o app precisa dizer, e
            isto aqui e o que a PESSOA precisa saber. Quem abre "Sobre" num app
            de terceiro esta perguntando "posso confiar nisso?", e a resposta
            honesta e a lista de aparelhos em que ele de fato rodou.
          */}
          <section className="tk-card" style={{ display: "grid", gap: 10 }}>
            <p className="tk-caption" style={{ lineHeight: 1.6 }}>
              {t("about.solo")}
            </p>
            <p className="tk-caption" style={{ lineHeight: 1.6 }}>
              {t("about.devices", { aparelhos: APARELHOS_TESTADOS.join(" · ") })}
            </p>
            <p className="tk-caption" style={{ lineHeight: 1.6 }}>
              {t("about.tellMe")}
            </p>

            {/* Leva pro canal que ja existe, em vez de repetir o e-mail aqui:
                um endereco escrito em dois lugares e um endereco que um dia vai
                estar errado num deles. */}
            <button type="button" className="tk-lite" onClick={() => setPainel("feedback")}>
              <span className="tk-lite-t">{t("about.toFeedback")}</span>
              <span className="tk-lite-go" aria-hidden="true">
                ›
              </span>
            </button>
          </section>

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
