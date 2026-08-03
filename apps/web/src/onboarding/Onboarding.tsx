import { useState } from "react";
import { createPortal } from "react-dom";

import { MAX_POWERUP_LEVEL } from "@trainerkit/core";

import { setGroqKey } from "../ai/groq.ts";
import { hasWebGPU } from "../ai/local.ts";
import { setProvider, sharedAvailable, type AiProvider } from "../ai/provider.ts";
import { LANGUAGES, setLanguage, useLanguage } from "../i18n/language.ts";
import { useT } from "../i18n/t.ts";
import { InstallGuide } from "../screens/InstallGuide.tsx";
import { useInstallState } from "../storage/install.ts";
import { IconDownload, IconGrid, IconSearch } from "../ui/Icons.tsx";
import {
  TRAINER_LEVELS,
  tetoDePowerUp,
  updateSetup,
  type TrainerLevel,
  type UsageMode,
} from "./setup.ts";

/**
 * Primeira abertura.
 *
 * Telas que NAO ROLAM. Cada uma cabe inteira no aparelho e tem um botao fixo
 * embaixo — e assim que app se comporta; rolar pra achar o "continuar" e
 * comportamento de site.
 *
 * ── O IDIOMA VOLTOU, e o comentario que o tirou daqui merece ficar registrado ─
 *
 * Dizia: "O idioma saiu daqui. Ele ja e detectado pelo aparelho no
 * `language.ts`, e quem quiser trocar acha em Ajustes. Pedir idioma na primeira
 * tela era pedir uma decisao que o sistema ja tinha tomado."
 *
 * O sistema tinha tomado a decisao ERRADA, e o dono do app foi quem descobriu:
 * "pelo q eu vi, no setup nao pediu idioma... e nem puxo o idioma correto, sou
 * do brasil e puxo ingles pra mim."
 *
 * A deteccao nao tem bug — o navegador dele responde `en-US`, porque o sistema
 * dele esta em ingles, como o de muita gente no Brasil. O erro foi de premissa:
 * "idioma do aparelho" e "idioma da pessoa" sao a mesma coisa na maioria dos
 * casos e nao em todos, e nas ferramentas de jogo essa diferenca e enorme —
 * metade da comunidade roda tudo em ingles de proposito.
 *
 * Por isso ele e o PRIMEIRO passo, antes ate do nome: e a unica escolha do setup
 * que muda o texto de todos os passos seguintes. Perguntar depois seria mostrar
 * tres telas no idioma errado pra so entao oferecer o certo.
 *
 * A lista nao precisa de titulo traduzido pra funcionar: "Português", "Español",
 * "日本語" se identificam sozinhos, com bandeira. E isso resolve o ovo-e-galinha
 * de rotular a tela de escolher idioma num idioma que ainda nao foi escolhido.
 */
type StepId = "idioma" | "boas-vindas" | "modo" | "ia" | "instalar";

