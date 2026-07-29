import { useEffect, useState } from "react";

import type { BaseStats } from "@trainerkit/core";

export interface DatasetSpecies {
  id: string;
  dex: number;
  name: string;
  types: string[];
  baseStats: BaseStats;
  fastMoves: string[];
  chargedMoves: string[];
  eliteFastMoves: string[];
  eliteChargedMoves: string[];
  familyId: string | null;
  parent: string | null;
  evolvesInto: string[];
  candyToEvolve: Record<string, number>;
  /**
   * Preenchido quando a entrada e so uma variacao cosmetica (fantasia, forma
   * "_normal" redundante, padrao de Unown). Elas tem stats identicos aos da
   * forma canonica, entao nao mudam veredito nenhum e ficam fora da busca.
   */
  cosmeticOf: string | null;
  /** Id do sprite no PokeAPI, resolvido no ETL. `null` = sem arte, usa monograma. */
  spriteId: number | null;
}

export interface DatasetMove {
  id: string;
  name: string;
  type: string;
  power: number;
  energyDelta: number;
  durationMs: number;
  damageWindowStartMs: number;
  pvp: { power: number; energyDelta: number; turns: number } | null;
}

export interface Dataset {
  version: {
    batchId: string;
    uploadTime: string;
    generatedAt: string;
    levelCap: number;
  };
  cpm: number[];
  /** Ordem do enum de tipos, usada para indexar `typeChart`. Vem do ETL. */
  typeOrder: string[];
  typeChart: Record<string, number[]>;
  species: DatasetSpecies[];
  fastMoves: DatasetMove[];
  chargedMoves: DatasetMove[];
  /** Nome oficial do golpe por idioma: `moveNames["pt-BR"]["counter_fast"]`. */
  moveNames?: Record<string, Record<string, string>>;
  /**
   * Constantes de batalha do proprio GAME_MASTER — STAB, bonus de sombroso,
   * energia maxima. Nunca digitadas a mao: elas mudam com o jogo, e um numero
   * defasado aqui faz o app mentir com confianca.
   */
  settings: {
    battle: {
      sameTypeAttackBonusMultiplier: number;
      enemyAttackInterval: number;
      maximumEnergy: number;
      shadowPokemonAttackBonusMultiplier: number;
      shadowPokemonDefenseBonusMultiplier: number;
    };
  };
}

export type DatasetState =
  | { status: "loading" }
  | { status: "ready"; data: Dataset }
  | { status: "error"; message: string };

/**
 * Carrega o dataset do jogo.
 *
 * E servido como asset estatico e fica no precache do service worker — depois
 * da primeira visita o app calcula offline. E de proposito que nao ha fallback
 * de rede: se o dataset nao carrega, o app nao tem como decidir nada, e e
 * melhor dizer isso do que exibir numeros errados.
 */
export function useDataset(): DatasetState {
  const [state, setState] = useState<DatasetState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/dataset/gamedata.json");
        if (!res.ok) throw new Error(`dataset respondeu ${res.status}`);
        const data = (await res.json()) as Dataset;
        if (!cancelled) setState({ status: "ready", data });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Data de referencia do dataset, formatada como o protótipo mostra (dd/MM). */
export function datasetLabel(version: Dataset["version"]): string {
  const ms = Number(version.uploadTime);
  if (!Number.isFinite(ms)) return "desconhecido";
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
