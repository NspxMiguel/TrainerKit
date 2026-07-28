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
      text: "Bate forte. Bom pra raide.",
      evidence: `ataque base ${baseStats.atk}`,
    });
  }

  if (bulk(baseStats) >= HIGH_DEF + HIGH_HP) {
    observations.push({
      tone: "bom",
      text: "Aguenta pancada. Bom pra PvP.",
      evidence: `defesa ${baseStats.def} e PS ${baseStats.hp}`,
    });
  }

  // Especie fraca em tudo: o perfil nao interessa.
  //
  // Antes as duas regras disparavam juntas e se contradiziam — o Bulbasaur
  // recebia "Equilibrado, serve pros dois" E "Fraco nos dois" na mesma tela.
  // Dizer que um Pokemon fraco e "equilibrado" e tecnicamente verdade e
  // praticamente inutil.
  const weak = baseStats.atk < 150 && bulk(baseStats) < 300;

  const attackerish = baseStats.atk / Math.max(1, bulk(baseStats) / 2);
  if (weak) {
    observations.push({
      tone: "ruim",
      text: "Fraco nos dois. Só pra Pokédex.",
      evidence: `ataque ${baseStats.atk}, defesa ${baseStats.def}, PS ${baseStats.hp}`,
    });
  } else if (attackerish >= 1.15) {
    observations.push({
      tone: "neutro",
      text: "Atacante: dá dano, mas cai rápido.",
      evidence: `ataque ${baseStats.atk} contra defesa ${baseStats.def} e PS ${baseStats.hp}`,
    });
  } else if (attackerish <= 0.8) {
    observations.push({
      tone: "neutro",
      text: "Parede: dura muito, mata devagar.",
      evidence: `defesa ${baseStats.def} e PS ${baseStats.hp} contra ataque ${baseStats.atk}`,
    });
  } else {
    observations.push({
      tone: "neutro",
      text: "Equilibrado. Serve pros dois.",
      evidence: `ataque ${baseStats.atk}, defesa ${baseStats.def}, PS ${baseStats.hp}`,
    });
  }

  // ------------------------------------------------------------- o bicho do dono

  if (!ivs) {
    return {
      headline: `Até ${maxCp.toLocaleString("pt-BR")} de PC no nível ${levelCap}.`,
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
      text: `IV excelente pra ${bestLeague.label} League.`,
      evidence: `#${bestLeague.rank.toLocaleString("pt-BR")} entre 4.096 combinações`,
    });
  }

  if (ivs.atk === MAX_BAR) {
    observations.push({
      tone: "bom",
      text: "Ataque 15. O stat que mais vale em raide.",
      evidence: "ataque 15 de 15",
    });
  }

  // O ponto que quase todo app esconde do jogador.
  if (ivs.atk >= 13 && bestLeague && bestLeague.label !== "Master" && bestLeague.rank > 500) {
    observations.push({
      tone: "neutro",
      text: "Ataque alto atrapalha em liga com teto: infla o PC.",
      evidence: `ataque ${ivs.atk}, posição #${bestLeague.rank.toLocaleString("pt-BR")} na ${bestLeague.label}`,
    });
  }

  if (total <= 15) {
    observations.push({
      tone: "ruim",
      text: "IV fraco. Candidato a transferir.",
      evidence: `${total} de 45 pontos`,
    });
  }

  // ------------------------------------------------------------------- manchete

  const headline = perfect
    ? `${name} 100%. Não transfere.`
    : bestLeague && bestLeague.rank <= 100
      ? `Top ${bestLeague.rank} na ${bestLeague.label} League.`
      : total <= 15
        ? "IV fraco. Não vale investir."
        : `${total} de 45 · até ${maxCp.toLocaleString("pt-BR")} de PC.`;

  const good = observations.filter((o) => o.tone === "bom").length;
  const bad = observations.filter((o) => o.tone === "ruim").length;

  return {
    headline,
    tone: good > bad ? "bom" : bad > good ? "ruim" : "neutro",
    observations,
  };
}
