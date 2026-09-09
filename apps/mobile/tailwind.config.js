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
      /*
       * Tipografia por PAPEL e não por tela — antes cada tela chutava 15px.
       *
       * ⚠️ NENHUMA ENTRELINHA ABAIXO DE 1,25, e isso é correção de defeito, não
       * gosto. `legenda` estava em `1` — entrelinha igual ao tamanho da fonte —
       * e o iOS CORTAVA o acento das maiúsculas: o til do Ã e o circunflexo do
       * Ê ficam ACIMA da altura de caixa e não cabiam. A tela mostrava
       * "SUA COLEÇAO", "1 PEDE UMA DECISAO", "VOCE SABIA" e
       * "MOSTRAR TRADUÇAO DOS ATAQUES" — a cedilha sobrevivia porque desce, o
       * til não. O dicionário sempre teve os acentos certos; quem os comia era
       * esta linha.
       *
       * Vale para todo idioma com diacrítico em maiúscula, que é quase todos os
       * dez: Ã Õ Ê Á É Í Ó Ú À Ü Ñ Ç. `tipografia.test.ts` falha se alguém
       * baixar qualquer uma destas de novo.
       */
      fontSize: {
        saudacao: ["34px", { lineHeight: "1.25", fontWeight: "800" }],
        "titulo-tela": ["28px", { lineHeight: "1.25", fontWeight: "700" }],
        "titulo-cartao": ["20px", { lineHeight: "1.3", fontWeight: "700" }],
        veredito: ["24px", { lineHeight: "1.25", fontWeight: "800" }],
        corpo: ["15px", { lineHeight: "1.5" }],
        legenda: ["11px", { lineHeight: "1.45", fontWeight: "700" }],
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
