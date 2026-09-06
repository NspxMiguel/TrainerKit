import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MAX_POWERUP_LEVEL, MAX_TRAINER_LEVEL } from "./types.js";

/**
 * AS DUAS CONSTANTES DE NÍVEL, cobradas contra o GAME_MASTER cru.
 *
 * ⚠️ Constante de jogo envelhece em silêncio. `MAX_POWERUP_LEVEL` já esteve em
 * 55 com um comentário afirmando que era "o cap atual", e inflava o PC máximo
 * em ~6%. `MAX_TRAINER_LEVEL` nasceu de um defeito do mesmo tipo em sentido
 * contrário: o app chamava 50 de "MÁX" depois de o teto de treinador ir a 80.
 *
 * A fonte da verdade é o arquivo que o ETL baixa, e as duas moram em lugares
 * DIFERENTES dentro dele — que é exatamente por que se confundem:
 *
 *   `POKEMON_UPGRADE_SETTINGS.maxNormalUpgradeLevel`  → o teto de power-up
 *   `PLAYER_LEVEL_SETTINGS.playerLevel.requiredExperience.length` → o do treinador
 */
const CRU = join(process.cwd(), "..", "dataset", "raw", "GAME_MASTER.json");

function templates(): { templateId?: string; data?: Record<string, unknown> }[] {
  const bruto = JSON.parse(readFileSync(CRU, "utf8")) as unknown;
  if (Array.isArray(bruto)) return bruto;
  const obj = bruto as Record<string, unknown>;
  return (obj.template ?? obj.itemTemplates ?? []) as { templateId?: string }[];
}

describe("constantes de nível contra o GAME_MASTER", () => {
  /* Sem o arquivo cru o teste PULA — ele é baixado pelo ETL e pode não estar
     numa máquina recém-clonada. Mas ele existe no repositório hoje, então na
     prática isto roda. */
  const temArquivo = existsSync(CRU);

  it.runIf(temArquivo)("MAX_POWERUP_LEVEL é o maxNormalUpgradeLevel do jogo", () => {
    const t = templates().find((x) => x.templateId === "POKEMON_UPGRADE_SETTINGS");
    const up = t?.data?.pokemonUpgrades as { maxNormalUpgradeLevel?: number } | undefined;
    expect(up?.maxNormalUpgradeLevel, "POKEMON_UPGRADE_SETTINGS sumiu do arquivo").toBeDefined();
    expect(up!.maxNormalUpgradeLevel).toBe(MAX_POWERUP_LEVEL);
  });

  it.runIf(temArquivo)("MAX_TRAINER_LEVEL é o tamanho da tabela de experiência", () => {
    const t = templates().find((x) => x.templateId === "PLAYER_LEVEL_SETTINGS");
    const pl = t?.data?.playerLevel as { requiredExperience?: number[] } | undefined;
    expect(pl?.requiredExperience, "PLAYER_LEVEL_SETTINGS sumiu do arquivo").toBeDefined();
    expect(pl!.requiredExperience!.length).toBe(MAX_TRAINER_LEVEL);
  });

  it("os dois são coisas diferentes — e é aí que se erra", () => {
    // Sem este caso, alguém "simplifica" fazendo um apontar pro outro e o app
    // volta a chamar 50 de máximo, ou a inflar o PC com 80.
    expect(MAX_TRAINER_LEVEL).toBeGreaterThan(MAX_POWERUP_LEVEL);
  });
});
