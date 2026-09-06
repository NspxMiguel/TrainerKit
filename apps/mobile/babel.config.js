/*
 * ⚠️ `babel-preset-expo` E DEPENDENCIA DECLARADA, e nao herdada do `expo`.
 *
 * Ela ja era usada aqui pelo nome, sem estar no `package.json`. Isso funciona
 * enquanto o pnpm por acaso deixar o pacote num caminho que a resolucao alcance
 * — e para de funcionar no proximo `pnpm add`, que re-liga a arvore.
 *
 * Foi exatamente o que aconteceu ao instalar o `expo-clipboard` em 06/09/2026:
 * `npx expo export:embed` continuava montando o bundle inteiro pelo terminal
 * (1.611 modulos), e o MESMO passo dentro do Xcode morria com
 * "Cannot find module 'babel-preset-expo'" seguido de
 * "Cannot read properties of undefined (reading 'transformFile')" — porque a
 * fase de script do Xcode resolve a partir de outro lugar.
 *
 * Dependencia fantasma nao da erro no dia em que entra; da no dia em que a
 * arvore muda, e ai o defeito parece do Xcode.
 */
module.exports = (api) => {
  api.cache(true);
  return { presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"] };
};
