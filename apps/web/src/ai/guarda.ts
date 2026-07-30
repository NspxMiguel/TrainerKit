/**
 * O porteiro, reexportado.
 *
 * ⚠️ O ARQUIVO DE VERDADE É `api/_guarda.ts`, e ele mora lá por uma razão que
 * custou um deploy quebrado pra eu aprender:
 *
 *   The Edge Function "api/ai" is referencing unsupported modules:
 *     ../apps/web/src/ai/guarda.ts
 *
 * O runtime edge da Vercel só empacota o que está dentro de `api/`. Enquanto o
 * porteiro morava aqui, a função não conseguia importá-lo — e o filtro ficava
 * valendo só no navegador, que é exatamente o furo que ele existe pra fechar:
 * um `curl` direto no endpoint passava por cima e recebia código Python.
 *
 * Então a fonte única passou pra `api/`, e este arquivo só reexporta. Duplicar
 * as duas listas seria pior: elas divergiriam no primeiro ajuste, e a versão
 * frouxa seria justamente a do servidor — a que importa.
 *
 * O `_` no nome impede a Vercel de servir `_guarda.ts` como rota.
 */
export { filtrar, filtrarConteudo, type Veredito } from "../../../../api/_guarda.ts";
