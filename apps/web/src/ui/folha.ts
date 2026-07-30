import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sair de uma tela também é uma animação.
 *
 * "nao tem fade out ao sair de paginas" — e nao tinha mesmo. Toda folha cheia
 * ENTRA com `tk-rise` (sobe 14px e aparece) e SAIA piscando: o React
 * desmontava o no e o navegador simplesmente parava de pintar. O efeito e o de
 * um corte seco no meio de um movimento suave, e e o tipo de coisa que a pessoa
 * sente sem saber nomear — o app parece bem-feito na ida e apressado na volta.
 *
 * ── Por que um hook, e nao CSS ───────────────────────────────────────────────
 *
 * Nao existe animacao de saida em CSS puro pra elemento que sai do DOM: quando
 * o React desmonta, nao ha mais o que animar. Alguem precisa SEGURAR o no
 * durante a saida, e esse alguem e o estado.
 *
 * O hook devolve `fechar`, que troca o `onClose` original em TODOS os caminhos
 * de fechamento — botao de voltar, Escape, toque fora, "salvei, pode fechar".
 * Se um caminho continuar chamando `onClose` direto, so aquele pisca, e o bug
 * volta pela metade — que e como ele passou despercebido tanto tempo.
 *
 * `prefers-reduced-motion` fecha na hora: pra quem pediu menos movimento,
 * segurar a tela 180ms a mais nao e delicadeza, e lentidao.
 */

/** Precisa bater com a duracao de `[data-saindo]` no CSS. */
const DURACAO = 180;

export function useFolha(onClose: () => void): {
  saindo: boolean;
  /** Fecha a folha, animado. */
  fechar: () => void;
  /**
   * Sai animado e SO ENTAO faz outra coisa.
   *
   * Existe porque nem toda saida e um "voltar": no Modo Pokedex, tocar num
   * resultado abre a ficha da especie e tocar em CAPTURADOS abre a colecao —
   * nos dois casos quem desmonta o aparelho e o componente de cima, que nao
   * sabe que ha uma animacao em curso. Sem isto, dois dos caminhos de saida
   * continuariam piscando enquanto o terceiro desliza.
   */
  sair: (depois: () => void) => void;
} {
  const [saindo, setSaindo] = useState(false);
  const timer = useRef<number | null>(null);

  // Desmontar no meio da saida (o pai fechou sozinho) nao pode deixar um
  // `setTimeout` de pe chamando `onClose` numa tela que ja nao existe.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const sair = useCallback((depois: () => void) => {
    if (timer.current !== null) return; // ja esta saindo: nao reinicia
    const semMovimento =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (semMovimento) {
      depois();
      return;
    }
    setSaindo(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      depois();
    }, DURACAO);
  }, []);

  const fechar = useCallback(() => sair(onClose), [sair, onClose]);

  return { saindo, fechar, sair };
}
