import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * 30 s, e não os 5 s do padrão.
     *
     * ⚠️ NÃO é que os testes sejam lentos — é que eles não rodam sozinhos.
     *
     * Medido em 06/09/2026: `audit.test.ts` inteiro leva **555 ms** quando
     * roda sozinho, e o caso do ranking de PvP leva 491 ms. Dentro do
     * `pnpm -r test` o mesmo caso estourou **5.000 ms** — dez vezes o tempo
     * dele — porque os quatro workspaces rodam em paralelo, cada um com o
     * próprio pool de workers, no mesmo Mac.
     *
     * O que o padrão de 5 s mede nesta suíte não é o código, é quanto a
     * máquina estava ocupada naquele minuto. E o `dados.test.ts` já vive na
     * beira: "nenhuma especie real fica sem nome, tipo ou stat" gasta 4.320 ms
     * dos 5.000 mesmo com a máquina livre — 86% do orçamento, ou seja, ele
     * quebra no próximo dia movimentado e o defeito vai parecer do dataset.
     *
     * Um teste que falha por agendamento não reprova código nenhum: ele só
     * ensina a rodar a suíte de novo até passar, que é o hábito que apaga o
     * valor de ter suíte.
     */
    testTimeout: 30_000,
  },
});
