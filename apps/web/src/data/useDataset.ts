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
   * A categoria do catalogo por idioma e número: `categoryNames["pt-BR"]["1"]`
   * é "especie Semente". Vem dos textos do próprio jogo.
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

/** Busca e valida um dataset. `null` quando nao deu — offline, 404, JSON torto. */
async function carregar(url: string): Promise<Dataset | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as Dataset;
    return looksLikeDataset(data) ? null : data;
  } catch {
    return null;
  }
}

/**
 * O mesmo endereco, com um carimbo do DIA colado.
 *
 * ⚠️ ISTO E O QUE FURA O PRECACHE, e e o ponto inteiro da revalidacao.
 *
 * `gamedata.json` entra no precache do service worker (de proposito: sem ele o
 * app abre offline e nao calcula nada). So que rota de precache atende pela URL
 * EXATA — entao um `fetch` normal nunca chega no servidor, e a base fica
 * congelada na versao do service worker instalado. O Workbox so ignora
 * `utm_*` e `fbclid` ao casar; qualquer outro parametro nao casa e a busca
 * segue pra rede.
 *
 * O carimbo e o DIA, e nao o relogio: com `Date.now()` toda abertura seria um
 * endereco novo, o cache HTTP nunca acertaria e o app baixaria ~1,6 MB a cada
 * vez que fosse aberto. Com o dia, a primeira abertura baixa e as outras
 * respondem do cache do navegador — que e exatamente a cadencia que o rebuild
 * tem.
 */
function urlDoDia(url: string): string {
  const dia = new Date().toISOString().slice(0, 10);
  return `${url}${url.includes("?") ? "&" : "?"}d=${dia}`;
}

/** Qual dos dois e mais novo, pelo relogio do proprio jogo. */
function maisNovo(a: Dataset, b: Dataset): boolean {
  return Number(a.version.uploadTime) > Number(b.version.uploadTime);
}

/**
 * Carrega o dataset do jogo.
 *
 * ⚠️ DUAS BUSCAS, E A ORDEM IMPORTA.
 *
 * A primeira e a do precache: responde na hora, funciona offline, e e com ela
 * que a tela abre. A segunda vai a rede furando o precache e so troca o que
 * esta em uso se vier coisa MAIS NOVA — pelo `uploadTime`, o relogio do jogo,
 * entao nunca anda pra tras.
 *
 * A segunda existe porque sem ela o dado tinha a cadencia do CODIGO. O dataset
 * mora no precache; o precache pertence a um service worker; e o service worker
 * novo instala e fica PARADO esperando o botao de atualizar (`registerType:
 * "prompt"`). Quem adiasse esse aviso ficava com a base do dia da instalacao —
 * medido em aparelho de verdade: nove dias, com a propria tela de Ajustes
 * prometendo que a base "se refaz todo dia". Base e DADO, e dado nao devia
 * depender de alguem aceitar uma versao nova do app.
 *
 * Falha em silencio de propósito: sem rede, a primeira busca ja resolveu, e um
 * aviso de "nao consegui conferir se ha base nova" seria ruido sobre um app que
 * esta funcionando.
 *
 * Fonte de terceiro NAO leva o carimbo do dia: ela nao esta no precache (o
 * Workbox so pre-cacheia o que sai no build), entao ja chega pela rede — e
 * inventar parametro na URL de outra pessoa e pedir pra esbarrar em servidor
 * que responde 400 pro que nao conhece.
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
      const embarcado = await carregar(url);
      if (cancelled) return;

      if (!embarcado) {
        setState({
          status: "error",
          message: `dataset nao carregou de ${url}`,
        });
        return;
      }
      setState({ status: "ready", data: embarcado });

      // A partir daqui o app ja funciona. O resto e melhoria silenciosa.
      if (source !== null) return;
      const fresco = await carregar(urlDoDia(url));
      if (cancelled || !fresco) return;
      if (maisNovo(fresco, embarcado)) setState({ status: "ready", data: fresco });
    })();

    return () => {
      cancelled = true;
    };
  }, [source]);

  return state;
}

/**
 * O maior nível que uma especie pode APARENTAR — e não o maior que se compra.
 *
 * ⚠️ Existem dois tetos e confundi-los é o defeito que este acessor evita:
 *
 *   `version.levelCap` (50) é até onde dá pra PAGAR power-up. É o número do
 *   "PC máximo" e de todo custo — ninguém consegue investir além dele.
 *
 *   Este aqui (51) é até onde dá pra OBSERVAR. O Melhor Amigo soma um nível na
 *   hora da batalha e o jogo mostra o PC já com o bônus. Um solver de nível que
 *   parasse em 50 não acharia solução nenhuma pro especie mais investido da
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
 * O sintoma apareceu no contador da Especies: "Vistos: 9" com oito espécies. O
 * Venusaur entrava duas vezes, como `venusaur` (aberto no Modo lente) e como
 * `venusaur_normal` (o da coleção). Numa Especies o contador de vistos é metade
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

/**
 * Quando o APP montou esta base, e nao quando o jogo publicou o dado.
 *
 * ⚠️ SAO DOIS RELOGIOS, e a tela precisa dos dois.
 *
 * `uploadTime` e do jogo: muda quando a Niantic publica GAME_MASTER novo, e
 * pode ficar dias parado sem nada estar errado. `generatedAt` e do build: muda
 * todo dia, porque o rebuild e diario.
 *
 * Com so o primeiro na tela nao da pra distinguir "o jogo nao mudou" de "o meu
 * app parou de buscar" — e foi exatamente essa confusao que apareceu num
 * aparelho com a base congelada ha nove dias. Duas linhas respondem separado:
 * a de cima diz a idade do DADO, esta diz a do BUILD.
 */
