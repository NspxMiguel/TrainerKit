import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Caminho base da publicacao.
 *
 * No GitHub Pages de projeto o site vive em `/<repo>/`, nao na raiz. O valor
 * vem do ambiente pra que o mesmo build sirva pra Pages, pra dominio proprio
 * (base `/`) e pro dev local sem editar arquivo. Um base errado nao quebra o
 * HTML — quebra os assets e o dataset, com a tela abrindo em branco.
 */
const base = process.env.TK_BASE ?? "/";

export default defineConfig({
  base,
  resolve: {
    alias: {
      "@trainerkit/core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 5273,
    host: true, // expoe na rede local — necessario pra testar no celular de verdade
  },
  build: {
    /**
     * Separa o que muda do que nao muda.
     *
     * Num arquivo so, trocar uma palavra do dicionario invalidava os 570 KB
     * inteiros no cache de quem ja tinha o app. React e os dicionarios sao
     * justamente as duas partes que quase nunca mudam junto com o resto —
     * fatiadas, uma correcao de texto nao obriga ninguem a rebaixar o runtime
     * de novo.
     */
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          i18n: [
            "./src/i18n/dict/en.ts",
            "./src/i18n/dict/pt-BR.ts",
            "./src/i18n/dict/es.ts",
            "./src/i18n/dict/es-419.ts",
            "./src/i18n/dict/de.ts",
            "./src/i18n/dict/fr.ts",
            "./src/i18n/dict/it.ts",
            "./src/i18n/dict/ja.ts",
            "./src/i18n/dict/ko.ts",
            "./src/i18n/dict/ru.ts",
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // O dataset tem ~1 MB e precisa estar no precache: sem ele o app abre
      // offline mas nao consegue calcular nada.
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,json}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            // Sprites sao buscados sob demanda e ficam guardados. Baixar as
            // 1024 de uma vez seriam ~150 MB; assim o app so paga pelo que voce
            // realmente olha, e a partir da segunda vez funciona offline.
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\//,
            handler: "CacheFirst",
            options: {
              cacheName: "tk-sprites",
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "tk-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: true },
      manifest: {
        // O escopo e o start_url acompanham o base: instalado a partir de um
        // subcaminho, o app precisa saber que a casa dele e ali.
        scope: base,
        start_url: base,
        name: "TrainerKit",
        short_name: "TrainerKit",
        description:
          "Decide o que fazer com cada Pokemon: investir, evoluir, guardar ou transferir.",
        lang: "pt-BR",
        theme_color: "#07080B",
        background_color: "#07080B",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: `${base}icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${base}icon-512.png`, sizes: "512x512", type: "image/png" },
          {
            // Variante propria: o sistema recorta ate 10% de cada borda, entao
            // este arquivo tem zona segura e o monograma encolhido. Usar o
            // icone normal aqui faria o Android cortar as pontas do "K".
            src: `${base}icon-maskable-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        // NAO declaramos `share_target`.
        //
        // Ele estava aqui e era uma promessa quebrada: o manifest anunciava a
        // capacidade, o Android colocava o TrainerKit na folha de compartilhar,
        // e o POST caia numa rota que nao existe. Anunciar e falhar e pior que
        // nao anunciar.
        //
        // Implementar exige service worker proprio (`injectManifest`) que
        // intercepte o POST com `event.request.formData()`. Vale fazer — mas
        // fazer, nao prometer.
      },
    }),
  ],
});
