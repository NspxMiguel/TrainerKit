import { useState } from "react";
import { createPortal } from "react-dom";

import { setGroqKey } from "../ai/groq.ts";
import { hasWebGPU } from "../ai/local.ts";
import { setProvider, sharedAvailable, type AiProvider } from "../ai/provider.ts";
import { useT } from "../i18n/t.ts";
import { InstallGuide } from "../screens/InstallGuide.tsx";
import { useInstallState } from "../storage/install.ts";
import { IconDownload, IconGrid, IconSearch } from "../ui/Icons.tsx";
import { updateSetup, type UsageMode } from "./setup.ts";

/**
 * Primeira abertura.
 *
 * Telas que NAO ROLAM. Cada uma cabe inteira no aparelho e tem um botao fixo
 * embaixo — e assim que app se comporta; rolar pra achar o "continuar" e
 * comportamento de site.
 *
 * O idioma saiu daqui. Ele ja e detectado pelo aparelho no `language.ts`, e
 * quem quiser trocar acha em Ajustes. Pedir idioma na primeira tela era pedir
 * uma decisao que o sistema ja tinha tomado.
 */
type StepId = "boas-vindas" | "modo" | "ia" | "instalar";

export function Onboarding() {
  const [step, setStep] = useState(0);
  /**
   * Pra onde a tela esta indo. Sem isto, voltar tem a mesma animacao de
   * avancar, e ai o movimento nao quer dizer nada — o usuario ve algo se mexer
   * sem entender se progrediu ou regrediu.
   */
  const [dir, setDir] = useState<1 | -1>(1);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<UsageMode>("consulta");
  const [assistant, setAssistant] = useState(true);
  const [iaEscolha, setIaEscolha] = useState<AiProvider>("off");
  const [chave, setChave] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const install = useInstallState();
  const { t } = useT();

  /**
   * O passo de instalar so existe se ainda houver o que instalar.
   *
   * O Miguel instalou o app na tela de inicio e o setup continuou pedindo pra
   * instalar — o app estava, literalmente, aberto dentro do proprio icone
   * enquanto sugeria que ele criasse um. Nao e so um passo inutil: destroi a
   * confianca, porque o app claramente nao sabe onde esta rodando.
   */
  /*
   * O passo da IA entra no setup.
   *
   * "no setup pergunta da groq api key. deixa o setup mais completo". Ele esta
   * certo: a IA era a unica escolha do app que ficava escondida em Ajustes, e
   * quem nunca abriu Ajustes nunca soube que existia. Perguntar aqui tambem e o
   * lugar honesto pra dizer o preco de cada opcao — chave propria, modelo no
   * aparelho, ou nada.
   */
  const steps: StepId[] = install.installed
    ? ["boas-vindas", "modo", "ia"]
    : ["boas-vindas", "modo", "ia", "instalar"];

  const current = steps[step]!;
  const last = step === steps.length - 1;

  const finish = () => {
    /*
     * A escolha de IA e gravada AQUI, no fim do setup — nao a cada toque.
     *
     * Se fosse gravando a cada clique, quem passeasse pelas opcoes ligaria e
     * desligaria o provedor varias vezes, e no caso do local isso descarrega e
     * recarrega a GPU sem motivo.
     */
    const limpa = chave.trim();
    if (iaEscolha === "groq" && limpa !== "") setGroqKey(limpa);
    setProvider(iaEscolha === "groq" && limpa === "" ? "off" : iaEscolha);
    updateSetup({ done: true, mode, assistant, name: name.trim() });
  };

  const go = (delta: 1 | -1) => {
    setDir(delta);
    setStep((s) => Math.min(steps.length - 1, Math.max(0, s + delta)));
  };

  return createPortal(
    <div className="tk-onb" role="dialog" aria-modal="true" aria-label={t("onb.aria")}>
      <div className="tk-onb-top">
        {/* Voltar so aparece quando ha pra onde voltar. Um botao permanentemente
            desabilitado ocupa o mesmo espaco e nao serve pra nada. */}
        {step > 0 && (
          <button
            type="button"
            className="tk-onb-back"
            onClick={() => go(-1)}
            aria-label={t("common.back")}
          >
            ‹
          </button>
        )}

        {/* Pontos de progresso: o app diz quantas telas faltam antes de a pessoa
            precisar perguntar. O ativo e mais largo — a barra cresce junto com
            o avanco em vez de so trocar de cor. */}
        <div className="tk-onb-dots" aria-hidden="true">
          {steps.map((id, i) => (
            <span key={id} data-on={i <= step || undefined} data-now={i === step || undefined} />
          ))}
        </div>
      </div>

      <div className="tk-onb-body" key={current} data-dir={dir === 1 ? "fwd" : "back"}>
        {current === "boas-vindas" && (
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

        {current === "modo" && (
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

        {current === "ia" && (
          <>
            <h1 className="tk-onb-title">{t("onb.ai.title")}</h1>
            <p className="tk-onb-sub">{t("onb.ai.sub")}</p>

            <div className="tk-onb-options">
              <button
                type="button"
                className="tk-option"
                data-active={iaEscolha === "off" || undefined}
                aria-pressed={iaEscolha === "off"}
                onClick={() => setIaEscolha("off")}
              >
                <span className="tk-option-mark" aria-hidden="true">
                  {iaEscolha === "off" ? "●" : "○"}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="tk-option-title">{t("onb.ai.off")}</span>
                  <span className="tk-option-detail">{t("onb.ai.offDetail")}</span>
                </span>
              </button>

              {/* Gratis com limite: so aparece se a funcao existe neste build. */}
              {sharedAvailable() && (
                <button
                  type="button"
                  className="tk-option"
                  data-active={iaEscolha === "shared" || undefined}
                  aria-pressed={iaEscolha === "shared"}
                  onClick={() => setIaEscolha("shared")}
                >
                  <span className="tk-option-mark" aria-hidden="true">
                    {iaEscolha === "shared" ? "●" : "○"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="tk-option-title">{t("onb.ai.shared")}</span>
                    <span className="tk-option-detail">{t("onb.ai.sharedDetail")}</span>
                  </span>
                </button>
              )}

              <button
                type="button"
                className="tk-option"
                data-active={iaEscolha === "groq" || undefined}
                aria-pressed={iaEscolha === "groq"}
                onClick={() => setIaEscolha("groq")}
              >
                <span className="tk-option-mark" aria-hidden="true">
                  {iaEscolha === "groq" ? "●" : "○"}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="tk-option-title">{t("onb.ai.groq")}</span>
                  <span className="tk-option-detail">{t("onb.ai.groqDetail")}</span>
                </span>
              </button>

              {/* O campo aparece SÓ quando ele escolhe a Groq: um campo de chave
                  de API sempre visivel assusta quem nao quer IA nenhuma. */}
              {iaEscolha === "groq" && (
                <div className="tk-search tk-onb-field" style={{ marginTop: 0 }}>
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="gsk_…"
                    value={chave}
                    onChange={(e) => setChave(e.target.value)}
                    aria-label={t("ai.keyAria")}
                  />
                </div>
              )}

              {/* So oferece o modelo local onde ele realmente roda. Prometer e
                  falhar depois de 1,7 GB de download seria cruel. */}
              {hasWebGPU() && (
                <button
                  type="button"
                  className="tk-option"
                  data-active={iaEscolha === "local" || undefined}
                  aria-pressed={iaEscolha === "local"}
                  onClick={() => setIaEscolha("local")}
                >
                  <span className="tk-option-mark" aria-hidden="true">
                    {iaEscolha === "local" ? "●" : "○"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="tk-option-title">{t("onb.ai.local")}</span>
                    <span className="tk-option-detail">{t("onb.ai.localDetail")}</span>
                  </span>
                </button>
              )}
            </div>
          </>
        )}

        {current === "instalar" && (
          <>
            <div className="tk-onb-mark tk-onb-mark--small" aria-hidden="true">
              <IconDownload size={30} />
            </div>
            <h1 className="tk-onb-title">{t("onb.lastThing")}</h1>
            <p className="tk-onb-sub">
              {install.platform === "iphone" || install.platform === "ipad"
                ? t("onb.installIos")
                : t("onb.installOther")}
            </p>
          </>
        )}
      </div>

      {/* Rodape fixo: o botao de avancar fica sempre no mesmo lugar, em todas as
          telas, e nunca depende de rolagem pra aparecer. */}
      <div className="tk-onb-foot">
        {current !== "instalar" ? (
          <button
            type="button"
            className="tk-btn tk-btn--primary tk-btn--block"
            onClick={() => (last ? finish() : go(1))}
          >
            {step === 0 ? t("onb.start") : last ? t("onb.open") : t("onb.continue")}
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
            <button type="button" className="tk-btn tk-btn--ghost tk-btn--block" onClick={finish}>
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
