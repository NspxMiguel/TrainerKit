import { useEffect, useState } from "react";

import { looksLikeDataset, resolvedDatasetUrl, useDataSource } from "./source.ts";

import type { BaseStats, RankedSpecies } from "@trainerkit/core";

/** Uma fonte declarada pelo proprio dataset. */
export interface DatasetSource {
  name: string;
  url: string;
  /** Chave de traducao dizendo o que vem dela. */
  provides: string;
}

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
  /** Lendario, mitico ou Ultra Beast — a classe que aparece em raide tier 5. */
  legendary?: boolean;
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
  /**
   * As fontes deste dataset. Opcional porque uma base de terceiro pode nao
   * declarar nada — e ai a tela diz isso, em vez de inventar procedencia.
   */
  sources?: DatasetSource[];
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
  /**
   * Rankings pre-calculados no ETL. Opcional porque um dataset customizado,
   * apontado pelo usuario, pode nao ter — e a tela some em vez de quebrar.
   */
  rankings?: {
    raidOverall: RankedSpecies[];
    raidByType: Record<string, RankedSpecies[]>;
    statProductByLeague: Record<"great" | "ultra" | "master", RankedSpecies[]>;
  };
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
 * O embarcado e servido como asset estatico e fica no precache do service
 * worker — depois da primeira visita o app calcula offline. E de proposito que
 * nao ha fallback de rede: se o dataset nao carrega, o app nao tem como decidir
 * nada, e e melhor dizer isso do que exibir numeros errados.
 *
 * Quando o usuario aponta pra outra fonte, o formato e CONFERIDO antes de
 * entrar. Sem isso, um JSON qualquer daria tela branca ou — pior — numeros
 * calculados sobre lixo, que e o unico tipo de erro que este app nao pode
 * cometer.
 */
export function useDataset(): DatasetState {
  const [state, setState] = useState<DatasetState>({ status: "loading" });
  const source = useDataSource();

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      const url = resolvedDatasetUrl();
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`dataset respondeu ${res.status}`);
        const data = (await res.json()) as Dataset;

        const problem = looksLikeDataset(data);
        if (problem) throw new Error(problem);

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
  }, [source]);

  return state;
}

/** Data de referencia do dataset, formatada como o protótipo mostra (dd/MM). */
export function datasetLabel(version: Dataset["version"]): string {
  const ms = Number(version.uploadTime);
  if (!Number.isFinite(ms)) return "desconhecido";
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
