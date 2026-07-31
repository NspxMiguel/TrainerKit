import { useEffect, type ReactNode } from "react";
import { useFolha } from "./folha.ts";
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
  /* A folha sai animada: quem segura o no durante a saida e o `useFolha`. Todo
     caminho de fechamento passa por `fechar`, nunca pelo `onClose` cru — um que
     escape volta a piscar, e so aquele. */
  const { saindo, ref: refFolha, fechar } = useFolha(onClose);

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
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);

  return createPortal(
    <div ref={refFolha}
      className="tk-sheet-full" role="dialog" aria-modal="true" aria-label={title} data-saindo={saindo || undefined}>
      {/*
        A volta EM CIMA, o titulo alinhado com o resto do app.
        
        Antes os dois dividiam uma linha, e o titulo comecava depois do botao. O
        Miguel: "compara o settings com o about ou o privacy". Medido: em
        Ajustes o titulo comeca a 22px e tem 34px; na folha comecava a 62px e
        tinha 26px. Ao entrar numa folha o titulo PULAVA 40px pra direita e
        encolhia — o app parecia trocar de identidade a cada toque.

        Agora a folha usa o mesmo `.tk-h1` das telas, na mesma margem, e a volta
        vive numa linha propria acima. Entrar num assunto deixa de ser uma
        mudanca de layout e passa a ser so mais conteudo.
      */}
      <header className="tk-sheet-head">
        <button
          type="button"
          className="tk-sheet-close"
          onClick={fechar}
          aria-label={t("common.back")}
        >
          ‹
        </button>
      </header>
      <h1 className="tk-h1">{title}</h1>

      {children}
    </div>,
    document.body,
  );
}
