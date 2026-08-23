import {
  GREAT_LEAGUE,
  MASTER_LEAGUE,
  ULTRA_LEAGUE,
  decide,
  fazGigantamax,
  ivTotalOf,
  rankOf,
  type CpmTable,
} from "@trainerkit/core";

import type { Dataset } from "../data/useDataset.ts";
import type { OwnedPokemon } from "../storage/collection.ts";
import { getSetup, tetoDePowerUp } from "../onboarding/setup.ts";
import { chat } from "./provider.ts";

/**
 * Perguntar sobre a propria colecao, com suas palavras.
 *
 * A primeira versao da IA reescrevia o veredito que o app ja tinha escrito.
 * Isso e quase nada: o numero ja estava na tela, a frase ja estava pronta, e o
 * modelo so trocava as palavras — trabalho de modelo pra entregar o que ja
 * estava pronto.
 *
 * O que um modelo faz e o app nao: entender uma pergunta solta. "Qual dos meus
 * presta pra Great?", "o que eu transfiro?", "vale subir o Machamp?" — sao
 * perguntas que nenhum botao responde, porque cada uma cruza dados diferentes.
 *
 * A regra continua a mesma: o modelo NAO calcula. Ele recebe a colecao inteira
 * ja avaliada — veredito, IV, posicao em cada liga — e so escolhe o que
 * responder. Todo numero que ele diz foi calculado aqui.
 */

export interface CollectionFact {
  name: string;
  ivTotal: number;
  /**
   * "eu tenho esse", sem IV medido.
   *
   * ⚠️ `ivTotal` é 0 nesses casos porque os `ivs` são zeros de preenchimento.
   * Quem monta o texto tem que checar ISTO antes de escrever o número — foi
   * assim que a Especies respondeu "O IV do Bulbasaur do jogador é 0" pra um
   * bicho que ninguém mediu.
   */
  semIv: boolean;
  level: number | null;
  cp: number | null;
  action: string;
  greatRank: number | null;
  ultraRank: number | null;
  masterRank: number | null;
  shadow: boolean;
  lucky: boolean;
}

/**
 * A colecao virada em fatos, pronta pra virar contexto.
 *
 * Limitada a 60 especie por chamada: uma colecao de 500 estouraria o contexto e
 * a conta de quem paga.
 *
 * ⚠️ COMO EU ESCOLHIA ERRADO: eu mandava os 60 de MAIOR IV, com a justificativa
 * de que "numa pergunta do tipo 'qual o melhor', o 63o melhor nunca e a
 * resposta". Verdade — e irrelevante pra metade das perguntas que este arquivo
 * existe pra responder. "O que eu transfiro?" esta no docstring do modulo como
 * pergunta-alvo, e pra ela os 60 de maior IV sao exatamente a fatia errada: o
 * modelo respondia com o pior DOS MELHORES, com toda a confianca, sem ter como
 * saber que os piores de verdade tinham sido cortados antes de ele ver.
 *
 * Agora o corte pega os DOIS extremos — os melhores e os piores — porque as
 * perguntas vem dos dois lados. E o meio, que some, some sabendo: o contexto
 * declara quantos existem e quantos chegaram (ver `asContext`).
 */
export function collectionFacts(
  items: readonly OwnedPokemon[],
  data: Dataset,
  limit = 60,
): CollectionFact[] {
  const cpm: CpmTable = data.cpm;

  const facts = items.flatMap((owned) => {
    const sp = data.species.find((s) => s.id === owned.speciesId);
    if (!sp) return [];

    const verdict = decide({
      ivDesconhecido: owned.ivDesconhecido === true,
      name: sp.name,
      baseStats: sp.baseStats,
      ivs: owned.ivs,
      level: owned.level ?? 20,
      cpm,
      /* Fora de componente: `getSetup()` em vez do hook. O dossie e montado sob
         demanda, na hora da pergunta — nao ha render pra assinar. */
      levelCap: tetoDePowerUp(getSetup().level, data.version.levelCap),
      evolvesInto: sp.evolvesInto,
      candyToEvolve: sp.evolvesInto[0]
        ? (sp.candyToEvolve[sp.evolvesInto[0]] ?? null)
        : null,
      lucky: owned.lucky,
      shadow: owned.shadow,
      gigantamax: fazGigantamax(sp.id, data.dynamax),
    });

    const rank = (league: typeof GREAT_LEAGUE) =>
      rankOf(cpm, sp.baseStats, owned.ivs, league)?.rank ?? null;

    return [
      {
        name: sp.name,
        ivTotal: ivTotalOf(owned.ivs),
        semIv: owned.ivDesconhecido === true,
        level: owned.level,
        cp: owned.cp,
        action: verdict.action,
        greatRank: rank(GREAT_LEAGUE),
        ultraRank: rank(ULTRA_LEAGUE),
        masterRank: rank(MASTER_LEAGUE),
        shadow: owned.shadow,
        lucky: owned.lucky,
      },
    ];
  });

  const porIv = facts.sort((a, b) => b.ivTotal - a.ivTotal);
  if (porIv.length <= limit) return porIv;

  // Dois tercos do topo, um terco do fundo: "qual o melhor" e mais comum que
  // "o que eu transfiro", mas nenhuma das duas pode ficar sem material.
  const topo = Math.ceil((limit * 2) / 3);
  return [...porIv.slice(0, topo), ...porIv.slice(-(limit - topo))];
}

