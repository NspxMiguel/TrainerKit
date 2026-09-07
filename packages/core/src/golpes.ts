/**
 * O NOME DO GOLPE — em inglês, e no idioma da pessoa.
 *
 * ⚠️ Os dois, e o inglês PRIMEIRO. Não é preferência: é o idioma em que os
 * nomes de golpe circulam na comunidade, em guia e em vídeo. Procurar "Ataque
 * de Chamas" no YouTube não acha nada, e procurar "Flame Charge" dentro do jogo
 * em português também não. Mostrar os dois deixa a pessoa transitar entre o
 * jogo e a comunidade.
 *
 *     Flame Charge · Ataque de Chamas
 *
 * ⚠️ Isto vivia em `apps/web/src/i18n/language.ts` e o app nativo não tinha —
 * ele mostrava só o inglês, sem dizer que era inglês. Está aqui porque a regra
 * é a mesma nos dois e uma segunda cópia divergiria na primeira correção.
 */

/** `moveNames["pt-BR"]["counter_fast"]` → "Contra-Ataque". */
export type NomesDeGolpe = Record<string, Record<string, string>>;

export interface RotuloDeGolpe {
  /** O que aparece maior. Sempre o inglês. */
  principal: string;
  /** A tradução oficial, ou `null` quando não há o que somar. */
  secundario: string | null;
}

export function rotuloDoGolpe(
  nomeEmIngles: string,
  nomes: NomesDeGolpe | undefined,
  golpeId: string,
  idioma: string,
  mostrarTraducao: boolean,
): RotuloDeGolpe {
  /* Em inglês não há segunda linha, e com a tradução desligada também não —
     quem desligou não quer duas linhas em lista nenhuma. */
  if (idioma === "en" || !mostrarTraducao) {
    return { principal: nomeEmIngles, secundario: null };
  }

  const traduzido = nomes?.[idioma]?.[golpeId];
  /* Igual ao inglês não é tradução: vários golpes têm o mesmo nome nos dois
     idiomas, e repetir a palavra embaixo dela mesma é ruído. */
  if (!traduzido || traduzido === nomeEmIngles) {
    return { principal: nomeEmIngles, secundario: null };
  }
  return { principal: nomeEmIngles, secundario: traduzido };
}
