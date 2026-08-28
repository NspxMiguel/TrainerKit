/**
 * Apagar tudo.
 *
 * O app fica inteiro no aparelho — colecao em IndexedDB, ajustes em
 * localStorage, dataset e sprites no Cache Storage, mais o service worker. Nao
 * ha servidor pra pedir exclusao, entao esta funcao E o botao de sair.
 *
 * Ela nao pede confirmacao: quem chama e a tela, e la a confirmacao e explicita
 * e o backup e oferecido primeiro. Uma funcao que apaga tudo tem que ser
 * chamavel sem surpresa; o cuidado mora em quem chama.
 *
 * O que ela apaga, sem exceção:
 *
 *   IndexedDB      a colecao inteira
 *   localStorage   setup, idioma, tema, chave da IA, fontes, adiamentos
 *   sessionStorage nada importante, mas nao pode sobrar
 *   Cache Storage  dataset, sprites, fontes — tudo o que o SW guardou
 *   Service Worker o registro, pra a proxima abertura ser a primeira
 */

/**
 * Lista os bancos e apaga um a um.
 *
 * `indexedDB.databases()` nao existe no Firefox nem no Safari antigo, entao o
 * nome conhecido entra na mao. Apagar um banco que nao existe e barato e nao
 * lanca — melhor tentar do que deixar a colecao pra tras.
 */
async function apagarIndexedDb(): Promise<void> {
  const nomes = new Set<string>([
    "trainerkit-collection",
    "trainerkit-sprites",
    // As imagens baixadas. Sao o maior volume de todos (~150 MB com a Especies
    // inteira), e ficavam para tras porque `databases()` nao existe no Firefox
    // nem no Safari antigo — a lista escrita a mao e a unica garantia.
    "trainerkit-arte",
  ]);

  try {
    const listar = (indexedDB as { databases?: () => Promise<{ name?: string }[]> }).databases;
    if (listar) {
      for (const db of await listar.call(indexedDB)) {
        if (db.name) nomes.add(db.name);
      }
    }
  } catch {
    // Sem listagem, ficam os nomes conhecidos.
  }

  await Promise.all(
    [...nomes].map(
      (nome) =>
        new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase(nome);
          // `blocked` acontece quando outra aba ainda segura o banco. Nao da pra
          // esperar pra sempre: o resto do apagamento segue e a recarga fecha a
          // conexao de qualquer jeito.
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        }),
    ),
  );
}

/** Apaga tudo e recarrega numa URL nova, pra nao voltar do cache HTTP. */
export async function wipeEverything(): Promise<void> {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // Safari privado recusa ate limpar. Nao pode travar o resto.
  }

  await apagarIndexedDb();

  try {
    await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch {
    // Sem Cache Storage nao ha o que apagar.
  }

  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    // idem
  }

  // Endereco novo pelo mesmo motivo do botao de forcar atualizacao: sem isto o
  // `index.html` volta do cache HTTP e a "primeira abertura" nao seria a
  // primeira de verdade.
  window.location.replace(`${import.meta.env.BASE_URL}?zerado=${Date.now()}`);
}
