import Dexie, { type Table } from "dexie";
import { useEffect, useState } from "react";

import type { IVs } from "@trainerkit/core";

/**
 * A colecao do usuario.
 *
 * Fica em IndexedDB, no aparelho, e nunca sai dali. Nao ha servidor, nao ha
 * conta e nao ha sincronizacao — o que significa que o unico jeito de perder
 * isto e o navegador despejar os dados, que e exatamente o risco que
 * `persist.ts` combate.
 *
 * Por isso o export em JSON existe desde o primeiro dia: rede de seguranca que
 * nao depende do humor do browser.
 */

/**
 * Por que a pessoa fica com um Pokémon que o app mandaria soltar.
 *
 * São três porque foram três os exemplos que ele deu, e eles cobrem categorias
 * diferentes de razão — não é uma lista de gostos:
 *
 *   `gosto`   — afeto e coleção. "vai q o cara gosta do pokemon q quer
 *               colecionar?"
 *   `uso`     — uso real que o app não mede (raide com amigos, ginásio, um
 *               moveset que ele gosta de jogar).
 *   `desafio` — regra que a pessoa se impôs. "vai q ele ta num desafio e quer
 *               usa o pokemon pra fazer reid e ponto final?"
 *
 * Guardar QUAL motivo, e não um booleano, é o que deixa a tela devolver a frase
 * dela em vez de um "ignorado" — e é o que permitiria, um dia, a faxina
 * agrupar por motivo. Um booleano jogaria fora a única parte que o app não
 * consegue recalcular sozinho.
 */
export type MeuMotivo = "gosto" | "uso" | "desafio";

export interface OwnedPokemon {
  id: string;
  speciesId: string;
  /** Apelido do jogador. Cosmetico — nunca usado para identificar a especie. */
  nickname: string | null;
  ivs: IVs;
  /** `null` quando o jogador nao informou PC e PS. */
  level: number | null;
  cp: number | null;
  hp: number | null;
  lucky: boolean;
  shadow: boolean;
  addedAt: string;
  /**
   * O veredito que a pessoa JA CUMPRIU.
   *
   * O app dizia "INVESTIR" em verde e continuava dizendo pra sempre, mesmo
   * depois de a pessoa investir. Um aviso que nao sai depois de atendido para
   * de ser aviso e vira ruido — e pior, ensina a ignorar os outros.
   *
   * Guardamos QUAL acao foi feita, nao um booleano: o veredito muda quando o
   * Pokemon sobe de nivel ou evolui, e "ja evolui" nao responde a um
   * "transferir" que apareca depois. Marcado e cumprido so quando o veredito
   * atual e o mesmo que foi marcado.
   */
  doneAction: string | null;
  /**
   * `true` quando a pessoa disse "eu tenho esse" sem informar o IV.
   *
   * ⚠️ Isto NÃO é um IV zerado. Os campos de `ivs` ficam em 0 porque o tipo os
   * exige, e ler esses zeros como se fossem medidos seria o pior erro possível
   * neste app: o veredito sairia "Transferir" com toda a confiança do mundo
   * para um Pokémon que pode ser 100%.
   *
   * Quem lê a coleção tem que checar esta marca ANTES de decidir. Sem IV o app
   * não decide — ele pede o IV, que é a resposta honesta.
   */
  ivDesconhecido?: boolean;
  /**
   * "Eu discordo — fico com ele", e o motivo que a pessoa deu.
   *
   * ⚠️ Isto existe porque o app estava errado sobre o que ele sabe.
   *
   * "e tem q ter um botão, discordo... vai q o cara gosta do pokemon q quer
   * colecionar? vai q ele ta num desafio e quer usa o pokemon pra fazer reid e
   * ponto final? pense em tudo isso..."
   *
   * O motor decide com o que dá pra calcular: IV, stats, liga, custo. Gostar de
   * um bicho, colecionar uma linha inteira, jogar um desafio de tipo único —
   * nada disso é calculável, e nada disso é menos válido que um stat product.
   * Um app que só sabe insistir está dizendo que a razão dele vale mais que a
   * da pessoa.
   *
   * Marcado, o veredito continua sendo CALCULADO e continua visível — o que
   * muda é que ele para de COBRAR: sai da fila da home e nunca aparece na
   * faxina. A conta não é escondida, só deixa de mandar.
   */
  meuMotivo?: MeuMotivo | null;
  /**
   * A qual coleção este Pokémon pertence.
   *
   * Opcional no tipo por causa das linhas gravadas antes do campo existir — a
   * migração da versão 2 preenche todas, mas um export antigo importado depois
   * volta a trazer linhas sem ele. `listPokemon` normaliza.
   */
  colecaoId?: string;
}

