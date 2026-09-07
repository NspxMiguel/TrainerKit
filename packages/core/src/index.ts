export * from "./types.js";
export * from "./cp.js";
export * from "./types-chart.js";
export * from "./iv.js";
export * from "./encounter.js";
export * from "./pvp.js";
export * from "./raid.js";
export * from "./appraisal.js";
export * from "./scan.js";
export * from "./ocr.js";
export * from "./moves.js";
export * from "./assistant.js";
export * from "./verdict.js";
export * from "./message.js";
export * from "./counters.js";
export * from "./rankings.js";
export * from "./usos.js";
export * from "./dex.js";
export * from "./dynamax.js";
export * from "./gym.js";
export * from "./team.js";
export * from "./trade.js";
export * from "./faxina.js";
export * from "./limiares.js";

/*
 * Os dicionarios dos 10 idiomas.
 *
 * ⚠️ MUDARAM DE `apps/web` PRA CA quando o app nativo entrou. Eles sao dado
 * puro — dez objetos de texto, sem DOM, sem React — e duplicar 8.575 linhas
 * entre web e mobile garantiria divergencia: a primeira correcao de texto
 * ficaria num app so, e o outro seguiria com a frase velha.
 *
 * Fica em `core` e nao num pacote proprio porque `core` ja e o que os dois
 * apps importam, e um pacote a mais so pra texto seria cerimonia.
 */
export * from "./dict/index.js";
export { EN } from "./dict/en.js";
export type { Dict, Key } from "./dict/tipos.js";
export * from "./cores.js";
export * from "./golpes.js";
export * from "./support.js";
export * from "./setup.js";
export * from "./languages.js";
export * from "./png.js";
export * from "./sprites.js";
export * from "./itens.js";
export * from "./groq.js";
