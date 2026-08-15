import { useEffect, type ReactNode } from "react";
import { useFolha } from "./folha.ts";
import { createPortal } from "react-dom";

import { useT } from "../i18n/t.ts";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /**
   * Toma a TELA INTEIRA em vez de subir do rodapé.
   *
   * ⚠️ É a exceção, e não o padrão — e já foi o contrário.
   *
   * "n precisa abrir uma tela inteira so pra aparencia. se n é mt grande n
   * precisa abrir tela inteira, abre so pop up."
   *
   * Aparência tem três opções numa linha. Abrir uma tela cheia pra isso custa
   * duas animações, um botão de voltar e a perda do contexto de onde a pessoa
   * estava — tudo pra mostrar 42px de conteúdo num aparelho de 874. A folha de
   * baixo faz o mesmo trabalho sem nada disso.
   *
   * Quem continua cheia é quem tem uma LISTA de verdade — Idioma (dez idiomas
   * que rolam) e Privacidade (texto longo). Idioma por pedido direto dele:
   * "quando digo idioma a tela inteira, digo ao invez de ser um scroll
   * estatico, escrolar a tela toda. nao um tao pequuen."
   */
  cheia?: boolean;
}

/**
 * Uma folha de ajuste.
 *
 * Ajustes tinha nove secoes empilhadas numa tela so, 2.780px de altura — mais
 * de tres telas de rolagem. O problema nao era a ordem: era tudo estar aberto
 * ao mesmo tempo.
 * Ninguem entra em Ajustes pra ler nove assuntos, entra pra mexer em um.
 *
 * Entao Ajustes virou indice — uma linha por assunto, com o valor atual a
 * direita — e cada assunto abre aqui.
 *
 * ── O tamanho da folha segue o CONTEÚDO ─────────────────────────────────────
 *
 * O padrão é uma folha de baixo que ENCOLHE até o tamanho do que tem dentro e
 * para em 86% da tela. Assim a mesma peça serve pros dois extremos sem eu ter
 * que classificar cada assunto: Aparência ocupa 150px, Armazenamento ocupa o
 * que precisar e rola dentro de si. É a única regra que não erra quando um
 * painel ganhar mais uma opção amanhã.
 *
 * A `cheia` continua existindo pra quem é lista longa de verdade — ver a nota
 * na propriedade.
 */
export function SettingsSheet({ title, onClose, children, cheia }: Props) {
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

  if (cheia) {
    return createPortal(
      <div
        ref={refFolha}
        className="tk-sheet-full"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-saindo={saindo || undefined}
      >
        {/*
          A volta EM CIMA, o titulo alinhado com o resto do app.

          Antes os dois dividiam uma linha, e o titulo comecava depois do botao.
          Comparando Ajustes com Sobre e Privacidade, medido: em
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

  return createPortal(
    <>
      {/*
        O escurecimento atrás.

        Ele não é enfeite: é o que diz que a tela de Ajustes continua ali e que
        isto é um passo temporário. Sem ele a folha de baixo lê como uma tela
        nova que apareceu torta. Tocar nele fecha, que é o gesto que todo mundo
        tenta primeiro.
      */}
      <button
        type="button"
        className="tk-pop-fundo"
        aria-label={t("common.close")}
        onClick={fechar}
        data-saindo={saindo || undefined}
      />
      <div
        ref={refFolha}
        className="tk-pop"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-saindo={saindo || undefined}
      >
        {/* A alça. Não faz nada sozinha — o gesto de arrastar quem trata é o
            `useFolha`. Ela existe porque é o que diz "isto desce". */}
        <span className="tk-pop-alca" aria-hidden="true" />
        <header className="tk-pop-head">
          <h2 className="tk-pop-title">{title}</h2>
          <button
            type="button"
            className="tk-pop-close"
            onClick={fechar}
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </header>
        <div className="tk-pop-corpo">{children}</div>
      </div>
    </>,
    document.body,
  );
}
