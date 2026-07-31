import { useEffect, useRef } from "react";

export interface WheelOption {
  value: string;
  label: string;
  /** Emoji ou glifo mostrado antes do rotulo. */
  glyph?: string;
}

interface Props {
  options: readonly WheelOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/** Altura de cada linha. Precisa bater com `--tk-wheel-item` no CSS. */
const ITEM = 44;

/**
 * Roda de selecao, como a de data do sistema.
 *
 * Dez idiomas viravam vinte botoes empilhados ocupando meia tela de Ajustes.
 * Uma roda mostra tres por vez e ocupa a altura de um campo — e e o gesto que
 * a pessoa ja conhece de escolher data.
 *
 * A selecao acompanha o SCROLL, nao o clique: parar a roda no meio de um item
 * ja escolhe aquele item, que e como o seletor do sistema se comporta. Clicar
 * tambem funciona, para quem esta no mouse.
 *
 * O alinhamento e feito por `scroll-snap` do proprio navegador em vez de
 * animacao em JS. Isso da o atrito e a inercia nativos do aparelho — imitar
 * isso na mao fica sempre um pouco errado, e "um pouco errado" num gesto
 * conhecido incomoda mais que uma lista feia.
 */
export function WheelPicker({ options, value, onChange, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  /*
   * ⚠️ A RODA SÓ ESCOLHE DEPOIS QUE ALGUÉM ENCOSTA NELA.
   *
   * Sem isto, abrir a folha de Ajustes › Idioma TROCAVA O IDIOMA sozinho.
   *
   * Reproduzido e medido: a folha entra animada, e enquanto ela se move o
   * `scrollTop` do trilho lê 44 — exatamente uma linha — em vez de 0. O
   * `onScroll` com debounce de 120ms interpretava isso como "o usuário parou a
   * roda na linha 1" e chamava `onChange` com o SEGUNDO idioma da lista. Em
   * inglês (índice 0), abrir a tela e fechar sem tocar em nada deixava o app em
   * português.
   *
   * Foi o varredor de idiomas que achou: eu setava `en`, rodava a varredura, e
   * no fim o app estava em `pt-BR`. Passei um tempo achando que era o meu
   * script — o script estava certo, e o defeito era do app desde sempre. Quem
   * troca de idioma raramente não perceberia a causa; perceberia só que "o app
   * volta pro português sozinho".
   *
   * "A seleção acompanha o SCROLL" continua valendo — mas scroll de GENTE. Um
   * reposicionamento que o próprio componente fez não é escolha de ninguém.
   */
  const tocou = useRef(false);

  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  // Centraliza o item escolhido quando ele muda por fora (carga inicial, ou
  // troca de idioma vinda de outro lugar). `behavior: auto` na primeira vez
  // pra nao animar a tela abrindo.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = index * ITEM;
    const posicionar = () => {
      if (!ref.current) return;
      if (Math.abs(ref.current.scrollTop - target) < 2) return;
      ref.current.scrollTo({ top: target, behavior: "auto" });
    };
    posicionar();
    /*
     * E de novo depois que a folha para de animar.
     *
     * Enquanto ela entra, o trilho ainda não tem a posição final, e o primeiro
     * `scrollTo` cai no lugar errado — foi assim que o `scrollTop` acabava em
     * 44. Repor no fim da animação deixa a roda mostrando o item certo em vez
     * de um vizinho.
     */
    const t = window.setTimeout(posicionar, 260);
    return () => window.clearTimeout(t);
  }, [index]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    // Debounce: so decide quando a roda para, senao dispararia a cada pixel e
    // o app trocaria de idioma dez vezes durante um unico gesto.
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      if (!tocou.current) return;
      const nearest = Math.round(el.scrollTop / ITEM);
      const picked = options[Math.min(options.length - 1, Math.max(0, nearest))];
      if (picked && picked.value !== value) onChange(picked.value);
    }, 120);
  };

  /** Qualquer gesto de verdade sobre a roda libera a escolha por scroll. */
  const marcarToque = () => {
    tocou.current = true;
  };

  return (
    <div className="tk-wheel">
      {/* A faixa do meio marca onde a escolha acontece. `pointer-events: none`
          no CSS: ela e sinalizacao, nao alvo. */}
      <div className="tk-wheel-window" aria-hidden="true" />
      <div
        ref={ref}
        className="tk-wheel-scroll"
        role="listbox"
        aria-label={ariaLabel}
        tabIndex={0}
        onScroll={onScroll}
        onPointerDown={marcarToque}
        onTouchStart={marcarToque}
        onWheel={marcarToque}
        onKeyDown={(e) => {
          marcarToque();
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
          e.preventDefault();
          const next = index + (e.key === "ArrowDown" ? 1 : -1);
          const picked = options[Math.min(options.length - 1, Math.max(0, next))];
          if (picked) onChange(picked.value);
        }}
      >
        {/* Espacadores: sem eles o primeiro e o ultimo item nunca alcancariam
            o centro da janela. */}
        <div className="tk-wheel-pad" />
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={o.value === value}
            className="tk-wheel-item"
            data-on={o.value === value || undefined}
            data-far={Math.abs(i - index) > 1 || undefined}
            onClick={() => onChange(o.value)}
          >
            {o.glyph && (
              <span aria-hidden="true" className="tk-wheel-glyph">
                {o.glyph}
              </span>
            )}
            {o.label}
          </button>
        ))}
        <div className="tk-wheel-pad" />
      </div>
    </div>
  );
}
