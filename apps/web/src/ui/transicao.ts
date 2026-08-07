/**
 * Elemento compartilhado: o tile cresce e VIRA o cabecalho da ficha.
 *
 * Transicao 1 do documento de animacoes: "o tile do tipo cresce e vira o
 * cabecalho — nada de tela nova aparecendo do nada. 440ms, a lista some em
 * 300ms."
 *
 * ── Por que View Transitions, e nao FLIP ────────────────────────────────────
 *
 * FLIP (medir origem, clonar, animar ate o destino) funciona em qualquer
 * navegador e custa umas 150 linhas: medicao, clone posicionado, limpeza, e o
 * caso chato de a ficha abrir enquanto a lista ainda rola. A API nativa faz o
 * mesmo com um `startViewTransition` e um par de `view-transition-name`, e o
 * navegador cuida do clone, do recorte e do descarte.
 *
 * ⚠️ E ELA DEGRADA SOZINHA. Onde nao existe, `iniciar` so chama a funcao: a
 * ficha abre sem animacao, que e exatamente o comportamento de hoje. Nao ha
 * caminho em que isto quebre a navegacao — no maximo ela fica sem enfeite.
 *
 * ── O nome so pode existir em UM elemento por vez ───────────────────────────
 *
 * `view-transition-name` tem que ser unico no documento no instante da captura.
 * Se duas celulas da lista carregarem o mesmo nome, o navegador desiste da
 * transicao inteira e nao avisa. Por isso o nome nao mora no CSS da celula: ele
 * e posto na celula CLICADA um instante antes, e tirado quando acaba.
 */

/** O nome compartilhado entre a celula da lista e o cabecalho da ficha. */
export const NOME_ESPECIE = "tk-especie";

/**
 * Roda `mudar` dentro de uma transicao, marcando `origem` como o elemento que
 * viaja.
 *
 * ⚠️ O `finally` NAO E OPCIONAL. Deixar o nome pendurado na celula faz a
 * PROXIMA transicao encontrar dois elementos com o mesmo nome — e ai ela nao
 * acontece, silenciosamente. O sintoma seria "a animacao funciona uma vez e
 * depois nunca mais", que e o tipo de bug que se atribui a sorte.
 */
export function comElementoCompartilhado(origem: HTMLElement | null, mudar: () => void): void {
  interface ComTransicao {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  }
  const doc = document as Document & ComTransicao;

  if (typeof doc.startViewTransition !== "function" || !origem) {
    mudar();
    return;
  }

  origem.style.viewTransitionName = NOME_ESPECIE;
  const t = doc.startViewTransition(mudar);
  void t.finished.finally(() => {
    origem.style.viewTransitionName = "";
  });
}

/**
 * Acha o tile dentro da celula clicada.
 *
 * E o TILE que viaja, e nao a celula: a celula tem nome e numero embaixo, e
 * anima-la inteira faria o texto esticar ate virar o cabecalho — o documento
 * mostra so o quadrado do tipo crescendo.
 */
export function tileDe(e: { currentTarget: HTMLElement }): HTMLElement | null {
  return e.currentTarget.querySelector(".tk-mono, img");
}
