/**
 * As cores nao moram aqui — moram no `global.css`, uma vez por tema. Este
 * arquivo so lhes da nome.
 *
 * `rgb(var(--x) / <alpha-value>)` e o que deixa `bg-superficie/50` continuar
 * funcionando: o canal alfa entra na hora, sem uma segunda variavel por
 * opacidade.
 */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        fundo: "rgb(var(--tk-fundo) / <alpha-value>)",
        superficie: "rgb(var(--tk-superficie) / <alpha-value>)",
        linha: "rgb(var(--tk-linha) / var(--tk-linha-alfa))",
        texto: "rgb(var(--tk-texto) / <alpha-value>)",
        texto2: "rgb(var(--tk-texto2) / <alpha-value>)",
        texto3: "rgb(var(--tk-texto3) / <alpha-value>)",
        investir: "rgb(var(--tk-investir) / <alpha-value>)",
        guardar: "rgb(var(--tk-guardar) / <alpha-value>)",
        transferir: "rgb(var(--tk-transferir) / <alpha-value>)",
        evoluir: "rgb(var(--tk-evoluir) / <alpha-value>)",
        descobrir: "rgb(var(--tk-descobrir) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
