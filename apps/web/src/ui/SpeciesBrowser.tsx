import { useDeferredValue, useMemo, useState } from "react";

import { computeCPAtLevel, rankDefenders } from "@trainerkit/core";

import { fold } from "../data/fold.ts";
import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { useT, type Key } from "../i18n/t.ts";
import { comElementoCompartilhado, tileDe } from "./transicao.ts";
import { useSetup } from "../onboarding/setup.ts";
import { typeKey } from "../sprites/provider.ts";
import { useCollection } from "../storage/collection.ts";
import { IconFilter, IconSearch } from "./Icons.tsx";
import { SpeciesTile } from "./SpeciesTile.tsx";

interface Props {
  data: Dataset;
  onPick: (s: DatasetSpecies) => void;
  /** Ordem inicial, quando a pessoa chegou por um atalho. */
  initialSort?: SortId;
  /**
   * So a busca, sem ordem nem filtro.
   *
   * Usado no primeiro passo do cadastro, onde a pergunta e "qual especie?" e a
   * resposta vem de digitar o nome. Oferecer dez ordens ali seria ruido no meio
   * de um fluxo de duas etapas.
   */
  simple?: boolean;
  /**
   * A busca mora FORA, e este componente so obedece.
   *
   * Na tela larga o documento de desktop poe titulo, seletor e busca numa barra
   * horizontal acima das duas colunas — e o campo nao pode viver aqui dentro,
   * que e a coluna da esquerda. Quando `busca` vem preenchido, este componente
   * para de desenhar o proprio campo e le o de fora.
   *
   * Sem os dois, tudo continua exatamente como era: campo proprio, estado
   * proprio. E o caminho do celular, e ele nao muda.
   */
  busca?: string | undefined;
  onBusca?: ((v: string) => void) | undefined;
}

/** Quantos resultados desenhar de uma vez. 1.182 tiles juntos travam o scroll. */
const PAGE = 60;

const PERFEITO = { atk: 15, def: 15, hp: 15 };

/**
 * Por que ordenar.
 *
 * "coloca uma opçÃO DE filtro ao invez de simplesmenre melhores. la no filtro
 * tem varias opcoes, puxar pelos melhores, maior pc, mais usados e etc"
 *
 * ⚠️ "MAIS USADOS" NAO ESTA AQUI, e a ausencia e proposital.
 *
 * O app nao tem, e nao tem como ter, dado sobre o que as pessoas usam. Isso
 * exigiria telemetria de jogadores reais — coisa que a Niantic/Scopely tem e nao
 * publica. Eu conseguiria montar uma lista "mais usados" que PARECE certa em
 * cinco minutos, chutando a partir dos rankings, e ela seria indistinguivel de
 * uma real pra quem le. Seria tambem a primeira mentira do app, e a partir dela
 * nenhum outro numero daqui mereceria credito.
 *
 * Todas as opcoes abaixo saem de conta feita sobre o GAME_MASTER, e cada uma diz
 * na tela de onde vem.
 */
export type SortId =
  | "dex"
  | "cp"
  | "raid"
  | "great"
  | "ultra"
  | "master"
  | "gym"
  | "atk"
  | "def"
  | "hp";

const SORTS: ReadonlyArray<{ id: SortId; labelKey: Key }> = [
  { id: "dex", labelKey: "filter.sort.dex" },
  { id: "cp", labelKey: "filter.sort.cp" },
  { id: "raid", labelKey: "filter.sort.raid" },
  { id: "gym", labelKey: "filter.sort.gym" },
  { id: "great", labelKey: "rank.league.great" },
  { id: "ultra", labelKey: "rank.league.ultra" },
  { id: "master", labelKey: "rank.league.master" },
  { id: "atk", labelKey: "filter.sort.atk" },
  { id: "def", labelKey: "filter.sort.def" },
  { id: "hp", labelKey: "filter.sort.hp" },
];

