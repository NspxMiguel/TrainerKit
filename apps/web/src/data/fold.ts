/**
 * Achata um nome pra comparar.
 *
 * Ignora acento e pontuacao, entao "farfetchd" acha "Farfetch'd" e
 * "porygonz" acha "Porygon-Z". Duas telas precisam disso — a busca da
 * Especies e o campo de nome do chefe no montador de time — e duas copias da
 * mesma funcao viram duas buscas que se comportam diferente.
 */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // marcas de acento, ja separadas pelo NFD
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}
