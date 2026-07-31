import { useEffect, useState, type CSSProperties } from "react";

import { datasetLabel, useDataset } from "./data/useDataset.ts";
import { Onboarding } from "./onboarding/Onboarding.tsx";
import { useSetup } from "./onboarding/setup.ts";
import { CollectionScreen } from "./screens/CollectionScreen.tsx";
import { HomeScreen } from "./screens/HomeScreen.tsx";
import { PokedexScreen } from "./screens/PokedexScreen.tsx";
import { SettingsScreen } from "./screens/SettingsScreen.tsx";
import { useT, type Key } from "./i18n/t.ts";
import { detectPlatform } from "./storage/install.ts";
import { requestPersistence, type PersistState } from "./storage/persist.ts";
import { IconGearFill, IconGridFill, IconHomeFill } from "./ui/Icons.tsx";
import { SpriteDownloadPanel, SpriteDownloadStrip } from "./ui/SpriteDownload.tsx";
import { UpdateBanner } from "./ui/UpdateBanner.tsx";
import { useTemFolha } from "./ui/folha.ts";
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
  const setup = useSetup();
  const dataset = useDataset();
  const [persist, setPersist] = useState<PersistState | null>(null);

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
          data-oculta={temFolha || undefined}
          aria-hidden={temFolha || undefined}
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
            </button>
          ))}
        </nav>
      </div>

      {!setup.done && <Onboarding />}
      <SpriteDownloadPanel />
    </div>
  );
}
