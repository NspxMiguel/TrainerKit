import { computeCP, cpmForLevel, type CpmTable } from "./cp.js";
import { ivTotal } from "./iv.js";
import type { BaseStats, IVs } from "./types.js";
import { MAX_IV } from "./types.js";

/**
 * IV a partir do PC, ANTES de capturar.
 *
 * A calculadora de IV do app pede as tres barras da avaliacao, e elas so
 * existem depois que o Pokemon esta na mochila. Na tela de encontro o jogo
 * mostra UM numero — o PC — e e com ele que a decisao de gastar bola tem que
 * ser tomada.
 *
 * ⚠️ O QUE FAZ ISSO FUNCIONAR NAO E O PC: E O NIVEL SER CONHECIDO.
 *
 * O PC sai de (especie, IV, nivel). Com dois deles se resolve o terceiro; com
 * um so nao se resolve nada. Numa raide, num ovo e numa pesquisa o jogo FIXA o
 * nivel do encontro, entao sobra uma incognita e a conta fecha.
 *
 * O piso de IV entra junto e vale muito: numa raide nenhum IV e menor que 10,
 * o que corta o espaco de busca de 4.096 combinacoes pra 216. E por isso que a
 * tabela de "PC de captura" que todo mundo usa funciona.
 *
 * ⚠️ NO SELVAGEM NAO FUNCIONA, e isso foi MEDIDO em vez de suposto. Varrendo o
 * dataset, um PC selvagem deixa em media 167 combinacoes de pe (de 4.096) e
 * NUNCA sobrou uma so em 800 casos. A faixa de IV encolhe — de 0–45 pra algo
 * como 6–38 — e uma faixa dessas nao decide bola nenhuma.
 *
 * A origem continua oferecida por dois motivos: o topo da faixa ainda responde
 * (o maior PC possivel de um selvagem so sai com 15/15/15), e sem a opcao a
 * pessoa tentaria assim mesmo escolhendo "raide" pra um bicho de rua, o que
 * daria uma resposta confiante e errada. Aqui ela recebe o numero verdadeiro:
 * quantas combinacoes sobraram.
 */

/** De onde o Pokemon esta vindo. E o que decide nivel e piso de IV. */
export type OrigemDeEncontro = "selvagem" | "raide" | "ovo" | "pesquisa";

interface RegraDeOrigem {
  /**
   * Niveis possiveis do encontro, sem clima favoravel.
   *
   * Um unico nivel = origem que fixa. Varios = sorteado, e ai o PC sozinho nao
   * resolve.
   */
  readonly niveis: readonly number[];
  /** O mesmo com clima favoravel ao tipo. `null` = o clima nao mexe nesta origem. */
  readonly niveisComClima: readonly number[] | null;
  /** Nenhum IV abaixo disto. */
  readonly piso: number;
  /** Piso com clima favoravel, quando o clima tambem muda o piso. */
  readonly pisoComClima: number;
}

/** Os niveis inteiros de 1 a `ate`. Encontro nao sorteia meio nivel. */
function inteirosAte(ate: number, de = 1): number[] {
  const fora: number[] = [];
  for (let n = de; n <= ate; n++) fora.push(n);
  return fora;
}

/*
 * ⚠️ ESTA TABELA E A UNICA COISA AQUI QUE NAO SAI DE CONTA — sao constantes do
 * jogo, e por isso ficam em UM lugar, nomeadas, e nao espalhadas em `if`.
 *
 * A linha da raide ja existia no app antes desta tela, em `counters.ts`
 * (`bossCatchRange`): nivel 20, nivel 25 com clima, piso 10. As outras seguem a
 * mesma mecanica com outro numero.
 *
 * O que protege o app de uma destas estar errada — hoje ou depois de uma
 * atualizacao do jogo — e que a conta se CONTRADIZ em vez de mentir: se o
 * nivel suposto estiver errado, nenhuma combinacao de IV produz aquele PC e a
 * resposta e uma lista vazia, que a tela mostra como "esse PC nao existe nessa
 * origem". Um numero errado aqui aparece como contradicao visivel, e nao como
 * um IV confiante e falso. Ver `LeituraDeEncontro.impossivel`.
 */
const REGRAS: Record<OrigemDeEncontro, RegraDeOrigem> = {
  /*
   * Selvagem: nivel sorteado, em passos INTEIROS. Meio nivel so existe depois
   * de um power-up, e um bicho de rua nunca foi turbinado.
   */
  selvagem: {
    niveis: inteirosAte(30),
    niveisComClima: inteirosAte(35, 6),
    piso: 0,
    pisoComClima: 4,
  },
  raide: {
    niveis: [20],
    niveisComClima: [25],
    piso: 10,
    pisoComClima: 10,
  },
  /* Ovo choca no mesmo nivel da raide, e o clima nao alcanca um ovo. */
  ovo: {
    niveis: [20],
    niveisComClima: null,
    piso: 10,
    pisoComClima: 10,
  },
  pesquisa: {
    niveis: [15],
    niveisComClima: null,
    piso: 10,
    pisoComClima: 10,
  },
};

export interface EncontroInput {
  base: BaseStats;
  /** O PC que o jogo mostra na tela de encontro. */
  cp: number;
  origem: OrigemDeEncontro;
  /** Clima favorecendo o tipo. Ignorado nas origens que o clima nao alcanca. */
  clima?: boolean;
}

