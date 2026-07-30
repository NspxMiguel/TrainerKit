import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useT } from "../i18n/t.ts";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Uma folha de ajuste.
 *
 * Ajustes tinha nove secoes empilhadas numa tela so, 2.780px de altura — o
 * Miguel: "ajustes ta bem bagunçadinho, da pra da uma organizada". Ele estava
 * certo, e o problema nao era a ordem: era tudo estar aberto ao mesmo tempo.
 * Ninguem entra em Ajustes pra ler nove assuntos, entra pra mexer em um.
 *
 * Entao Ajustes virou indice — uma linha por assunto, com o valor atual a
 * direita — e cada assunto abre aqui. E o padrao do proprio sistema, e resolve
 * as duas coisas de uma vez: a tela inicial cabe sem rolagem e cada assunto
 * ganha a tela inteira quando e a vez dele.
 */
export function SettingsSheet({ title, onClose, children }: Props) {
  const { t } = useT();

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

  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label={title}>
      <header className="tk-sheet-head">
        <button
          type="button"
          className="tk-sheet-close"
          onClick={onClose}
          aria-label={t("common.back")}
        >
          ‹
        </button>
        <h2 className="tk-sheet-title">{title}</h2>
      </header>

      {children}
    </div>,
    document.body,
  );
}
