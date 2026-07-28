import { useState } from "react";

import type { DatasetState } from "../data/useDataset.ts";
import { datasetLabel } from "../data/useDataset.ts";
import { useInstallState } from "../storage/install.ts";
import type { PersistState } from "../storage/persist.ts";
import { IconAlert, IconPlus } from "../ui/Icons.tsx";
import { InstallBanner } from "../ui/InstallBanner.tsx";
import { InstallGuide } from "./InstallGuide.tsx";

interface Props {
  dataset: DatasetState;
  persist: PersistState | null;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomeScreen({ dataset, persist }: Props) {
  const install = useInstallState();
  const [guideOpen, setGuideOpen] = useState(false);

  // Armazenamento sem garantia de durabilidade. So avisa quando ha risco real:
  // navegador que suporta modo persistente mas ainda nao concedeu.
  const atRisk = persist?.supported === true && !persist.persisted;

  const showInstall = !install.installed && !install.dismissed;

  return (
    <>
      <p className="tk-greeting">{greeting()}</p>
      <h1 className="tk-h1">TrainerKit</h1>

      {showInstall && (
        <InstallBanner
          platform={install.platform}
          atRisk={atRisk}
          onOpen={() => setGuideOpen(true)}
          onDismiss={install.dismiss}
        />
      )}

      {/* Ja instalado mas o navegador ainda nao garantiu o armazenamento: e o
          caso raro em que instalar nao resolveu, entao o aviso muda de conselho. */}
      {install.installed && atRisk && (
        <div className="tk-banner tk-banner--warn" role="status">
          <IconAlert size={20} />
          <div className="tk-banner-text">
            <div className="tk-banner-title">Seus dados podem ser apagados</div>
            <p className="tk-banner-body">
              O navegador ainda não garantiu o armazenamento. Mantenha um backup
              exportado por segurança.
            </p>
          </div>
        </div>
      )}

      {dataset.status === "loading" && <p className="tk-body">Carregando dados do jogo…</p>}

      {dataset.status === "error" && (
        <div className="tk-banner tk-banner--warn" role="alert">
          <IconAlert size={20} />
          <div className="tk-banner-text">
            <div className="tk-banner-title">Não consegui carregar o dataset</div>
            <p className="tk-banner-body">Sem ele o app não calcula nada. {dataset.message}</p>
          </div>
        </div>
      )}

      {dataset.status === "ready" && (
        <>
          <section className="tk-card">
            <div className="tk-overline">Dados do jogo</div>
            <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
              <div>
                <div style={{ font: "800 26px/1.1 var(--tk-font)", letterSpacing: "-0.02em" }}>
                  {dataset.data.species
                    .filter((s) => s.cosmeticOf === null)
                    .length.toLocaleString("pt-BR")}
                </div>
                <div className="tk-caption">espécies</div>
              </div>
              <div>
                <div style={{ font: "800 26px/1.1 var(--tk-font)", letterSpacing: "-0.02em" }}>
                  {dataset.data.fastMoves.length + dataset.data.chargedMoves.length}
                </div>
                <div className="tk-caption">ataques</div>
              </div>
              <div>
                <div style={{ font: "800 26px/1.1 var(--tk-font)", letterSpacing: "-0.02em" }}>
                  {dataset.data.version.levelCap}
                </div>
                <div className="tk-caption">nível máximo</div>
              </div>
            </div>
            <p className="tk-caption" style={{ marginTop: 14 }}>
              Base de {datasetLabel(dataset.data.version)} · funciona offline
            </p>
          </section>

          <h2 className="tk-h2">Sua coleção</h2>
          <div className="tk-empty">
            <div className="tk-empty-mark">
              <IconPlus size={26} />
            </div>
            <div className="tk-empty-title">Comece pelo primeiro</div>
            <p className="tk-body">
              Ainda não há nenhum Pokémon salvo. Leva menos de 10 segundos.
            </p>
          </div>
        </>
      )}

      {guideOpen && (
        <InstallGuide
          platform={install.platform}
          promptInstall={install.promptInstall}
          onClose={() => setGuideOpen(false)}
        />
      )}
    </>
  );
}
