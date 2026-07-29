import { useEffect, useState } from "react";

/**
 * A barra de abas recolhe quando se rola pra baixo.
 *
 * Nao e invencao: a Apple documenta isto como `tabBarMinimizeBehavior` no iOS
 * 26 — *"Tab bars can help elevate the underlying content by receding when a
 * person scrolls... The tab bar expands when a person scrolls in the opposite
 * direction."* Sem isso a barra de vidro fica parada e enorme por cima do
 * conteudo o tempo todo, que e justamente o que a Apple mudou.
 *
 * A regra e direcao, nao posicao: descendo (lendo adiante) a barra sai da
 * frente; subindo (procurando algo) ela volta, porque quem sobe geralmente esta
 * indo embora daquela tela.
 *
 * Tres detalhes que separam isto de um `onscroll` ingenuo:
 *
 *   O limiar de 8px impede que o tremor do dedo parado fique abrindo e fechando
 *   a barra. Sem ele o efeito vira nervoso.
 *
 *   Nos primeiros 40px a barra fica sempre aberta. No topo da tela nao ha o que
 *   "elevar", e recolher ali so esconde a navegacao a toa.
 *
 *   A leitura vai pro `requestAnimationFrame`. `scroll` dispara varias vezes por
 *   quadro, e ler `scrollY` fora do quadro forca o navegador a recalcular
 *   layout na hora — e o jeito classico de deixar um scroll travado.
 */
export function useTabBarMinimize(enabled: boolean): boolean {
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setMinimized(false);
      return;
    }

    let last = window.scrollY;
    let ticking = false;

    const measure = () => {
      ticking = false;
      const y = window.scrollY;
      const delta = y - last;

      if (y < 40) {
        last = y;
        setMinimized(false);
        return;
      }

      if (Math.abs(delta) < 8) return;
      last = y;
      setMinimized(delta > 0);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);

  return minimized;
}
