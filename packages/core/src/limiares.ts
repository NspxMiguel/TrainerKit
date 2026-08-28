/**
 * O que conta como atributo base "alto" — em UM lugar.
 *
 * ⚠️ ESTES NUMEROS JA ESTIVERAM ESCRITOS EM TRES ARQUIVOS, e divergiram. O
 * comentario do `dex.ts` descrevia o defeito com todas as letras — "dois
 * modulos que descrevem a mesma especie com criterios diferentes acabam se
 * contradizendo na tela, e o app ja passou por isso uma vez (o Eternatus dizia
 * que batia forte e caia rapido em linhas seguidas)" — e mesmo assim os valores
 * voltaram a divergir:
 *
 *   dex.ts e dynamax.ts   240 / 220 / 200
 *   assistant.ts          250 / 220 / 220
 *
 * Medido no dataset: 307 especies das 2.466 (12%) recebiam palavras diferentes
 * das duas telas — 62 com "ataque alto" so num lado, 245 com "PS alto" so num
 * lado. Comentario nao impede divergencia; import impede.
 *
 * ── Por que 250/220/220 e nao 240/220/200 ────────────────────────────────────
 *
 * Porque so um dos dois conjuntos faz as tres palavras significarem coisas
 * comparaveis. Que fatia da Especies cada corte chama de "alto":
 *
 *   corte      ataque   defesa   PS
 *   240/220/200  11,1%    6,7%   21,7%
 *   250/220/220   8,6%    6,7%   11,7%
 *
 * Com o primeiro, "PS alto" valia pra mais de um quinto do jogo enquanto
 * "defesa alta" valia pra um quinze avos. Dizer que 22% dos bichos tem PS alto
 * nao informa nada — e a mesma palavra, na tela ao lado, estava selecionando o
 * topo de verdade. O segundo conjunto foi o que o `assistant.ts` dizia ter
 * medido, e a medicao confirma.
 */

/** Ataque base a partir do qual a especie "bate forte". Topo ~8,6% do jogo. */
export const ATK_ALTO = 250;

/** Defesa base que caracteriza uma parede. Topo ~6,7%. */
export const DEF_ALTO = 220;

/** PS base considerado alto. Topo ~11,7%. */
export const HP_ALTO = 220;
