import { useEffect, useState } from "react";

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
import { IconGrid, IconHome, IconSearch, IconSliders } from "./ui/Icons.tsx";
import { SpriteDownloadPanel, SpriteDownloadStrip } from "./ui/SpriteDownload.tsx";
import { UpdateBanner } from "./ui/UpdateBanner.tsx";
import { useTabBarMinimize } from "./ui/useTabBarMinimize.ts";

export type Tab = "inicio" | "pokedex" | "colecao" | "ajustes";

/**
 * Com que pergunta a pessoa chegou na Pokedex.
 *
 * Os atalhos da home diziam "Raide · Melhores atacantes por tipo" e abriam a
 * BUSCA — a lista de espécies em ordem de número, que não é o que o atalho
 * prometeu. Levar junto a intenção é o que faz o atalho chegar onde diz.
 */
export type PokedexIntent = { view: "browse" } | { view: "best"; mode: "raid" | "pvp" };

const TABS: ReadonlyArray<{
  id: Tab;
  labelKey: Key;
  Icon: typeof IconHome;
}> = [
  { id: "inicio", labelKey: "nav.home", Icon: IconHome },
  // Consulta pura, sem cadastro: nem todo mundo quer catalogar a colecao, as
  // vezes a pergunta e so "esse Pokemon presta?".
  { id: "pokedex", labelKey: "nav.pokedex", Icon: IconSearch },
  { id: "colecao", labelKey: "nav.collection", Icon: IconGrid },
  { id: "ajustes", labelKey: "nav.settings", Icon: IconSliders },
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
  const minimized = useTabBarMinimize(detectPlatform() === "ios");

  const species = dataset.status === "ready" ? dataset.data.species : [];

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
          {tab === "colecao" && <CollectionScreen dataset={dataset} />}
          {tab === "ajustes" && (
            <SettingsScreen
              datasetLabel={
                dataset.status === "ready" ? datasetLabel(dataset.data.version) : null
              }
              persist={persist}
              species={species}
            />
          )}
        </main>

        <SpriteDownloadStrip />

        <nav
          className="tk-tabbar"
          data-min={minimized || undefined}
          aria-label={t("nav.aria")}
          // No modo consulta a aba Colecao nao aparece: ela so faria sentido
          // pra quem escolheu cadastrar, e uma aba vazia permanente e ruido.
          style={setup.mode === "consulta" ? { gridTemplateColumns: "repeat(3, 1fr)" } : undefined}
        >
          {TABS.filter((tab) => setup.mode === "colecao" || tab.id !== "colecao").map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              type="button"
              className="tk-tab"
              aria-current={tab === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon size={22} />
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
