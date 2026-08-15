import type { Key } from "../i18n/t.ts";

/**
 * O erro da IA vira frase, em vez de vazar o codigo interno.
 *
 * `sem-chave` e uma string escrita pra o CODIGO reconhecer —
 * `throw new Error("sem-chave")` — e ela estava chegando inteira na tela,
 * porque toda tela fazia `setErro(e.message)` sem passar por lugar nenhum.
 *
 * O padrao e o mesmo do `explain.ts`: nome interno de regra nao e texto de
 * usuario. Aqui era pior, porque `sem-chave` nem explica o que fazer.
 *
 * Erro que eu NAO reconheço passa direto e aparece cru, de propósito. Um "429
 * rate limit exceeded" da Groq diz mais que um "algo deu errado" meu — e quando
 * eu engulo o texto do provedor, quem esta depurando fica sem nada.
 */
export function mensagemDeErro(
  e: unknown,
  t: (k: Key, p?: Record<string, string | number>) => string,
): string {
  const bruto = e instanceof Error ? e.message : String(e);

  switch (bruto) {
    case "cota-diaria":
      return t("ai.err.dailyQuota");
    case "cota-hora":
      return t("ai.err.hourQuota");
    case "sem-chave":
      return t("ai.err.noKey");
    case "ia-desligada":
      return t("ai.err.off");

    /*
     * O porteiro (`guarda.ts`).
     *
     * Cada motivo tem frase propria porque sao situacoes diferentes pra quem
     * esta do outro lado: quem pediu codigo Python precisa saber que o app so
     * fala de Pokemon; quem escreveu uma pergunta de 700 caracteres precisa
     * saber que e pra encurtar. Uma mensagem generica faria os dois acharem que
     * o app quebrou.
     */
    case "filtro-fora-do-assunto":
      return t("ai.err.offTopic");
    case "filtro-injecao":
      return t("ai.err.offTopic");
    case "filtro-longa":
      return t("ai.err.tooLong");
    case "filtro-vazia":
      return t("ai.err.empty");

    default:
      return bruto;
  }
}