/**
 * Uma coleção — na prática, uma conta do jogo.
 *
 * "esse M, no caso, a conta da pessoa ... onde vc pode criar varias contas,
 * varias coleçÕes. pra pessoas q tem varias contas."
 *
 * Não é multiusuário: é a MESMA pessoa com mais de uma conta no jogo, que é
 * comum entre quem joga a sério. Cada coleção tem os seus Pokémon e os seus
 * vereditos; tudo continua no aparelho, sem servidor e sem login.
 */
export interface Colecao {
  id: string;
  nome: string;
  criadaEm: string;
}

/** A coleção que o app usa por padrão, criada na migração. */
const COLECAO_PADRAO = "principal";

class CollectionDb extends Dexie {
  pokemon!: Table<OwnedPokemon, string>;
  colecoes!: Table<Colecao, string>;

  constructor() {
    super("trainerkit-collection");
    this.version(1).stores({ pokemon: "id, speciesId, addedAt" });

    /*
     * ⚠️ VERSÃO 2: as coleções entram, e ninguém perde nada.
     *
     * O `upgrade` roda uma vez por aparelho e faz duas coisas: cria a coleção
     * "Principal" e carimba nela TODOS os Pokémon que já existiam. Sem isso,
     * quem já usa o app abriria a versão nova com a coleção aparentemente
     * vazia — os dados continuariam lá, invisíveis, porque o filtro por
     * coleção não casaria com nada.
     *
     * É o tipo de perda que não dá erro nenhum e parece que o app apagou tudo.
     */
    this.version(2)
      .stores({ pokemon: "id, speciesId, addedAt, colecaoId", colecoes: "id, criadaEm" })
      .upgrade(async (tx) => {
        await tx.table("colecoes").put({
          id: COLECAO_PADRAO,
          nome: "Principal",
          criadaEm: new Date().toISOString(),
        });
        await tx
          .table("pokemon")
          .toCollection()
          .modify((row: OwnedPokemon) => {
            row.colecaoId = COLECAO_PADRAO;
          });
      });
  }
}

const db = new CollectionDb();

/*
 * Qual coleção está ativa. Fica em `localStorage`, e não no IndexedDB, de
 * propósito: é preferência de sessão, precisa ser lida de forma síncrona no
 * primeiro render e não faz parte dos dados que o export salva.
 */
const CHAVE_ATIVA = "tk-colecao-ativa";

export function colecaoAtiva(): string {
  try {
    return localStorage.getItem(CHAVE_ATIVA) || COLECAO_PADRAO;
  } catch {
    // Safari em navegação privada recusa `localStorage`. Cair na padrão é
    // melhor que quebrar a tela inteira por causa de uma preferência.
    return COLECAO_PADRAO;
  }
}

export async function trocarColecao(id: string): Promise<void> {
  try {
    localStorage.setItem(CHAVE_ATIVA, id);
  } catch {
    /* ver acima */
  }
  emit();
}

export async function listarColecoes(): Promise<Colecao[]> {
  const todas = await db.colecoes.toArray();
  if (todas.length === 0) {
    // Aparelho novo: a migração não roda porque não havia versão 1 pra migrar.
    const padrao: Colecao = {
      id: COLECAO_PADRAO,
      nome: "Principal",
      criadaEm: new Date().toISOString(),
    };
    await db.colecoes.put(padrao);
    return [padrao];
  }
  return todas.sort((a, b) => a.criadaEm.localeCompare(b.criadaEm));
}

