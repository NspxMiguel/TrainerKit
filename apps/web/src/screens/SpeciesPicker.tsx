import { useEffect } from "react";
import { createPortal } from "react-dom";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { useT } from "../i18n/t.ts";
import { SpeciesBrowser } from "../ui/SpeciesBrowser.tsx";

interface Props {
  data: Dataset;
  onPick: (s: DatasetSpecies) => void;
  onClose: () => void;
}

/** Primeiro passo do cadastro: qual especie. Reusa a mesma busca da Pokedex. */
export function SpeciesPicker({ data, onPick, onClose }: Props) {
  const { t } = useT();
  // Trava o scroll do fundo enquanto a folha esta aberta.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portal para o body: dentro de `.tk-main` a animacao deixa um transform
  // residual que cria contexto de empilhamento, e a folha ficaria PRESA embaixo
  // da barra de abas por mais z-index que levasse.
  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label={t("pokedex.whichPokemon")}>
      <header className="tk-sheet-head">
        <button type="button" className="tk-sheet-close" onClick={onClose} aria-label={t("common.close")}>
          ‹
        </button>
      </header>
      <h1 className="tk-h1">{t("pokedex.whichPokemon")}</h1>

      <SpeciesBrowser data={data} onPick={onPick} simple />
    </div>,
    document.body,
  );
}
