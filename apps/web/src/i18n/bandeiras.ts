/**
 * Este navegador desenha bandeira?
 *
 * ⚠️ NAO SE PERGUNTA "e Windows?", SE PERGUNTA "desenha?".
 *
 * Emoji de bandeira nao e um caractere: e um PAR de indicadores regionais
 * (`🇧` + `🇷`) que a fonte junta numa ligadura. O Windows nao traz essas
 * ligaduras, entao la o navegador desenha as duas letras soltas — "BR", "US" —
 * onde deveria haver uma imagem.
 *
 * Farejar o user-agent responderia a pergunta errada duas vezes: um Windows com
 * fonte de emoji instalada desenha, e um sistema qualquer sem a fonte nao
 * desenha. O que decide e o que a maquina tem, e isso se MEDE.
 *
 * ── Como a medicao funciona ─────────────────────────────────────────────────
 *
 * Mede-se a largura de `BR` em indicadores regionais e a dos MESMOS dois com um
 * `\u200B` (espaco de largura zero) no meio — escrito com a sequencia de
 * escape, e nunca como caractere literal: invisivel no codigo e armadilha pro
 * proximo que abrir o arquivo. O espaco nao ocupa nada, mas IMPEDE a
 * ligadura.
 *
 *   · ha ligadura: o primeiro vira UM glifo e o segundo continua sendo DOIS,
 *     entao o primeiro e mais estreito;
 *   · nao ha: os dois sao as mesmas duas letras, e as larguras batem.
 *
 * ── O que acontece quando nao desenha ───────────────────────────────────────
 *
 * A bandeira some e sobra o nome do idioma, que e o que importa. Duas letras
 * latinas no lugar de uma bandeira nao informam nada que "Português" ja nao
 * diga, e ainda parecem defeito.
 */

let medido: boolean | null = null;

export function bandeirasDesenham(): boolean {
  if (medido !== null) return medido;

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // Sem canvas nao da pra medir. Mostrar e o comportamento que o app ja
      // tinha, entao a duvida nao tira nada de ninguem.
      medido = true;
      return medido;
    }

    // A fonte do app, pra medir o que a tela vai desenhar de verdade e nao o
    // padrao do canvas.
    ctx.font = "16px system-ui, sans-serif";
    const junto = ctx.measureText("\u{1F1E7}\u{1F1F7}").width;
    const separado = ctx.measureText("\u{1F1E7}\u200B\u{1F1F7}").width;

    // Uma folga de meio pixel: subpixel e arredondamento fazem duas medidas
    // identicas divergirem na terceira casa, e sem a folga a resposta viraria
    // sorteio em algumas maquinas.
    medido = junto < separado - 0.5;
  } catch {
    medido = true;
  }

  return medido;
}

/** So pro teste: apaga a medicao guardada. */
export function esquecerMedicaoDeBandeira(): void {
  medido = null;
}
