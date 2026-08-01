import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ACOES_QUE_COBRAM,
  cumpriu,
  decide,
  formatTrace,
  pedeMotivo,
  type Action,
} from "./verdict.js";
import type { BaseStats } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = join(HERE, "..", "..", "..", "apps", "web", "public", "dataset", "gamedata.json");

interface Species {
  id: string;
  name: string;
  baseStats: BaseStats;
  evolvesInto: string[];
  candyToEvolve: Record<string, number>;
}

const data = JSON.parse(readFileSync(DATASET, "utf8")) as {
  cpm: number[];
  species: Species[];
  version: { levelCap: number };
};

function species(id: string): Species {
  const s = data.species.find((x) => x.id === id);
  if (!s) throw new Error(`especie ausente: ${id}`);
  return s;
}

/** A entrada montada, sem decidir — pra quem precisa acrescentar campos. */
function comum(id: string, ivs: { atk: number; def: number; hp: number }) {
  const s = species(id);
  return {
    name: s.name,
    baseStats: s.baseStats,
    ivs,
    level: 20,
    cpm: data.cpm,
    levelCap: data.version.levelCap,
    evolvesInto: s.evolvesInto,
    candyToEvolve: s.evolvesInto[0] ? (s.candyToEvolve[s.evolvesInto[0]] ?? null) : null,
  };
}

function base(id: string, ivs: { atk: number; def: number; hp: number }, extra = {}) {
  return decide({ ...comum(id, ivs), ...extra });
}

