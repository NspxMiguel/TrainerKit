import { useEffect, useState, type CSSProperties } from "react";

import { datasetLabel, useDataset, type DatasetSpecies } from "./data/useDataset.ts";
import { Onboarding } from "./onboarding/Onboarding.tsx";
import { useSetup } from "./onboarding/setup.ts";
import { CollectionScreen } from "./screens/CollectionScreen.tsx";
import { HomeScreen } from "./screens/HomeScreen.tsx";
import { PokedexScreen } from "./screens/PokedexScreen.tsx";
import { SettingsScreen } from "./screens/SettingsScreen.tsx";
import { useLanguage } from "./i18n/language.ts";
import { useT, type Key } from "./i18n/t.ts";
import { detectPlatform } from "./storage/install.ts";
import { requestPersistence, type PersistState } from "./storage/persist.ts";
import { IVCalculator } from "./screens/IVCalculator.tsx";
import { RaidCounters } from "./screens/RaidCounters.tsx";
import { SpeciesPicker } from "./screens/SpeciesPicker.tsx";
import { TeamBuilder } from "./screens/TeamBuilder.tsx";
import { useOffline } from "./storage/offline.ts";
import { usePendencias } from "./storage/pendencias.ts";
import {
  IconCamera,
  IconGearFill,
  IconGridFill,
  IconHomeFill,
  IconShield,
  IconSwords,
} from "./ui/Icons.tsx";
import { SpriteDownloadPanel, SpriteDownloadStrip } from "./ui/SpriteDownload.tsx";
import { UpdateBanner } from "./ui/UpdateBanner.tsx";
import { fecharFolhaDeCima, useTemFolha } from "./ui/folha.ts";
import { useTabBarMinimize } from "./ui/useTabBarMinimize.ts";

/*
 * Tres abas, nao quatro.
 *
 * A Colecao virou um modo DENTRO da Pokedex ("Todos" / "Meus"). Ver a nota em
 * `PokedexScreen`: as duas abas respondiam a mesma pergunta, e a Pokedex do jogo
 * mostra visto e capturado no mesmo lugar.
 *
 * `"colecao"` sai do tipo de propósito: assim o compilador aponta qualquer lugar
 * que ainda tente navegar pra ela, em vez de a navegacao falhar calada.
 */
export type Tab = "inicio" | "pokedex" | "ajustes";

/**
 * Com que pergunta a pessoa chegou na Pokedex.
 *
 * Os atalhos da home diziam "Raide · Melhores atacantes por tipo" e abriam a
 * BUSCA — a lista de espécies em ordem de número, que não é o que o atalho
 * prometeu. Levar junto a intenção é o que faz o atalho chegar onde diz.
 */
export type PokedexIntent =
  | { view: "browse" }
  | { view: "best"; mode: "raid" | "pvp" }
  /**
   * "os MEUS", nao a especie.
   *
   * O `+3` no fim da fila da home dizia "mais tres SEUS" e abria a Pokedex em
   * "Todos" — a lista das 1.000 especies do jogo, onde os seus tres nao estao
   * em lugar nenhum. Era a mesma falha dos atalhos antigos: o botao prometia um
   * destino e a navegacao entregava outro, porque so o nome da aba viajava.
   */
  | { view: "mine" };

const TABS: ReadonlyArray<{
  id: Tab;
  labelKey: Key;
  Icon: typeof IconHomeFill;
}> = [
  { id: "inicio", labelKey: "nav.home", Icon: IconHomeFill },
  // Consulta pura, sem cadastro: nem todo mundo quer catalogar a colecao, as
  // vezes a pergunta e so "esse Pokemon presta?".
  { id: "pokedex", labelKey: "nav.pokedex", Icon: IconGridFill },
  { id: "ajustes", labelKey: "nav.settings", Icon: IconGearFill },
];