/**
 * Quantos Pokémon há em CADA coleção, sem trocar a ativa.
 *
 * ⚠️ Existe porque a primeira versão contava trocando a coleção ativa num laço
 * e voltando no fim — e eu escrevi no comentário que era "feio de propósito".
 * Era pior que feio: estava errado.
 *
 * O `useEffect` do React roda duas vezes em desenvolvimento, então dois laços
 * concorriam trocando a MESMA variável global; cada `listPokemon` lia o que o
 * outro tinha acabado de escrever, e a tela mostrava "0 Pokémon" numa coleção
 * com três. De quebra, cada troca disparava `emit()`, fazendo todas as outras
 * telas recarregarem sem motivo.
 *
 * Contar é uma pergunta de leitura: não tem por que mexer em estado global pra
 * responder. Aqui vai direto ao índice.
 */
export async function contarPorColecao(): Promise<Record<string, number>> {
  const linhas = await db.pokemon.toArray();
  const contas: Record<string, number> = {};
  for (const row of linhas) {
    const id = row.colecaoId ?? COLECAO_PADRAO;
    contas[id] = (contas[id] ?? 0) + 1;
  }
  return contas;
}

export async function criarColecao(nome: string): Promise<Colecao> {
  const nova: Colecao = {
    id: crypto.randomUUID(),
    nome: nome.trim() || "Nova coleção",
    criadaEm: new Date().toISOString(),
  };
  await db.colecoes.put(nova);
  await trocarColecao(nova.id);
  return nova;
}

export async function renomearColecao(id: string, nome: string): Promise<void> {
  await db.colecoes.update(id, { nome: nome.trim() || "Sem nome" });
  emit();
}

/**
 * Apaga a coleção E os Pokémon dela.
 *
 * ⚠️ Numa transação só. Apagar a coleção e deixar os Pokémon produziria linhas
 * órfãs — invisíveis na tela, contando no espaço em disco, e ressuscitando se
 * alguém recriasse uma coleção com o mesmo id.
 *
 * A última coleção não pode ser apagada: sem nenhuma, o app não teria onde
 * gravar o próximo Pokémon escaneado.
 */
export async function apagarColecao(id: string): Promise<void> {
  const todas = await db.colecoes.toArray();
  if (todas.length <= 1) return;
  await db.transaction("rw", db.pokemon, db.colecoes, async () => {
    await db.pokemon.where("colecaoId").equals(id).delete();
    await db.colecoes.delete(id);
  });
  if (colecaoAtiva() === id) {
    const sobrou = todas.find((c) => c.id !== id);
    if (sobrou) await trocarColecao(sobrou.id);
  }
  emit();
}

const listeners = new Set<() => void>();
function emit(): void {
  for (const fn of listeners) fn();
}

export async function addPokemon(
  entry: Omit<OwnedPokemon, "id" | "addedAt">,
): Promise<OwnedPokemon> {
  const row: OwnedPokemon = {
    ...entry,
    id: crypto.randomUUID(),
    addedAt: new Date().toISOString(),
    // O Pokémon nasce na coleção que está aberta. Sem isto, escanear com uma
    // segunda conta ativa gravaria na primeira.
    colecaoId: colecaoAtiva(),
  };
  await db.pokemon.put(row);
  emit();
  return row;
}

export async function removePokemon(id: string): Promise<void> {
  await db.pokemon.delete(id);
  emit();
}

/**
 * Tira vários da coleção DE UMA VEZ, e devolve o que tirou.
 *
 * ⚠️ O retorno é o desfazer. Não é conveniência de API: a faxina remove dezenas
 * de linhas num toque, e a única coisa que existe entre um toque errado e a
 * perda é este array — não há servidor, não há lixeira e não há histórico.
 * Quem chama SEGURA o resultado até a pessoa sair da tela.
 *
 * Numa transação só, pelo mesmo motivo de `apagarColecao`: uma remoção pela
 * metade deixaria a lista de desfazer sem correspondência com o que sumiu, e o
 * "Desfazer" restauraria duplicatas.
 */
export async function removerVarios(ids: readonly string[]): Promise<OwnedPokemon[]> {
  if (ids.length === 0) return [];
  const removidos = await db.transaction("rw", db.pokemon, async () => {
    const linhas = await db.pokemon.bulkGet([...ids]);
    const achados = linhas.filter((r): r is OwnedPokemon => r !== undefined);
    await db.pokemon.bulkDelete(achados.map((r) => r.id));
    return achados;
  });
  emit();
  return removidos;
}

