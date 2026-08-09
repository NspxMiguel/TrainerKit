/**
 * PRA QUE ESTE POKEMON SERVE — raide, PvP, ou nada.
 *
 * O pedido, com as palavras dele: *"coloca nos pokemon tbm, sujestao para oq
 * usar, reid, pvp e etc"*. A ficha ja dizia o FORMATO do bicho ("Bate forte",
 * "Aguenta pancada") via `opine`, que e leitura de stat base; o que faltava era
 * a frase seguinte, a que o jogador realmente quer: onde eu ponho isso.
 *
 * ── Por que ler dos rankings, e nao dos stats ──────────────────────────────
 *
 * "Ataque alto" nao e resposta. Dragonite tem ataque alto e nao entra em raide
 * nenhuma hoje, porque ha vinte bichos melhores no mesmo tipo; Azumarill tem
 * ataque baixo e e um dos melhores da Grande Liga. Formato de stat nao decide
 * uso — POSICAO decide, e o ETL ja calcula as duas listas que importam:
 * `raidOverall` (dano contra um chefe neutro, com o melhor moveset) e
 * `statProductByLeague` (produto de stats no teto de cada liga).
 *
 * Entao aqui nao se calcula nada novo: procura-se o bicho nas listas que ja
 * existem e traduz-se a posicao em recomendacao. O app inteiro depende de dizer
 * de onde vem o numero, e este arquivo nao abre excecao — todo `Uso` carrega a
 * posicao e o tamanho da lista, pra tela poder mostrar "#14 de 812" ao lado da
 * frase em vez de pedir fe.
 */

export type UsoOnde = "raide" | "great" | "ultra" | "master";

/**
 * Quao bom ele e naquilo.
 *
 * `nao` nao e devolvido: um uso ruim simplesmente nao entra na lista. Uma ficha
 * que diz "Grande Liga: ruim. Ultra: ruim. Mestre: ruim." e tres linhas pra
 * comunicar uma, e das tres a pessoa so le a palavra repetida.
 */
export type UsoNivel = "topo" | "bom" | "serve";

export interface Uso {
  onde: UsoOnde;
  nivel: UsoNivel;
  /** Posicao na lista, comecando em 1. */
  posicao: number;
  /**
   * Tamanho da lista PUBLICADA, nao da populacao.
   *
   * ⚠️ O ETL corta: `raidOverall` sai com 30 e cada liga com 60. Entao `total`
   * e "quantos entraram no ranking", nao "quantas especies existem" — a tela
   * tem que dizer *"#9 entre os 30 melhores"*, nunca *"#9 de 30"*, que leria
   * como se o jogo tivesse trinta Pokemon.
   */
  total: number;
}

/**
 * Os cortes, em posicao ABSOLUTA e nao em porcentagem.
 *
 * Percentil mentiria: o dataset tem ~800 especies rankeaveis, entao "top 10%"
 * sao oitenta bichos, e o octogesimo melhor atacante de raide nao serve pra
 * raide nenhuma — quem monta um grupo leva seis. Os numeros abaixo sao o que o
 * jogo pede na pratica: seis pra encher um grupo de raide (com folga, 15), tres
 * pra um time de PvP (com folga, 30).
 */
const CORTES: Record<UsoNivel, number> = {
  topo: 15,
  bom: 30,
  serve: 60,
};

export interface ListasDeUso {
  readonly raidOverall?: readonly { readonly speciesId: string }[];
  readonly statProductByLeague?: Readonly<
    Record<"great" | "ultra" | "master", readonly { readonly speciesId: string }[]>
  >;
}

function achar(
  onde: UsoOnde,
  lista: readonly { readonly speciesId: string }[] | undefined,
  speciesId: string,
): Uso | null {
  if (!lista || lista.length === 0) return null;
  const i = lista.findIndex((r) => r.speciesId === speciesId);
  if (i < 0) return null;

  const posicao = i + 1;
  const nivel: UsoNivel | null =
    posicao <= CORTES.topo
      ? "topo"
      : posicao <= CORTES.bom
        ? "bom"
        : posicao <= CORTES.serve
          ? "serve"
          : null;
  if (!nivel) return null;

  return { onde, nivel, posicao, total: lista.length };
}

/**
 * Onde vale a pena usar esta especie, do melhor uso pro pior.
 *
 * Devolve vazio quando ela nao passa de 60 em lista nenhuma — e a resposta
 * honesta pra maioria do dex, e a tela mostra "so pra Pokedex" em vez de
 * inventar uma serventia.
 *
 * ⚠️ As tres ligas podem sair juntas, e isso e de proposito. Um bicho que joga
 * as tres e uma informacao real e util; cortar pra "so a melhor" esconderia que
 * ele acompanha o treinador a campanha inteira. Quem quiser uma linha so usa o
 * primeiro item, que ja vem sendo o melhor.
 */
export function usos(speciesId: string, listas: ListasDeUso | undefined): Uso[] {
  if (!listas) return [];

  const achados = [
    achar("raide", listas.raidOverall, speciesId),
    achar("great", listas.statProductByLeague?.great, speciesId),
    achar("ultra", listas.statProductByLeague?.ultra, speciesId),
    achar("master", listas.statProductByLeague?.master, speciesId),
  ].filter((u): u is Uso => u !== null);

  // Melhor primeiro. Empate no nivel desempata pela posicao — entre "#3 de
  // raide" e "#12 na Grande Liga" o destaque tem que ser o 3.
  const peso: Record<UsoNivel, number> = { topo: 0, bom: 1, serve: 2 };
  return achados.sort((a, b) => peso[a.nivel] - peso[b.nivel] || a.posicao - b.posicao);
}
