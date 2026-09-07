import type { DadosDynamax } from "@trainerkit/core";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { useEffect, useState } from "react";

/**
 * O dataset, lido do proprio pacote.
 *
 * ⚠️ NAO E `import gamedata from "./gamedata.json"`, e a diferenca importa: o
 * Metro embutiria 2 MB de JSON dentro do bundle JavaScript, que o Hermes teria
 * que analisar inteiro no arranque. Como asset, o arquivo fica no pacote e e
 * lido do disco — o app abre antes de precisar dele.
 *
 * No web isto era `fetch` mais service worker; aqui o arquivo ja esta no
 * aparelho desde a instalacao, entao nao ha rede, nao ha cache e nao ha o que
 * revalidar. A revalidacao diaria (`data/useDataset.ts` do web) continua
 * fazendo sentido e entra depois — o que ela precisa e de um endereco pra
 * buscar, nao de um caminho de arquivo.
 */
export interface EstadoDados {
  pronto: boolean;
  erro: string | null;
  dados: Base | null;
}

export interface Especie {
  id: string;
  /**
   * Aponta pra forma CANONICA quando esta e so um enfeite.
   *
   * ⚠️ 2.476 entradas viram 1.182. As outras 1.294 sao a mesma especie com
   * chapeu de evento: "Bulbasaur (Fall 2019)", "Charmander (Goggles 2026)".
   * Elas existem no jogo e por isso existem na base, mas numa LISTA elas sao
   * ruido — Bulbasaur aparecia tres vezes seguidas.
   *
   * O mesmo filtro do app web (`SpeciesBrowser.tsx`): `cosmeticOf === null`.
   */
  cosmeticOf: string | null;
  dex: number;
  name: string;
  types: string[];
  baseStats: { atk: number; def: number; hp: number };
  spriteId: number | null;
  legendary?: boolean;
  fastMoves: string[];
  chargedMoves: string[];
  /*
   * ⚠️ ESTES QUATRO JA VINHAM NO ARQUIVO e o tipo nao declarava.
   *
   * `gamedata.tkdata` traz `evolvesInto`, `candyToEvolve`, `eliteFastMoves` e
   * `eliteChargedMoves` em toda especie — o app web le os quatro. Aqui o tipo
   * era uma vista estreita do mesmo JSON, e a ficha passava `evolvesInto: []`
   * fixo pro `decide`. Consequencia: o veredito NUNCA dizia "Evoluir" no app
   * nativo, porque a regra que produz esse veredito depende justamente deste
   * campo (`verdict.ts`, "if (input.evolvesInto.length > 0)").
   */
  evolvesInto: string[];
  /** Quantos doces cada evolucao custa, por id do que ela vira. */
  candyToEvolve: Record<string, number>;
  /** Golpes que so entram por TM Elite — nao aparecem em captura normal. */
  eliteFastMoves: string[];
  eliteChargedMoves: string[];
  /** Grupo de custo dos Max Ataques. `null` na especie que nao entra em Batalha Max. */
  maxGrupo: string | null;
}

interface Golpe {
  id: string;
  name: string;
  type: string;
  power: number;
  energyDelta: number;
  durationMs: number;
  damageWindowStartMs: number;
  pvp: { power: number; energyDelta: number; turns: number } | null;
}

export interface Base {
  /** TODAS, inclusive as cosmeticas — a busca por id precisa delas. */
  species: Especie[];
  /** So as canonicas. E o que uma lista mostra. */
  canonicas: Especie[];
  cpm: number[];
  version: {
    levelCap: number;
    /*
     * ⚠️ Os dois vinham no arquivo e o tipo nativo os ignorava, então Ajustes
     * não tinha como dizer de quando é o dado que o app está usando — e um
     * dataset velho é a explicação mais comum para um número que não bate com o
     * jogo.
     */
    batchId?: string;
    generatedAt?: string;
  };
  typeChart: Record<string, number[]>;
  typeOrder: string[];
  fastMoves: Golpe[];
  chargedMoves: Golpe[];
  /*
   * A Batalha Max, que tambem ja vinha no arquivo sem tipo.
   *
   * `ligado` e a chave que decide se a mecanica existe na temporada — quando o
   * jogo desligar, a tela some sozinha em vez de mostrar custo de uma coisa que
   * nao da pra fazer. O tipo vem do core (`DadosDynamax`), pra nao existirem
   * duas descricoes do mesmo objeto.
   */
  dynamax?: DadosDynamax;
  settings: {
    /*
     * ⚠️ `shadowPokemonAttackBonusMultiplier` DECLARADO, e nao so um
     * `Record<string, number>`.
     *
     * O `Record` largo compila e mente: `shadowDamageMultiplier` do core pede
     * essa chave por nome, e com o tipo largo o TypeScript recusa a chamada —
     * o que empurra pra um `as any` que passaria a esconder o dia em que a
     * chave sumir do ETL. O arquivo traz ela (1.2, medido); declarar e o que
     * faz o compilador vigiar isso por nos.
     */
    battle: Record<string, number> & { shadowPokemonAttackBonusMultiplier: number };
  };
  /*
   * Os rankings ja vem calculados no arquivo — o ETL faz a conta uma vez, e nao
   * o aparelho a cada abertura. `fast`/`charged` sao o conjunto que rendeu
   * aquela posicao, e sem eles a tira diria "o melhor" sem dizer com o que.
   */
  rankings?: {
    raidOverall: {
      speciesId: string;
      fast?: { name: string };
      charged?: { name: string };
    }[];
    raidByType: Record<string, { speciesId: string }[]>;
    statProductByLeague: Record<string, { speciesId: string }[]>;
  };
}

export function useDados(): EstadoDados {
  const [estado, setEstado] = useState<EstadoDados>({ pronto: false, erro: null, dados: null });

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const asset = Asset.fromModule(require("../assets/dataset/gamedata.tkdata"));
        await asset.downloadAsync();
        const caminho = asset.localUri ?? asset.uri;
        /*
         * ⚠️ `new File(...).text()`, e nao `readAsStringAsync`.
         *
         * O `expo-file-system` 57 aposentou a API antiga: chamar
         * `readAsStringAsync` nao avisa em tempo de compilacao, LANCA em tempo
         * de execucao ("Method readAsStringAsync ... is deprecated"). Numa build
         * Release isso aparece so quando o app abre — foi assim que apareceu.
         */
        const texto = await new File(caminho).text();
        const base = JSON.parse(texto) as Base;
        base.canonicas = base.species.filter((e) => !e.cosmeticOf);
        if (vivo) setEstado({ pronto: true, erro: null, dados: base });
      } catch (e) {
        if (vivo) setEstado({ pronto: false, erro: String(e).slice(0, 200), dados: null });
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return estado;
}
