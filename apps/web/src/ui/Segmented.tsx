import type { CSSProperties } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  ariaLabel: string;
  options: ReadonlyArray<Option<T>>;
  value: T;
  onChange: (value: T) => void;
  /** `compact` pra escolha subordinada, quando ela nao pode competir com a de cima. */
  size?: "normal" | "compact";
}

/**
 * Uma escolha entre poucas, sempre com a mesma cara.
 *
 * Varias telas do app nao seguiam o mesmo estilo visual, e o exemplo mais claro
 * era este: a MESMA pergunta — escolha
 * uma entre duas ou tres — estava desenhada de tres formas diferentes no app.
 * Tema e modo nos Ajustes eram `tk-btn--primary` de 44px; liga nos Rankings era
 * `tk-btn` de 36px com fonte 12; raide/PvP era `tk-chip`. Nenhuma estava errada
 * sozinha, mas juntas faziam o app parecer costurado de pedaços.
 *
 * Isto e a peca unica: a forma de segmento do iOS, com a pilha que DESLIZA
 * entre as opcoes em vez de acender e apagar — o mesmo `matchedGeometry` da
 * barra de abas, pelo mesmo motivo (a forma nunca some, ela muda de lugar).
 *
 * Nao serve pra lista longa: dez tipos de especie continuam sendo `tk-chips`,
 * que rola na horizontal. Segmento e pra duas ou tres opcoes que cabem juntas.
 */
export function Segmented<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  size = "normal",
}: Props<T>) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  return (
    <div
      className="tk-segment"
      role="group"
      aria-label={ariaLabel}
      data-compact={size === "compact" || undefined}
      /* Quantas opcoes, pro CSS poder apertar a fonte quando sao muitas. Ver a
         nota em `.tk-segment[data-n]` — com a quarta opcao ("Grátis"), o rotulo
         "No aparelho" passou a sair "No apar…". */
      data-n={options.length}
      style={
        {
          "--tk-seg-n": options.length,
          "--tk-seg-i": index,
        } as CSSProperties
      }
    >
      {/* Uma forma so, que viaja. Fica antes dos botoes no DOM e atras deles
          por `z-index` — assim o texto do selecionado nunca e coberto. */}
      <span className="tk-segment-pill" aria-hidden="true" />

      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="tk-segment-btn"
          data-on={o.value === value || undefined}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {/*
            ⚠️ O RÓTULO NUM `<span>`, e o corte mora nele.

            O botão precisa de `overflow: visible` pra a área de toque de 44px
            (um `::after` maior que ele) valer — conteúdo cortado por
            `overflow: hidden` não é tocável fora da caixa, então o alvo
            invisível existia e não funcionava.

            Só que o corte com reticências EXIGE `overflow: hidden`. As duas
            coisas não cabem no mesmo elemento: o corte desce pro span, e o botão
            fica livre pra crescer a área de toque.
          */}
          <span className="tk-segment-txt">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
