import AsyncStorage from "expo-sqlite/kv-store";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * A colecao — os bichos que ele guardou.
 *
 * ⚠️ KV-STORE E NAO TABELA, e o motivo e o tamanho: uma colecao grande de
 * Pokemon GO tem centenas de itens, nao centenas de milhares. Serializar a
 * lista inteira num valor custa milissegundos e dispensa migracao de esquema —
 * e migracao de esquema num app que a pessoa instala por sideload, sem loja pra
 * empurrar correcao, e risco sem ganho.
 *
 * Quando a colecao virar consulta de verdade (filtrar por tipo, ordenar por
 * IV sobre milhares), ai sim vale SQLite com tabela. Hoje seria adiantar
 * complexidade pra um problema que nao existe.
 */
const CHAVE = "tk:colecao";
const CHAVE_COLECOES = "tk:colecoes";
const CHAVE_ATIVA = "tk:colecao-ativa";

/** A colecao que a migracao cria e carimba em tudo que ja existia. */
export const COLECAO_PADRAO = "principal";

export interface Colecao {
  id: string;
  nome: string;
  criadaEm: number;
}

export interface Guardado {
  id: string;
  /**
   * A que colecao este bicho pertence.
   *
   * ⚠️ OPCIONAL DE PROPOSITO, e nao por desleixo: quem ja usava o app tem
   * registros gravados SEM este campo. `ler` carimba todos na colecao padrao
   * na primeira leitura — sem isso a colecao abriria vazia, com os dados ainda
   * la e invisiveis, porque o filtro nao casaria com nada.
   */
  colecao?: string;
  speciesId: string;
  ivs: { atk: number; def: number; hp: number };
  level: number;
  shadow: boolean;
  lucky: boolean;
  em: number;
  /**
   * O IV ainda não foi medido.
   *
   * ⚠️ Sem esta marca, "Tenho esse" gravaria `0/0/0` e a coleção mostraria um
   * Charizard de 0% — um número errado é pior que número nenhum, porque o
   * veredito acredita nele e manda transferir.
   *
   * Opcional porque registro gravado antes disto não tem o campo, e a ausência
   * significa "medido", que é o que aqueles registros são.
   */
  ivDesconhecido?: boolean;
  /**
   * O veredito que a pessoa já EXECUTOU neste exemplar.
   *
   * ⚠️ É o que tira o bicho da fila sem apagar o veredito: quem já evoluiu não
   * quer ser cobrado de novo, e o app continuar dizendo "Evoluir" depois de a
   * pessoa evoluir é o app não estar prestando atenção.
   */
  doneAction?: string | null;
  /**
   * Por que ela vai ficar com ele mesmo assim.
   *
   * ⚠️ É o "discordo". O veredito continua calculado e visível na ficha; o que
   * ele perde é o direito de COBRAR. Um contador que soma bichos que a pessoa
   * já disse que vai guardar é insistência.
   */
  meuMotivo?: string | null;
}

let cache: Guardado[] | null = null;
const ouvintes = new Set<() => void>();

function avisar(): void {
  for (const fn of ouvintes) fn();
}

async function ler(): Promise<Guardado[]> {
  if (cache) return cache;
  try {
    const cru = await AsyncStorage.getItem(CHAVE);
    const lido = cru ? (JSON.parse(cru) as Guardado[]) : [];
    /* A MIGRACAO, e ela roda uma vez por aparelho: tudo que nao tem colecao
       passa a ser da padrao. Regravar so acontece se algo mudou. */
    const semColecao = lido.filter((g) => !g.colecao);
    if (semColecao.length > 0) {
      for (const g of semColecao) g.colecao = COLECAO_PADRAO;
      await AsyncStorage.setItem(CHAVE, JSON.stringify(lido));
    }
    cache = lido;
  } catch {
    cache = [];
  }
  return cache;
}

async function lerColecoes(): Promise<Colecao[]> {
  try {
    const cru = await AsyncStorage.getItem(CHAVE_COLECOES);
    const lido = cru ? (JSON.parse(cru) as Colecao[]) : [];
    if (lido.length > 0) return lido;
  } catch {
    // cai na criacao da padrao
  }
  const padrao: Colecao[] = [{ id: COLECAO_PADRAO, nome: "Principal", criadaEm: 0 }];
  await AsyncStorage.setItem(CHAVE_COLECOES, JSON.stringify(padrao));
  return padrao;
}