describe("motor de veredito", () => {
  it("manda evoluir quem ainda evolui", () => {
    // Nao adianta recomendar investir num Machoke: o que importa e o Machamp.
    expect(base("machoke", { atk: 15, def: 15, hp: 15 }).action).toBe("evoluir");
  });

  it("manda transferir IV fraco de especie fraca", () => {
    expect(base("rattata", { atk: 0, def: 1, hp: 2 }).action).toBe("transferir");
  });

  it("nao manda transferir shadow, mesmo com IV baixo", () => {
    // Shadow ganha 20% de ataque: um shadow medio bate mais que um normal alto.
    const v = base("rattata", { atk: 0, def: 1, hp: 2 }, { shadow: true });
    expect(v.action).not.toBe("transferir");
    expect(v.signals.some((s) => s.rule === "shadow.bonus")).toBe(true);
  });

  it("o Azumarill 0/15/15 vira investir pelo rank de PvP", () => {
    const v = base("azumarill", { atk: 0, def: 15, hp: 15 });
    expect(v.action).toBe("investir");
    expect(v.reason.key).toBe("verdict.pvp.top");
  });

  it("evolui o mediano, mas transfere o lixo — mesmo evoluivel", () => {
    // Precedencia de evolucao nao pode ser absoluta: ninguem gasta doce
    // evoluindo um Rattata de 3%.
    expect(base("rattata", { atk: 0, def: 0, hp: 0 }).action).toBe("transferir");
    expect(base("machoke", { atk: 10, def: 10, hp: 10 }).action).toBe("evoluir");
  });

  it("a confianca cai quando as regras discordam", () => {
    // Um caso com um sinal so contra um com varios sinais divididos.
    const umSinal = base("blissey", { atk: 10, def: 10, hp: 10 });
    const varios = base("azumarill", { atk: 0, def: 15, hp: 15 });
    expect(umSinal.confidence).toBeGreaterThanOrEqual(varios.confidence);
  });

  it("sempre devolve motivo e ao menos um sinal", () => {
    for (const id of ["machamp", "blissey", "magikarp", "mewtwo", "smeargle"]) {
      const v = base(id, { atk: 10, def: 10, hp: 10 });
      expect(v.reason.key.length).toBeGreaterThan(0);
      expect(v.signals.length).toBeGreaterThan(0);
      expect(v.confidence).toBeGreaterThan(0);
      expect(v.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("SEM IV, nao decide — pede o IV, e nao inventa confianca", () => {
    /*
     * ⚠️ O caso mais caro do motor, e ele ja tinha custado uma contradicao na
     * cara do usuario.
     *
     * O guarda existia SO na tela inicial, que montava um veredito a mao com
     * `action: "investir"`. Resultado: a home escrevia "Falta o IV pra eu
     * decidir" com um botao INVESTIR do lado, e a ficha da especie — que nao
     * tinha guarda nenhum — respondia "Transferir · IV 0 de 45 · confianca
     * 65%" pro MESMO Bulbasaur.
     *
     * "aq diz investir e no outro diz transferir..."
     *
     * Os zeros existem porque o tipo exige tres numeros. Le-los como medidos e
     * o pior erro possivel neste app: sai "Transferir" com confianca cheia pra
     * um bicho que pode ser 100%.
     */
    const zerado = { atk: 0, def: 0, hp: 0 };
    for (const id of ["bulbasaur", "machamp", "mewtwo", "magikarp"]) {
      const v = decide({ ...comum(id, zerado), ivDesconhecido: true });
      expect(v.action).toBe("descobrir");
      expect(v.reason.key).toBe("verdict.needIv");
      // Sem regra nenhuma nao ha rastro NEM barra: confianca e concordancia
      // entre regras, e aqui nenhuma rodou.
      expect(v.signals).toEqual([]);
      expect(v.confidence).toBe(0);
    }
  });

  it("o mesmo Pokemon sem IV da a MESMA resposta em qualquer chamada", () => {
    // A contradicao entre telas so foi possivel porque cada uma resolvia o caso
    // do seu jeito. Com o guarda no motor, "chamar de outro lugar" deixou de
    // ser uma variavel.
    const a = decide({ ...comum("bulbasaur", { atk: 0, def: 0, hp: 0 }), ivDesconhecido: true });
    const b = decide({ ...comum("bulbasaur", { atk: 15, def: 15, hp: 15 }), ivDesconhecido: true });
    expect(a.action).toBe(b.action);
    expect(a.reason.key).toBe(b.reason.key);
  });

  it("com IV informado, `descobrir` NUNCA aparece", () => {
    // O outro lado da trava: a quinta acao e so pro caso sem dado. Se ela
    // vazar pro caminho normal, o app para de decidir.
    for (const id of ["machamp", "blissey", "magikarp", "mewtwo", "smeargle"]) {
      for (const iv of [0, 7, 15]) {
        const v = base(id, { atk: iv, def: iv, hp: iv });
        expect(v.action).not.toBe("descobrir");
      }
    }
  });

  it("o rastro sai no formato do prototipo", () => {
    const v = base("machamp", { atk: 15, def: 15, hp: 15 });
    const trace = formatTrace("machamp", v);
    expect(trace).toMatch(/^decide\(machamp\)/);
    expect(trace).toMatch(/veredito/);
    for (const s of v.signals) expect(trace).toContain(s.rule);
  });
});

/*
 * ⚠️ O QUE COBRA, E O QUE NAO COBRA.
 *
 * "discordo fico com ele? deveria ser so discordo" — o texto era o sintoma. O
 * defeito era que o cartao oferecia a saida de "Discordo" num veredito que nao
 * cobrava nada: `guardar` nao entra na fila da home nem na faxina, entao
 * discordar dele silenciava uma cobranca inexistente.
 *
 * A lista virou uma so, no core. Estes testes existem pra que ela nao volte a
 * ser dois literais em duas telas.
 */
describe("quais vereditos cobram alguma coisa", () => {
  it("guardar NAO cobra — e por isso nao oferece saida", () => {
    expect(ACOES_QUE_COBRAM).not.toContain("guardar");
  });

  it("as outras quatro cobram", () => {
    for (const a of ["descobrir", "evoluir", "investir", "transferir"] as const) {
      expect(ACOES_QUE_COBRAM, a).toContain(a);
    }
  });

  it("cobre todas as acoes possiveis, sem esquecer nenhuma", () => {
    const todas: Action[] = ["investir", "evoluir", "guardar", "transferir", "descobrir"];
    const naoCobram = todas.filter((a) => !ACOES_QUE_COBRAM.includes(a));
    // Se alguem criar uma acao nova, ela cai aqui e tem que ser classificada de
    // proposito — em vez de silenciosamente virar "nao cobra".
    expect(naoCobram).toEqual(["guardar"]);
  });
});

describe("cumpriu", () => {
  it("so vale quando a acao marcada e a mesma de hoje", () => {
    expect(cumpriu("investir", "investir")).toBe(true);
    expect(cumpriu("investir", "evoluir")).toBe(false);
    expect(cumpriu("investir", null)).toBe(false);
    expect(cumpriu("investir", undefined)).toBe(false);
  });

  /*
   * ⚠️ O CASO QUE CURA DADO VELHO.
   *
   * Enquanto o app deixava marcar "Guardar" como feito, ele gravou
   * `doneAction: "guardar"` em Pokemon reais. Se `cumpriu` respeitasse essa
   * marca, essas linhas mostrariam "✓ FEITO" pra sempre — sem nenhum botao pra
   * desmarcar, porque o botao saiu. Trocar UI morta por estado sem saida seria
   * pior que o defeito original.
   */
  it("ignora um 'guardar' marcado como feito por uma versao antiga", () => {
    expect(cumpriu("guardar", "guardar")).toBe(false);
  });
});

describe("pedeMotivo", () => {
  /*
   * "Gosto dele", "Eu uso ele mesmo", "É um desafio meu" respondem "por que
   * voce FICA com ele". Essa pergunta so existe quando o conselho foi SOLTAR.
   */
  it("so o transferir pede motivo", () => {
    expect(pedeMotivo("transferir")).toBe(true);
    for (const a of ["investir", "evoluir", "descobrir"] as const) {
      expect(pedeMotivo(a), a).toBe(false);
    }
  });

  /*
   * Discordar de "guardar" nao existe (o botao nem aparece), mas a funcao tem
   * que responder alguma coisa — e o "false" e o certo: se um dia ele voltar a
   * cobrar, quem for mexer tem que decidir de proposito, nao herdar um "sim".
   */
  it("guardar nao pede motivo, mesmo nao chegando aqui hoje", () => {
    expect(pedeMotivo("guardar")).toBe(false);
  });

  it("so pede motivo onde ha cobranca — as duas regras nao podem se contradizer", () => {
    const todas: Action[] = ["investir", "evoluir", "guardar", "transferir", "descobrir"];
    for (const a of todas) {
      if (pedeMotivo(a)) expect(ACOES_QUE_COBRAM, a).toContain(a);
    }
  });
});
