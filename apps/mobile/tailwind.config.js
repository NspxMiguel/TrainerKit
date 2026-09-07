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
      /* Raio por PAPEL — pílula em ação/navegação, cartão em conteúdo. */
      borderRadius: {
        pilula: "999px",
        chip: "14px",
        cartao: "26px",
        "cartao-sm": "20px",
        "cartao-lg": "28px",
        tile: "15px",
      },
      /* Tipografia por PAPEL e não por tela — antes cada tela chutava 15px. */
      fontSize: {
        saudacao: ["34px", { lineHeight: "1.1", fontWeight: "800" }],
        "titulo-tela": ["28px", { lineHeight: "1.15", fontWeight: "700" }],
        "titulo-cartao": ["20px", { lineHeight: "1.2", fontWeight: "700" }],
        veredito: ["24px", { lineHeight: "1.1", fontWeight: "800" }],
        corpo: ["15px", { lineHeight: "1.5" }],
        legenda: ["11px", { lineHeight: "1", fontWeight: "700" }],
      },
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
