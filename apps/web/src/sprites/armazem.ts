import Dexie, { type Table } from "dexie";

/**
 * As imagens guardadas NO APARELHO, e nao no cache do navegador.
 *
 * ── Por que este arquivo existe ──────────────────────────────────────────────
 *
 * O download em massa (`prefetch.ts`) buscava as 1.024 imagens e JOGAVA OS
 * BYTES FORA de proposito: a nota dele dizia que o service worker intercepta e
 * guarda sozinho, entao gravar na mao seria adivinhar a chave do Workbox.
 *
 * O raciocinio estava certo e a premissa estava errada. MEDIDO no endereco da
 * rede local, que e onde o app e testado no celular:
 *
 *   http://localhost:5273    isSecureContext=true    caches=true   sw=true
 *   http://10.0.0.21:5273    isSecureContext=FALSE   caches=FALSE  sw=FALSE
 *
 * Origem HTTP com IP NAO e contexto seguro. Sem contexto seguro nao existe
 * `caches` nem `navigator.serviceWorker` — nao e que falhem, e que nao estao
 * no objeto. Entao naquele endereco o download baixava ~150 MB e guardava
 * nada, e cada tile voltava pra rede. O `raw.githubusercontent.com` responde
 * `cache-control: max-age=300`: cinco minutos depois ate o cache HTTP desiste,
 * e a imagem e buscada DE NOVO. Sao os "1 a 3 segundos".
 *
 * O IndexedDB funciona em origem insegura. Por isso a arte passa a morar aqui:
 * e o unico deposito que existe nos dois mundos, e a resposta deixa de depender
 * de o navegador ter achado a pagina confiavel.
 *
 * ── O indice fica na memoria, os bytes nao ───────────────────────────────────
 *
 * Uma grade monta 60 tiles de uma vez. Se cada um perguntasse ao banco "voce
 * tem esta URL?", seriam 60 idas ao disco so pra descobrir que sim. Em vez
 * disso o indice (so as CHAVES, ~1.024 strings) e lido UMA vez e vira um Set em
 * memoria — dai "tem?" e sincrono, e o disco so e tocado pelo blob que
 * realmente vai aparecer.
 *
 * O sincrono nao e detalhe de desempenho: `SpeciesTile` decide no
 * inicializador do `useState` se ja pode mostrar a arte. Uma resposta que so
 * chega depois traria de volta o quadro de monograma que aquele codigo existe
 * pra evitar.
 */

interface ArteGuardada {
  /** A URL de origem. E a chave: e ela que o tile tem em maos. */
  url: string;
  blob: Blob;
  /** Pra saber a idade do acervo sem abrir cada blob. */
  em: number;
}

class ArmazemDb extends Dexie {
  arte!: Table<ArteGuardada, string>;

  constructor() {
    super("trainerkit-arte");
    this.version(1).stores({ arte: "url" });
  }
}

/*
 * Banco PROPRIO, e nao uma tabela nova no `trainerkit-sprites`.
 *
 * Aquele banco guarda as fontes que o usuario adicionou — o .zip que ele
 * importou e nao tem de onde baixar de novo. Este guarda copia de coisa que a
 * rede devolve. Sao valores muito diferentes na hora de liberar espaco: "apagar
 * as imagens baixadas" nao pode nem chegar perto do acervo que so existe aqui.
 * Bancos separados tornam isso impossivel por construcao, em vez de por cuidado.
 */
const db = new ArmazemDb();

/** As URLs que o banco tem. `null` enquanto ninguem perguntou ainda. */
let indice: Set<string> | null = null;
let carregando: Promise<Set<string>> | null = null;

/*
 * Quem avisar quando o indice chegar.
 *
 * ⚠️ SEM ISTO A PRIMEIRA GRADE VAI TODA PRA REDE. O indice e assincrono; a
 * grade monta antes dele. `temNoArmazem` responderia `false` para as 60 e cada
 * tile pediria a imagem pro GitHub — justamente o que este arquivo existe pra
 * evitar, e so na primeira tela, que e a que se ve.
 */
const ouvintes = new Set<() => void>();

export function assinarArmazem(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}

/**
 * O que o `useSyncExternalStore` compara.
 *
 * ⚠️ NAO E O TAMANHO DO ACERVO, e a diferenca importa muito: `guardarArte` roda
 * 1.024 vezes durante um download, e um snapshot que mudasse a cada uma
 * re-renderizaria TODO tile montado 1.024 vezes — o app travaria justamente
 * enquanto baixa. A geracao so anda quando o indice fica pronto ou e zerado,
 * que sao os dois momentos em que a resposta de `temNoArmazem` muda de figura.
 *
 * Imagem guardada durante um download so aparece na proxima montagem do tile.
 * E o certo: enquanto o download corre, o caminho de rede ja esta funcionando.
 */
export function versaoDoArmazem(): number {
  return geracao;
}

