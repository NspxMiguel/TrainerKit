import AsyncStorage from "expo-sqlite/kv-store";
import { useCallback, useEffect, useState } from "react";

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

export interface Guardado {
  id: string;
  speciesId: string;
  ivs: { atk: number; def: number; hp: number };
  level: number;
  shadow: boolean;
  lucky: boolean;
  em: number;
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
    cache = cru ? (JSON.parse(cru) as Guardado[]) : [];
  } catch {
    cache = [];
  }
  return cache;
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

export async function guardar(
  entrada: Omit<Guardado, "id" | "em">,
): Promise<void> {
  const lista = await ler();
  await gravar([
    ...lista,
    { ...entrada, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, em: Date.now() },
  ]);
}

export async function remover(id: string): Promise<void> {
  const lista = await ler();
  await gravar(lista.filter((g) => g.id !== id));
}

export function useColecao(): { itens: Guardado[] | null; recarregar: () => void } {
  const [itens, setItens] = useState<Guardado[] | null>(cache);

  const recarregar = useCallback(() => {
    void ler().then((l) => setItens([...l]));
  }, []);

  useEffect(() => {
    const fn = () => setItens(cache ? [...cache] : []);
    ouvintes.add(fn);
    recarregar();
    return () => {
      ouvintes.delete(fn);
    };
  }, [recarregar]);

  return { itens, recarregar };
}
