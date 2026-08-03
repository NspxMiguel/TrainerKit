import { useState } from "react";

import type { PokedexIntent } from "../App.tsx";
import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { useLanguage } from "../i18n/language.ts";
import { useT } from "../i18n/t.ts";
import { useCollection } from "../storage/collection.ts";
import { detectPlatform } from "../storage/install.ts";
import { IconGrid, IconList } from "../ui/Icons.tsx";
import { setEmGrade, useEmGrade } from "../ui/vistaColecao.ts";
import { SpeciesBrowser, type SortId } from "../ui/SpeciesBrowser.tsx";
import { useSetup } from "../onboarding/setup.ts";
import { Esqueleto, Offline } from "../ui/Estados.tsx";
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

  /*
   * As contagens do seletor. Ver a nota no `options` do `Segmented`.
   *
   * "Todos" conta so as especies CANONICAS: `cosmeticOf` marca variacoes
   * cosmeticas (fantasia, padrao de Unown), que tem stats identicos e ja ficam
   * fora da busca. Conta-las aqui daria um numero que nao bate com a lista que
   * a pessoa ve rolando logo abaixo.
   */
  const { items } = useCollection();
  const language = useLanguage();
  const totalEspecies =
    dataset.status === "ready"
      ? dataset.data.species.filter((s) => !s.cosmeticOf).length
      : 0;
  const totalMeus = items?.length ?? 0;

  if (dataset.status === "loading") {
    return (
      <>
        <h1 className="tk-h1">{t("pokedex.title")}</h1>
        {/* Esqueleto com a geometria da lista real, e nao uma frase: sem isso
            a tela saltava quando os dados chegavam. Ver `ui/Estados.tsx`. */}
        <Esqueleto linhas={6} />
      </>
    );
  }

  if (dataset.status === "error") {
    return (
      <>
        <h1 className="tk-h1">{t("pokedex.title")}</h1>
        {/* Cartao ambar que diz que os vereditos CONTINUAM VALENDO: sem rede o
            app funciona, porque o dataset esta no aparelho. Ver `ui/Estados.tsx`. */}
        <Offline detalhe={dataset.message} />
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
              /*
                ⚠️ COM A CONTAGEM, como o handoff pede ("Todos · 1.182 / Meus ·
                247").

                Nao e enfeite: o numero responde antes do toque. "Meus" sem
                contagem obriga a pessoa a entrar pra descobrir se ha algo la —
                e num app cuja tese e decidir por voce, fazer entrar pra
                descobrir e o oposto do trabalho.
              */
              options={[
                {
                  value: "todos" as const,
                  label: `${t("pokedex.all")} · ${totalEspecies.toLocaleString(language)}`,
                },
                {
                  value: "meus" as const,
                  label: `${t("pokedex.mine")} · ${totalMeus.toLocaleString(language)}`,
                },
              ]}
            />
          </div>
          {meus && (
            /*
             * ⚠️ COM A PALAVRA, e não só o ícone.
             *
             * "esse botao nao faz nada, tira ou da uma função pra ele bro."
             *
             * Ele faz — medi: alterna lista e grade, e o estado persiste. O que
             * não funcionava era ELE CONTAR o que faz. Um ícone mudo de 44px no
             * canto, cuja consequência acontece abaixo da dobra numa coleção
             * curta: toca, nada muda na altura dos olhos, e a conclusão certa a
             * tirar é a que ele tirou.
             *
             * Com o rótulo, o botão promete antes de agir — e a promessa é
             * conferível sem rolar. Tirar seria jogar fora uma vista que ele
             * mesmo pediu ("#43 coleção com cara de Pokédex de verdade").
             */
            <button
              type="button"
              className="tk-filter-btn tk-filter-btn--rotulo"
              aria-label={t(emGrade ? "collection.asList" : "collection.asGrid")}
              onClick={() => setEmGrade(!emGrade)}
            >
              {emGrade ? <IconList size={17} /> : <IconGrid size={17} />}
              <span>{t(emGrade ? "collection.asListShort" : "collection.asGridShort")}</span>
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
      {/*
        O cartao do Modo Pokedex, na receita do handoff: "tile vermelho 48px
        (raio 16, gradiente #F87171→#DC2626) com a lente desenhada em SVG,
        título 16/700, subtítulo 12,5px, chevron".

        ⚠️ O VERMELHO E DO APARELHO, e nao do app. E o unico lugar da interface
        que nao segue a cor da especie em destaque — de propósito: este cartao
        anuncia um OBJETO, e um objeto que muda de cor com o Pokemon da vez
        deixa de parecer um objeto.
      */}
      {/*
        ⚠️ NAO EXISTE NO COMPUTADOR.

        "modo pokedex nem faz sentido no computador..."

        E nao faz mesmo, e o motivo esta na propria tela: o aparelho e uma coisa
        que se SEGURA. Ele desenha a carcaca vermelha em volta de um visor, abre
        a camera traseira pra pessoa APONTAR pra alguma coisa e le a ficha em voz
        alta. Num monitor, apontar e segurar nao existem — sobra um desenho de
        aparelho parado no meio da tela pedindo permissao de webcam.

        O porteiro e `desktop` e nao "tela grande" de proposito: o iPad continua
        tendo o modo, deitado inclusive, porque um iPad E um aparelho que se
        segura e aponta. O que muda a resposta e o formato do aparelho, nao
        quantos pixels ele tem.

        `detectPlatform()` e chamado direto, sem hook: a plataforma nao muda
        durante a sessao — trocar de computador pra iPad no meio do uso nao e uma
        coisa que aconteca.
      */}
      {detectPlatform() !== "desktop" && (
      <button type="button" className="tk-dexopen" onClick={() => setDexOpen(true)}>
        <span className="tk-dexopen-tile" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="10.5" fill="#EAF2FF" stroke="rgba(0,0,0,.28)" />
            <circle cx="13" cy="13" r="7.5" fill="url(#tk-lente)" />
            <circle cx="10" cy="10" r="2.6" fill="#fff" fillOpacity=".85" />
            <defs>
              <radialGradient id="tk-lente" cx="0.35" cy="0.3" r="0.85">
                <stop offset="0" stopColor="#9CD4FF" />
                <stop offset="1" stopColor="#1D4ED8" />
              </radialGradient>
            </defs>
          </svg>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="tk-dexopen-t">{t("dex.open")}</span>
          <span className="tk-dexopen-d">{t("dex.openDetail")}</span>
        </span>
        <span className="tk-dexopen-chevron" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>
      )}

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