/** De onde sai cada ordem, em uma frase. A tela mostra a do escolhido. */
const SORT_WHY: Record<SortId, Key> = {
  dex: "filter.why.dex",
  cp: "filter.why.cp",
  raid: "filter.why.raid",
  gym: "filter.why.gym",
  great: "filter.why.league",
  ultra: "filter.why.league",
  master: "filter.why.league",
  atk: "filter.why.stat",
  def: "filter.why.stat",
  hp: "filter.why.stat",
};

/**
 * Busca, filtro e ordem — uma tela so.
 *
 * Antes eram duas listas atras de um seletor "Buscar | Melhores", e "melhores"
 * escondia quatro rankings diferentes atras de mais dois seletores. Agora e uma
 * lista que se reordena: a mesma pergunta ("qual Pokemon?") com a resposta
 * ordenada pelo que importa naquele momento.
 */
export function SpeciesBrowser({
  data,
  onPick,
  initialSort = "dex",
  simple = false,
  busca,
  onBusca,
}: Props) {
  const [queryInterna, setQueryInterna] = useState("");
  /* Controlado por fora quando `onBusca` existe; senao, estado proprio. */
  const controlado = onBusca !== undefined;
  const query = controlado ? (busca ?? "") : queryInterna;
  const setQuery = (v: string) => {
    if (controlado) onBusca(v);
    else setQueryInterna(v);
  };
  const [limit, setLimit] = useState(PAGE);
  const [sort, setSort] = useState<SortId>(initialSort);
  const [tipo, setTipo] = useState<string | null>(null);
  const [soMeus, setSoMeus] = useState(false);

  /**
   * O painel de filtro, fechado por padrão.
   *
   * `ativos` conta o que está mudando a lista AGORA — e a ordem só conta quando
   * não é a padrão, senão o ponto ficaria aceso desde a primeira abertura e
   * pararia de significar alguma coisa.
   */
  const [aberto, setAberto] = useState(false);
  const ativos = (tipo !== null ? 1 : 0) + (soMeus ? 1 : 0) + (sort !== initialSort ? 1 : 0);
  const { t, language } = useT();
  const { items } = useCollection();
  const setup = useSetup();

  // O campo responde na hora; a lista pode ficar um frame atras sem travar.
  const deferred = useDeferredValue(query);

  const indexed = useMemo(
    () =>
      data.species
        // Formas cosmeticas (fantasias, "_normal" redundante, padroes de Unown)
        // tem stats identicos aos da forma canonica: nao mudam veredito nenhum
        // e so poluiriam a busca com o mesmo nome repetido.
        .filter((s) => s.cosmeticOf === null)
        .map((s) => ({ s, key: fold(s.name), id: fold(s.id) })),
    [data.species],
  );

  /** Quais especies eu tenho, pra o filtro "so os meus". */
  const meus = useMemo(() => new Set((items ?? []).map((o) => o.speciesId)), [items]);

  /**
   * A nota de cada especie na ordem escolhida.
   *
   * Calculada de uma vez e guardada num Map: sem isso o `sort` chamaria a conta
   * duas vezes por comparacao — com 1.182 especies sao ~20.000 chamadas.
   */
  const notas = useMemo(() => {
    const m = new Map<string, number>();
    if (sort === "dex") return m;

    const listaDe = (chave: "great" | "ultra" | "master") =>
      data.rankings?.statProductByLeague[chave] ?? [];

    if (sort === "raid") {
      const lista = data.rankings?.raidOverall ?? [];
      lista.forEach((r, i) => m.set(r.speciesId, lista.length - i));
      return m;
    }

    if (sort === "great" || sort === "ultra" || sort === "master") {
      const lista = listaDe(sort);
      lista.forEach((r, i) => m.set(r.speciesId, lista.length - i));
      return m;
    }

    if (sort === "gym") {
      const ranked = rankDefenders(
        indexed.map(({ s }) => ({
          id: s.id,
          speciesId: s.id,
          name: s.name,
          types: s.types,
          baseStats: s.baseStats,
          ivs: PERFEITO,
          level: 40,
        })),
        data.cpm,
        data.typeChart,
        data.typeOrder,
      );
      for (const d of ranked) m.set(d.speciesId, d.score);
      return m;
    }

    for (const { s } of indexed) {
      m.set(
        s.id,
        sort === "cp"
          ? computeCPAtLevel(data.cpm, s.baseStats, PERFEITO, data.version.levelCap)
          : sort === "atk"
            ? s.baseStats.atk
            : sort === "def"
              ? s.baseStats.def
              : s.baseStats.hp,
      );
    }
    return m;
  }, [sort, indexed, data]);

  const results = useMemo(() => {
    const q = fold(deferred);

    let lista = indexed;
    if (tipo !== null) lista = lista.filter(({ s }) => s.types.includes(tipo));
    if (soMeus) lista = lista.filter(({ s }) => meus.has(s.id));

    let saida: DatasetSpecies[];
    if (q) {
      // Quem comeca com o termo vem antes de quem so o contem: digitar "char"
      // mostra Charmander antes de Chimchar.
      const starts: DatasetSpecies[] = [];
      const contains: DatasetSpecies[] = [];
      for (const { s, key, id } of lista) {
        if (key.startsWith(q) || id.startsWith(q)) starts.push(s);
        else if (key.includes(q) || id.includes(q)) contains.push(s);
      }
      saida = [...starts, ...contains];
    } else {
      saida = lista.map((x) => x.s);
    }

    if (sort === "dex") return saida.sort((a, b) => a.dex - b.dex);

    /*
     * Quem NAO tem nota vai pro fim, nao pro topo.
     *
     * Os rankings prontos so tem 40 ou 60 nomes; o resto do jogo nao aparece
     * neles. Sem este cuidado, ordenar por "melhor de raide" colocaria as mil
     * especies sem nota empatadas em zero na frente da lista.
     */
    return saida.sort((a, b) => {
      const na = notas.get(a.id);
      const nb = notas.get(b.id);
      if (na === undefined && nb === undefined) return a.dex - b.dex;
      if (na === undefined) return 1;
      if (nb === undefined) return -1;
      return nb - na || a.dex - b.dex;
    });
  }, [indexed, deferred, sort, notas, tipo, soMeus, meus]);

  const shown = results.slice(0, limit);
  const podeFiltrarMeus = setup.mode === "colecao" && meus.size > 0;

  return (
    <>
      {/*
        Busca e filtro na MESMA linha.

        "filtrar na pokedex fico estranho, devia ser um pouco melhor, mais
        compacto. um botaozinho que voce clica do lado da barra de pesquisa."

        Antes eram dois blocos de chips sempre abertos — ordem e tipo — ocupando
        meia tela acima da grade. Filtro é coisa que se usa de vez em quando e se
        lê o tempo todo: aberto por padrão, ele cobra espaço de quem só quer ver
        os Pokémon, que é o caso comum.

        O ponto no botão acende quando há filtro ativo. Sem isso, esconder o
        painel esconderia também o fato de a lista estar filtrada — e "cadê o
        Charizard" com um filtro de tipo esquecido é pior que o painel grande.
      */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {/* Com a busca la em cima, o campo daqui nao existe — mas o botao de
            filtro fica, porque ele e da LISTA e nao do cabecalho. */}
        <div
          className="tk-search"
          style={{ flex: 1, minWidth: 0, display: controlado ? "none" : undefined }}
        >
          <IconSearch size={18} />
          <input
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder={t("pokedex.searchPlaceholder")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            aria-label={t("pokedex.search")}
          />
        </div>

        {!simple && (
          <button
            type="button"
            className="tk-filter-btn"
            data-on={aberto || undefined}
            aria-expanded={aberto}
            aria-label={t("filter.filterBy")}
            onClick={() => setAberto((v) => !v)}
          >
            <IconFilter size={18} />
            {ativos > 0 && <span className="tk-filter-dot" aria-hidden="true" />}
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------ ordem */}

      {!simple && aberto && (
        <>
      <div className="tk-overline" style={{ display: "block", margin: "14px 0 6px" }}>
        {t("filter.sortBy")}
      </div>
      <div className="tk-chips">
        {SORTS.map((o) => (
          <button
            key={o.id}
            type="button"
            className="tk-chip"
            data-on={sort === o.id || undefined}
            aria-pressed={sort === o.id}
            onClick={() => {
              setSort(o.id);
              setLimit(PAGE);
            }}
          >
            {t(o.labelKey)}
          </button>
        ))}
      </div>

      {/* De onde vem a ordem escolhida. Ranking sem procedencia e opiniao. */}
      <p className="tk-caption" style={{ margin: "8px 2px 0", lineHeight: 1.45 }}>
        {t(SORT_WHY[sort], { cap: data.version.levelCap })}
        {sort !== "dex" && ` ${t("filter.noUsage")}`}
      </p>

      {/* ----------------------------------------------------------- filtros */}

      <div className="tk-overline" style={{ display: "block", margin: "16px 0 6px" }}>
        {t("filter.filterBy")}
      </div>
      <div className="tk-chips">
        <button
          type="button"
          className="tk-chip tk-chip--dim"
          data-on={tipo === null || undefined}
          onClick={() => {
            setTipo(null);
            setLimit(PAGE);
          }}
        >
          {t("rank.allTypes")}
        </button>
        {podeFiltrarMeus && (
          <button
            type="button"
            className="tk-chip tk-chip--dim"
            data-on={soMeus || undefined}
            aria-pressed={soMeus}
            onClick={() => {
              setSoMeus((v) => !v);
              setLimit(PAGE);
            }}
          >
            {t("filter.onlyMine")}
          </button>
        )}
        {data.typeOrder.map((tp) => (
          <button
            key={tp}
            type="button"
            className="tk-chip tk-chip--dim"
            data-on={tipo === tp || undefined}
            onClick={() => {
              setTipo(tipo === tp ? null : tp);
              setLimit(PAGE);
            }}
          >
            {t(typeKey(tp) as "type.normal")}
          </button>
        ))}
      </div>

        </>
      )}

      <p className="tk-caption" style={{ margin: "12px 2px 14px" }}>
        {results.length === 1
          ? t("pokedex.count.one")
          : t("pokedex.count.many", { count: results.length.toLocaleString(language) })}
      </p>

      {results.length === 0 ? (
        <div className="tk-empty">
          <div className="tk-empty-title">{t("pokedex.noResults", { query })}</div>
        </div>
      ) : (
        <>
          <ul className="tk-species-grid">
            {shown.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="tk-species-cell"
                  /* O tile viaja pro cabecalho da ficha. Ver `ui/transicao.ts`;
                     onde a API nao existe, abre sem animacao como antes. */
                  onClick={(e) => comElementoCompartilhado(tileDe(e), () => onPick(s))}
                >
                  <SpeciesTile
                    spriteId={s.spriteId}
                    dex={s.dex}
                    speciesId={s.id}
                    name={s.name}
                    types={s.types}
                    size={72}
                  />
                  <span className="tk-species-name">{s.name}</span>
                  {/*
                    O numero da linha muda com a ordem.

                    Em ordem de Pokedex o util e o numero da especie; ordenado por
                    PC ou por ranking, o util e a POSICAO — sem isso a pessoa nao
                    sabe se esta olhando o 3o ou o 300o.
                  */}
                  <span className="tk-species-dex">
                    {sort === "dex"
                      ? `#${String(s.dex).padStart(3, "0")}`
                      : `${i + 1}º`}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {limit < results.length && (
            <button
              type="button"
              className="tk-btn tk-btn--secondary tk-btn--block"
              style={{ marginTop: 18 }}
              onClick={() => setLimit((n) => n + PAGE * 2)}
            >
              {t("pokedex.showMore", {
                count: (results.length - limit).toLocaleString(language),
              })}
            </button>
          )}
        </>
      )}
    </>
  );
}