/** Todas as colecoes, com a padrao garantida. */
export async function listarColecoes(): Promise<Colecao[]> {
  return lerColecoes();
}

/** Qual colecao esta em uso. */
export async function colecaoAtiva(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(CHAVE_ATIVA)) || COLECAO_PADRAO;
  } catch {
    return COLECAO_PADRAO;
  }
}

export async function trocarColecao(id: string): Promise<void> {
  await AsyncStorage.setItem(CHAVE_ATIVA, id);
  avisar();
}

export async function criarColecao(nome: string): Promise<Colecao> {
  const lista = await lerColecoes();
  const nova: Colecao = {
    id: `c${lista.length + 1}-${nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`,
    nome: nome.trim() || "Sem nome",
    criadaEm: 0,
  };
  await AsyncStorage.setItem(CHAVE_COLECOES, JSON.stringify([...lista, nova]));
  avisar();
  return nova;
}

export async function renomearColecao(id: string, nome: string): Promise<void> {
  const lista = await lerColecoes();
  const alvo = lista.find((c) => c.id === id);
  if (!alvo) return;
  alvo.nome = nome.trim() || alvo.nome;
  await AsyncStorage.setItem(CHAVE_COLECOES, JSON.stringify(lista));
  avisar();
}

/**
 * Apaga a colecao E o que estava dentro dela.
 *
 * ⚠️ A padrao nao se apaga: sem ela um aparelho ficaria sem destino pra guardar
 * o proximo bicho, e a proxima leitura recriaria uma vazia com outro id.
 */
export async function apagarColecao(id: string): Promise<void> {
  if (id === COLECAO_PADRAO) return;
  const lista = await lerColecoes();
  await AsyncStorage.setItem(CHAVE_COLECOES, JSON.stringify(lista.filter((c) => c.id !== id)));
  const bichos = await ler();
  await gravar(bichos.filter((g) => g.colecao !== id));
  if ((await colecaoAtiva()) === id) await trocarColecao(COLECAO_PADRAO);
  avisar();
}

/** Quantos bichos em cada colecao. */
export async function contarPorColecao(): Promise<Record<string, number>> {
  const bichos = await ler();
  const conta: Record<string, number> = {};
  for (const g of bichos) {
    const c = g.colecao ?? COLECAO_PADRAO;
    conta[c] = (conta[c] ?? 0) + 1;
  }
  return conta;
}

async function gravar(lista: Guardado[]): Promise<void> {
  cache = lista;
  avisar();
  try {
    await AsyncStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // Sem disco a sessao continua; o que se perde e a proxima abertura.
  }
}

export async function guardar(entrada: Omit<Guardado, "id" | "em">): Promise<void> {
  const lista = await ler();
  /* Sem colecao dita, vai pra que estiver em uso — e nao pra padrao fixa: quem
     esta com "Time de PvP" aberta espera guardar ali. */
  const colecao = entrada.colecao ?? (await colecaoAtiva());
  await gravar([
    ...lista,
    {
      ...entrada,
      colecao,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      em: Date.now(),
    },
  ]);
}

/** Marca (ou desmarca) o veredito como já executado. */
export async function marcarFeito(id: string, acao: string | null): Promise<void> {
  const lista = await ler();
  const alvo = lista.find((g) => g.id === id);
  if (!alvo) return;
  alvo.doneAction = acao;
  await gravar([...lista]);
}

/** Guarda (ou apaga) o motivo de ficar com ele mesmo contra o veredito. */
export async function definirMeuMotivo(id: string, motivo: string | null): Promise<void> {
  const lista = await ler();
  const alvo = lista.find((g) => g.id === id);
  if (!alvo) return;
  alvo.meuMotivo = motivo;
  await gravar([...lista]);
}

