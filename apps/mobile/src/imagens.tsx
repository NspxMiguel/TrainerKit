import { SPRITE_SOURCE_KEYS, type BuiltinSourceId } from "@trainerkit/core";
import AsyncStorage from "expo-sqlite/kv-store";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * A FONTE DE IMAGEM — desligada por padrão, e isso não é economia.
 *
 * O app é distribuído sem arte nenhuma, e o monograma colorido não é um
 * placeholder envergonhado: ele é o recurso de qualquer espécie sem arquivo, em
 * qualquer fonte. Ligar significa buscar imagem do GitHub enquanto se navega, e
 * essa é uma escolha de quem instala.
 *
 * ⚠️ E é a política de privacidade que obriga o padrão a ser esse. A tela de
 * Privacidade diz que UM host recebe pedido do app (a lista de eventos). Ligar
 * a fonte de imagem acrescenta um segundo — e é por isso que a mesma tela
 * declara isso, condicionado a esta configuração estar ligada. Ligar por padrão
 * transformaria uma frase verdadeira em falsa.
 */
const CHAVE = "tk:imagens";

/** As três embutidas. O `.zip` próprio do web não atravessa pro nativo. */
export const FONTES: BuiltinSourceId[] = ["off", "pokeapi-artwork", "pokeapi-home"];

export { SPRITE_SOURCE_KEYS };

interface Ctx {
  fonte: BuiltinSourceId;
  definir: (f: BuiltinSourceId) => void;
}

const Contexto = createContext<Ctx | null>(null);

export function Imagens({ children }: { children: ReactNode }) {
  const [fonte, setFonte] = useState<BuiltinSourceId>("off");

  useEffect(() => {
    AsyncStorage.getItem(CHAVE)
      .then((v) => {
        if (v === "pokeapi-artwork" || v === "pokeapi-home" || v === "off") setFonte(v);
      })
      .catch(() => {});
  }, []);

  const valor = useMemo<Ctx>(
    () => ({
      fonte,
      definir: (f) => {
        setFonte(f);
        AsyncStorage.setItem(CHAVE, f).catch(() => {});
      },
    }),
    [fonte],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useImagens(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error("useImagens fora do <Imagens>");
  return c;
}
