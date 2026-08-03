import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useGestoVoltar } from "./gestoVoltar.ts";

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
  /**
   * A raiz da folha. Espalhe em quem tem `tk-sheet-full`.
   *
   * ⚠️ Ele existe pro GESTO DE VOLTAR: "coloca tbm voltar puxando pro lado,
   * igual maioria dos android e ios faz". O gesto mora aqui, no hook por onde
   * TODAS as folhas passam, e não em cada tela — a alternativa era lembrar de
   * ligar em nove lugares, que é exatamente o tipo de "lembrar" que já falhou
   * três vezes neste arquivo.
   *
   * Uma folha que esqueça de espalhar o `ref` continua funcionando; só fica sem
   * o gesto. Não há como quebrar nada esquecendo.
   */
  ref: React.RefObject<HTMLDivElement | null>;
  /** Fecha a folha, animado. */
  fechar: () => void;
  /**
   * Sai animado e SO ENTAO faz outra coisa.
   *
   * ⚠️ TODA SAIDA QUE PASSA POR CALLBACK DO PAI PRECISA DISTO, e a lista abaixo
   * so ficou completa na segunda passada — o que ja diz o quanto e facil
   * esquecer uma.
   *
   * Nem toda saida e um "voltar". Quando a folha entrega um resultado, quem a
   * desmonta e o componente de cima, que nao sabe que ha animacao em curso:
   *
   *   · Modo Pokedex     tocar num resultado abre a ficha da especie
   *   · Modo Pokedex     tocar em CAPTURADOS abre a colecao
   *   · Monta um time    tocar num membro abre a ficha dele
   *   · Ginasio          idem
   *   · Escolher especie escolher e o proprio objetivo da folha
   *
   * O sintoma e traicoeiro porque e PARCIAL: o botao de voltar desliza bonito
   * e a acao principal pisca. Da pra usar o app por semanas achando que a
   * animacao "as vezes nao pega".
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

  /*
   * Enquanto esta folha existe, ela esta na pilha.
   *
   * A pilha SUBSTITUI o contador `abertas` que morava aqui. Eram dois fatos
   * sobre a mesma coisa — quantas folhas ha, e qual e a de cima — e manter os
   * dois em paralelo e como o contador some de sincronia.
   *
   * O `ref` no meio e o que permite registrar UMA vez. `fechar` troca de
   * identidade sempre que `onClose` troca; um efeito com `[fechar]` na
   * dependencia se desfaria e refaria a cada render do pai, e entre o desfazer e
   * o refazer a pilha fica vazia por um instante — tempo suficiente pro
   * `useSyncExternalStore` ler "nenhuma folha aberta" e a barra lateral piscar.
   */
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;

  useEffect(() => {
    const entrada = () => fecharRef.current();
    pilha.push(entrada);
    mudou();
    return () => {
      const i = pilha.indexOf(entrada);
      if (i !== -1) pilha.splice(i, 1);
      mudou();
    };
  }, []);

  const ref = useRef<HTMLDivElement>(null);
  useGestoVoltar(ref, fechar);

  return { saindo, ref, fechar, sair };
}

/**
 * Ha alguma folha de tela cheia aberta?
 *
 * A barra de abas SOME quando uma folha abre — regra do redesenho, e ela existe
 * porque a barra flutua a 24px do rodape com vidro proprio: por baixo de uma
 * folha ela viraria uma mancha borrada no canto, sem funcao.
 *
 * O contador mora aqui, e nao numa store separada, porque `useFolha` ja e
 * chamado por TODAS as nove folhas — e o unico lugar por onde nenhuma passa
 * sem passar. Uma store nova exigiria lembrar de registrar cada uma, que e
 * exatamente o tipo de "lembrar" que ja falhou tres vezes neste arquivo.
 */
const pilha: Array<() => void> = [];
const ouvintesFolha = new Set<() => void>();

function mudou(): void {
  for (const fn of ouvintesFolha) fn();
}

export function useTemFolha(): boolean {
  return useSyncExternalStore(
    (fn) => {
      ouvintesFolha.add(fn);
      return () => {
        ouvintesFolha.delete(fn);
      };
    },
    () => pilha.length > 0,
    () => false,
  );
}

/**
 * Fecha a folha de cima, animada, como se fosse a seta de voltar dela.
 *
 * Existe pro veu de tela larga (`.tk-folha-scrim`): clicar fora fecha o dialogo
 * — no computador isso nao e um extra, e o que a pessoa TENTA primeiro, antes
 * de procurar a seta. No celular o veu nem e desenhado, entao isto nunca roda.
 *
 * "De cima" e o fim da pilha porque folha abre folha: a ficha de uma especie sai
 * de dentro do Monta um Time, que saiu da Pokedex. Fechar a de baixo deixaria a
 * de cima orfa por cima de um veu que ja nao existe.
 */
export function fecharFolhaDeCima(): void {
  pilha.at(-1)?.();
}
