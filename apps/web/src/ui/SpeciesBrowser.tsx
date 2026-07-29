import { useDeferredValue, useMemo, useState } from "react";

import type { DatasetSpecies } from "../data/useDataset.ts";
import { useT } from "../i18n/t.ts";
import { IconSearch } from "./Icons.tsx";
import { SpeciesTile } from "./SpeciesTile.tsx";

interface Props {
  species: DatasetSpecies[];
  onPick: (s: DatasetSpecies) => void;
}

/** Quantos resultados desenhar de uma vez. 1.182 tiles juntos travam o scroll. */
const PAGE = 60;

/** Ignora acento e pontuacao: "farfetchd" acha "Farfetch'd". */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marcas de acento, ja separadas pelo NFD
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

/**
 * Busca + grade de especies.
 *
 * Compartilhado entre a Pokedex (so consulta) e o cadastro na colecao. Ficarem
 * iguais nao e coincidencia: e a mesma pergunta, "qual Pokemon?".
 */
export function SpeciesBrowser({ species, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const { t, language } = useT();

  // O campo responde na hora; a lista pode ficar um frame atras sem travar.
  const deferred = useDeferredValue(query);

  const indexed = useMemo(
    () =>
      species
        // Formas cosmeticas (fantasias, "_normal" redundante, padroes de Unown)
        // tem stats identicos aos da forma canonica: nao mudam veredito nenhum
        // e so poluiriam a busca com o mesmo nome repetido.
        .filter((s) => s.cosmeticOf === null)
        .map((s) => ({ s, key: fold(s.name), id: fold(s.id) })),
    [species],
  );

  const results = useMemo(() => {
    const q = fold(deferred);
    if (!q) return indexed.map((x) => x.s);

    // Quem comeca com o termo vem antes de quem so o contem: digitar "char"
    // mostra Charmander antes de Chimchar.
    const starts: DatasetSpecies[] = [];
    const contains: DatasetSpecies[] = [];
    for (const { s, key, id } of indexed) {
      if (key.startsWith(q) || id.startsWith(q)) starts.push(s);
      else if (key.includes(q) || id.includes(q)) contains.push(s);
    }
    return [...starts, ...contains];
  }, [indexed, deferred]);

  const shown = results.slice(0, limit);

  return (
    <>
      <div className="tk-search">
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

      <p className="tk-caption" style={{ margin: "10px 2px 14px" }}>
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
            {shown.map((s) => (
              <li key={s.id}>
                <button type="button" className="tk-species-cell" onClick={() => onPick(s)}>
                  <SpeciesTile
                    spriteId={s.spriteId}
                    dex={s.dex}
                    speciesId={s.id}
                    name={s.name}
                    types={s.types}
                    size={72}
                  />
                  <span className="tk-species-name">{s.name}</span>
                  <span className="tk-species-dex">#{String(s.dex).padStart(3, "0")}</span>
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
