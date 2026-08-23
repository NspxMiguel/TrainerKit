import { MAX_BAR, ivTotalOf } from "./appraisal.js";
import { msg, type Message } from "./message.js";
import { computeCPAtLevel, type CpmTable } from "./cp.js";
import { rankOf, GREAT_LEAGUE, MASTER_LEAGUE, ULTRA_LEAGUE, type League } from "./pvp.js";
import type { BaseStats, IVs } from "./types.js";

/**
 * O assistente.
 *
 * Ele NAO e um modelo de linguagem e nao inventa nada: cada frase sai de um
 * numero que o app ja calculou. Isso e escolha, nao limitacao — uma opiniao
 * sobre uma especie precisa ser verificavel, senao vira palpite bonito. Toda
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
  text: Message;
  /** O numero que sustenta a frase. Sempre presente — sem dado, sem opiniao. */
  evidence: Message;
}

export interface Opinion {
  /** Uma frase de resumo. Nunca duas. */
  headline: Message;
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

  const hitsHard = baseStats.atk >= HIGH_ATK;
  const tanky = bulk(baseStats) >= HIGH_DEF + HIGH_HP;

  if (hitsHard) {
    observations.push({
      tone: "bom",
      text: msg("assistant.profile.hitsHard"),
      evidence: msg("assistant.evidence.baseAttack", { atk: baseStats.atk }),
    });
  }

  if (tanky) {
    observations.push({
      tone: "bom",
      text: msg("assistant.profile.tanky"),
      evidence: msg("assistant.evidence.defAndHp", { def: baseStats.def, hp: baseStats.hp }),
    });
  }

  // Especie fraca em tudo: o perfil nao interessa.
  //
  // Antes as duas regras disparavam juntas e se contradiziam — o Bulbasaur
  // recebia "Equilibrado, serve pros dois" E "Fraco nos dois" na mesma tela.
  // Dizer que uma especie fraco e "equilibrado" e tecnicamente verdade e
  // praticamente inutil.
  const weak = baseStats.atk < 150 && bulk(baseStats) < 300;

  /*
   * A razao diz pra QUE LADO a especie pende. Ela nao diz se a especie e frouxa.
   *
   * Era isso que fazia o Eternatus se contradizer em tres linhas seguidas:
   *
   *   Bate forte          (ataque 278, absoluto)
   *   Aguenta pancada     (defesa+PS 460, absoluto)
   *   Da dano, mas cai rapido   (razao 1.21)
   *
   * As duas primeiras olham valores ABSOLUTOS; a terceira olha uma PROPORCAO.
   * Um lendario com tudo alto pende pro ataque e continua durissimo — a razao
   * 1.21 significa "inclinado pra ofensiva", nunca "morre facil". Dizer que ele
   * cai rapido logo depois de dizer que ele aguenta pancada e o app discordando
   * de si mesmo na mesma tela.
   *
   * Entao a leitura de tendencia so fala em fragilidade quando a especie de
   * fato NAO e dura, e so fala em passividade quando ela de fato NAO bate
   * forte. Quando os dois absolutos ja dispararam, nao ha terceira linha: as
   * duas de cima ja descreveram o bicho, e "pende pro ataque" nao acrescenta
   * nada que valha uma linha.
   */
  const attackerish = baseStats.atk / Math.max(1, bulk(baseStats) / 2);
  if (hitsHard && tanky) {
    // Forte nos dois. Nada a acrescentar.
  } else if (weak) {
    observations.push({
      tone: "ruim",
      text: msg("assistant.profile.weak"),
      evidence: msg("assistant.evidence.allStats", {
        atk: baseStats.atk,
        def: baseStats.def,
        hp: baseStats.hp,
      }),
    });
  } else if (attackerish >= 1.15 && !tanky) {
    observations.push({
      tone: "neutro",
      text: msg("assistant.profile.attacker"),
      evidence: msg("assistant.evidence.atkVsBulk", {
        atk: baseStats.atk,
        def: baseStats.def,
        hp: baseStats.hp,
      }),
    });
  } else if (attackerish <= 0.8 && !hitsHard) {
    observations.push({
      tone: "neutro",
      text: msg("assistant.profile.wall"),
      evidence: msg("assistant.evidence.hpAndDefVsAtk", {
        atk: baseStats.atk,
        def: baseStats.def,
        hp: baseStats.hp,
      }),
    });
  } else {
    observations.push({
      tone: "neutro",
      text: msg("assistant.profile.balanced"),
      evidence: msg("assistant.evidence.allStats", {
        atk: baseStats.atk,
        def: baseStats.def,
        hp: baseStats.hp,
      }),
    });
  }

  // ------------------------------------------------------------- o bicho do dono

  if (!ivs) {
    return {
      headline: msg("assistant.headline.speciesOnly", { cp: maxCp, level: levelCap }),
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
      text: msg("assistant.iv.greatForLeague", { league: bestLeague.label }),
      evidence: msg("assistant.evidence.rankOf4096", { rank: bestLeague.rank }),
    });
  }

  if (ivs.atk === MAX_BAR) {
    observations.push({
      tone: "bom",
      text: msg("assistant.iv.maxAttack"),
      evidence: msg("assistant.evidence.attackMax"),
    });
  }

  // O ponto que quase todo app esconde do jogador.
  if (ivs.atk >= 13 && bestLeague && bestLeague.label !== "Master" && bestLeague.rank > 500) {
    observations.push({
      tone: "neutro",
      text: msg("assistant.iv.attackHurtsCapped"),
      evidence: msg("assistant.evidence.attackAndRank", {
        atk: ivs.atk,
        rank: bestLeague.rank,
        league: bestLeague.label,
      }),
    });
  }

  if (total <= 15) {
    observations.push({
      tone: "ruim",
      text: msg("assistant.iv.weak"),
      evidence: msg("assistant.evidence.ivOutOf45", { total }),
    });
  }

  // ------------------------------------------------------------------- manchete

  const headline = perfect
    ? msg("assistant.headline.perfect", { name })
    : bestLeague && bestLeague.rank <= 100
      ? msg("assistant.headline.topLeague", { rank: bestLeague.rank, league: bestLeague.label })
      : total <= 15
        ? msg("assistant.headline.weak")
        : msg("assistant.headline.plain", { total, cp: maxCp });

  const good = observations.filter((o) => o.tone === "bom").length;
  const bad = observations.filter((o) => o.tone === "ruim").length;

  return {
    headline,
    tone: good > bad ? "bom" : bad > good ? "ruim" : "neutro",
    observations,
  };
}
