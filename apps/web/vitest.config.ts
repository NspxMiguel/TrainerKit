import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `language.ts` le localStorage ao ser importado — e proposital, o idioma
    // precisa estar decidido antes do primeiro render. Em teste isso exige um
    // ambiente de DOM.
    environment: "jsdom",
  },
  define: {
    /*
     * O React so habilita `act()` quando este sinalizador existe.
     *
     * Sem ele os testes de `useFolha` passam, mas o React reclama a cada
     * chamada ("testing environment is not configured to support act") e, pior,
     * nao garante que os efeitos tenham rodado antes da assercao — o teste
     * passaria por sorte de agendamento, nao por estar certo.
     */
    "globalThis.IS_REACT_ACT_ENVIRONMENT": "true",
  },
});
