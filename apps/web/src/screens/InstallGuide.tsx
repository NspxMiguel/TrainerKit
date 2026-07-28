import { useEffect } from "react";
import { createPortal } from "react-dom";

import type { Platform } from "../storage/install.ts";

interface Props {
  platform: Platform;
  promptInstall: (() => Promise<boolean>) | null;
  onClose: () => void;
}

interface Step {
  text: string;
  /** Glifo que imita o icone real do sistema, pra achar o botao na tela. */
  glyph?: string;
}

const STEPS: Record<Platform, { title: string; browser: string; steps: Step[] }> = {
  ios: {
    title: "Instalar no iPhone",
    browser: "Precisa ser pelo Safari — no iPhone só ele consegue instalar.",
    steps: [
      { text: "Toque no botão Compartilhar, na barra de baixo.", glyph: "􀈂" },
      { text: "Role a lista e toque em “Adicionar à Tela de Início”.", glyph: "＋" },
      { text: "Toque em “Adicionar”, no canto superior direito." },
      { text: "Pronto. Abra o TrainerKit pelo ícone, não mais pelo Safari." },
    ],
  },
  android: {
    title: "Instalar no Android",
    browser: "Funciona no Chrome, Edge, Opera ou Samsung Internet.",
    steps: [
      { text: "Toque no menu de três pontos, no canto superior direito.", glyph: "⋮" },
      { text: "Toque em “Instalar app” ou “Adicionar à tela inicial”." },
      { text: "Confirme em “Instalar”." },
      { text: "Pronto. O TrainerKit vira um app na sua gaveta." },
    ],
  },
  desktop: {
    title: "Instalar no computador",
    browser: "Funciona no Chrome, Edge ou Brave.",
    steps: [
      { text: "Clique no ícone de instalar, na barra de endereço.", glyph: "⊕" },
      { text: "Confirme em “Instalar”." },
    ],
  },
};

/** Passo a passo de instalação, separado por sistema. */
export function InstallGuide({ platform, promptInstall, onClose }: Props) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const guide = STEPS[platform];

  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label={guide.title}>
      <header className="tk-sheet-head">
        <button type="button" className="tk-sheet-close" onClick={onClose} aria-label="Fechar">
          ‹
        </button>
        <h2 className="tk-sheet-title">{guide.title}</h2>
      </header>

      <section className="tk-card">
        <div className="tk-overline">Por que vale a pena</div>
        <ul className="tk-reasons">
          <li>Abre direto do ícone, em tela cheia, sem a barra do navegador.</li>
          <li>Funciona offline — os dados do jogo já ficam salvos no aparelho.</li>
          {platform === "ios" && (
            <li>
              <strong>E o mais importante:</strong> o Safari apaga os dados de sites que
              passam 7 dias sem uso. Instalado, ele para de fazer isso — é o que protege a
              sua coleção.
            </li>
          )}
          {platform === "android" && (
            <li>Recebe print direto pelo botão Compartilhar do sistema.</li>
          )}
        </ul>
      </section>

      <p className="tk-caption" style={{ margin: "18px 2px 12px", lineHeight: 1.5 }}>
        {guide.browser}
      </p>

      <ol className="tk-steps">
        {guide.steps.map((step, i) => (
          <li key={step.text}>
            <span className="tk-step-num">{i + 1}</span>
            <span className="tk-step-text">
              {step.text}
              {step.glyph && <span className="tk-step-glyph">{step.glyph}</span>}
            </span>
          </li>
        ))}
      </ol>

      {promptInstall && (
        <button
          type="button"
          className="tk-btn tk-btn--primary tk-btn--block"
          style={{ marginTop: 20 }}
          onClick={() => {
            void promptInstall().then((accepted) => {
              if (accepted) onClose();
            });
          }}
        >
          Instalar agora
        </button>
      )}

      <button
        type="button"
        className="tk-btn tk-btn--secondary tk-btn--block"
        style={{ marginTop: 10 }}
        onClick={onClose}
      >
        Fechar
      </button>
    </div>,
    document.body,
  );
}
