import {
  GREAT_LEAGUE,
  MASTER_LEAGUE,
  ULTRA_LEAGUE,
  decide,
  ivTotalOf,
  rankOf,
  type CpmTable,
} from "@trainerkit/core";

import type { Dataset } from "../data/useDataset.ts";
import type { OwnedPokemon } from "../storage/collection.ts";

/**
 * Perguntar sobre a propria colecao, com suas palavras.
 *
 * A primeira versao da IA reescrevia o veredito que o app ja tinha escrito.
 * Isso e quase nada: o numero ja estava na tela, a frase ja estava pronta, e o
 * modelo so trocava as palavras. O Miguel perguntou "pra que serve isso?" e a
 * resposta honesta era "pra pouco".
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
 * Limitada a 60 Pokemon por chamada: uma colecao de 500 estouraria o contexto e
 * a conta de quem paga. Os escolhidos sao os de maior IV — numa pergunta do
 * tipo "qual o melhor", o 63o melhor nunca e a resposta.
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
      name: sp.name,
      baseStats: sp.baseStats,
      ivs: owned.ivs,
      level: owned.level ?? 20,
      cpm,
      levelCap: data.version.levelCap,
      evolvesInto: sp.evolvesInto,
      candyToEvolve: sp.evolvesInto[0]
        ? (sp.candyToEvolve[sp.evolvesInto[0]] ?? null)
        : null,
      lucky: owned.lucky,
      shadow: owned.shadow,
    });

    const rank = (league: typeof GREAT_LEAGUE) =>
      rankOf(cpm, sp.baseStats, owned.ivs, league)?.rank ?? null;

    return [
      {
        name: sp.name,
        ivTotal: ivTotalOf(owned.ivs),
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

  return facts.sort((a, b) => b.ivTotal - a.ivTotal).slice(0, limit);
}

const SYSTEM = `Você é o assistente do TrainerKit, um app de Pokémon GO.

Você recebe a coleção do jogador já avaliada pelo app: IV, nível, PC, veredito
(investir/evoluir/guardar/transferir) e a posição de cada um nas três ligas de
PvP entre as 4.096 combinações possíveis de IV — posição 1 é a melhor.

Responda a pergunta usando SÓ esses dados.

Regras rígidas:
- Nunca invente números, Pokémon, movesets ou mecânicas. Se a resposta não está
  nos dados, diga que não sabe.
- Posição menor é melhor. Um #12 na Great é excelente; um #3000 é ruim.
- Não gere, descreva nem ofereça imagens.
- Responda no idioma da pergunta.
- Curto: no máximo 4 frases. Cite os nomes e os números que sustentam a
  resposta, sem virar tabela.
- Nada de saudação nem de "espero ter ajudado".`;

/** Monta o contexto compacto. Uma linha por Pokemon, sem JSON — gasta menos. */
function asContext(facts: readonly CollectionFact[]): string {
  return facts
    .map((f) => {
      const partes = [
        f.name,
        `IV ${f.ivTotal}/45`,
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
    .join("\n");
}

export interface AskOptions {
  question: string;
  facts: readonly CollectionFact[];
  apiKey: string;
  model: string;
  signal?: AbortSignal;
}

export async function askAboutCollection({
  question,
  facts,
  apiKey,
  model,
  signal,
}: AskOptions): Promise<string> {
  if (facts.length === 0) throw new Error("colecao vazia");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 320,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Minha coleção:\n${asContext(facts)}\n\nPergunta: ${question}`,
        },
      ],
    }),
    ...(signal ? { signal } : {}),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${detail.slice(0, 120)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("resposta vazia");
  return text;
}
