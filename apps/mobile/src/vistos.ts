import AsyncStorage from "expo-sqlite/kv-store";
import { useCallback, useEffect, useState } from "react";

/**
 * O registro de VISTOS.
 *
 * E a funcao mais caracteristica de uma Pokedex, e o app nativo nao tinha
 * nenhuma — o PWA ja tinha (`apps/web/src/storage/seen.ts`) e este e o mesmo
 * conceito no armazenamento do nativo.
 *
 *   VISTO      a pessoa abriu a ficha dele. E o mais perto de "encontrei" que
 *              um app fora do jogo pode saber honestamente.
 *   CAPTURADO  esta na colecao (`colecao.ts`). Ja existia.
 *
 * ⚠️ O ESTADO E A QUANTIDADE, e nao o conjunto. Devolver o `Set` de um hook
 * faria toda ficha re-renderizar em laco — quem precisa de um id especifico
 * chama `foiVisto`, que nao passa pelo estado.
 */
const CHAVE = "tk:vistos";

let cache: Set<string> | null = null;
const ouvintes = new Set<() => void>();

async function ler(): Promise<Set<string>> {
  if (cache) return cache;
  try {
    const bruto = await AsyncStorage.getItem(CHAVE);
    const lido: unknown = bruto ? JSON.parse(bruto) : [];
    cache = new Set(Array.isArray(lido) ? lido.filter((x): x is string => typeof x === "string") : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

function avisar(): void {
  for (const fn of ouvintes) fn();
}

/** Marca a especie como vista. Escreve so quando ela ainda nao estava la. */
export async function marcarVisto(id: string): Promise<void> {
  const atual = await ler();
  if (atual.has(id)) return;
  atual.add(id);
  await AsyncStorage.setItem(CHAVE, JSON.stringify([...atual]));
  avisar();
}

/** Se a especie ja foi vista. Sincrono: le o cache, que a abertura ja carregou. */
export function foiVisto(id: string): boolean {
  return cache?.has(id) ?? false;
}

/** Quantas especies distintas ja foram abertas. */
export function useVistos(): { total: number; recarregar: () => void } {
  const [total, setTotal] = useState(cache?.size ?? 0);

  const recarregar = useCallback(() => {
    void ler().then((s) => setTotal(s.size));
  }, []);

  useEffect(() => {
    const fn = () => setTotal(cache?.size ?? 0);
    ouvintes.add(fn);
    recarregar();
    return () => {
      ouvintes.delete(fn);
    };
  }, [recarregar]);

  return { total, recarregar };
}