/**
 * RESTAURAR um backup.
 *
 * ⚠️ Ele SOMA, não substitui. Importar sobre uma coleção existente e apagar o
 * que estava lá é a forma mais rápida de alguém perder tudo por tocar no botão
 * errado — e não há servidor para desfazer.
 *
 * ⚠️ Todo registro entra na coleção EM USO, e o `colecao` que vier no arquivo é
 * ignorado. O id de coleção é do aparelho de origem; restaurar num aparelho
 * novo — que é para o que serve um backup — gravaria linhas apontando para uma
 * coleção que nunca existiu aqui. Elas ficariam no banco e sumiriam da tela.
 *
 * Devolve quantos entraram.
 */
export async function importar(texto: string): Promise<number> {
  const lido: unknown = JSON.parse(texto);
  /* Aceita as duas formas: a lista crua que o `exportar` grava hoje, e o
     `{ items: [...] }` do backup do PWA. */
  const linhas: unknown = Array.isArray(lido)
    ? lido
    : ((lido as { items?: unknown }).items ?? null);
  if (!Array.isArray(linhas)) throw new Error("nao-e-backup");

  const validos = linhas.filter(
    (x): x is Guardado =>
      typeof x === "object" &&
      x !== null &&
      typeof (x as Guardado).speciesId === "string" &&
      typeof (x as Guardado).ivs === "object",
  );
  if (validos.length === 0) throw new Error("nao-e-backup");

  const destino = await colecaoAtiva();
  const lista = await ler();
  const agora = Date.now();
  await gravar([
    ...lista,
    ...validos.map((g, i) => ({
      ...g,
      colecao: destino,
      /* Id novo: dois backups do mesmo aparelho trariam ids repetidos, e
         remover um apagaria o outro. */
      id: `${agora}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      em: g.em ?? agora,
    })),
  ]);
  return validos.length;
}

/**
 * DEVOLVE o que a faxina tirou.
 *
 * ⚠️ Os registros voltam com o MESMO id. É isso que faz o desfazer ser um
 * desfazer: um id novo criaria cópias e a coleção cresceria a cada vai-e-volta.
 */
export async function restaurar(linhas: readonly Guardado[]): Promise<void> {
  const lista = await ler();
  const existentes = new Set(lista.map((g) => g.id));
  await gravar([...lista, ...linhas.filter((g) => !existentes.has(g.id))]);
}

export async function remover(id: string): Promise<void> {
  const lista = await ler();
  await gravar(lista.filter((g) => g.id !== id));
}

/**
 * Os bichos da colecao EM USO, mais o estado das colecoes.
 *
 * ⚠️ `itens` filtra pela ativa. Devolver a lista inteira e deixar cada tela
 * filtrar seria a mesma regra escrita seis vezes — e a primeira tela que
 * esquecesse mostraria bicho de outra colecao sem ninguem notar.
 */
export function useColecao(): {
  itens: Guardado[] | null;
  todos: Guardado[] | null;
  colecoes: Colecao[];
  ativa: string;
  recarregar: () => void;
} {
  const [todos, setTodos] = useState<Guardado[] | null>(cache);
  const [colecoes, setColecoes] = useState<Colecao[]>([]);
  const [ativa, setAtiva] = useState(COLECAO_PADRAO);

  const recarregar = useCallback(() => {
    void ler().then((l) => setTodos([...l]));
    void lerColecoes().then(setColecoes);
    void colecaoAtiva().then(setAtiva);
  }, []);

  useEffect(() => {
    ouvintes.add(recarregar);
    recarregar();
    return () => {
      ouvintes.delete(recarregar);
    };
  }, [recarregar]);

  /*
   * ⚠️ `useMemo` NÃO É OTIMIZAÇÃO AQUI, é correção.
   *
   * Sem ele `itens` era um array novo a cada render, e todo `useMemo` que
   * depende dele recalculava sempre. Na Faxina isso virou laço infinito —
   * "Maximum update depth exceeded" — porque o efeito que sincroniza a seleção
   * dependia de uma lista que mudava de identidade em toda passada.
   */
  const itens = useMemo(
    () => todos?.filter((g) => (g.colecao ?? COLECAO_PADRAO) === ativa) ?? null,
    [todos, ativa],
  );

  return { itens, todos, colecoes, ativa, recarregar };
}
