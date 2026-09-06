/**
 * As cores vem da mesma decisao do app web: preto de verdade, superficie
 * quase-preta neutra, e a COR DA ESPECIE como unico matiz. Ver a nota de
 * `--tk-screen-neutro` no `design.css` — o azul que sobrava ali era o gradiente
 * de fundo, e ele saiu.
 */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        fundo: "#000000",
        superficie: "#131313",
        linha: "rgba(255,255,255,0.08)",
        texto: "#f4f6fa",
        texto2: "#a8adba",
        texto3: "#767c8c",
        investir: "#3ddc97",
        guardar: "#ffc55c",
        transferir: "#9aa6b8",
      },
    },
  },
  plugins: [],
};
