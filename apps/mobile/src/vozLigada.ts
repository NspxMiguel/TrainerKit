import AsyncStorage from "expo-sqlite/kv-store";
import { useCallback, useEffect, useState } from "react";

/**
 * A VOZ LIGADA OU DESLIGADA — e a escolha fica salva.
 *
 * ⚠️ O Modo Pokédex tinha só um botão "falar de novo": para calar era preciso
 * tocar de novo, e a preferência sumia ao fechar a tela. Quem não quer voz não
 * quer ser perguntado toda vez.
 *
 * O padrão é LIGADA: a locução é o que separa este modo de uma busca com
 * câmera atrás, e quem não quiser desliga uma vez.
 */
const CHAVE = "tk:voz";

let cache: boolean | null = null;
const ouvintes = new Set<() => void>();

export function useVozLigada(): { ligada: boolean; alternar: () => void } {
  const [ligada, setLigada] = useState(cache ?? true);

  useEffect(() => {
    const fn = () => setLigada(cache ?? true);
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

  return { ligada, alternar };
}
