import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

/**
 * A VERSAO SE ESCREVE SOZINHA, a cada commit.
 *
 * "faz o negocio da atualizacao. q ta a anos na 0.1.0. coloca q a cada release,
 * ou a cada push uma nova versao."
 *
 * Ele contou certo: foram ~170 commits com `0.1.0` na tela. E a razao nao era
 * preguiça, era o desenho — subir a versao dependia de alguem LEMBRAR de subir,
 * e num projeto de uma pessoa so ninguem lembra. Trocar as cinco copias por uma
 * (o `package.json`) resolveu a divergencia; nao resolveu o esquecimento.
 *
 * Agora o numero tem duas partes e nenhuma e digitada a mao:
 *
 *   · MAIOR.MENOR vem do `package.json`, e e a unica coisa que eu mexo quando
 *     alguma coisa grande muda. Hoje 0.5;
 *   · a CORRECAO e a contagem de commits do repositorio. Cada commit e um
 *     numero novo, entao todo push publica uma versao que nunca existiu antes.
 *
 * `git rev-list --count HEAD` e a fonte: ela nao depende de tag, de CI nem de
 * nada que possa estar desligado — e o Actions desta conta esta, justamente.
 *
 * Sem git (um .zip do codigo, um CI raso), cai no `.0` do package.json em vez de
 * quebrar o build. Versao errada e ruim; build que nao sai e pior.
 */
function lerVersao(): string {
  const base = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8"),
  ).version as string;
  const [maior, menor] = base.split(".");
  const raiz = fileURLToPath(new URL("../..", import.meta.url));
  const git = (args: string[]): string =>
    execFileSync("git", args, { cwd: raiz, encoding: "utf8" }).trim();

  try {
    /*
     * ⚠️ CLONE RASO CONTA 1 COMMIT, e o build sairia 0.5.1 PARA SEMPRE.
     *
     * O `actions/checkout` clona com `fetch-depth: 1` por padrão. Nesse clone o
     * `git rev-list --count HEAD` devolve 1 — não falha, não avisa, devolve um
     * número plausível. A versão automática — uma por push — nasceria congelada
     * no primeiro deploy, e o sintoma seria justamente o que ela veio consertar:
     * o número parado enquanto o app muda.
     *
     * O workflow ganhou `fetch-depth: 0`. Isto aqui é o cinto: se alguém
     * construir de um clone raso de novo, o build GRITA em vez de mentir baixo.
     */
    if (git(["rev-parse", "--is-shallow-repository"]) === "true") {
      console.warn(
        "\n  AVISO: clone RASO — a contagem de commits não vale, e a versão sairia errada.\n" +
          "  Em CI use `fetch-depth: 0` no actions/checkout; aqui, `git fetch --unshallow`.\n" +
          `  Caindo na versão base do package.json: ${base}\n`,
      );
      return base;
    }
    return `${maior}.${menor}.${git(["rev-list", "--count", "HEAD"])}`;
  } catch {
    // Sem git (tarball baixado, container sem o binário): a versão base já é
    // verdadeira, só não é específica.
    return base;
  }
}

const versao = lerVersao();

