/**
 * WHAT THE FIRST RUN ASKS, shared by both apps.
 *
 * This moved out of `apps/web/src/onboarding/setup.ts` when the native app
 * grew its own first run. What stayed behind there is the web STORE — the
 * `localStorage` read/write and the React subscription — because the native app
 * persists through `expo-sqlite/kv-store` and cannot use any of it.
 *
 * What lives here is the part that must never disagree between the two: the
 * levels offered, and the cap they imply. Two copies of the same arithmetic is
 * how one app promises a ceiling the other does not calculate.
 */

import { ALLOWED_LEVELS_ABOVE_PLAYER } from "./types.js";

/**
 * Como a pessoa quer usar o app.
 *
 * A escolha existe porque as duas formas sao legitimas e exigem telas
 * diferentes. Quem so quer saber se uma especie presta nao deveria ser obrigado
 * a cadastrar colecao — e quem quer o veredito precisa cadastrar.
 */
export type UsageMode = "consulta" | "colecao";

/**
 * As faixas que o setup oferece.
 *
 * ⚠️ Ia so ate 50, e o teto do treinador subiu pra 80 (`MAX_TRAINER_LEVEL`).
 * Quem joga hoje passa dos 50 e nao se encontrava na lista — o app se anunciava
 * desatualizado logo na primeira tela.
 *
 * Acima do 40 a conta de `tetoDePowerUp` satura (40 + 10 ja bate o teto de 50),
 * entao as faixas de 50 pra cima nao mudam numero nenhum. Elas existem porque a
 * pergunta e sobre a PESSOA, e uma lista que para onde a pessoa nao parou e uma
 * lista errada.
 */
export type TrainerLevel = 20 | 30 | 40 | 50 | 60 | 70 | 80;

export const TRAINER_LEVELS: readonly TrainerLevel[] = [20, 30, 40, 50, 60, 70, 80];

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
 * Onde a pergunta e sobre a ESPECIE e nao sobre o jogador — o "PC máximo com IV
 * perfeito" da ficha, a ordenacao da Especies — continua sendo o teto do jogo,
 * porque ali o numero e um fato da especie e nao uma promessa.
 *
 * QUANTOS niveis acima vem do GAME_MASTER e nao de memoria: era `+2` cravado
 * aqui, com um comentario dizendo que o dois era do jogo, e
 * `POKEMON_UPGRADE_SETTINGS.allowedLevelsAbovePlayer` responde 10. O `min`
 * impede que a soma passe do teto da temporada.
 */
export function tetoDePowerUp(nivelDoTreinador: number, tetoDoJogo: number): number {
  return Math.min(nivelDoTreinador + ALLOWED_LEVELS_ABOVE_PLAYER, tetoDoJogo);
}

/** Um nivel valido, ou o padrao — usado ao ler o que estava gravado. */
export function nivelValido(bruto: unknown, padrao: TrainerLevel = 50): TrainerLevel {
  return TRAINER_LEVELS.includes(bruto as TrainerLevel) ? (bruto as TrainerLevel) : padrao;
}
