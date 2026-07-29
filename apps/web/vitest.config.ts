import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `language.ts` le localStorage ao ser importado — e proposital, o idioma
    // precisa estar decidido antes do primeiro render. Em teste isso exige um
    // ambiente de DOM.
    environment: "jsdom",
  },
});
