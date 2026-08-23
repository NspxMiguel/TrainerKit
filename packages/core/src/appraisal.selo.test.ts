import { describe, expect, it } from "vitest";

import { BADGE_TIERS, badgeFor } from "./appraisal.js";

/**
 * Os limiares de estrela, conferidos contra especie REAIS de uma conta de jogo.
 *
 * ⚠️ POR QUE ISTO PRECISAVA EXISTIR ─────────────────────────────────────────
 *
 * O plano registra, desde o comeco, que os limiares do appraisal **nao estao no
 * GAME_MASTER** — e isso continua verdade hoje. O que existe la e so o rotulo
 * de busca (`RECOMMENDED_SEARCH_APPRAISAL_IV_HIGH` com a string "3*,4*"), que
 * prova que os tiers existem e nao diz onde eles cortam.
 *
 * Ou seja: os numeros 23 / 30 / 37 / 45 que este app usa vieram da comunidade,
 * nao da fonte. Eram chute — bem-informado, mas chute. E chute em cima de
 * limiar e o tipo de coisa que faz o app decidir errado exatamente no caso
 * apertado, que e o unico caso em que o jogador precisa do app.
 *
 * ── O metodo ────────────────────────────────────────────────────────────────
 *
 * Cada print da tela de avaliacao mostra DUAS coisas independentes: as barras
 * (que dao o IV exato, e sao o que o app le) e a roseta com as estrelas (que e
 * o jogo aplicando os limiares). Comparar as duas dentro do MESMO print e uma
 * medicao, nao uma opiniao.
 *
 * Foram 13 prints. Doze batem exatamente com os limiares abaixo, e entre eles
 * estao os quatro casos que mais valem — os das BORDAS:
 *
 *   total 23 → 1 estrela   (a primeira estrela nasce exatamente em 23)
 *   total 29 → 1 estrela   (29 ainda e uma; 30 ja e duas)
 *   total 36 → 2 estrelas  (36 ainda sao duas; 37 ja sao tres)
 *   total 38 → 3 estrelas
 *
 * ── A decima terceira, e por que ela NAO derruba os limiares ────────────────
 *
 * IMG_2543 (o Sneasel, apelidado "Sneasel93%" pelo proprio dono) tem barras
 * 15/12/15 = 42, o apelido confirma 93%, e a roseta mostra DUAS estrelas.
 *
 * Nao existe conjunto de limiares monotono que devolva 3 pro total 42 do
 * IMG_2547 e 2 pro total 42 do IMG_2543. Um dos dois esta errado — e o errado
 * e a roseta, porque:
 *
 *   · as barras concordam com o apelido, que o dono escreveu na mao;
 *   · o outro print de total 42 mostra tres estrelas;
 *   · o erro so acontece numa direcao — MENOS estrelas do que o total merece,
 *     nunca mais.
 *
 * Essa assimetria e a assinatura de ANIMACAO INACABADA, que e o risco que o
 * plano ja tinha previsto pras barras ("print tirado no meio da animacao da IV
 * menor que o real, sem nenhum sinal de erro"). As estrelas acendem uma a uma;
 * um print no meio disso pega duas de tres.
 *
 * A consequencia pro app e boa: ele le as BARRAS, nao a roseta. E o motivo de
 * `scanAppraisalBars` existir e de nunca ter sido tentado ler a estrela.
 */

/**
 * (total de IV, estrelas acesas) medidos nos prints dele.
 *
 * O total vem do leitor de barras (`pnpm --filter @trainerkit/web ler-prints`);
 * as estrelas foram contadas na roseta do mesmo print.
 *
 * ⚠️ ESTA TABELA É O GABARITO, NÃO A PROVA. Ela guarda o que o scanner
 * devolveu no dia da medição e não roda o scanner — se ele regredir amanhã,
 * este arquivo continua verde sobre números que já não correspondem a nada.
 *
 * Quem fecha o circuito é `apps/web/src/scan/barras.png.test.ts`: mesmos
 * prints, mesmos totais, mas rodando `scanAppraisalBars` de verdade. Os dois
 * andam juntos — mexeu num, confira o outro.
 */
const MEDIDOS: ReadonlyArray<{ print: string; total: number; estrelas: number }> = [
  { print: "IMG_2544", total: 23, estrelas: 1 },
  { print: "IMG_2535", total: 29, estrelas: 1 },
  { print: "IMG_2541", total: 32, estrelas: 2 },
  { print: "IMG_2545", total: 32, estrelas: 2 },
  { print: "IMG_2540", total: 33, estrelas: 2 },
  { print: "IMG_2542", total: 33, estrelas: 2 },
  { print: "IMG_2539", total: 34, estrelas: 2 },
  { print: "IMG_2546", total: 36, estrelas: 2 },
  { print: "IMG_2536", total: 38, estrelas: 3 },
  { print: "IMG_2538", total: 38, estrelas: 3 },
  { print: "IMG_2537", total: 39, estrelas: 3 },
  { print: "IMG_2547", total: 42, estrelas: 3 },
];

describe("limiares do appraisal, medidos nos prints reais", () => {
  it("todo print medido bate com o tier que o app calcula", () => {
    for (const m of MEDIDOS) {
      expect(badgeFor(m.total).litStars, `${m.print} (total ${m.total})`).toBe(m.estrelas);
    }
  });

  /*
   * As bordas separadas, porque sao elas que carregam a prova. Um teste que so
   * checasse totais no meio da faixa passaria com limiares errados por ate seis
   * pontos — que e a largura de um tier inteiro.
   */
  it("as bordas medidas caem exatamente onde o app corta", () => {
    expect(badgeFor(22).litStars).toBe(0);
    expect(badgeFor(23).litStars).toBe(1); // medido: IMG_2544
    expect(badgeFor(29).litStars).toBe(1); // medido: IMG_2535
    expect(badgeFor(30).litStars).toBe(2);
    expect(badgeFor(36).litStars).toBe(2); // medido: IMG_2546
    expect(badgeFor(37).litStars).toBe(3);
  });

  it("45 e um tier PROPRIO, e nao so o topo do de tres estrelas", () => {
    // Tres estrelas nos dois; o que muda e o fundo rosa. Juntar os dois
    // esconderia do jogador justamente o caso que ele mais quer ver.
    expect(badgeFor(44)).toBe(BADGE_TIERS[3]);
    expect(badgeFor(45)).toBe(BADGE_TIERS[4]);
    expect(badgeFor(44).pink).toBe(false);
    expect(badgeFor(45).pink).toBe(true);
    expect(badgeFor(45).litStars).toBe(3);
  });

  /*
   * O contrato que impede um "conserto" futuro de reabrir um buraco: os tiers
   * tem que cobrir 0..45 inteiro, sem vao e sem sobreposicao, e nunca podem
   * andar pra tras. Se alguem mexer num limiar sem mexer no vizinho, quebra
   * aqui em vez de quebrar na tela de alguem.
   */
  it("os tiers cobrem 0..45 sem buraco e sem voltar atras", () => {
    let anterior = -1;
    for (let total = 0; total <= 45; total++) {
      const tier = badgeFor(total).tier;
      expect(tier, `total ${total}`).toBeGreaterThanOrEqual(anterior);
      expect(tier, `total ${total}`).toBeLessThanOrEqual(4);
      anterior = tier;
    }
    expect(badgeFor(0).tier).toBe(0);
    expect(badgeFor(45).tier).toBe(4);
  });
});
