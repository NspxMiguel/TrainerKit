import AsyncStorage from "expo-sqlite/kv-store";
import { useCallback, useEffect, useState } from "react";

/**
 * MOSTRAR A TRADUÇÃO DO GOLPE junto do inglês.
 *
 * ⚠️ LIGADO por padrão, e é a escolha certa: quem abre o app em português quer
 * entender o nome, e quem já sabe desliga uma vez. O contrário — inglês puro
 * por padrão — deixa a maioria lendo uma língua que ela não escolheu.
 *
 * ⚠️ Em inglês a chave não importa: `rotuloDoGolpe` já devolve uma linha só.
 */
const CHAVE = "tk:traducao";

let cache: boolean | null = null;
const ouvintes = new Set<() => void>();

export function useTraducao(): { mostrar: boolean; alternar: () => void } {
  const [mostrar, setMostrar] = useState(cache ?? true);

  useEffect(() => {
    const fn = () => setMostrar(cache ?? true);
    ouvintes.add(fn);
    if (cache === null) {
      AsyncStorage.getItem(CHAVE)
        .then((v) => {
          cache = v === null ? true : v === "1";
          fn();
        })
        .catch(() => {});
    }
    return () => {
      ouvintes.delete(fn);
    };
  }, []);

  const alternar = useCallback(() => {
    cache = !(cache ?? true);
    AsyncStorage.setItem(CHAVE, cache ? "1" : "0").catch(() => {});
    for (const fn of ouvintes) fn();
  }, []);

  return { mostrar, alternar };
}
