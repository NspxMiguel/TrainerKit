import AsyncStorage from "expo-sqlite/kv-store";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * A IA — e a chave é de quem usa, sempre.
 *
 * ⚠️ Duas opções e só: desligado, e a chave da própria pessoa. "app a pessoa
 * coloca a ia dela, key dela, nada free, free so o site". A opção "grátis com
 * limite" do PWA sai do bolso dele e por isso **não** atravessa pro app.
 *
 * A chave vai direto do aparelho pra Groq. Não existe servidor nosso no meio —
 * não existe servidor nosso, ponto. É o que a tela de Privacidade afirma, e é
 * por isso que ligar a IA acrescenta uma linha lá: um host a mais passa a
 * receber pedido do app.
 *
 * ⚠️ A chave fica no `kv-store` do app, que é o mesmo lugar da coleção. Não é
 * o Chaveiro do iOS: numa build de sideload sem entitlement de keychain o
 * Chaveiro daria trabalho a mais pra proteger uma chave que a própria pessoa
 * pode revogar em um clique no painel da Groq. Se um dia a chave passar a valer
 * dinheiro de verdade, isto muda.
 */
const CHAVE = "tk:ia";

interface Ctx {
  /** A chave da Groq, ou `null` quando a IA está desligada. */
  chave: string | null;
  definir: (k: string | null) => void;
  /** `false` enquanto a leitura assíncrona não voltou. */
  pronto: boolean;
}

const Contexto = createContext<Ctx | null>(null);

export function IA({ children }: { children: ReactNode }) {
  const [chave, setChave] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE)
      .then((v) => setChave(v && v.trim() !== "" ? v : null))
      .catch(() => {})
      .finally(() => setPronto(true));
  }, []);

  const valor = useMemo<Ctx>(
    () => ({
      chave,
      pronto,
      definir: (k) => {
        const limpa = k?.trim() ?? "";
        setChave(limpa === "" ? null : limpa);
        if (limpa === "") AsyncStorage.removeItem(CHAVE).catch(() => {});
        else AsyncStorage.setItem(CHAVE, limpa).catch(() => {});
      },
    }),
    [chave, pronto],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useIA(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error("useIA fora do <IA>");
  return c;
}
