import { nivelValido, type TrainerLevel } from "@trainerkit/core";
import AsyncStorage from "expo-sqlite/kv-store";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * A PRIMEIRA ABERTURA — o que ficou gravado dela.
 *
 * O irmão web guarda cinco campos (`apps/web/src/onboarding/setup.ts`): idioma,
 * nome, nível, modo de uso e assistente. Aqui só entram os que o app nativo
 * REALMENTE consome hoje:
 *
 * · **nível do treinador** — entra em `tetoDePowerUp` e muda o veredito. É o
 *   único campo do setup com consequência de cálculo, e sem ele o app nativo
 *   responde a todo mundo com o teto de quem já terminou o jogo;
 * · **idioma** — já tem store própria (`i18n.tsx`), então não é gravado aqui.
 *
 * O nome, o modo de uso e o assistente ficaram DE FORA de propósito. Nenhum dos
 * três tem consumidor no app nativo: perguntar os três seria três telas a mais
 * para gravar o que nada lê, e um ajuste que não faz nada é pior que um ajuste
 * ausente — quem responde acredita que mudou alguma coisa. Entram no dia em que
 * a tela que os usa existir.
 */
const KEY = "tk:setup";

export interface Setup {
  /** `false` até a pessoa concluir a primeira configuração. */
  done: boolean;
  level: TrainerLevel;
}

/*
 * 50 e não 20, pelo mesmo motivo do web: é o que o app assumia antes deste
 * campo existir. Quem atualiza não vê veredito nenhum mudar sozinho.
 */
const PADRAO: Setup = { done: false, level: 50 };

interface Ctx {
  /** `false` enquanto a leitura assíncrona não voltou. */
  pronto: boolean;
  setup: Setup;
  definir: (parcial: Partial<Setup>) => void;
}

const Contexto = createContext<Ctx | null>(null);

export function ConfigInicial({ children }: { children: ReactNode }) {
  const [setup, setSetup] = useState<Setup>(PADRAO);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const lido = JSON.parse(raw) as Partial<Setup>;
          setSetup({ done: lido.done === true, level: nivelValido(lido.level, PADRAO.level) });
        }
      })
      .catch(() => {
        /* Chave corrompida ou banco indisponível: segue no padrão e refaz o
           setup. Perder a escolha é ruim; não abrir é pior. */
      })
      .finally(() => setPronto(true));
  }, []);

  const valor = useMemo<Ctx>(
    () => ({
      pronto,
      setup,
      definir: (parcial) => {
        setSetup((atual) => {
          const proximo = { ...atual, ...parcial };
          AsyncStorage.setItem(KEY, JSON.stringify(proximo)).catch(() => {});
          return proximo;
        });
      },
    }),
    [pronto, setup],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSetup(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error("useSetup fora do <ConfigInicial>");
  return c;
}
