import { useState } from "react";

import type { PokedexIntent } from "../App.tsx";
import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { useT } from "../i18n/t.ts";
import { IconCamera, IconGrid, IconList } from "../ui/Icons.tsx";
import { setEmGrade, useEmGrade } from "../ui/vistaColecao.ts";
import { SpeciesBrowser, type SortId } from "../ui/SpeciesBrowser.tsx";
import { useSetup } from "../onboarding/setup.ts";
import { Segmented } from "../ui/Segmented.tsx";
import { CollectionScreen } from "./CollectionScreen.tsx";
import { DexMode } from "./DexMode.tsx";
import { SpeciesDetail } from "./SpeciesDetail.tsx";

interface Props {
  dataset: DatasetState;
  /** De onde a pessoa veio, quando veio por um atalho da home. */
  intent?: PokedexIntent | null;
}

/**
 * Modo consulta.
 *
 * Existe porque nem todo mundo quer cadastrar colecao: as vezes a pergunta e so
 * "esse Pokemon presta?". Aqui a resposta sai sem cadastro nenhum, sem conta e
 * sem passo intermediario.
 */
export function PokedexScreen({ dataset, intent }: Props) {
  const [selected, setSelected] = useState<DatasetSpecies | null>(null);
  const [dexOpen, setDexOpen] = useState(false);
  const { t } = useT();
  const setup = useSetup();

  /*
   * TODOS ou MEUS, na mesma aba.
   *
   * "o colection n seria mais legal, se ele fizesse parte do pokedex mode?
   * faria muito mais sentido nao acha??" — faria, e ele estava certo sobre o
   * problema: o app separava em duas abas o que e UMA pergunta ("qual
   * Pokémon?"), e a Pokédex do jogo mostra visto e capturado no mesmo lugar.
   *
   * ⚠️ O QUE EU **NAO** FIZ, e por que: nao dava pra simplesmente usar o filtro
   * "Só os meus" que ja existia. Ele filtra ESPECIES; a colecao lista
   * EXEMPLARES. Quem tem tres Bulbasaur com IV diferente ve um so no filtro, e o
   * IV e o veredito — que sao a razao de a colecao existir — nao teriam onde
   * aparecer. Merge ingenuo aqui perderia informacao em silencio.
   *
   * Entao sao duas listas de verdade, atras de um seletor: "Todos" percorre o
   * jogo inteiro, "Meus" mostra os seus com IV e veredito. Uma aba, uma
   * pergunta, duas respostas.
   */
  const podeColecao = setup.mode === "colecao";
  // Quem chegou pelo `+3` da home pediu OS SEUS; abrir em "Todos" seria
  // responder outra pergunta. O `key={tab}` na `App` remonta esta tela a cada
  // troca de aba, entao o valor inicial e lido de novo em toda navegacao.
  const [aba, setAba] = useState<"todos" | "meus">(
    podeColecao && intent?.view === "mine" ? "meus" : "todos",
  );
  const meus = podeColecao && aba === "meus";
  const emGrade = useEmGrade();

  if (dataset.status === "loading") {
    return (
      <>
        <h1 className="tk-h1">{t("pokedex.title")}</h1>
        <p className="tk-body">{t("common.loadingGameData")}</p>
      </>
    );
  }

  if (dataset.status === "error") {
    return (
      <>
        <h1 className="tk-h1">{t("pokedex.title")}</h1>
        <p className="tk-body">{t("pokedex.loadError", { message: dataset.message })}</p>
      </>
    );
  }

  return (
    <>
      <h1 className="tk-h1">{t("pokedex.title")}</h1>

      {podeColecao && (
        /*
          O seletor e o alternador de vista na MESMA linha.
          
          O alternador vivia dentro da Colecao, ao lado do titulo dela. Sem o
          titulo (a Colecao esta embutida aqui), ele ficava sozinho com quase
          300px de vazio ao lado. Aqui ele fica junto do "Todos/Meus", que e
          onde as escolhas de vista desta tela ja moram — e so aparece em
          "Meus", porque a lista de "Todos" ja tem grade fixa.
        */
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Segmented
              ariaLabel={t("pokedex.title")}
              value={aba}
              onChange={setAba}
              size="compact"
              options={[
                { value: "todos" as const, label: t("pokedex.all") },
                { value: "meus" as const, label: t("pokedex.mine") },
              ]}
            />
          </div>
          {meus && (
            <button
              type="button"
              className="tk-filter-btn"
              aria-label={t(emGrade ? "collection.asList" : "collection.asGrid")}
              title={t(emGrade ? "collection.asList" : "collection.asGrid")}
              onClick={() => setEmGrade(!emGrade)}
            >
              {emGrade ? <IconList size={18} /> : <IconGrid size={18} />}
            </button>
          )}
        </div>
      )}

      {/*
        O modo Pokedex mora AQUI, e nao na home.
        
        Ele estava como um dos tres botoes de acao da tela inicial, chamado
        "Pokédex" — do lado de uma ABA chamada Pokédex. O Miguel: "2 funcoes com
        o msm nome, pokedex e pokedex". Era a mesma redundancia que ele ja tinha
        apontado nos atalhos, e eu criei de novo.

        Aqui nao ha duas: a aba e a Pokedex, e este botao abre o APARELHO — que e
        outra coisa que a mesma aba faz, no lugar onde a pessoa ja esta olhando
        Pokemon.
      */}
      <button
        type="button"
        className="tk-dexopen"
        onClick={() => setDexOpen(true)}
      >
        <span className="tk-dexopen-lens" aria-hidden="true" />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="tk-dexopen-t">{t("dex.open")}</span>
          <span className="tk-dexopen-d">{t("dex.openDetail")}</span>
        </span>
        <IconCamera size={20} />
      </button>

      {/*
        Uma lista so, que se reordena.

        Eram duas atras de "Buscar | Melhores", e "Melhores" escondia quatro
        rankings atras de mais dois seletores — o Miguel: "coloca uma opção de
        filtro ao invés de simplesmente melhores". E a mesma pergunta ("qual
        Pokemon?") com a resposta ordenada pelo que importa naquele momento.
      */}
      {meus ? (
        <CollectionScreen dataset={dataset} embutida />
      ) : (
        <SpeciesBrowser
          data={dataset.data}
          onPick={setSelected}
          {...(intent?.view === "best"
            ? { initialSort: (intent.mode === "raid" ? "raid" : "great") as SortId }
            : {})}
        />
      )}

      {dexOpen && (
        <DexMode
          data={dataset.data}
          onClose={() => setDexOpen(false)}
          onOpenSpecies={(s) => {
            setDexOpen(false);
            setSelected(s);
          }}
          // O aparelho fecha e a aba ja esta em "Meus": os capturados que ele
          // contava sao os mesmos desta lista, entao nao ha tela nova nenhuma
          // pra manter — so parar de esconder a que ja existe.
          onOpenMine={
            podeColecao
              ? () => {
                  setDexOpen(false);
                  setAba("meus");
                }
              : undefined
          }
        />
      )}

      {selected && (
        <SpeciesDetail
          species={selected}
          data={dataset.data}
          onClose={() => setSelected(null)}
          onPickSpecies={setSelected}
        />
      )}
    </>
  );
}
