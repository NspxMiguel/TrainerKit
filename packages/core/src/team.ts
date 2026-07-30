import type { TypeChart } from "./types-chart.js";

/**
 * Montar um time, e virar lista de caça.
 *
 * A ideia e do Miguel: em vez de "veja o ranking", o app MONTA um time pra um
 * objetivo e voce sai atras do que falta. A diferenca nao e de apresentacao —
 * um ranking e uma lista de trinta nomes que ninguem decora; um time e seis
 * nomes com um proposito, e isso cabe na cabeca.
 *
 * O que este arquivo NAO faz: inventar meta. Nao ha dado nenhum sobre o que as
 * pessoas usam, quais times ganham ou o que esta forte no mes. Existe uma
 * tentacao grande de fingir que ha — bastaria escrever uma lista bonita — e e
 * exatamente o tipo de coisa que faria o resto do app perder o direito de ser
 * levado a serio. Entao o time e montado por criterio declarado, e a tela diz
 * qual e o criterio.
 */

export interface Candidate {
  speciesId: string;
  name: string;
  /** Nota do ranking de origem, 0 a 100. */
  score: number;
  /** Tipos da especie, para a regra de variedade. */
  types: readonly string[];
}

export interface TeamPick extends Candidate {
  /**
   * Por que este entrou.
   *
   * `melhor` — estava no topo puro.
   * `variedade` — entrou por trazer um tipo que o time ainda nao tinha.
   */
  reason: "melhor" | "variedade";
}

/**
 * Escolhe `size` candidatos sem repetir FAMILIA de tipo.
 *
 * Pegar os seis primeiros do ranking parece o obvio e e o errado: os seis
 * melhores atacantes de Lutador costumam ser tres formas do mesmo bicho e dois
 * primos, todos com a mesma fraqueza. Um time assim morre inteiro pro mesmo
 * golpe do chefe.
 *
 * Entao a regra e: pega o melhor, e depois so aceita quem traz um tipo
 * primario que ainda nao esta no time. Quando os tipos acabam — porque um
 * ranking de um tipo so tende a ter poucos — completa com os melhores que
 * sobraram, marcados como `melhor` em vez de `variedade`.
 */
export function pickTeam(candidates: readonly Candidate[], size: number): TeamPick[] {
  const escolhidos: TeamPick[] = [];
  const tiposUsados = new Set<string>();
  const usados = new Set<string>();

  for (const c of candidates) {
    if (escolhidos.length >= size) break;
    const primario = c.types[0];
    if (primario !== undefined && tiposUsados.has(primario)) continue;
    escolhidos.push({ ...c, reason: escolhidos.length === 0 ? "melhor" : "variedade" });
    usados.add(c.speciesId);
    if (primario !== undefined) tiposUsados.add(primario);
  }

  // Faltou gente: completa pela nota, sem a regra de variedade.
  for (const c of candidates) {
    if (escolhidos.length >= size) break;
    if (usados.has(c.speciesId)) continue;
    escolhidos.push({ ...c, reason: "melhor" });
    usados.add(c.speciesId);
  }

  return escolhidos;
}

/**
 * Com que tipo de golpe se bate num chefe deste tipo.
 *
 * Isto conserta um erro que parecia funcionar. A tela pedia o tipo do chefe e
 * ia buscar os melhores atacantes DAQUELE tipo — pra um chefe de Dragao dava
 * certo por acidente, porque Dragao bate forte em Dragao. Pra um chefe de Fogo
 * o app montava um time de atacantes de Fogo, que e o pior time possivel: Fogo
 * resiste a Fogo. O resumo ainda diria a verdade ("0 dos 6 batem forte"), o que
 * so deixaria a tela sincera sobre estar errada.
 *
 * Recebe os tipos do alvo, nao um so, e MULTIPLICA a tabela por todos eles —
 * que e como o jogo calcula. Contra um chefe de Fogo/Voador, Pedra vale 4x, e
 * uma conta feita so no primeiro tipo diria 2x e escolheria o time errado.
 *
 * Devolve os tipos ordenados pela vantagem, o mais forte primeiro. Vazio
 * significa que nada e super efetivo contra o alvo — nao acontece no jogo hoje,
 * mas um dataset customizado pode ter qualquer tabela.
 */
export function attackTypesAgainst(
  targetTypes: readonly string[],
  chart: TypeChart,
  order: readonly string[],
): string[] {
  const indices = targetTypes.map((t) => order.indexOf(t)).filter((i) => i >= 0);
  if (indices.length === 0) return [];

  return Object.entries(chart)
    .map(([tipo, linha]) => ({
      tipo,
      mult: indices.reduce((acc, i) => acc * (linha[i] ?? 1), 1),
    }))
    .filter((x) => x.mult > 1)
    .sort((a, b) => b.mult - a.mult)
    .map((x) => x.tipo);
}

/**
 * Quantos tipos primarios diferentes o time tem.
 *
 * E o numero que mede a unica coisa que a regra de variedade tenta garantir, e
 * portanto o unico honesto de mostrar na tela: seis bichos do mesmo tipo caem
 * inteiros pro mesmo golpe do chefe.
 */
export function countDistinctTypes(team: readonly TeamPick[]): number {
  const tipos = new Set<string>();
  for (const p of team) {
    const primario = p.types[0];
    if (primario !== undefined) tipos.add(primario);
  }
  return tipos.size;
}