/**
 * Devolve o que `removerVarios` tirou.
 *
 * Os `id` são os mesmos, então nada mais no app precisa saber que houve uma
 * volta: o `doneAction`, a coleção de origem e a data de entrada voltam
 * exatamente como estavam. Um desfazer que recriasse ids novos reordenaria a
 * lista e apagaria os vereditos já cumpridos — desfazer que muda as coisas de
 * lugar não é desfazer.
 */
export async function restaurar(linhas: readonly OwnedPokemon[]): Promise<void> {
  if (linhas.length === 0) return;
  await db.pokemon.bulkPut([...linhas]);
  emit();
}

/**
 * "Discordo, fico com ele" — ou desfaz.
 *
 * `null` devolve o Pokémon à fila normal. Não apaga nada mais: o veredito
 * continua sendo calculado o tempo todo, e é isso que faz o botão ser
 * reversível de graça.
 */
export async function setMeuMotivo(id: string, motivo: MeuMotivo | null): Promise<void> {
  await db.pokemon.update(id, { meuMotivo: motivo });
  emit();
}

/** Marca (ou desmarca) o veredito como cumprido. `null` volta a cobrar. */
export async function setDoneAction(id: string, action: string | null): Promise<void> {
  await db.pokemon.update(id, { doneAction: action });
  emit();
}

/**
 * Evolui o Pokémon de verdade: ele VIRA a próxima espécie.
 *
 * "ao evoluir um pokemon q pede pra evoluir (bulbasauro) ao invez de so dar um
 * check, porque nao transformarlo em sua evolução? continua o trajeto garai"
 *
 * Ele está certo, e o defeito era de produto, não de tela: o app dizia
 * "Evoluir", a pessoa evoluía no jogo, tocava em "já fiz isso" — e o app
 * continuava com um Bulbasaur na coleção. A partir dali toda análise ficava
 * errada, porque era feita sobre a espécie ANTERIOR: PC máximo do Bulbasaur,
 * ranking do Bulbasaur, counters do Bulbasaur. Um "check" registrava que a
 * pessoa cumpriu e jogava fora justamente o que ela cumpriu.
 *
 * ⚠️ Os IVs e o nível são PRESERVADOS, e isso não é escolha de interface: é
 * como o jogo funciona. Evoluir não altera IV nem nível — só a espécie, e com
 * ela os stats base. Por isso o veredito da forma nova sai correto sozinho, sem
 * a pessoa precisar reescanear nada.
 *
 * `doneAction` volta a `null` porque o veredito recomeça: o Ivysaur pode
 * perfeitamente voltar a pedir "evoluir", e um "já fiz" herdado esconderia isso.
 *
 * PC e PS entram como `null` — eles mudam na evolução e o app não tem como
 * saber os novos. Deixar os antigos seria pior que não ter: número errado com
 * cara de certo.
 */
export async function evolvePokemon(id: string, paraEspecie: string): Promise<void> {
  await db.pokemon.update(id, {
    speciesId: paraEspecie,
    doneAction: null,
    cp: null,
    hp: null,
  });
  emit();
}

export async function listPokemon(): Promise<OwnedPokemon[]> {
  const all = await db.pokemon.toArray();
  const ativa = colecaoAtiva();
  return (
    all
      // Linhas gravadas antes do campo existir vem sem ele. Normalizar aqui
      // dispensa `?? null` espalhado por toda tela que le a colecao.
      .map((row) => ({
        ...row,
        doneAction: row.doneAction ?? null,
        colecaoId: row.colecaoId ?? COLECAO_PADRAO,
      }))
      /*
       * ⚠️ O FILTRO POR COLEÇÃO MORA AQUI, e não em cada tela.
       *
       * Toda tela que lê a coleção passa por esta função — home, Pokédex,
       * counters de raide, montar time, o dossiê da IA. Filtrar em cada uma
       * seria seis lugares pra esquecer um, e o sintoma de esquecer é o pior
       * possível: os Pokémon de uma conta aparecendo na análise da outra.
       */
      .filter((row) => row.colecaoId === ativa)
      // Mais recente primeiro: o que voce acabou de escanear e o que voce quer ver.
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  );
}

