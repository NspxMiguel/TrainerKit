import AsyncStorage from "expo-sqlite/kv-store";
import { colorScheme, useColorScheme } from "nativewind";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * As duas peles, e quem escolhe.
 *
 * As cores em si estao no `global.css` — aqui fica so o que o NativeWind nao
 * alcanca: `ActivityIndicator color`, `placeholderTextColor`, a barra do
 * `Stack` e as bordas em `style`. Sao props de JS, nao classe, entao precisam
 * do valor literal.
 *
 * ⚠️ AS DUAS LISTAS TEM QUE FICAR IGUAIS. Uma cor que muda no CSS e nao muda
 * aqui nao quebra o build nem o typecheck — ela aparece torta numa tela so,
 * geralmente a que ninguem reabre. Por isso a lista e curta de proposito: cada
 * item aqui e uma divida com o CSS.
 */
const CHAVE = "tk:tema";

export type Escolha = "sistema" | "claro" | "escuro";

export interface Paleta {
  fundo: string;
  superficie: string;
  linha: string;
  texto: string;
  texto2: string;
  texto3: string;
  investir: string;
  guardar: string;
  transferir: string;
  evoluir: string;
  descobrir: string;
}

const CLARO: Paleta = {
  fundo: "#f4f6fa",
  superficie: "#ffffff",
  linha: "rgba(15,18,25,0.10)",
  texto: "#14171e",
  texto2: "#4a5160",
  texto3: "#676e7b",
  investir: "#12805a",
  guardar: "#8a5a00",
  transferir: "#5c6675",
  evoluir: "#0b62c4",
  descobrir: "#5c6675",
};

const ESCURO: Paleta = {
  fundo: "#000000",
  superficie: "#131313",
  linha: "rgba(255,255,255,0.08)",
  texto: "#f4f6fa",
  texto2: "#a8adba",
  /* #767c8c media 4,45:1 sobre o cartao (#131313) — reprovava por pouco, e por
     pouco e reprovado do mesmo jeito. #7d8494 da 4,95:1 e 5,60:1 sobre o preto. */
  texto3: "#7d8494",
  investir: "#3ddc97",
  guardar: "#ffc55c",
  transferir: "#9aa6b8",
  evoluir: "#4db2ff",
  descobrir: "#a8adba",
};

interface Ctx {
  escolha: Escolha;
  definir: (e: Escolha) => void;
  escuro: boolean;
  cores: Paleta;
}

const Contexto = createContext<Ctx | null>(null);

export function Tema({ children }: { children: ReactNode }) {
  const [escolha, setEscolha] = useState<Escolha>("sistema");
  const { colorScheme: atual } = useColorScheme();

  /* A escolha fica salva — regra do projeto. Ler e assincrono, entao o app
     abre no tema do sistema e corrige em seguida; e um quadro, nao um piscar. */
  useEffect(() => {
    AsyncStorage.getItem(CHAVE)
      .then((v) => {
        if (v === "claro" || v === "escuro" || v === "sistema") {
          setEscolha(v);
          colorScheme.set(v === "claro" ? "light" : v === "escuro" ? "dark" : "system");
        }
      })
      .catch(() => {});
  }, []);

  const valor = useMemo<Ctx>(() => {
    const escuro = atual !== "light";
    return {
      escolha,
      escuro,
      cores: escuro ? ESCURO : CLARO,
      definir: (e) => {
        setEscolha(e);
        colorScheme.set(e === "claro" ? "light" : e === "escuro" ? "dark" : "system");
        AsyncStorage.setItem(CHAVE, e).catch(() => {});
      },
    };
  }, [escolha, atual]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTema(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error("useTema fora do <Tema>");
  return c;
}