export interface LeituraDeEncontro {
  /** Niveis considerados. Um so quando a origem fixa o nivel. */
  niveis: readonly number[];
  /** O piso de IV que a origem garante. */
  piso: number;
  /**
   * As combinacoes de IV que produzem aquele PC.
   *
   * Sem o nivel junto de propósito: no selvagem o mesmo IV aparece em varios
   * niveis, e repetir a combinacao uma vez por nivel daria uma lista longa que
   * nao diz nada a mais. Quem quiser o nivel usa `solveIVs`, que ja o devolve.
   */
  ivs: readonly IVs[];
  /** Menor e maior soma de IV possiveis, de 0 a 45. */
  totalMin: number;
  totalMax: number;
  /** Preenchido so quando sobra exatamente uma combinacao. */
  exato: IVs | null;
  /** `true` quando nada bate: PC impossivel para essa especie nessa origem. */
  impossivel: boolean;
  /**
   * Quantas combinacoes a origem permitiria SEM olhar o PC.
   *
   * E a base de comparacao, e existe pra tela poder dizer o quanto o PC
   * estreitou sem inventar um limiar de "estreitou o bastante". Medido no
   * dataset:
   *
   *   raide/ovo/pesquisa   216 possiveis -> 1 ou 2 combinacoes
   *   selvagem           4.096 possiveis -> 167 em media, nunca 1
   *
   * E essa diferenca, e nao o PC, que decide se a tela responde ou avisa. O
   * numero fica aqui porque e conta, e a frase fica na tela.
   */
  combinacoesDaOrigem: number;
}

/**
 * Quais IV cabem naquele PC.
 *
 * Forca bruta: no maximo 35 niveis x 4.096 combinacoes, e nas origens de nivel
 * fixo sao 216. Roda em milissegundos e nao aproxima nada.
 */
export function lerEncontro(input: EncontroInput, cpm: CpmTable): LeituraDeEncontro {
  const regra = REGRAS[input.origem];
  const clima = input.clima === true && regra.niveisComClima !== null;
  const niveis = clima ? regra.niveisComClima! : regra.niveis;
  const piso = clima ? regra.pisoComClima : regra.piso;

  // Chave "atk*256 + def*16 + hp": a mesma combinacao aparece em mais de um
  // nivel no selvagem, e a lista e sobre IV, nao sobre par (IV, nivel).
  const vistos = new Set<number>();
  const ivs: IVs[] = [];

  for (const nivel of niveis) {
    const multiplicador = cpmForLevel(cpm, nivel);
    for (let atk = piso; atk <= MAX_IV; atk++) {
      for (let def = piso; def <= MAX_IV; def++) {
        for (let hp = piso; hp <= MAX_IV; hp++) {
          if (computeCP(input.base, { atk, def, hp }, multiplicador) !== input.cp) continue;
          const chave = (atk << 8) | (def << 4) | hp;
          if (vistos.has(chave)) continue;
          vistos.add(chave);
          ivs.push({ atk, def, hp });
        }
      }
    }
  }

  const porStat = MAX_IV - piso + 1;
  const combinacoesDaOrigem = porStat * porStat * porStat;

  if (ivs.length === 0) {
    return {
      niveis,
      piso,
      ivs,
      totalMin: 0,
      totalMax: 0,
      exato: null,
      impossivel: true,
      combinacoesDaOrigem,
    };
  }

  let totalMin = Infinity;
  let totalMax = -Infinity;
  for (const iv of ivs) {
    const total = ivTotal(iv);
    if (total < totalMin) totalMin = total;
    if (total > totalMax) totalMax = total;
  }

  return {
    niveis,
    piso,
    ivs,
    totalMin,
    totalMax,
    exato: ivs.length === 1 ? ivs[0]! : null,
    impossivel: false,
    combinacoesDaOrigem,
  };
}

/**
 * A faixa de PC que a origem pode produzir para aquela especie.
 *
 * Serve pro campo de PC saber o que e digitavel antes de o jogador terminar de
 * digitar, e pra tela poder dizer "esse PC esta fora da faixa" apontando os
 * dois extremos em vez de so recusar. E a generalizacao do `bossCatchRange`,
 * que fazia isto so pra raide.
 */
export function faixaDePC(
  base: BaseStats,
  origem: OrigemDeEncontro,
  cpm: CpmTable,
  clima = false,
): { min: number; max: number } {
  const regra = REGRAS[origem];
  const usaClima = clima && regra.niveisComClima !== null;
  const niveis = usaClima ? regra.niveisComClima! : regra.niveis;
  const piso = usaClima ? regra.pisoComClima : regra.piso;

  // O PC cresce com o nivel e com cada IV, entao os extremos saem dos cantos:
  // menor nivel com o piso, maior nivel com 15/15/15.
  const menor = Math.min(...niveis);
  const maior = Math.max(...niveis);

  return {
    min: computeCP(base, { atk: piso, def: piso, hp: piso }, cpmForLevel(cpm, menor)),
    max: computeCP(
      base,
      { atk: MAX_IV, def: MAX_IV, hp: MAX_IV },
      cpmForLevel(cpm, maior),
    ),
  };
}

/** As origens, na ordem em que a tela oferece. */
export const ORIGENS: readonly OrigemDeEncontro[] = ["selvagem", "raide", "ovo", "pesquisa"];

/** Se o clima muda alguma coisa nesta origem. A tela esconde o controle quando nao. */
export function climaImporta(origem: OrigemDeEncontro): boolean {
  return REGRAS[origem].niveisComClima !== null;
}

/** Os niveis que a origem produz, pra tela poder dizer de onde a conta saiu. */
export function niveisDaOrigem(origem: OrigemDeEncontro, clima = false): readonly number[] {
  const regra = REGRAS[origem];
  return clima && regra.niveisComClima !== null ? regra.niveisComClima : regra.niveis;
}
