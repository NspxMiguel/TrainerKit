import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useT } from "../i18n/t.ts";

/**
 * O selo BETA, que agora diz o que quer dizer.
 *
 * Antes era a palavra "BETA" sozinha no canto da tela de IV. Ela avisava que
 * algo pode dar errado sem dizer o que nem onde — o que e pior que nao avisar,
 * porque deixa a pessoa desconfiada do app inteiro. O texto e simples: foi
 * testado num iPhone 17 Pro e num Poco X3 Pro, e em qualquer
 * outro aparelho o leitor de print e o primeiro suspeito.
 *
 * Abre por toque E por passar o mouse, porque os dois existem: no celular nao
 * ha hover, e no computador clicar num rotulo pra ler uma nota e estranho.
 */
export function BetaBadge() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);

  /*
   * O balao se posiciona MEDINDO, nao escolhendo um lado.
   *
   * A versao anterior deixava isso no CSS, com `right: 0`, e o comentario de la
   * dizia por que: o selo vivia no canto direito do cabecalho da tela de IV.
   * Quando ele passou a existir tambem no Modo Pokedex — canto ESQUERDO — a
   * mesma regra jogou um balao de 277px pra 204px fora da tela.
   *
   * Escolher o outro lado so inverteria qual tela quebra. Entao ninguem escolhe:
   * mede-se o selo e o balao, e o balao encosta no selo ate onde a tela deixa.
   * Serve pros dois cantos e pra qualquer canto que apareca depois.
   */
  const posicionar = useCallback(() => {
    const selo = box.current;
    const balao = pop.current;
    if (!selo || !balao) return;
    const r = selo.getBoundingClientRect();
    const MARGEM = 12;
    const limite = window.innerWidth - balao.offsetWidth - MARGEM;
    balao.style.top = `${r.bottom + 8}px`;
    // `Math.max` por ultimo: numa tela mais estreita que o balao, o limite fica
    // menor que a margem e o balao deve encostar na esquerda, nao sumir.
    balao.style.left = `${Math.max(MARGEM, Math.min(r.left, limite))}px`;
  }, []);

  // `useLayoutEffect` e nao `useEffect`: posicionar depois de pintar faria o
  // balao aparecer no canto errado por um quadro e pular pro lugar.
  useLayoutEffect(() => {
    if (!open) return;
    posicionar();
  }, [open, posicionar]);

  // Preso a viewport, ele nao acompanha a rolagem sozinho. A folha de IV rola.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [open, posicionar]);

  // Toque fora fecha. Sem isto o balao ficaria aberto pra sempre no celular,
  // onde nao ha como "sair de cima" dele.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      // O balao nao e mais descendente do selo (esta no `body`), entao ele
      // precisa ser perguntado a parte — sem isto, tocar no proprio aviso o
      // fecharia, que e o oposto de "toque fora fecha".
      const alvo = e.target as Node;
      if (box.current?.contains(alvo) || pop.current?.contains(alvo)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      className="tk-beta-wrap"
      ref={box}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="tk-beta"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t("common.beta")}
      </button>

      {/*
        O balao sai do `body`, nao daqui.

        Ele ja era `position: fixed`, o que basta pra posicao mas NAO pra
        pintura: no Modo Pokedex o selo mora dentro de `.tk-dexdev-counters`,
        que tem `z-index: 1` e portanto abre um contexto de empilhamento — o
        `z-index: 30` do balao passava a valer so DENTRO daquela caixinha, e a
        tela verde do aparelho, que e irma dela, cobria o balao inteiro.

        Portal resolve a classe do problema, nao este caso: um aviso nao pode
        depender de qual tela o hospeda, e a proxima tela a receber o selo teria
        o proprio empilhamento pra brigar.

        `role="status"` e nao `tooltip`: o texto e um aviso que vale ser lido em
        voz alta quando aparece, nao a legenda de um botao.
      */}
      {open &&
        createPortal(
          <span className="tk-beta-pop" role="status" ref={pop}>
            {t("common.betaDetail")}
          </span>,
          document.body,
        )}
    </span>
  );
}
