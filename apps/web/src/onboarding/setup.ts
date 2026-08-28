import { useSyncExternalStore } from "react";

/**
 * Como a pessoa quer usar o app.
 *
 * A escolha existe porque as duas formas sao legitimas e exigem telas
 * diferentes. Quem so quer saber se uma especie presta nao deveria ser obrigado
 * a cadastrar colecao — e quem quer o veredito precisa cadastrar. Empurrar todo
 * mundo pro mesmo fluxo faria o app parecer burocratico pra metade das pessoas.
 */
export type UsageMode = "consulta" | "colecao";

/** As quatro faixas que o setup oferece. */
export type TrainerLevel = 20 | 30 | 40 | 50;

export const TRAINER_LEVELS: readonly TrainerLevel[] = [20, 30, 40, 50];

export interface Setup {
  /** `false` ate a pessoa concluir a primeira configuracao. */
  done: boolean;
  mode: UsageMode;
  /** Liga o assistente que opina sobre os especie. */
  assistant: boolean;
  /**
   * Como a pessoa quer ser chamada. Vazio e valido — quem nao quiser dizer o
   * nome ve so a saudacao, e nada no app depende disto.
   */
  name: string;
  /**
   * Nivel do TREINADOR, e nao da especie.
   *
   * Ele existe porque o teto de power-up do jogo e `nivel do treinador + 2`.
   * Ver `tetoDePowerUp`, que e onde isso vira consequencia.
   */
  level: TrainerLevel;
}

/**
 * Ate que nivel ESTE jogador consegue subir uma especie.
 *
 * ⚠️ ISTO NAO E UMA REGRA NOVA — e um dado de entrada que estava fixo no melhor
 * caso.
 *
 * `VerdictInput.levelCap` sempre existiu e sempre alimentou o calculo de PC
 * (`verdict.ts`). O que todos os chamadores passavam era `version.levelCap`, o
 * `maxNormalUpgradeLevel` do jogo — o teto de QUEM JA ESTA NO FIM. Para um
 * treinador de nivel 20 o app respondia "até 1.260 de PC no nível 50" sobre um
 * especie que aquela pessoa so consegue levar ao nivel 22.
 *
 * As regras do veredito nao mudaram uma linha, e `packages/core` nao foi
 * tocado. Mudou o numero que entra nelas: de "o teto do jogo" para "o teto
 * desta pessoa". Onde a pergunta e sobre a ESPECIE e nao sobre o jogador — o
 * "PC máximo com IV perfeito" da ficha, a ordenacao da Especies — continua sendo
 * o teto do jogo, porque ali o numero e um fato da especie e nao uma promessa.
 *
 * O `+2` e do jogo: sobe-se uma especie ate dois niveis acima do proprio, e o
 * `min` impede que um treinador de 50 passe do teto da temporada.
 */
export function tetoDePowerUp(nivelDoTreinador: number, tetoDoJogo: number): number {
  return Math.min(nivelDoTreinador + 2, tetoDoJogo);
}

const KEY = "tk:setup";

export const DEFAULT_SETUP: Setup = {
  done: false,
  mode: "consulta",
  assistant: true,
  name: "",
  /*
   * ⚠️ 50, e nao 20, e a diferenca importa pra quem JA usa o app.
   *
   * Quem instalou antes desta versao nao tem `level` gravado, e o `??` abaixo
   * decide o que o app passa a achar dessas pessoas. Cair em 20 mudaria o
   * veredito de toda a colecao ja cadastrada, de uma atualizacao pra outra, sem
   * ninguem ter pedido — especie que diziam "Investir" passariam a dizer
   * "Guardar" porque o app resolveu sozinho que o dono e iniciante.
   *
   * 50 e exatamente o que o app assumia antes de este campo existir. Quem
   * atualiza nao ve veredito nenhum mudar; quem passa pelo setup escolhe.
   */
  level: 50,
};

function read(): Setup {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETUP;
    const parsed = JSON.parse(raw) as Partial<Setup>;
    return {
      done: parsed.done ?? false,
      mode: parsed.mode === "colecao" ? "colecao" : "consulta",
      assistant: parsed.assistant ?? true,
      name: typeof parsed.name === "string" ? parsed.name : "",
      level: TRAINER_LEVELS.includes(parsed.level as TrainerLevel)
        ? (parsed.level as TrainerLevel)
        : DEFAULT_SETUP.level,
    };
  } catch {
    return DEFAULT_SETUP;
  }
}

let current = read();
const listeners = new Set<() => void>();

export function getSetup(): Setup {
  return current;
}

export function updateSetup(next: Partial<Setup>): void {
  current = { ...current, ...next };
  /*
   * ⚠️ `setItem` LANCA no Safari privado e com a cota cheia, e este e o
   * onboarding: a excecao subia na primeira tela do app, ao escolher idioma ou
   * modo, e derrubava tudo antes de qualquer coisa aparecer.
   *
   * O `read()` logo acima ja tratava — so a gravacao estava descoberta. A
   * preferencia nao persistida vale mais que app quebrado: `current` continua
   * certo em memoria e a sessao inteira funciona, so nao sobrevive ao
   * fechamento.
   */
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ver acima */
  }
  for (const fn of listeners) fn();
}

export function useSetup(): Setup {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSetup,
    () => DEFAULT_SETUP,
  );
}
