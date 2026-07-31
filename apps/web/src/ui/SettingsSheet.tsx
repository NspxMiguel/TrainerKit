import { useEffect, type ReactNode } from "react";
import { useFolha } from "./folha.ts";
import { createPortal } from "react-dom";

import { useT } from "../i18n/t.ts";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /**
   * Folha CURTA, colada no rodapé — o seletor do sistema.
   *
   * "idioma abre tela inteira la nas configuraçÕes. agr q tem um botao so pro
   * idioma."
   *
   * Ele está certo sobre a proporção: uma tela inteira, com título de 34px e
   * uma volta no topo, pra mostrar UMA roda de escolha. Nos dois sistemas essa
   * interação é uma folha baixa que sobe, cobre um terço da tela e sai — e o
   * conteúdo de trás continua visível, que é o que diz "isto é um ajuste, não
   * um lugar".
   *
   * Continua sendo a mesma folha: mesmo `useFolha`, mesmo Escape, mesmo gesto
   * de voltar. O que muda é a forma.
   */
  compacta?: boolean;
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
export function SettingsSheet({ title, onClose, children, compacta = false }: Props) {
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

  if (compacta) {
    return createPortal(
      <div className="tk-baixo-scrim" onClick={fechar} data-saindo={saindo || undefined}>
        {/* `stopPropagation` porque o toque FORA fecha, e o toque dentro não
            pode fechar junto — é o mesmo contrato de qualquer folha do sistema. */}
        <div
          ref={refFolha}
          className="tk-baixo"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          data-saindo={saindo || undefined}
          onClick={(e) => e.stopPropagation()}
        >
          {/* A alça. Ela não faz nada além de dizer "isto sai puxando pra
              baixo" — e é o único jeito de anunciar um gesto sem um texto. */}
          <span className="tk-baixo-alca" aria-hidden="true" />
          <div className="tk-baixo-head">
            <span className="tk-baixo-titulo">{title}</span>
            <button type="button" className="tk-baixo-ok" onClick={fechar}>
              {t("common.done")}
            </button>
          </div>
          {children}
        </div>
      </div>,
      document.body,
    );
  }

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
