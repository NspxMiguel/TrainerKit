import { getLocales } from "expo-localization";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { DICTS, EN, type Key } from "@trainerkit/core";

/**
 * O idioma, e o texto que a pessoa le.
 *
 * ⚠️ OS DICIONARIOS SAO OS MESMOS DO WEB — eles mudaram pra `packages/core`
 * quando este app nasceu. Copiar as 8.575 linhas garantiria divergencia: a
 * primeira correcao de texto ficaria num app so.
 *
 * O idioma do SISTEMA decide o padrao, e a pessoa pode trocar dentro do app —
 * regra do projeto. Mac ou iPhone em ingles nao significa que ele quer o app em
 * ingles.
 */
const CHAVE = "tk:idioma";

function doSistema(): string {
  const tags = getLocales().map((l) => l.languageTag);
  for (const tag of tags) {
    if (DICTS[tag]) return tag;
    const base = tag.split("-")[0];
    // `pt-PT` cai em `pt-BR`, `es-AR` cai em `es-419`: o dicionario mais
    // proximo vale mais que o ingles.
    const parecido = Object.keys(DICTS).find((k) => k.split("-")[0] === base);
    if (parecido) return parecido;
  }
  return "en";
}

interface Ctx {
  idioma: string;
  trocar: (i: string) => void;
  t: (k: Key, vars?: Record<string, string | number>) => string;
}

const Contexto = createContext<Ctx | null>(null);

export function Idioma({ children }: { children: ReactNode }) {
  const [idioma, setIdioma] = useState(doSistema);

  const valor = useMemo<Ctx>(() => {
    const dict = DICTS[idioma] ?? EN;
    return {
      idioma,
      trocar: setIdioma,
      t: (k, vars) => {
        /* Cai no ingles por chave, e nao no dicionario inteiro: um idioma com
           uma chave faltando mostra so aquela linha em ingles. */
        let texto: string = dict[k] ?? EN[k] ?? String(k);
        if (vars) {
          for (const [nome, v] of Object.entries(vars)) {
            texto = texto.replaceAll(`{${nome}}`, String(v));
          }
        }
        return texto;
      },
    };
  }, [idioma]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useT(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error("useT fora do <Idioma>");
  return c;
}

export { CHAVE as CHAVE_IDIOMA };
