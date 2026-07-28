import { useEffect, useState } from "react";

import { datasetLabel, useDataset } from "./data/useDataset.ts";
import { CollectionScreen } from "./screens/CollectionScreen.tsx";
import { HomeScreen } from "./screens/HomeScreen.tsx";
import { PokedexScreen } from "./screens/PokedexScreen.tsx";
import { SettingsScreen } from "./screens/SettingsScreen.tsx";
import { isInstalled, requestPersistence, type PersistState } from "./storage/persist.ts";
import { IconGrid, IconHome, IconSearch, IconSliders } from "./ui/Icons.tsx";

export type Tab = "inicio" | "pokedex" | "colecao" | "ajustes";

const TABS: ReadonlyArray<{
  id: Tab;
  label: string;
  Icon: typeof IconHome;
}> = [
  { id: "inicio", label: "Início", Icon: IconHome },
  // Consulta pura, sem cadastro: nem todo mundo quer catalogar a colecao, as
  // vezes a pergunta e so "esse Pokemon presta?".
  { id: "pokedex", label: "Pokédex", Icon: IconSearch },
  { id: "colecao", label: "Coleção", Icon: IconGrid },
  { id: "ajustes", label: "Ajustes", Icon: IconSliders },
];

export function App() {
  const [tab, setTab] = useState<Tab>("inicio");
  const dataset = useDataset();
  const [persist, setPersist] = useState<PersistState | null>(null);

  useEffect(() => {
    void requestPersistence().then(setPersist);
  }, []);

  return (
    <div className="tk-app">
      <div className="tk-shell">
        <main className="tk-main" key={tab}>
          {tab === "inicio" && (
            <HomeScreen dataset={dataset} persist={persist} installed={isInstalled()} />
          )}
          {tab === "pokedex" && <PokedexScreen dataset={dataset} />}
          {tab === "colecao" && <CollectionScreen dataset={dataset} />}
          {tab === "ajustes" && (
            <SettingsScreen
              datasetLabel={
                dataset.status === "ready" ? datasetLabel(dataset.data.version) : null
              }
              persist={persist}
            />
          )}
        </main>

        <nav className="tk-tabbar" aria-label="Navegação principal">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className="tk-tab"
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <Icon size={22} />
              {/* Rotulo sempre visivel: o prototipo proibe icone sem rotulo na navegacao. */}
              <span className="tk-tab-label">{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
