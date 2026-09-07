import { Easing } from "react-native-reanimated";

/**
 * O MOVIMENTO, com os números do pacote de forma.
 *
 * ⚠️ Eles não são escolha minha: saem de `docs/forma/tokens.css`, e estão aqui
 * em um lugar só porque duração espalhada por arquivo é como um app fica com
 * três velocidades diferentes para a mesma sensação.
 *
 *   --tk-dur-micro  200ms   toque, troca de aba de um segmented
 *   --tk-dur-base   300ms   entrada de conteúdo, troca de estado
 *   --tk-dur-sheet  440ms   folha subindo, tela empurrando
 *   --tk-dur-exit   180ms   saída — sempre MAIS RÁPIDA que a entrada, senão a
 *                           tela parece grudar no dedo
 *   --tk-stagger     28ms   atraso entre irmãos numa cascata
 */
export const DUR = {
  micro: 200,
  base: 300,
  folha: 440,
  saida: 180,
  cascata: 28,
} as const;

/** `cubic-bezier(.32,.72,0,1)` — a saída da Apple: rápida no começo, longa no fim. */
export const SAIDA = Easing.bezier(0.32, 0.72, 0, 1);

/** `cubic-bezier(.4,0,.2,1)` — para o que entra e sai no mesmo gesto. */
export const ENTRA_E_SAI = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * A mola, quando o movimento responde ao dedo.
 *
 * Amortecimento alto de propósito: o pacote diz "mola discreta, nunca chama
 * atenção". Uma mola que balança duas vezes vira brinquedo — o que se quer é só
 * tirar a dureza da interpolação linear.
 */
export const MOLA = { amortecimento: 0.82, rigidez: 220, massa: 1 } as const;
