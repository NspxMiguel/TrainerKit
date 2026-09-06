// Metro precisa enxergar a raiz do monorepo: `@trainerkit/core` mora em
// `packages/core` e e resolvido por workspace, nao por copia em node_modules.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const raiz = path.resolve(__dirname, "../..");
const config = getDefaultConfig(__dirname);
config.watchFolders = [raiz];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(raiz, "node_modules"),
];
config.resolver.sourceExts = [...config.resolver.sourceExts, "mjs", "cjs"];

/*
 * ⚠️ O DATASET E `.tkdata`, E NAO `.json`. A extensao esquisita tem motivo.
 *
 * Pro Metro, `.json` e CODIGO-FONTE: `require("x.json")` devolve o objeto ja
 * analisado, embutido no bundle. Era exatamente o que eu queria evitar — sao
 * 2 MB que o Hermes teria que ler no arranque — e por isso o codigo usa
 * `Asset.fromModule`. So que, recebendo um objeto em vez de um id de modulo,
 * o `Asset` reclamava: `Module "[object Object]" is missing from the asset
 * registry`, e o app abria com a base vazia.
 *
 * Registrar `json` como asset consertaria isto e quebraria todo o resto —
 * `package.json`, `app.json` e os dicionarios deixariam de ser importaveis.
 * Uma extensao SO PRA ESTE ARQUIVO resolve sem tocar em nada mais: o conteudo
 * continua sendo JSON (`JSON.parse` do outro lado), o que muda e quem o Metro
 * acha que deve empacotar.
 */
config.resolver.assetExts = [...config.resolver.assetExts, "tkdata"];

/*
 * ⚠️ `./types.js` -> `./types.ts`, e sem isto o `core` inteiro nao entra.
 *
 * `packages/core` e ESM de verdade: os imports carregam o sufixo `.js` porque
 * e assim que o Node resolve modulo ESM, mesmo quando o arquivo em disco e
 * `.ts`. O TypeScript entende isso; o Metro nao — ele procura um `types.js`
 * que nunca existiu e falha com "Unable to resolve module ./types.js".
 *
 * A troca vale SO dentro de `packages/`: fora dali um `.js` pedido e um `.js`
 * de verdade, e reescrever seria esconder um erro de import real.
 */
const resolverPadrao = config.resolver.resolveRequest;
config.resolver.resolveRequest = (contexto, nome, plataforma) => {
  const daOrigem = contexto.originModulePath ?? "";
  if (nome.startsWith(".") && nome.endsWith(".js") && daOrigem.includes(`${path.sep}packages${path.sep}`)) {
    const comTs = nome.replace(/\.js$/, ".ts");
    try {
      return (resolverPadrao ?? contexto.resolveRequest)(contexto, comTs, plataforma);
    } catch {
      // Nao existe `.ts` correspondente: era mesmo um `.js`. Segue o normal.
    }
  }
  return (resolverPadrao ?? contexto.resolveRequest)(contexto, nome, plataforma);
};

module.exports = withNativeWind(config, { input: "./global.css" });