export function datasetBuildLabel(version: Dataset["version"]): string | null {
  const d = new Date(version.generatedAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Quantos dias faz que o app montou esta base. `null` se nao der pra saber. */
export function buildIdadeDias(version: Dataset["version"]): number | null {
  const d = new Date(version.generatedAt);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

/**
 * Quantos dias tem a base, ou `null` se ela nao diz.
 *
 * ⚠️ "07/08" NAO RESPONDE "esta velha?", e era so isso que a tela mostrava.
 *
 * Um dia e um mes sao a mesma coisa pra quem bate o olho: `07/08` de dois dias
 * atras e `07/08` do ano passado se escrevem igual, e o segundo caso e o unico
 * que importa. O app inteiro se apoia na ideia de que a base envelhece sozinha
 * e de que voce pode apontar pra outra fonte (ver `data/source.ts`) — mas quem
 * apontou pra uma fonte de terceiro nao tinha como perceber que ela parou de
 * ser atualizada.
 *
 * Conta pelo `uploadTime` (o carimbo do PROPRIO jogo), e nao pelo `generatedAt`
 * (quando o meu ETL rodou), pelos dois motivos: e o mesmo relogio que a data
 * dd/MM ja usa — dizer "07/08" e "3 dias" a partir de relogios diferentes daria
 * um par que nao fecha — e o que interessa e a idade do DADO, nao a do meu
 * build.
 */
export function datasetIdadeDias(version: Dataset["version"]): number | null {
  const ms = Number(version.uploadTime);
  if (!Number.isFinite(ms)) return null;
  // Piso em zero: relogio do aparelho atrasado nao vira "base do futuro".
  return Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
}

/**
 * A partir de quantos dias a base merece um aviso.
 *
 * Trinta e o ponto em que o jogo ja mudou de temporada: chefe de raide novo,
 * ajuste de golpe, especie nova. Abaixo disso o dado velho da respostas
 * levemente desatualizadas; acima, da respostas sobre um jogo que nao existe
 * mais — e ai a tela precisa dizer, porque o numero errado com cara de certo e
 * pior que numero nenhum.
 */
export const DIAS_PRA_AVISAR = 30;
