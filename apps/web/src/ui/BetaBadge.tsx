import { useEffect, useRef, useState } from "react";

import { useT } from "../i18n/t.ts";

/**
 * O selo BETA, que agora diz o que quer dizer.
 *
 * Antes era a palavra "BETA" sozinha no canto da tela de IV. Ela avisava que
 * algo pode dar errado sem dizer o que nem onde — o que e pior que nao avisar,
 * porque deixa a pessoa desconfiada do app inteiro. O Miguel pediu o texto e ele
 * e simples: foi testado num iPhone 17 Pro e num Poco X3 Pro, e em qualquer
 * outro aparelho o leitor de print e o primeiro suspeito.
 *
 * Abre por toque E por passar o mouse, porque os dois existem: no celular nao
 * ha hover, e no computador clicar num rotulo pra ler uma nota e estranho.
 */
export function BetaBadge() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  // Toque fora fecha. Sem isto o balao ficaria aberto pra sempre no celular,
  // onde nao ha como "sair de cima" dele.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
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

      {/* `role="status"` e nao `tooltip`: o texto e um aviso que vale ser lido
          em voz alta quando aparece, nao a legenda de um botao. */}
      {open && (
        <span className="tk-beta-pop" role="status">
          {t("common.betaDetail")}
        </span>
      )}
    </span>
  );
}
