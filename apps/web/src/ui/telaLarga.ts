import { useSyncExternalStore } from "react";

/**
 * A tela e larga o bastante pra duas colunas?
 *
 * ── Por que ISTO precisa existir em JS, se o resto e CSS ─────────────────────
 *
 * A regra do handoff e clara e continua valendo: "nao duplique logica — e a
 * mesma tela reagindo ao espaco disponivel, nao uma segunda tela". Em quase todo
 * lugar do app quem decide layout e a folha de estilo, e as `FERRAMENTAS` da
 * barra lateral seguem exatamente isso: existem sempre no DOM e somem no celular
 * com `display: none`.
 *
 * A ficha da especie e o unico caso onde CSS nao alcanca, e o motivo e
 * ESTRUTURAL, nao visual: no celular ela e uma folha renderizada por
 * `createPortal` direto no `<body>`, com `useFolha` segurando o no durante a
 * animacao de saida, gesto de voltar, Escape e escurecimento. Na tela larga ela
 * e uma COLUNA dentro da propria Especies — sem portal, sem escurecimento e sem
 * nada pra fechar, porque ela nao esta por cima de coisa nenhuma.
 *
 * Portal ou nao-portal e uma escolha de arvore. Nenhuma media query muda onde um
 * no e montado.
 *
 * ── 900px, e nao 1024 ────────────────────────────────────────────────────────
 *
 * O texto do handoff sugere "min-width: 1024px **ou onde seu app ja decide que e
 * desktop**". Este app ja decide em 900px, em dezenas de regras — a barra vira
 * coluna lateral, a folha encolhe, o escurecimento nasce. Abrir um segundo
 * limiar em 1024 criaria uma faixa de 124px onde a barra ja e lateral mas a
 * ficha ainda e folha: o pior dos dois, e mais um numero pra alguem
 * dessincronizar depois.
 */
const CONSULTA = "(min-width: 900px)";

/**
 * ⚠️ ESCUTA `resize` TAMBEM, e nao so o `change` da media query.
 *
 * O `change` e o sinal certo e e o barato — dispara uma vez, na virada. Mas ele
 * NAO chegou numa das medicoes: redimensionei de 1440 pra 390 com o app aberto,
 * `matchMedia(...).matches` ja respondia `false`, e a Especies continuou em duas
 * colunas porque o React nunca foi avisado. Em carga limpa o mesmo tamanho
 * renderiza certo, entao nao e erro de conta — e o evento que nao veio.
 *
 * Nao vou apostar o layout num evento que ja falhou na minha frente. O `resize`
 * e redundante de proposito: quando os dois vem, `useSyncExternalStore` compara
 * o resultado de `ler()` e ignora o segundo — nao ha re-render duplicado,
 * porque o valor nao mudou.
 */
function inscrever(fn: () => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const mq = matchMedia(CONSULTA);
  mq.addEventListener("change", fn);
  addEventListener("resize", fn);
  return () => {
    mq.removeEventListener("change", fn);
    removeEventListener("resize", fn);
  };
}

function ler(): boolean {
  return typeof matchMedia === "function" && matchMedia(CONSULTA).matches;
}

/**
 * ⚠️ REAGE A MUDANCA DE TAMANHO, e nao le uma vez.
 *
 * Redimensionar a janela do navegador e girar um tablet sao a mesma coisa pra
 * esta conta, e as duas acontecem com o app aberto. Um `useState` com leitura no
 * primeiro render deixaria a ficha como folha numa janela que virou larga — e o
 * `useSyncExternalStore` ainda resolve o caso do servidor, onde `matchMedia` nao
 * existe: o terceiro argumento responde `false`, que e o layout de celular.
 */
export function useTelaLarga(): boolean {
  return useSyncExternalStore(inscrever, ler, () => false);
}