/** Lista reativa — recarrega sozinha quando algo e adicionado ou removido. */
export function useCollection(): { items: OwnedPokemon[] | null; reload: () => void } {
  const [items, setItems] = useState<OwnedPokemon[] | null>(null);

  const reload = () => {
    void listPokemon().then(setItems);
  };

  useEffect(() => {
    reload();
    listeners.add(reload);
    return () => {
      listeners.delete(reload);
    };
  }, []);

  return { items, reload };
}

/**
 * Backup em JSON.
 *
 * Nao e recurso de luxo: e a unica coisa que sobrevive a um despejo do
 * navegador. Fica acessivel sempre, nao escondido atras de "avancado".
 *
 * ⚠️ SALVA TODAS AS CONTAS, e isto era um bug de perda de dados.
 *
 * A versao 1 chamava `listPokemon()`, que filtra pela coleção ATIVA. Quem
 * tivesse duas contas e baixasse o backup levava para casa metade da coleção —
 * sem erro, sem aviso, e com um arquivo que parecia completo. O sintoma só
 * apareceria no dia do desastre, que é o único dia em que já não dá pra
 * consertar.
 *
 * As coleções vão junto com os Pokémon: sem elas, restaurar num aparelho novo
 * recriaria bichos apontando para contas que não existem, e eles não
 * apareceriam em lugar nenhum (o filtro de `listPokemon` não casaria com nada).
 */
export async function exportJson(): Promise<string> {
  const [items, colecoes] = await Promise.all([db.pokemon.toArray(), listarColecoes()]);
  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      colecoes,
      items: items.map((row) => ({ ...row, colecaoId: row.colecaoId ?? COLECAO_PADRAO })),
    },
    null,
    2,
  );
}

export async function importJson(text: string): Promise<number> {
  const parsed = JSON.parse(text) as { items?: unknown; colecoes?: unknown };
  if (!Array.isArray(parsed.items)) {
    throw new Error("Arquivo não parece um backup do TrainerKit.");
  }

  const rows = parsed.items as OwnedPokemon[];
  for (const row of rows) {
    if (!row.speciesId || !row.ivs) throw new Error("Backup com entrada inválida.");
  }

  /*
   * ⚠️ NENHUM POKÉMON PODE ENTRAR NUMA COLEÇÃO QUE NÃO EXISTE.
   *
   * O `colecaoId` é um UUID gerado no aparelho de origem. Restaurar num
   * aparelho novo — que é justamente para o que serve um backup — gravava
   * linhas apontando para um id que nunca existiu aqui. Elas ficam no banco,
   * ocupam espaço, e some do app: `listPokemon` filtra pela coleção ativa e
   * nenhuma coleção tem aquele id.
   *
   * Backup v2 traz as coleções e nós as recriamos. Backup v1 não traz nada
   * disso, e aí o destino honesto é a coleção que está ABERTA: é onde a pessoa
   * está olhando e onde ela vai procurar o que acabou de importar.
   */
  const doArquivo = Array.isArray(parsed.colecoes) ? (parsed.colecoes as Colecao[]) : [];
  // `listarColecoes` (e nao `db.colecoes.toArray`) porque ele GARANTE que existe
  // pelo menos uma: num aparelho zerado a migracao nao roda, e sem esta chamada
  // o destino dos orfaos seria uma colecao inexistente — o bug de novo.
  const jaAqui = await listarColecoes();
  const existentes = new Set(jaAqui.map((c) => c.id));

  const aCriar = doArquivo.filter((c) => c && c.id && !existentes.has(c.id));
  if (aCriar.length > 0) {
    await db.colecoes.bulkPut(
      aCriar.map((c) => ({
        id: c.id,
        nome: c.nome?.trim() || "Conta importada",
        criadaEm: c.criadaEm ?? new Date().toISOString(),
      })),
    );
    for (const c of aCriar) existentes.add(c.id);
  }

  const ativa = colecaoAtiva();
  const destinoOrfao = existentes.has(ativa) ? ativa : jaAqui[0]!.id;
  await db.pokemon.bulkPut(
    rows.map((row) => ({
      ...row,
      colecaoId: row.colecaoId && existentes.has(row.colecaoId) ? row.colecaoId : destinoOrfao,
    })),
  );
  emit();
  return rows.length;
}