let geracao = 0;

function avisar(): void {
  geracao++;
  for (const fn of ouvintes) fn();
}

/**
 * Le o indice uma vez e guarda.
 *
 * `primaryKeys()` traz so as chaves — nenhum blob sai do disco aqui.
 */
export function carregarIndice(): Promise<Set<string>> {
  if (indice) return Promise.resolve(indice);
  carregando ??= db.arte
    .toCollection()
    .primaryKeys()
    .then((chaves) => {
      indice = new Set(chaves);
      avisar();
      return indice;
    })
    .catch(() => {
      // Navegador em modo privado pode recusar o banco. Sem indice o app volta
      // ao comportamento antigo (busca pela rede) em vez de ficar sem imagem.
      indice = new Set();
      avisar();
      return indice;
    });
  return carregando;
}

/** Sincrono: `false` tambem quando o indice ainda nao chegou. */
export function temNoArmazem(url: string): boolean {
  return indice !== null && indice.has(url);
}

/** Quantas imagens estao guardadas. `0` antes de o indice chegar. */
export function quantasNoArmazem(): number {
  return indice?.size ?? 0;
}

// ------------------------------------------------------------- object URLs

/**
 * As URLs de blob vivas, em ordem de uso.
 *
 * ⚠️ O TETO EXISTE POR MEMORIA, e nao por capricho: uma URL de blob segura o
 * blob inteiro na memoria enquanto nao for revogada. Percorrer a Especies
 * inteira criaria 1.024 delas — ~150 MB presos num celular.
 *
 * Revogar e seguro porque revogar NAO apaga imagem ja pintada: o endereco para
 * de resolver para cargas NOVAS, e o `<img>` que ja decodificou continua na
 * tela. Com 160 vivas e ~60 tiles visiveis, a evicao nunca alcanca uma imagem
 * que ainda esteja carregando.
 */
const TETO_DE_URLS = 160;
const vivas = new Map<string, string>();

function lembrar(url: string, objeto: string): string {
  vivas.set(url, objeto);
  if (vivas.size > TETO_DE_URLS) {
    // `Map` itera na ordem de insercao, entao o primeiro e o mais antigo.
    const maisVelha = vivas.keys().next();
    if (!maisVelha.done) {
      const antiga = vivas.get(maisVelha.value)!;
      vivas.delete(maisVelha.value);
      URL.revokeObjectURL(antiga);
    }
  }
  return objeto;
}

/** O endereco local, se ele ja estiver na memoria. Sincrono de proposito. */
export function arteEmMemoria(url: string): string | null {
  return vivas.get(url) ?? null;
}

/** O endereco local da arte guardada, lendo o blob se precisar. */
export async function pegarArte(url: string): Promise<string | null> {
  const pronta = vivas.get(url);
  if (pronta) return pronta;

  await carregarIndice();
  if (!temNoArmazem(url)) return null;

  try {
    const linha = await db.arte.get(url);
    if (!linha) return null;
    // Outra chamada pode ter resolvido a mesma URL enquanto esta lia o disco.
    // Sem esta conferencia, as duas criariam objetos e um vazaria.
    const jaFeita = vivas.get(url);
    if (jaFeita) return jaFeita;
    return lembrar(url, URL.createObjectURL(linha.blob));
  } catch {
    return null;
  }
}

/** Guarda uma imagem baixada. Silencioso: um erro aqui nao pode parar o download. */
export async function guardarArte(url: string, blob: Blob): Promise<void> {
  try {
    await db.arte.put({ url, blob, em: Date.now() });
    // Sem `avisar()` de proposito — ver a nota em `versaoDoArmazem`.
    (await carregarIndice()).add(url);
  } catch {
    // Cota estourada e o caso comum. O download continua e o que couber fica —
    // parar tudo por causa da ultima imagem seria pior que guardar 900.
  }
}

/** Quantas destas URLs ja estao guardadas. E a pergunta que o botao faz. */
export async function quantasDestas(urls: readonly string[]): Promise<number> {
  const dentro = await carregarIndice();
  let n = 0;
  for (const url of urls) if (dentro.has(url)) n++;
  return n;
}

/** Apaga o acervo baixado. Nao toca nas fontes que o usuario importou. */
export async function limparArmazem(): Promise<void> {
  try {
    await db.arte.clear();
  } catch {
    // Nada a fazer: quem chama ja esta na tela de limpeza.
  }
  for (const objeto of vivas.values()) URL.revokeObjectURL(objeto);
  vivas.clear();
  indice = new Set();
  avisar();
}

/** Bytes ocupados. Percorre os blobs, entao so a tela de limpeza chama. */
export async function tamanhoDoArmazem(): Promise<number> {
  try {
    let total = 0;
    await db.arte.each((linha) => {
      total += linha.blob.size;
    });
    return total;
  } catch {
    return 0;
  }
}
