import { useState } from "react";
import { createPortal } from "react-dom";

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
  const [mode, setMode] = useState<UsageMode>("consulta");
  const [assistant, setAssistant] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const install = useInstallState();

  const finish = () => updateSetup({ done: true, mode, assistant });

  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label="Boas-vindas">
      {step === 0 && (
        <>
          <div className="tk-onb-mark" aria-hidden="true">
            TK
          </div>
          <h1 className="tk-h1" style={{ marginTop: 24 }}>
            TrainerKit
          </h1>
          <p className="tk-body" style={{ lineHeight: 1.6 }}>
            Um app que responde uma pergunta por vez: esse Pokémon presta, e pra quê.
            Tudo fica no seu aparelho — sem conta, sem login, e nada é enviado pra
            lugar nenhum.
          </p>
          <button
            type="button"
            className="tk-btn tk-btn--primary tk-btn--block"
            style={{ marginTop: 28 }}
            onClick={() => setStep(1)}
          >
            Começar
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="tk-sheet-title" style={{ marginBottom: 6 }}>
            Como você quer usar?
          </h2>
          <p className="tk-caption" style={{ marginBottom: 18, lineHeight: 1.5 }}>
            Dá pra trocar depois nos Ajustes.
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
                <span className="tk-option-title">Só consultar</span>
                <span className="tk-option-detail">
                  Busca qualquer Pokémon e vê os melhores ataques, o PC máximo e o IV
                  por print. Não cadastra nada.
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
                <span className="tk-option-title">Montar minha coleção</span>
                <span className="tk-option-detail">
                  Salva os seus Pokémon e o app diz o que fazer com cada um: investir,
                  evoluir, guardar ou transferir.
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
              <span className="tk-option-title">Assistente</span>
              <span className="tk-option-detail">
                Dá uma opinião em texto sobre cada Pokémon, em vez de só mostrar
                número. Funciona no aparelho, sem internet.
              </span>
            </span>
          </button>

          <button
            type="button"
            className="tk-btn tk-btn--primary tk-btn--block"
            style={{ marginTop: 26 }}
            onClick={() => setStep(2)}
          >
            Continuar
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="tk-sheet-title" style={{ marginBottom: 6 }}>
            Uma última coisa
          </h2>
          <p className="tk-caption" style={{ marginBottom: 18, lineHeight: 1.5 }}>
            {install.platform === "ios"
              ? "No iPhone isso não é só conveniência: o Safari apaga os dados de sites parados há 7 dias. Instalado, o TrainerKit fica protegido."
              : "Instalado, ele abre em tela cheia, funciona offline e recebe print direto pelo botão de compartilhar."}
          </p>

          <button
            type="button"
            className="tk-btn tk-btn--primary tk-btn--block"
            onClick={() => setGuideOpen(true)}
          >
            <IconDownload size={16} />
            Ver como instalar
          </button>
          <button
            type="button"
            className="tk-btn tk-btn--secondary tk-btn--block"
            style={{ marginTop: 10 }}
            onClick={finish}
          >
            Agora não, abrir o app
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
