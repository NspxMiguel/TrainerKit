import AsyncStorage from "expo-sqlite/kv-store";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * DE ONDE VEM A BASE DO JOGO.
 *
 * O app embarca uma, gerada no build a partir do GAME_MASTER público. Essa
 * escolha não precisa ser minha para sempre: quem quiser aponta para outra —
 * uma base própria, um fork mais atualizado, um recorte só com o que interessa.
 *
 * ⚠️ Isto não é conforto, é desacoplamento. O jogo muda a cada poucos dias; se
 * a base só se atualiza quando EU publico, quem precisa do dado de hoje fica
 * preso ao meu calendário. É a mesma postura das imagens: o app aponta, não
 * hospeda.
 *
 * O endereço é guardado, e não o arquivo: a base tem megabytes, e copiar isso
 * para o `kv-store` a cada troca desperdiça o cartão do aparelho. O que a
 * `useDados` faz com ele — buscar, validar, e cair na embarcada quando falha —
 * é o assunto de lá.
 */
const CHAVE = "tk:fonte-dados";

interface Ctx {
  /** `null` = a que vem no app. */
  url: string | null;
  definir: (url: string | null) => void;
  /** Enquanto o disco não respondeu, `useDados` não deve buscar nada ainda. */
  pronto: boolean;
}

const Contexto = createContext<Ctx | null>(null);

export function FonteDeDados({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE)
      .then((v) => setUrl(v && v !== "" ? v : null))
      .catch(() => {})
      .finally(() => setPronto(true));
  }, []);

  const valor = useMemo<Ctx>(
    () => ({
      url,
      pronto,
      definir: (u) => {
        setUrl(u);
        if (u === null) AsyncStorage.removeItem(CHAVE).catch(() => {});
        else AsyncStorage.setItem(CHAVE, u).catch(() => {});
      },
    }),
    [url, pronto],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useFonteDeDados(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error("useFonteDeDados fora do <FonteDeDados>");
  return c;
}
