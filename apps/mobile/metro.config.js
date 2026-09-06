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
