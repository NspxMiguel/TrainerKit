import { useEffect, useRef } from "react";

/**
 * Voltar arrastando da borda esquerda.
 *
 * O gesto de voltar arrastando é o padrão do Android e do iOS, e o app tinha um
 * motivo a mais pra precisar dele: instalado na tela de início, um PWA no iOS
 * **não tem o gesto do Safari**. Sem isto, a única saída de uma folha é uma seta
 * de 44px no canto superior — o canto mais longe do polegar de quem segura o
 * telefone com uma mão só.
 *
 * ── O que faz um gesto de voltar parecer nativo ──────────────────────────────
 *
 * Três coisas, e as três importam:
 *
 *  1. **Só da borda.** O toque tem que COMEÇAR nos primeiros 24px. Fora daí, um
 *     arrasto horizontal é rolagem de carrossel, é a lista de chips da caixa de
 *     perguntas, é o usuário tentando selecionar texto.
 *  2. **A tela ACOMPANHA o dedo.** Um gesto que só dispara no fim parece um
 *     atalho escondido; um que arrasta junto é uma porta. Por isso o
 *     `transform` acompanha em tempo real, e volta animado se a pessoa desistir.
 *  3. **O compromisso é medido no SOLTAR**, por distância *ou* velocidade. Só
 *     distância obriga a atravessar meia tela; só velocidade recusa o arrasto
 *     lento e decidido. Os dois juntos é o que o sistema faz.
 *
 * ⚠️ NÃO usa `pointercancel` como desistência. O navegador cancela o ponteiro
 * quando decide que o gesto virou rolagem — e como o `touch-action` aqui já
 * libera o eixo horizontal, esse cancelamento chega no meio de um arrasto
 * legítimo e a folha voltava sozinha.
 */

/** Onde o gesto pode começar. Igual à faixa que os dois sistemas usam. */
const BORDA = 24;

/** Quanto arrastar pra fechar, em fração da largura. */
const FRACAO = 0.32;

/** Ou quão rápido, em px/ms — o arrasto curto e decidido também conta. */
const VELOCIDADE = 0.5;

export function useGestoVoltar(
  alvo: React.RefObject<HTMLElement | null>,
  fechar: () => void,
): void {
  const inicio = useRef<{ x: number; y: number; t: number } | null>(null);
  const arrastando = useRef(false);

  useEffect(() => {
    const el = alvo.current;
    if (!el) return;

    /*
     * `prefers-reduced-motion` não desliga o gesto — desliga o ACOMPANHAMENTO.
     * Quem pede menos movimento continua querendo voltar arrastando; o que
     * incomoda é a tela deslizando junto.
     */
    const semMovimento =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return; // no mouse existe o botão, e ele é melhor
      if (e.clientX > BORDA) return;
      inicio.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      arrastando.current = false;
    };

    const onMove = (e: PointerEvent) => {
      const i = inicio.current;
      if (!i) return;
      const dx = e.clientX - i.x;
      const dy = e.clientY - i.y;

      /*
       * O primeiro movimento DECIDE o eixo, e depois disso não muda mais.
       *
       * Sem travar o eixo, um arrasto na diagonal alternava entre puxar a folha
       * e rolar a lista conforme o dedo oscilava — e o resultado era uma tela
       * que treme sem sair do lugar.
       */
      if (!arrastando.current) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          inicio.current = null; // era rolagem
          return;
        }
        arrastando.current = true;
      }

      if (dx <= 0) return;
      if (!semMovimento) {
        el.style.transition = "none";
        el.style.transform = `translateX(${dx}px)`;
        // A sombra do que fica atrás some junto, senão a folha desliza sobre
        // uma tela que continua com cara de "nada aconteceu".
        el.style.opacity = String(Math.max(0.4, 1 - dx / (window.innerWidth * 0.9)));
      }
    };

    const soltar = (e: PointerEvent) => {
      const i = inicio.current;
      inicio.current = null;
      if (!i || !arrastando.current) return;
      arrastando.current = false;

      const dx = e.clientX - i.x;
      const rapido = dx / Math.max(1, performance.now() - i.t) > VELOCIDADE;
      const longe = dx > window.innerWidth * FRACAO;

      el.style.transition = "";
      el.style.transform = "";
      el.style.opacity = "";

      if (dx > 0 && (longe || rapido)) fechar();
    };

    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerup", soltar, { passive: true });

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", soltar);
      el.style.transition = "";
      el.style.transform = "";
      el.style.opacity = "";
    };
  }, [alvo, fechar]);
}
