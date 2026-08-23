import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

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
/**
 * O mesmo numero do `--tk-dur-exit` em `styles/tokens.css`.
 *
 * `setTimeout` nao le CSS, entao a repeticao nao tem como sumir — o que da pra
 * fazer e deixar escrito nos dois lados que eles andam juntos. Menor aqui corta
 * a animacao no meio; maior deixa uma tela morta na frente do app.
 */
export const DURACAO = 220;

export function useFolha(
  onClose: () => void,
  opcoes?: {
    /**
     * Esta folha deixa a barra de abas aparecendo?
     *
     * ⚠️ ISTO CONTRARIA O HANDOFF, e e decisao dele: *"a barrinha com liquid
     * glass poderia continuar aparecendo ali po. ate mais simples de ir pra
     * tela inicial."*
     *
     * O documento de desenho diz "some quando uma folha de tela cheia esta
     * aberta", e o motivo escrito aqui embaixo (o vidro passaria a borrar a
     * folha, sem funcao) continua verdadeiro. So que ele pesou outra coisa: da
     * ficha de uma especie nao ha atalho pra Inicio — e preciso voltar, e as
     * vezes voltar duas vezes, porque ficha abre de dentro de ficha.
     *
     * Fica por folha, e nao global, porque nem toda folha pode: as que tem
     * rodape proprio (`.tk-sheet-full--barra`, a Faxina e as selecoes em massa)
     * teriam duas barras empilhadas no mesmo canto.
     */
    mantemBarra?: boolean;
  },
): {
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
   *   · Modo lente     tocar num resultado abre a ficha da especie
   *   · Modo lente     tocar em CAPTURADOS abre a colecao
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

  // Lido uma vez, no registro: uma folha nao troca de ideia sobre a barra no
  // meio da vida, e reagir a isso exigiria refazer o efeito — que e exatamente
  // o que a nota acima explica que nao pode acontecer.
  const mantemBarra = opcoes?.mantemBarra ?? false;

  useEffect(() => {
    const entrada: Folha = { fechar: () => fecharRef.current(), mantemBarra };
    pilha.push(entrada);
    mudou();
    return () => {
      const i = pilha.indexOf(entrada);
      if (i !== -1) pilha.splice(i, 1);
      mudou();
    };
  }, [mantemBarra]);

  const ref = useRef<HTMLDivElement>(null);
  useGestoVoltar(ref, fechar);

  /*
   * ⚠️ FOLHA QUE NASCE DENTRO DE UMA VIEW TRANSITION NAO ANIMA SOZINHA — E A
   * MARCA TEM QUE SER PERMANENTE.
   *
   * Abrir a ficha pela Especies ja e uma transicao de elemento compartilhado: o
   * tile cresce e vira o cabecalho. A folha animando por cima disso da duas
   * entradas pro mesmo toque.
   *
   * A primeira tentativa foi `[data-vt] .tk-sheet-full { animation: none }`,
   * com `data-vt` no `<html>` durante a transicao. Isso INTRODUZIU o defeito em
   * vez de resolver: quando a transicao acaba e o atributo sai, a propriedade
   * `animation` volta de `none` pro nome do keyframe — e trocar o nome de
   * `none` pra um nome E o gatilho que faz o navegador comecar a animacao. A
   * folha deslizava DEPOIS da transicao ja ter terminado.
   *
   * Foi o que ele descreveu no celular, na ordem exata: *"ele abre primeiro
   * rapidao com a animação antiga, ai dps aparece a nova"* — a primeira e o
   * cross-fade da view transition, a segunda e a folha reanimando.
   *
   * A marca agora vai NO NO da folha e nunca sai. Ela e lida uma vez, no
   * commit, enquanto `data-vt` ainda esta no `<html>`; dali em diante o valor
   * de `animation` daquele elemento nunca muda, entao nao ha o que disparar.
   *
   * `useLayoutEffect` e nao `useEffect`: precisa acontecer ANTES de o navegador
   * pintar, senao a folha pisca um quadro deslizando antes de ser calada.
   */
  useLayoutEffect(() => {
    const no = ref.current;
    if (no && document.documentElement.dataset.vt) no.dataset.semEntrada = "1";
  }, []);

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
type Folha = { fechar: () => void; mantemBarra: boolean };

const pilha: Folha[] = [];
const ouvintesFolha = new Set<() => void>();

function mudou(): void {
  for (const fn of ouvintesFolha) fn();
}

function assinar(fn: () => void): () => void {
  ouvintesFolha.add(fn);
  return () => {
    ouvintesFolha.delete(fn);
  };
}

export function useTemFolha(): boolean {
  return useSyncExternalStore(assinar, () => pilha.length > 0, () => false);
}

/**
 * A barra de abas tem que sumir agora?
 *
 * ⚠️ NAO E O MESMO QUE `useTemFolha`, e foi por isso que virou funcao propria.
 *
 * "Ha folha aberta" e "a barra tem que sumir" eram a mesma pergunta ate ele
 * pedir a barra de volta na ficha. Agora sao duas: o veu de tela larga e o
 * congelamento da rolagem continuam olhando pra qualquer folha, e so a barra
 * olha pra ESTA.
 *
 * Basta UMA folha que tape pra barra sumir. Ficha abre ficha, e ficha tambem
 * abre a Faxina — se a de cima tem rodape proprio, a barra nao pode estar la,
 * mesmo que a de baixo permitisse.
 */
export function useBarraTapada(): boolean {
  return useSyncExternalStore(
    assinar,
    () => pilha.some((f) => !f.mantemBarra),
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
 * de dentro do Monta um Time, que saiu da Especies. Fechar a de baixo deixaria a
 * de cima orfa por cima de um veu que ja nao existe.
 */
export function fecharFolhaDeCima(): void {
  pilha.at(-1)?.fechar();
}

/**
 * Fecha TODAS as folhas abertas, cada uma com a animacao de saida dela.
 *
 * Existe por causa da barra de abas na ficha: com a barra visivel por cima de
 * uma folha, tocar em "Inicio" tem que levar pra Inicio. Sem isto a aba trocaria
 * por baixo e a pessoa continuaria vendo a ficha — um botao que parece nao
 * funcionar, que e pior do que nao ter o botao.
 *
 * Itera sobre uma COPIA: cada `fechar` acaba desmontando a folha, e desmontar
 * mexe na pilha durante o laco.
 */
export function fecharTodasAsFolhas(): void {
  for (const folha of [...pilha]) folha.fechar();
}
