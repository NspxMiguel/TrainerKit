import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
        name: "TrainerKit",
        short_name: "TrainerKit",
        description:
          "Decide o que fazer com cada Pokemon: investir, evoluir, guardar ou transferir.",
        lang: "pt-BR",
        theme_color: "#07080B",
        background_color: "#07080B",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            // Variante propria: o sistema recorta ate 10% de cada borda, entao
            // este arquivo tem zona segura e o monograma encolhido. Usar o
            // icone normal aqui faria o Android cortar as pontas do "K".
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        // Recebe print compartilhado direto do sistema. Android apenas — o
        // WebKit tem o bug aberto desde 2019 e nao vai implementar. No iOS o
        // caminho e o seletor de arquivo com `multiple`.
        share_target: {
          action: "/compartilhar",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            files: [
              {
                name: "screenshot",
                accept: ["image/png", "image/jpeg", ".png", ".jpg", ".jpeg"],
              },
            ],
          },
        },
      },
    }),
  ],
});