const SYSTEM = `Você é o assistente do TrainerKit, um app de o jogo.

Você recebe a coleção do jogador já avaliada pelo app: IV, nível, PC, veredito
(investir/evoluir/guardar/transferir) e a posição de cada um nas três ligas de
PvP entre as 4.096 combinações possíveis de IV — posição 1 é a melhor.

Responda a pergunta usando SÓ esses dados.

Regras rígidas:
- Nunca invente números, especie, movesets ou mecânicas. Se a resposta não está
  nos dados, diga que não sabe.
- Posição menor é melhor. Um #12 na Great é excelente; um #3000 é ruim.
- Se o cabeçalho disser que você está vendo só parte da coleção, responda pelo
  que viu e avise numa frase curta que olhou só os extremos. Nunca diga "o
  melhor que você tem" ou "o pior que você tem" como se tivesse visto todos.
- Não chame um IV de bom ou ruim pelo número solto: 100% é perfeito, 0% é o
  pior possível, e a média de uma especie selvagem é perto de 49%.
- Quando perguntarem "qual o IV", responda em PORCENTAGEM, que é o que a tela
  mostra em letra grande. A fração de 45 vem depois, entre parênteses.
- "IV NÃO informado" quer dizer que o jogador nunca mediu aquele especie.
  NUNCA diga que o IV dele é 0 — diga que falta escanear.
- Não gere, descreva nem ofereça imagens.
- Responda SEMPRE no idioma pedido no cabeçalho, nunca no idioma que você achou
  que a pergunta estava.
- Curto: no máximo 4 frases. Cite os nomes e os números que sustentam a
  resposta, sem virar tabela.
- Nada de saudação nem de "espero ter ajudado".`;

/** Monta o contexto compacto. Uma linha por especie, sem JSON — gasta menos. */
function asContext(facts: readonly CollectionFact[], total: number): string {
  const cabecalho =
    facts.length < total
      ? `O jogador tem ${total} especie. Você está vendo ${facts.length}: os de maior ` +
        `e os de menor IV. O meio da coleção não chegou até você.\n`
      : `Coleção completa do jogador, ${total} especie:\n`;

  return (
    cabecalho +
    facts
    .map((f) => {
      const partes = [
        f.name,
        // Porcentagem e fração juntas: a tela mostra as duas, e o modelo
        // precisa poder responder na língua de quem perguntou. Ver a nota em
        // `dossier.ts`.
        f.semIv
          ? "IV NÃO informado"
          : `IV ${Math.round((f.ivTotal / 45) * 100)}% (${f.ivTotal}/45)`,
        f.cp === null ? null : `PC ${f.cp}`,
        f.level === null ? null : `nv ${f.level}`,
        `veredito: ${f.action}`,
        f.greatRank === null ? null : `Great #${f.greatRank}`,
        f.ultraRank === null ? null : `Ultra #${f.ultraRank}`,
        f.masterRank === null ? null : `Master #${f.masterRank}`,
        f.shadow ? "sombroso" : null,
        f.lucky ? "lucky" : null,
      ].filter(Boolean);
      return `- ${partes.join(" · ")}`;
    })
      .join("\n")
  );
}

export interface AskOptions {
  question: string;
  facts: readonly CollectionFact[];
  /**
   * Quantos o jogador tem DE VERDADE. Separado de `facts.length` porque `facts`
   * pode ser um recorte, e o modelo precisa saber disso pra nao responder "o
   * pior que voce tem e X" quando X e so o pior que ele viu.
   */
  total: number;
  /**
   * O idioma escolhido em Ajustes. Obrigatorio de propósito: com `?` ele viraria
   * opcional e a proxima tela a chamar isto esqueceria, que e como o bug nasceu.
   */
  language: string;
  signal?: AbortSignal;
}

/**
 * Nao recebe mais chave nem modelo.
 *
 * Quem decide de onde vem a resposta e `provider.ts` — Groq com a chave do
 * usuario, ou o modelo rodando na GPU do aparelho. Esta funcao so monta a
 * pergunta, e ela e a mesma nos dois casos.
 */
/**
 * O idioma vai ESCRITO, e nao adivinhado.
 *
 * ⚠️ "Responda no idioma da pergunta" parecia bastar e nao basta. Perguntei
 * "vale purificar" — portugues — e a resposta veio em espanhol: ""Purificar" se
 * refiere a la funcion de purificar un especie...". Duas palavras que existem
 * identicas nos dois idiomas nao carregam informacao suficiente pro modelo
 * decidir, e ele chutou.
 *
 * O app SABE o idioma: e a escolha da pessoa em Ajustes, e a mesma que pinta a
 * tela inteira. Pedir pro modelo inferir do texto e jogar fora um dado que ja
 * esta na mao — e a `dexSystem` ja fazia certo desde o bug do alemao misturado.
 * Esta era a outra porta da IA, e ficou de fora daquela correcao.
 */
function cabecalhoIdioma(language: string): string {
  const nome = NOMES_IDIOMA[language] ?? "Portuguese (Brazil)";
  return `Answer in ${nome}. Every word of your reply must be in ${nome}.\n\n`;
}

const NOMES_IDIOMA: Record<string, string> = {
  "pt-BR": "Portuguese (Brazil)",
  en: "English",
  es: "Spanish (Spain)",
  "es-419": "Spanish (Latin America)",
  fr: "French",
  de: "German",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  ru: "Russian",
};

export async function askAboutCollection({
  question,
  facts,
  total,
  language,
  signal,
}: AskOptions): Promise<string> {
  if (facts.length === 0) throw new Error("colecao vazia");

  return chat(
    [
      { role: "system", content: cabecalhoIdioma(language) + SYSTEM },
      {
        role: "user",
        content: `Minha coleção:\n${asContext(facts, total)}\n\nPergunta: ${question}`,
      },
    ],
    // `pergunta` liga o porteiro (`guarda.ts`) — so o texto cru do usuario, nunca
    // o resumo da colecao que eu montei em volta dele.
    { temperature: 0.2, maxTokens: 320, pergunta: question, ...(signal ? { signal } : {}) },
  );
}
