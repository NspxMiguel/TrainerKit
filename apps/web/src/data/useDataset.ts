import { useEffect, useState } from "react";

import { looksLikeDataset, resolvedDatasetUrl, useDataSource } from "./source.ts";

import type { BaseStats, DadosDynamax, RankedSpecies } from "@trainerkit/core";

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
  /**
   * Altura em decimetros e peso em hectogramas, como o jogo guarda.
   * Opcionais: uma base customizada, apontada pelo usuario, pode nao ter.
   */
  heightDm?: number | null;
  weightHg?: number | null;
  /** Lendario, mitico ou Ultra Beast — a classe que aparece em raide tier 5. */
  legendary?: boolean;
  /**
   * Grupo de custo dos Max Ataques (`breadTierGroup`).
   *
   * ⚠️ Não é "pode Dynamax" — quase toda espécie tem um. Ver `dynamax.ts`.
   */
  maxGrupo?: string | null;
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
    /**
     * Ate onde da pra PAGAR power-up (`maxNormalUpgradeLevel`). E o teto do
     * "PC maximo" e de todo custo de poeira e doce.
     */
    levelCap: number;
    /** O bonus de Melhor Amigo, que nao se compra. Hoje 1. */
    buddyBonusLevels?: number;
    /** `levelCap + buddyBonusLevels`. Ver `tetoObservavel`. */
    observableLevelCap?: number;
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
   * A categoria da Pokédex por idioma e número: `categoryNames["pt-BR"]["1"]`
   * é "Pokémon Semente". Vem dos textos do próprio jogo.
   *
   * ⚠️ Ausente numa build publicável — ver `INCLUIR_CATEGORIA` no ETL. Quem lê
   * tem que tratar a ausência, não assumir que sempre há categoria.
   */
  categoryNames?: Record<string, Record<string, string>>;
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
  /**
   * Dynamax, Gigantamax e Batalhas Max — o bloco `BREAD` do GAME_MASTER.
   *
   * Opcional porque só o ETL daqui extrai isso: uma base de terceiro apontada
   * pelo usuário não vai ter, e aí a ficha simplesmente não fala do assunto.
   */
  dynamax?: DadosDynamax;
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

/**
 * O maior nível que um Pokémon pode APARENTAR — e não o maior que se compra.
 *
 * ⚠️ Existem dois tetos e confundi-los é o defeito que este acessor evita:
 *
 *   `version.levelCap` (50) é até onde dá pra PAGAR power-up. É o número do
 *   "PC máximo" e de todo custo — ninguém consegue investir além dele.
 *
 *   Este aqui (51) é até onde dá pra OBSERVAR. O Melhor Amigo soma um nível na
 *   hora da batalha e o jogo mostra o PC já com o bônus. Um solver de nível que
 *   parasse em 50 não acharia solução nenhuma pro Pokémon mais investido da
 *   coleção — e a tela diria "esses números não existem juntos" pra um print
 *   perfeitamente correto.
 *
 * Base de terceiro pode não declarar o campo; aí assumimos o bônus de hoje.
 */
export function tetoObservavel(version: Dataset["version"]): number {
  return version.observableLevelCap ?? version.levelCap + (version.buddyBonusLevels ?? 1);
}

/**
 * Colapsa forma cosmética na espécie de verdade.
 *
 * ⚠️ CONTAR `speciesId` CRU CONTA A MESMA ESPÉCIE DUAS VEZES.
 *
 * O GAME_MASTER traz ~2.470 entradas para ~1.180 espécies: cada fantasia, cada
 * letra de Unown e um "_NORMAL" redundante viram template próprio. O ETL já
 * marca essas entradas com `cosmeticOf`, apontando para a forma canônica —
 * ninguém estava lendo.
 *
 * O sintoma apareceu no contador da Pokédex: "Vistos: 9" com oito espécies. O
 * Venusaur entrava duas vezes, como `venusaur` (aberto no Modo Pokédex) e como
 * `venusaur_normal` (o da coleção). Numa Pokédex o contador de vistos é metade
 * da razão de ela existir — errar nele é errar no que a tela promete.
 *
 * Devolve uma função e não um Map porque quem conta faz isso dentro de um laço:
 * o índice é montado uma vez e a busca é O(1).
 */
export function canonico(species: readonly DatasetSpecies[]): (id: string) => string {
  const mapa = new Map(species.map((s) => [s.id, s.cosmeticOf ?? s.id]));
  return (id) => mapa.get(id) ?? id;
}

/** Data de referencia do dataset, formatada como o protótipo mostra (dd/MM). */
export function datasetLabel(version: Dataset["version"]): string {
  const ms = Number(version.uploadTime);
  if (!Number.isFinite(ms)) return "desconhecido";
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
