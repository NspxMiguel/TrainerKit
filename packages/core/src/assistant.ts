import { MAX_BAR, ivTotalOf } from "./appraisal.js";
import { computeCPAtLevel, type CpmTable } from "./cp.js";
import { rankOf, GREAT_LEAGUE, MASTER_LEAGUE, ULTRA_LEAGUE, type League } from "./pvp.js";
import type { BaseStats, IVs } from "./types.js";

/**
 * O assistente.
 *
 * Ele NAO e um modelo de linguagem e nao inventa nada: cada frase sai de um
 * numero que o app ja calculou. Isso e escolha, nao limitacao — uma opiniao
 * sobre um Pokemon precisa ser verificavel, senao vira palpite bonito. Toda
 * observacao carrega o dado que a sustenta, e a interface mostra os dois juntos.
 *
 * O que ele faz e o que um amigo que manja faria: olhar os numeros e dizer o que
 * eles significam na pratica. "IV 96%" nao diz nada sozinho; "otimo pra raide,
 * mas o ataque alto atrapalha na Great League" diz.
 */

export type Tone = "bom" | "neutro" | "ruim";

export interface Observation {
  tone: Tone;
  /** A frase. Curta, direta, sem enrolacao. */
  text: string;
  /** O numero que sustenta a frase. Sempre presente — sem dado, sem opiniao. */
  evidence: string;
}

export interface Opinion {
  /** Uma frase de resumo. Nunca duas. */
  headline: string;
  tone: Tone;
  observations: Observation[];
}

export interface AssistantInput {
  name: string;
  baseStats: BaseStats;
  cpm: CpmTable;
  levelCap: number;
  /** Ausente quando o usuario so esta consultando a especie, sem um bicho seu. */
  ivs?: IVs;
}

/** Referencias para dizer se um stat base e alto ou baixo, medidas no dataset. */
const HIGH_ATK = 250;
const HIGH_DEF = 220;
const HIGH_HP = 220;

function bulk(base: BaseStats): number {
  return base.def + base.hp;
}

