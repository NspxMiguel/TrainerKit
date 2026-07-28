import type { DatasetState } from "../data/useDataset.ts";
import { datasetLabel } from "../data/useDataset.ts";
import type { PersistState } from "../storage/persist.ts";
import { isIos } from "../storage/persist.ts";
import { IconAlert, IconPlus } from "../ui/Icons.tsx";

interface Props {
  dataset: DatasetState;
  persist: PersistState | null;
  installed: boolean;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomeScreen({ dataset, persist, installed }: Props) {
  // O aviso de durabilidade so aparece quando ha risco real: navegador que
  // suporta modo persistente, mas nao concedeu. Avisar sempre viraria ruido.
  const atRisk = persist?.supported === true && !persist.persisted;

  return (
    <>
      <p className="tk-greeting">{greeting()}</p>
      <h1 className="tk-h1">TrainerKit</h1>

      {atRisk && (
        <div className="tk-banner tk-banner--warn" role="status">
          <IconAlert size={20} />
          <div className="tk-banner-text">
            <div className="tk-banner-title">Seus dados podem ser apagados</div>
            <p className="tk-banner-body">
              {isIos() && !installed
                ? "O Safari apaga os dados de sites que passam 7 dias sem uso. Adicione o TrainerKit à Tela de Início para que ele pare de fazer isso."
                : "O navegador ainda não garantiu o armazenamento. Mantenha um backup exportado até que ele garanta."}
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
            <p className="tk-banner-body">
              Sem ele o app não calcula nada. {dataset.message}
            </p>
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
                  {dataset.data.species.length.toLocaleString("pt-BR")}
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
    </>
  );
}
