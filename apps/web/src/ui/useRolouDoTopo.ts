import { useEffect, useState } from "react";

import { useTemFolha } from "./folha.ts";

/**
 * O conteudo ja saiu do topo? — pro vidro da borda de cima.
 *
 * A borda de BAIXO ja tinha remedio: o `.tk-scroll-edge` apaga o conteudo pouco
 * antes de ele passar por tras da barra de abas, citando a HIG da Apple —
 * *"obscuring content that scrolls beneath them"*. Em cima nao havia nada, e no
 * iPhone dele o texto subia e ENCOSTAVA NO RELOGIO: "Subir os Ma…" por cima de
 * "7:39". Em aba de navegador isso nao existe, porque nao ha barra de status
 * sobre a pagina — foi por isso que passou batido.
 *
 * ── Por que ligado ao scroll, e nao sempre aceso ─────────────────────────────
 *
 * O desenho manda a cor subir ate o topo, INCLUSIVE por tras da barra de status
 * (ver `.tk-home-topo::before`) — e e isso que faz o hero ficar bonito. Um vidro
 * fixo ali escureceria a arte o tempo todo. Entao ele so entra depois que o
 * conteudo começa a passar por baixo do relogio, que e quando ele faz falta.
 * E o mesmo que o iOS faz nas barras do sistema.
 *
 * ── Qual rolagem conta ───────────────────────────────────────────────────────
 *
 * Duas coisas rolam neste app: a JANELA (home, Pokedex, Ajustes) e cada
 * `.tk-sheet-full`, que tem `overflow-y` proprio. `scroll` nao borbulha, entao o
 * ouvinte e de CAPTURA — mesmo jeito que o `BetaBadge` ja usa pra se reposicionar.
 *
 * O filtro e uma REGRA, e nao uma lista de classes: vale quem encosta na borda
 * de cima e rola pra baixo. Uma lista ("`.tk-sheet-full` e `.tk-onb` e…") teria
 * que ser lembrada a cada tela nova — que e exatamente o tipo de "lembrar" que
 * ja falhou tres vezes no `folha.ts`. Sem a regra, rolar a fila de tipos DE LADO
 * dentro do Monta um Time apagaria o vidro, porque o `scrollTop` dela e sempre 0.
 */

/** Alguns pixels de folga: o tremor do dedo parado nao acende nem apaga. */
const LIMIAR = 6;

function ehDocumento(alvo: EventTarget | null): boolean {
  return alvo === document || alvo === document.documentElement || alvo === document.body;
}

export function useRolouDoTopo(): boolean {
  const temFolha = useTemFolha();
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    /*
     * Trocou quem manda no topo da tela.
     *
     * Folha nova nasce no topo, entao o vidro sai. Ao fechar, quem volta a
     * mandar e a janela — que continua rolada onde a pessoa a deixou, e sem
     * este calculo o vidro ficaria apagado sobre um conteudo ja no meio.
     */
    setRolou(temFolha ? false : window.scrollY > LIMIAR);

    let ticking = false;

    const medir = (alvo: EventTarget | null) => {
      ticking = false;

      if (ehDocumento(alvo)) {
        /*
         * Com folha aberta a janela nao conta. Ela continua rolada la atras, e
         * ler ela aqui acenderia o vidro sobre uma folha recem-aberta no topo —
         * bem em cima do hero da ficha, que e o unico lugar onde ele estraga.
         */
        if (temFolha) return;
        setRolou(window.scrollY > LIMIAR);
        return;
      }

      if (!(alvo instanceof HTMLElement)) return;
      // Nao encosta na borda de cima: nao e a tela, e um pedaco dentro dela.
      if (alvo.getBoundingClientRect().top > 0) return;
      // Rola de lado, nao pra baixo — o `scrollTop` dela seria 0 pra sempre.
      if (alvo.scrollHeight <= alvo.clientHeight) return;

      setRolou(alvo.scrollTop > LIMIAR);
    };

    /*
     * A leitura vai pro `requestAnimationFrame`, pelo mesmo motivo do
     * `useTabBarMinimize`: `scroll` dispara varias vezes por quadro, e medir
     * fora do quadro forca o navegador a recalcular layout na hora — o jeito
     * classico de deixar um scroll travado. Aqui pesa mais, porque o
     * `getBoundingClientRect` acima e justamente uma leitura de layout.
     */
    const onScroll = (e: Event) => {
      if (ticking) return;
      ticking = true;
      const alvo = e.target;
      requestAnimationFrame(() => medir(alvo));
    };

    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, [temFolha]);

  return rolou;
}