export default defineConfig({
  base,
  /**
   * Carimbo de quando este build saiu, e a VERSAO.
   *
   * O carimbo existe pra responder "o app atualizou ou nao?" olhando a tela.
   *
   * ⚠️ A versao passou a sair daqui pelo mesmo motivo, e por causa de um defeito
   * que ele apontou: "versao a gente ja fez umas 30 kkkk, e até agr ta na mesma
   * 0.1.0". Ela estava escrita a mao em TRES lugares (`SettingsScreen` duas
   * vezes e `FeedbackScreen`) alem dos dois `package.json` — cinco copias, e
   * subir a versao exigia lembrar das cinco. Ninguem lembra das cinco.
   *
   * Agora ha uma fonte: o `package.json` da raiz. A tela e o relato de bug leem
   * `__TK_VERSAO__`, e subir a versao volta a ser mexer num numero so.
   */
  define: {
    __TK_BUILD__: JSON.stringify(
      new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    ),
    __TK_VERSAO__: JSON.stringify(versao),
  },
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
          /*
           * O web-llm num pedaco proprio, com nome fixo.
           *
           * Sao 6 MB de JavaScript, e o service worker pre-cacheia tudo que
           * encontra em `dist` — sem isto, TODO usuario baixaria 6 MB pra ter
           * uma opcao que a maioria nunca liga. Nome fixo (nao `webllm-[hash]`)
           * porque `globIgnores` la embaixo precisa poder acertar nele.
           */
          webllm: ["@mlc-ai/web-llm"],
          /*
           * Mesmo motivo do web-llm: o motor de voz neural e pesado e so e
           * buscado por quem aperta "Baixar a voz".
           *
           * SO `kokoro-js` aqui. O `@huggingface/transformers` e dependencia
           * dele, nao do app, e com o node_modules estrito do pnpm o Rollup nao
           * consegue resolver esse nome a partir daqui — dava "Could not resolve
           * entry module". Listando so a raiz, o grafo dela vem junto sozinho.
           */
          kokoro: ["kokoro-js"],
          /*
           * O leitor de texto, pelo mesmo motivo dos dois acima.
           *
           * O `tesseract.js` em si sao ~63 kB, mas ele arrasta 5,9 MB de wasm e
           * modelo de `public/ocr/` na primeira vez que alguem anexa um print.
           * Em pedaco proprio e com import dinamico, quem so consulta a Pokedex
           * nunca chega perto disso.
           */
          tesseract: ["tesseract.js"],
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
      /*
       * "prompt", nao "autoUpdate".
       *
       * O nome engana: em nenhum dos dois o service worker gerado chama
       * `self.skipWaiting()` sozinho — ele so escuta uma mensagem
       * `SKIP_WAITING`. Quem decide e o cliente. Com "prompt" isso fica
       * explicito, e quem manda a mensagem e o botao de atualizar.
       */
      registerType: "prompt",
      /*
       * O registro e nosso — ver `src/storage/updates.ts`.
       *
       * O script que o plugin injeta chama `register()` sem
       * `updateViaCache: "none"` e sem recarregar quando a versao nova assume.
       * Com o `max-age=600` do GitHub Pages isso deixava o app instalado
       * rodando codigo velho por tempo indeterminado — verificado no site
       * publicado, com a pagina num bundle e o servidor em outro.
       */
      injectRegister: false,
      // O dataset tem ~1 MB e precisa estar no precache: sem ele o app abre
      // offline mas nao consegue calcular nada.
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,json}"],
        /*
         * O motor de IA local NAO entra no pre-cache.
         *
         * Ele so e buscado quando alguem escolhe "no aparelho" nos Ajustes, e
         * a partir dai o navegador o guarda normalmente. Pre-cachear seria
         * cobrar 6 MB de quem deixou a IA desligada — que e o padrao.
         */
        /*
         * ⚠️ `ocr/**` fora do pre-cache, e nao so o JS.
         *
         * Sao 5,9 MB de wasm e modelo. Pre-cachear cobraria isso de TODO mundo
         * na instalacao — inclusive de quem nunca vai anexar um print — e o
         * `maximumFileSizeToCacheInBytes` abaixo nem deixaria o wasm de 2,7 MB
         * passar sem ser levantado. A regra de runtime logo abaixo guarda os
         * arquivos na primeira leitura, e dai em diante funciona offline.
         */
        globIgnores: ["**/webllm*.js", "**/kokoro*.js", "**/tesseract*.js", "ocr/**"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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
            /*
             * O leitor de texto: baixa uma vez, vale pra sempre.
             *
             * `CacheFirst` porque estes arquivos sao imutaveis — trocam junto
             * com a versao do pacote, e ai o caminho muda. Sem esta regra o
             * segundo print offline falharia mesmo depois de o primeiro ter
             * baixado os 5,9 MB.
             */
            urlPattern: ({ url }) => url.pathname.includes("/ocr/"),
            handler: "CacheFirst",
            options: {
              cacheName: "tk-ocr",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
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
        /*
         * `#0A0C10`, do handoff — e nao `#07080B`, que estava aqui sem
         * justificativa nenhuma.
         *
         * Os dois existem no app: `--tk-bg` e `#0a0c10`, e `#07080b` e a parada
         * MAIS EXTERNA do `--tk-screen`, o gradiente radial. O manifest pinta a
         * tela de abertura, e o que aparece nela e o fundo do app — nao a beirada
         * do gradiente. Escolher a beirada deixava a abertura um tom mais escura
         * que a tela que vem depois dela.
         */
        theme_color: "#0A0C10",
        background_color: "#0A0C10",
        display: "standalone",
        /*
         * Sem trava de orientacao.
         *
         * Era `orientation: "portrait"`, e isso vale pro app INSTALADO — num
         * iPad significa um app que se recusa a girar. O layout e uma coluna
         * unica centralizada, que funciona igual deitado ou em pe, entao a
         * trava nao protegia nada: so impedia.
         */
        icons: [
          { src: `${base}icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${base}icon-512.png`, sizes: "512x512", type: "image/png" },
          {
            /*
             * Variante propria, e as duas diferencas dela sao obrigatorias.
             *
             * QUADRADO CHEIO, sem raio e sem margem: quem arredonda e o
             * sistema, e a forma varia por fabricante. Um arquivo com a
             * propria forma vira forma DENTRO de forma, com um vao entre as
             * duas. Ele ja foi desenhado como circulo aqui, o que so passava
             * despercebido em aparelho de mascara redonda.
             *
             * MARCA ENCOLHIDA pra 78%: o Android recorta ate 10% de cada
             * borda e a zona segura da especificacao e o circulo central de
             * 80%. Os `purpose: "any"` acima nao levam nada disso — ninguem
             * os mascara, e por isso eles mantem o raio do handoff.
             */
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