export function Onboarding() {
  const [step, setStep] = useState(0);
  /**
   * Pra onde a tela esta indo. Sem isto, voltar tem a mesma animacao de
   * avancar, e ai o movimento nao quer dizer nada — o usuario ve algo se mexer
   * sem entender se progrediu ou regrediu.
   */
  const [dir, setDir] = useState<1 | -1>(1);
  const [name, setName] = useState("");
  /*
   * 50 e o padrao, e ele NAO e neutro — e o que o app assumia antes de esta
   * escolha existir. Ver a nota do `DEFAULT_SETUP`: comecar em 20 faria a
   * primeira tela do app ja mudar o veredito de quem so quer passar batido.
   */
  const [level, setLevel] = useState<TrainerLevel>(50);
  const [mode, setMode] = useState<UsageMode>("consulta");
  const [assistant, setAssistant] = useState(true);
  const [iaEscolha, setIaEscolha] = useState<AiProvider>("off");
  const [chave, setChave] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const install = useInstallState();
  const { t } = useT();
  /*
   * O idioma nao fica em `useState` como as outras escolhas.
   *
   * As outras (nome, modo, IA) so valem no `finish()`, e por bom motivo — ver a
   * nota la. Esta e o contrario: ela precisa valer NA HORA, porque e ela que
   * traduz os proprios passos seguintes. Guardar pro fim faria a pessoa escolher
   * "Português" e continuar lendo "How do you want to use it?" ate o final.
   *
   * Trocar de ideia tambem nao custa nada: `setLanguage` ja e a store global do
   * app, a mesma que Ajustes usa, e o setup nao tem estado que dependa dela.
   */
  const language = useLanguage();

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
    ? ["idioma", "boas-vindas", "modo", "ia"]
    : ["idioma", "boas-vindas", "modo", "ia", "instalar"];

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
    updateSetup({ done: true, mode, assistant, name: name.trim(), level });
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
        {current === "idioma" && (
          <>
            {/* `settings.language` em vez de uma chave nova: e a mesma palavra, ja
                existe nos dez dicionarios, e o titulo aqui e quase decorativo —
                quem nao le o idioma atual reconhece a propria lingua na lista. */}
            <h1 className="tk-onb-title">{t("settings.language")}</h1>

            {/* A MESMA lista de Ajustes, mesma classe. Ver a nota de
                `SettingsScreen`: lista e nao seletor, com o ✓ a direita. Duas
                telas que fazem a mesma escolha com desenhos diferentes e como o
                app "parece tres apps" — a queixa do briefing. */}
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
                  <span className="tk-lista-radio-check" aria-hidden="true">
                    ✓
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

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

            {/*
              O NIVEL DO TREINADOR — "Nome + nível" e um passo so no handoff.

              ⚠️ Ele nao e um dado de perfil: e o unico campo do setup que muda
              VEREDITO. Ver `tetoDePowerUp`. O `levelCap` que alimenta o calculo
              sempre existiu e estava fixo no teto do jogo, que e o teto de quem
              ja terminou — o app respondia "até 1.260 de PC no nível 50" pra
              quem so consegue chegar ao 22.

              Por isso o cartao abaixo diz a conta em vez de um elogio. Ele
              troca a cada toque, com o teto real da escolha, e e a unica coisa
              nesta tela que a pessoa pode conferir depois no jogo.
            */}
            <h2 className="tk-onb-sub" style={{ marginTop: "var(--tk-s6)" }}>
              {t("onb.level.title")}
            </h2>

            <div className="tk-onb-niveis" role="group" aria-label={t("onb.level.title")}>
              {TRAINER_LEVELS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="tk-onb-nivel"
                  data-on={n === level || undefined}
                  aria-pressed={n === level}
                  onClick={() => setLevel(n)}
                >
                  <span className="tk-onb-nivel-n">{n}</span>
                  <span className="tk-onb-nivel-r">
                    {t(
                      n === 20
                        ? "onb.level.start"
                        : n === 30
                          ? "onb.level.mid"
                          : n === 40
                            ? "onb.level.high"
                            : "onb.level.max",
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/*
              O teto vem de `tetoDePowerUp` e nao de `level + 2` escrito aqui: e
              a MESMA funcao que o veredito usa. Duas contas do mesmo numero em
              lugares diferentes e como a tela passa a prometer um teto e o
              calculo usar outro.
            */}
            <p className="tk-onb-nivel-nota">
              {/*
                `MAX_POWERUP_LEVEL` do core, e nao `50` escrito aqui.

                O setup roda antes de o dataset existir, entao nao da pra ler o
                `version.levelCap` real — e um literal faria desta tela o ultimo
                lugar do app dizendo 50 depois de o jogo subir o teto. E a mesma
                nota que ja esta em `CollectionScreen`.
              */}
              {t("onb.level.what", {
                nivel: level,
                teto: tetoDePowerUp(level, MAX_POWERUP_LEVEL),
              })}
            </p>
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
            {/* "Comecar" mora na tela do NOME, e nao mais no passo 0 — o passo 0
                agora e o idioma, e "Comecar" antes de escolher a lingua prometia
                que a proxima tela ja era o app. */}
            {current === "boas-vindas"
              ? t("onb.start")
              : last
                ? t("onb.open")
                : t("onb.continue")}
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