export function opine(input: AssistantInput): Opinion {
  const { name, baseStats, cpm, levelCap, ivs } = input;
  const observations: Observation[] = [];

  // ---------------------------------------------------------- perfil da especie

  const maxCp = computeCPAtLevel(cpm, baseStats, { atk: 15, def: 15, hp: 15 }, levelCap);

  if (baseStats.atk >= HIGH_ATK) {
    observations.push({
      tone: "bom",
      text: "Bate muito forte. É candidato natural a time de raide.",
      evidence: `ataque base ${baseStats.atk}`,
    });
  }

  if (bulk(baseStats) >= HIGH_DEF + HIGH_HP) {
    observations.push({
      tone: "bom",
      text: "Aguenta pancada. Esse tipo de corpo rende bem em PvP, onde durar importa mais que matar rápido.",
      evidence: `defesa ${baseStats.def} e PS ${baseStats.hp}`,
    });
  }

  // Uma leitura de PERFIL que sempre sai.
  //
  // Sem isto o assistente ficava mudo em especies medianas — justamente as
  // que mais precisam de uma opiniao, porque o numero sozinho nao diz se o
  // bicho serve pra atacar ou pra aguentar.
  const attackerish = baseStats.atk / Math.max(1, bulk(baseStats) / 2);
  if (attackerish >= 1.15) {
    observations.push({
      tone: "neutro",
      text: "É mais atacante que parede: entrega dano, mas cai rápido. Bom pra raide, arriscado em PvP.",
      evidence: `ataque ${baseStats.atk} contra defesa ${baseStats.def} e PS ${baseStats.hp}`,
    });
  } else if (attackerish <= 0.8) {
    observations.push({
      tone: "neutro",
      text: "É mais parede que atacante: dura muito, mas demora pra derrubar. Perfil de PvP.",
      evidence: `defesa ${baseStats.def} e PS ${baseStats.hp} contra ataque ${baseStats.atk}`,
    });
  } else {
    observations.push({
      tone: "neutro",
      text: "Perfil equilibrado — não se destaca em nada, mas também não tem buraco.",
      evidence: `ataque ${baseStats.atk}, defesa ${baseStats.def}, PS ${baseStats.hp}`,
    });
  }

  if (baseStats.atk < 150 && bulk(baseStats) < 300) {
    observations.push({
      tone: "ruim",
      text: "Não bate nem aguenta. Serve pra Pokédex e pouco mais.",
      evidence: `ataque ${baseStats.atk}, defesa ${baseStats.def}, PS ${baseStats.hp}`,
    });
  }

  // ------------------------------------------------------------- o bicho do dono

  if (!ivs) {
    return {
      headline: `${name} chega a ${maxCp.toLocaleString("pt-BR")} de PC no nível ${levelCap}.`,
      tone: observations.some((o) => o.tone === "bom") ? "bom" : "neutro",
      observations,
    };
  }

  const total = ivTotalOf(ivs);
  const perfect = total === 45;

  // A pergunta que interessa nao e "quantos por cento", e "bom pra QUE".
  const leagues: Array<{ league: League; label: string }> = [
    { league: GREAT_LEAGUE, label: "Great" },
    { league: ULTRA_LEAGUE, label: "Ultra" },
    { league: MASTER_LEAGUE, label: "Master" },
  ];

  let bestLeague: { label: string; rank: number; percent: number } | null = null;
  for (const { league, label } of leagues) {
    const ranked = rankOf(cpm, baseStats, ivs, league);
    if (!ranked) continue;
    if (!bestLeague || ranked.rank < bestLeague.rank) {
      bestLeague = { label, rank: ranked.rank, percent: ranked.percent };
    }
  }

  if (bestLeague && bestLeague.rank <= 100) {
    observations.push({
      tone: "bom",
      text: `Esse IV é excelente pra ${bestLeague.label} League. Guarda esse.`,
      evidence: `#${bestLeague.rank.toLocaleString("pt-BR")} entre 4.096 combinações`,
    });
  }

  if (ivs.atk === MAX_BAR) {
    observations.push({
      tone: "bom",
      text: "Ataque perfeito. Pra raide é o stat que mais importa.",
      evidence: "ataque 15 de 15",
    });
  }

  // O ponto que quase todo app esconde do jogador.
  if (ivs.atk >= 13 && bestLeague && bestLeague.label !== "Master" && bestLeague.rank > 500) {
    observations.push({
      tone: "neutro",
      text: "Ataque alto ajuda em raide, mas atrapalha em liga com teto: ele infla o PC e obriga a parar num nível mais baixo.",
      evidence: `ataque ${ivs.atk}, posição #${bestLeague.rank.toLocaleString("pt-BR")} na ${bestLeague.label}`,
    });
  }

  if (total <= 15) {
    observations.push({
      tone: "ruim",
      text: "IV bem fraco. Se não for por apego, é candidato a transferir.",
      evidence: `${total} de 45 pontos`,
    });
  }

  // ------------------------------------------------------------------- manchete

  const headline = perfect
    ? `${name} 100%. Esse é dos raros — não transfere de jeito nenhum.`
    : bestLeague && bestLeague.rank <= 100
      ? `${name} vale guardar: é top ${bestLeague.rank} na ${bestLeague.label} League.`
      : total <= 15
        ? `${name} com IV fraco. Provavelmente não vale investir.`
        : `${name} está em ${total} de 45, e chega a ${maxCp.toLocaleString("pt-BR")} de PC.`;

  const good = observations.filter((o) => o.tone === "bom").length;
  const bad = observations.filter((o) => o.tone === "ruim").length;

  return {
    headline,
    tone: good > bad ? "bom" : bad > good ? "ruim" : "neutro",
    observations,
  };
}