export function App() {
  const [tab, setTab] = useState<Tab>("inicio");
  const [intent, setIntent] = useState<PokedexIntent | null>(null);

  const go = (next: Tab, withIntent?: PokedexIntent) => {
    setTab(next);
    setIntent(withIntent ?? null);
  };
  const { t } = useT();
  const language = useLanguage();
  const setup = useSetup();
  const dataset = useDataset();
  const [persist, setPersist] = useState<PersistState | null>(null);
  /* O selo do documento de desktop: "Pokédex 4". A regra de "pede decisão" mora
     em `storage/pendencias.ts` — a mesma que a fila da Home lê. */
  const pendencias = usePendencias(dataset);
  const offline = useOffline(
    dataset.status === "ready" ? dataset.data.species.length : 0,
    dataset.status,
  );

  useEffect(() => {
    void requestPersistence().then(setPersist);
  }, []);

  // O recolhimento e comportamento do iOS 26. No Android a barra do Material e
  // assente e nao se mexe — recolher la pareceria bug, nao refinamento.
  const minimized = useTabBarMinimize(detectPlatform() === "iphone");

  /*
   * A barra some quando uma folha de tela cheia esta aberta.
   *
   * Regra do redesenho, e ela tem motivo tecnico: a barra flutua com vidro
   * proprio, e vidro mostra o que esta ATRAS. Com uma folha por cima, o "atras"
   * vira a folha, e a barra fica sendo uma mancha borrada no canto.
   */
  const temFolha = useTemFolha();

  const species = dataset.status === "ready" ? dataset.data.species : [];

  /*
   * As FERRAMENTAS da barra lateral — só existem na tela larga.
   *
   * "sidebar fixa (Início/Pokédex/Ajustes + acesso direto a Calculadora de
   * IV/Raide/Montar time)", do `TrainerKit Desktop.dc.html`.
   *
   * ⚠️ QUEM ESCONDE NO CELULAR É O CSS, e não um `if` aqui. O handoff é
   * explícito: "não duplique lógica — é a mesma tela reagindo ao espaço
   * disponível, não uma segunda tela". Com `display: none` o leitor de tela
   * também não anuncia, que é o que um `if` daria de bom — sem o custo de a
   * navegação existir em duas versões que precisam ser mantidas iguais.
   *
   * ⚠️ DUAS DELAS PRECISAM DE UMA ESPÉCIE, e é por isso que existe o `pedindo`.
   * `RaidCounters` recebe `boss` e `IVCalculator` recebe `species` — abrir
   * qualquer uma das duas "no vazio" não é possível nem faria sentido: a
   * pergunta delas é sempre sobre um Pokémon. Então a ferramenta abre o
   * `SpeciesPicker` que a coleção já usa, e só então a tela. "Montar time" não
   * pede nada porque a pergunta dela é sobre a coleção inteira.
   */
  const [ferramenta, setFerramenta] = useState<"calc" | "raide" | "time" | null>(null);
  const [pedindo, setPedindo] = useState<"calc" | "raide" | null>(null);
  const [alvo, setAlvo] = useState<DatasetSpecies | null>(null);

  const abrirFerramenta = (qual: "calc" | "raide" | "time") => {
    if (qual === "time") {
      setFerramenta("time");
      return;
    }
    setPedindo(qual);
  };

  const fecharFerramenta = () => {
    setFerramenta(null);
    setAlvo(null);
  };

  /*
   * As tres abas sempre aparecem.
   *
   * Antes a aba Colecao era escondida no modo consulta (`setup.mode !==
   * "colecao"`). Ela nao existe mais como aba — virou o modo "Meus" DENTRO da
   * Pokedex — e quem esconde esse modo agora e a propria `PokedexScreen`, que e
   * quem sabe se ha colecao pra mostrar.
   */
  const visibleTabs = TABS;
  const activeIndex = visibleTabs.findIndex((x) => x.id === tab);

  return (
    <div className="tk-app">
      <div className="tk-shell">
        <main className="tk-main" key={tab}>
          {/* Antes de qualquer tela: se ha versao nova, e a primeira coisa que
              importa — e a unica que explica por que o resto pode estar velho. */}
          <UpdateBanner />
          {tab === "inicio" && (
            <HomeScreen dataset={dataset} persist={persist} onGo={go} />
          )}
          {tab === "pokedex" && <PokedexScreen dataset={dataset} intent={intent} />}
          {tab === "ajustes" && (
            <SettingsScreen
              datasetLabel={
                dataset.status === "ready" ? datasetLabel(dataset.data.version) : null
              }
              persist={persist}
              species={species}
              sources={dataset.status === "ready" ? dataset.data.sources : undefined}
            />
          )}
        </main>

        <SpriteDownloadStrip />

        {/* Apaga o conteudo pouco antes de ele passar por tras do vidro — o
            "scroll edge effect" que a Apple usa nas barras do sistema. */}
        <div className="tk-scroll-edge" aria-hidden="true" />

        <nav
          className="tk-tabbar"
          data-min={minimized || undefined}
          /*
           * ⚠️ O SETUP TAMBEM ESCONDE A BARRA, e nao escondia.
           *
           * `.tk-onb` e `z-index: 20` e a barra e 50: no celular ela ficava
           * flutuando POR CIMA da primeira tela do app, tapando o botao de
           * avancar. Apareceu quando o passo do nivel deixou aquela tela mais
           * alta, mas o defeito nao e do passo — a barra sempre esteve por cima,
           * so que ate entao sobrava vazio embaixo do botao pra disfarcar.
           *
           * A regra ja existia e so nao cobria este caso: a barra some quando ha
           * uma tela cheia por cima. O onboarding e uma, e ainda por cima e a
           * unica em que as tres abas nao levam a lugar nenhum — nada foi
           * configurado ainda.
           */
          data-oculta={temFolha || !setup.done || undefined}
          aria-hidden={temFolha || !setup.done || undefined}
          aria-label={t("nav.aria")}
          style={{
            /*
              So variaveis aqui, nunca propriedade final.
              
              Antes isto escrevia `gridTemplateColumns` direto, e estilo inline
              ganha de media query: na tela grande, onde a barra vira coluna
              unica, a regra do CSS era simplesmente ignorada e a barra
              continuava com tres colunas espremidas. Quem decide o layout e a
              folha de estilo; o React so informa quantas abas ha e qual esta
              ativa — que sao dados, nao layout.
            */
            "--tk-tabs": visibleTabs.length,
            "--tk-tab-i": Math.max(0, activeIndex),
          } as CSSProperties}
        >
          {/*
            A lente de vidro, que VIAJA.
            
            "ele vai de inicio, se vc clicou em pokedex se arrastando pro lado"
            — e o documento de animacao do desenho concorda: "a lente de vidro
            viaja entre os itens em 420ms".
            
            Minha primeira versao seguiu o mockup ESTATICO, onde cada item
            acende no lugar: a bolha aparecia no destino em vez de ir ate ele.
            Parecia certo em screenshot e errado em uso.
          */}
          {/*
            A MARCA no topo da barra — so na tela larga.

            "TrainerKit" com o tile de 34px ao lado, do documento de desktop. No
            celular a barra e uma capsula de tres abas no rodape: nao ha topo, e
            um nome ali comeria o espaco das proprias abas. Some pelo CSS, como
            as FERRAMENTAS.

            ⚠️ O DESENHO DO TILE E O ICONE ATUAL, e nao o ovo do handoff. O ovo
            e a marca escolhida, mas ele so existe como SVG com paths bezier — e
            o gerador de icones deste repo desenha proceduralmente, sem
            rasterizador de path. Ate isso ser resolvido, repetir aqui o icone
            que o app ja usa e honesto; inventar um terceiro desenho nao.
          */}
          <div className="tk-side-marca">
            <span className="tk-side-marca-tile" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="tk-side-marca-nome">TrainerKit</span>
          </div>

          <span className="tk-tab-bolha" aria-hidden="true" />
          {visibleTabs.map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              type="button"
              className="tk-tab"
              aria-current={tab === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon size={20} />
              {/* Rotulo sempre visivel: o prototipo proibe icone sem rotulo na navegacao. */}
              <span className="tk-tab-label">{t(labelKey)}</span>
              {/*
                O selo so existe na Pokedex, so quando ha o que decidir, e so na
                barra lateral (o CSS o esconde no celular, onde a aba tem 50px
                de altura e nao ha onde por um numero sem apertar o rotulo).

                `aria-hidden`: o numero ja e dito pelo proprio destino — quem
                entra na Pokedex ve "1 pede uma decisão" escrito. Anuncia-lo na
                aba faria o leitor de tela ler "Pokédex 4", que soa como o nome
                da aba.
              */}
              {id === "pokedex" && pendencias > 0 && (
                <span className="tk-tab-selo" aria-hidden="true">
                  {pendencias.toLocaleString(language)}
                </span>
              )}
            </button>
          ))}

          {/* Ver a nota longa em `abrirFerramenta`: isto some no celular pelo
              CSS, não por condição aqui. */}
          <div className="tk-side-tools">
            <p className="tk-side-legenda">{t("side.tools")}</p>
            <button type="button" className="tk-side-tool" onClick={() => abrirFerramenta("calc")}>
              <IconCamera size={17} />
              <span>{t("side.calc")}</span>
            </button>
            <button type="button" className="tk-side-tool" onClick={() => abrirFerramenta("raide")}>
              <IconShield size={17} />
              <span>{t("side.raid")}</span>
            </button>
            <button type="button" className="tk-side-tool" onClick={() => abrirFerramenta("time")}>
              <IconSwords size={17} />
              <span>{t("side.team")}</span>
            </button>
          </div>

          {/*
            ⚠️ O SELO SÓ APARECE QUANDO É VERDADE.

            O desenho traz o cartão verde "MODO OFFLINE · Tudo baixado. O app
            funciona sem internet." como parte fixa da sidebar. Fixo ele seria
            uma afirmação falsa na maior parte do tempo — as imagens das
            espécies são ~150 MB e vêm sob demanda, então o app recém-instalado
            NÃO funciona inteiro sem rede.

            `useOffline` mede o `CacheStorage` de verdade (ver
            `storage/offline.ts`). Enquanto faltar alguma coisa, o selo não
            existe; quando tudo estiver guardado, ele aparece dizendo algo que
            dá para conferir puxando o cabo da internet.
          */}
          {offline?.every((i) => i.estado === "guardado") && (
            <div className="tk-side-offline">
              <span className="tk-side-offline-t">{t("side.offline")}</span>
              <span className="tk-side-offline-d">{t("side.offlineBody")}</span>
            </div>
          )}
        </nav>
      </div>

      {/*
        O que ha ATRAS de uma folha, em tela larga.

        So e desenhado a partir de 900px — no celular a folha e `inset: 0` e
        cobre tudo, entao nao ha "atras". Ver `.tk-folha-scrim` no design.css.

        O onboarding entra na conta porque ele tambem encolhe pra uma coluna e
        tambem deixa o app aparecendo em volta — mas sem o clique pra fechar:
        ainda nao ha nada pra onde voltar.
      */}
      {(temFolha || !setup.done) && (
        <div
          className="tk-folha-scrim"
          aria-hidden="true"
          onClick={temFolha ? fecharFolhaDeCima : undefined}
        />
      )}

      {/*
        As ferramentas da barra lateral, montadas aqui e nao dentro da aba.

        Elas precisam sobreviver a troca de aba — abrir a calculadora e depois
        clicar em "Pokedex" nao pode fechar a calculadora, e se ela morasse
        dentro de `<HomeScreen>` morreria junto com a aba.
      */}
      {pedindo !== null && dataset.status === "ready" && (
        <SpeciesPicker
          data={dataset.data}
          onPick={(s) => {
            setAlvo(s);
            setFerramenta(pedindo);
            setPedindo(null);
          }}
          onClose={() => setPedindo(null)}
        />
      )}

      {ferramenta === "calc" && alvo && dataset.status === "ready" && (
        <IVCalculator species={alvo} data={dataset.data} onClose={fecharFerramenta} />
      )}

      {ferramenta === "raide" && alvo && dataset.status === "ready" && (
        <RaidCounters boss={alvo} data={dataset.data} onClose={fecharFerramenta} />
      )}

      {ferramenta === "time" && dataset.status === "ready" && (
        <TeamBuilder
          data={dataset.data}
          onClose={fecharFerramenta}
          onPickSpecies={() => {
            /* Abrir a ficha a partir do time fecharia a folha do time por baixo
               dela. Na barra lateral a ferramenta e um destino, nao um passo de
               um fluxo — quem quer a ficha tem a Pokedex do lado. */
            fecharFerramenta();
            go("pokedex");
          }}
        />
      )}

      {!setup.done && <Onboarding />}
      <SpriteDownloadPanel />
    </div>
  );
}
