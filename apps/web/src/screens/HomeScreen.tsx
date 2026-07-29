import { useMemo, useState } from "react";

import { ACTION_KEYS, decide, type Action } from "@trainerkit/core";

import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { datasetLabel } from "../data/useDataset.ts";
import { useT, type Key } from "../i18n/t.ts";
import type { PokedexIntent } from "../App.tsx";
import { updateSetup, useSetup } from "../onboarding/setup.ts";
import { useCollection } from "../storage/collection.ts";
import { useInstallState } from "../storage/install.ts";
import type { PersistState } from "../storage/persist.ts";
import { DidYouKnow } from "../ui/DidYouKnow.tsx";
import {
  IconAlert,
  IconCamera,
  IconPlus,
  IconSearch,
  IconShield,
  IconTrophy,
} from "../ui/Icons.tsx";
import { InstallBanner } from "../ui/InstallBanner.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { InstallGuide } from "./InstallGuide.tsx";
import { IVCalculator } from "./IVCalculator.tsx";
import { SpeciesPicker } from "./SpeciesPicker.tsx";

interface Props {
  dataset: DatasetState;
  persist: PersistState | null;
  /** A home leva pras outras abas — atalho e atalho, nao decoracao. */
  onGo: (tab: "pokedex" | "colecao", intent?: PokedexIntent) => void;
}

const TONE: Record<Action, string> = {
  investir: "var(--tk-succ)",
  evoluir: "var(--tk-pri)",
  guardar: "var(--tk-info)",
  transferir: "var(--tk-dang)",
};

/**
 * O que a home mostra da colecao.
 *
 * Nao e a colecao inteira — para isso existe a aba. Aqui aparece so o que PEDE
 * ACAO: evoluir e transferir mudam o Pokemon, investir gasta recurso. "Guardar"
 * e o veredito de quem nao precisa fazer nada, e portanto nao merece espaco na
 * primeira tela.
 */
const PEDEM_ACAO: readonly Action[] = ["evoluir", "investir", "transferir"];

function greetingKey(): Key {
  const h = new Date().getHours();
  if (h < 5) return "home.greeting.lateNight";
  if (h < 12) return "home.greeting.morning";
  if (h < 18) return "home.greeting.afternoon";
  return "home.greeting.night";
}

export function HomeScreen({ dataset, persist, onGo }: Props) {
  const install = useInstallState();
  const setup = useSetup();
  const { items } = useCollection();
  const { t, tm, language } = useT();
  const [guideOpen, setGuideOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [picked, setPicked] = useState<DatasetSpecies | null>(null);

  const ready = dataset.status === "ready";
  const data = ready ? dataset.data : null;

  const pendencias = useMemo(() => {
    if (!data || !items || items.length === 0) return null;

    const decided = items.flatMap((owned) => {
      const s = data.species.find((x) => x.id === owned.speciesId);
      if (!s) return [];

      const verdict = decide({
        name: s.name,
        baseStats: s.baseStats,
        ivs: owned.ivs,
        level: owned.level ?? 20,
        cpm: data.cpm,
        levelCap: data.version.levelCap,
        evolvesInto: s.evolvesInto,
        candyToEvolve: s.evolvesInto[0]
          ? (s.candyToEvolve[s.evolvesInto[0]] ?? null)
          : null,
        lucky: owned.lucky,
        shadow: owned.shadow,
      });

      return [{ id: owned.id, species: s, verdict }];
    });

    // Ordena pela ordem de PEDEM_ACAO e, dentro dela, pela confianca: o que o
    // app tem mais certeza aparece primeiro, porque e o conselho mais util.
    const agir = decided
      .filter((d) => PEDEM_ACAO.includes(d.verdict.action))
      .sort(
        (a, b) =>
          PEDEM_ACAO.indexOf(a.verdict.action) - PEDEM_ACAO.indexOf(b.verdict.action) ||
          b.verdict.confidence - a.verdict.confidence,
      );

    return { total: decided.length, agir };
  }, [items, data]);

  /**
   * O resumo da colecao.
   *
   * Tres numeros que a pessoa quer ver ao abrir o app: quantos tem, quantos sao
   * 100%, e qual o melhor. Nao decide nada — e o "olha o que eu tenho" que faz
   * uma colecao ser colecao em vez de planilha.
   */
  const resumo = useMemo(() => {
    if (!items || items.length === 0 || !data) return null;
    const comIv = items.map((o) => ({
      owned: o,
      total: o.ivs.atk + o.ivs.def + o.ivs.hp,
      species: data.species.find((s) => s.id === o.speciesId),
    }));
    const melhor = comIv.reduce((a, b) => (b.total > a.total ? b : a));
    return {
      total: items.length,
      perfeitos: comIv.filter((x) => x.total === 45).length,
      melhor,
    };
  }, [items, data]);

  // Armazenamento sem garantia de durabilidade. So avisa quando ha risco real:
  // navegador que suporta modo persistente mas ainda nao concedeu.
  const atRisk = persist?.supported === true && !persist.persisted;

  /*
   * O convite de instalar nao aparece no computador.
   *
   * O motivo dele e um so, e e de celular: o Safari apaga os dados de origens
   * paradas ha 7 dias, e estar na tela de inicio e o que faz o WebKit conceder
   * armazenamento persistente. No desktop nao ha esse despejo, o navegador ja
   * fica aberto, e "instale este site" vira uma sugestao estranha — o Miguel
   * viu isso no PC e a reacao foi exatamente essa.
   */
  const showInstall =
    !install.installed && !install.dismissed && install.platform !== "desktop";

  return (
    <>
      {/* A saudacao e o nome do app estavam empilhados e liam como uma frase
          so — "Boa noite TrainerKit". Quem cumprimenta e a pessoa, nao o app. */}
      <p className="tk-greeting">{t(greetingKey())}</p>
      <h1 className="tk-h1">{setup.name.trim() || t("home.trainer")}</h1>

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
            <div className="tk-banner-title">{t("home.atRisk.title")}</div>
            <p className="tk-banner-body">{t("home.atRisk.body")}</p>
          </div>
        </div>
      )}

      {dataset.status === "loading" && <p className="tk-body">{t("common.loadingGameData")}</p>}

      {dataset.status === "error" && (
        <div className="tk-banner tk-banner--warn" role="alert">
          <IconAlert size={20} />
          <div className="tk-banner-text">
            <div className="tk-banner-title">{t("home.datasetError.title")}</div>
            <p className="tk-banner-body">{t("home.datasetError.body", { message: dataset.message })}</p>
          </div>
        </div>
      )}

      {dataset.status === "ready" && (
        <>
          {/*
            O caminho curto pro que o app faz.

            Aqui ficava um cartao com "1.182 especies, 390 ataques, base de
            28/07". Isso e metadado do BANCO, nao informacao sobre o jogador —
            ninguem abre um app pra saber quantas linhas ele tem. A versao da
            base continua em Ajustes, que e onde se procura quando importa.

            No lugar entra a acao: um toque da home ate a leitura do print.
          */}
          <button
            type="button"
            className="tk-quick"
            onClick={() => setScanning(true)}
          >
            <span className="tk-quick-mark" aria-hidden="true">
              <IconCamera size={22} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="tk-quick-title">{t("home.quickScan")}</span>
              <span className="tk-quick-detail">{t("home.quickScanDetail")}</span>
            </span>
            <span className="tk-quick-go" aria-hidden="true">
              ›
            </span>
          </button>

          {/* No modo consulta nao existe colecao nem aba pra ela: um bloco
              vazio apontando pra uma aba que nao esta na tela e so confusao. */}
          {setup.mode === "colecao" && (
            <>
          <h2 className="tk-h2">{t("home.yourCollection")}</h2>

          {/* Tres numeros que dao gosto de olhar. Nao decidem nada — e o
              "olha o que eu tenho" que faz colecao ser colecao. */}
          {resumo && (
            <div className="tk-stats">
              <div className="tk-stat">
                <span className="tk-stat-n">{resumo.total.toLocaleString(language)}</span>
                <span className="tk-stat-l">{t("home.stat.saved")}</span>
              </div>
              <div className="tk-stat">
                <span
                  className="tk-stat-n"
                  style={resumo.perfeitos > 0 ? { color: "var(--tk-succ)" } : undefined}
                >
                  {resumo.perfeitos}
                </span>
                <span className="tk-stat-l">{t("home.stat.perfect")}</span>
              </div>
              <div className="tk-stat">
                <span className="tk-stat-n">
                  {resumo.melhor.total}
                  <span className="tk-stat-sub">/45</span>
                </span>
                <span className="tk-stat-l">
                  {resumo.melhor.species?.name ?? t("home.stat.best")}
                </span>
              </div>
            </div>
          )}

          {!pendencias ? (
            <div className="tk-empty">
              <div className="tk-empty-mark">
                <IconPlus size={26} />
              </div>
              <div className="tk-empty-title">{t("home.empty.title")}</div>
              <p className="tk-body">{t("home.empty.body")}</p>
            </div>
          ) : pendencias.agir.length === 0 ? (
            <section className="tk-card">
              <div style={{ font: "700 15px var(--tk-font)" }}>
                {pendencias.total === 1
                  ? t("home.nothingPending.one")
                  : t("home.nothingPending.many", { count: pendencias.total })}
              </div>
            </section>
          ) : (
            <section className="tk-card" style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ font: "700 15px var(--tk-font)" }}>
                  {pendencias.agir.length === 1
                    ? t("home.needsDecision.one")
                    : t("home.needsDecision.many", { count: pendencias.agir.length })}
                </div>
                <p className="tk-caption" style={{ marginTop: 4 }}>
                  {pendencias.total === 1
                    ? t("home.ofSaved.one", { count: pendencias.total })
                    : t("home.ofSaved.many", { count: pendencias.total })}
                </p>
              </div>

              {pendencias.agir.slice(0, 3).map((d) => (
                <div
                  key={d.id}
                  style={{ display: "flex", gap: 12, alignItems: "center" }}
                >
                  <SpeciesTile
                    spriteId={d.species.spriteId}
                    dex={d.species.dex}
                    speciesId={d.species.id}
                    name={d.species.name}
                    types={d.species.types}
                    size={40}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", font: "600 14px var(--tk-font)" }}>
                      {d.species.name}
                    </span>
                    <span className="tk-caption" style={{ display: "block" }}>
                      {tm(d.verdict.reason)}
                    </span>
                  </span>
                  <span
                    style={{
                      font: "700 12px var(--tk-font)",
                      color: TONE[d.verdict.action],
                      flex: "none",
                    }}
                  >
                    {t(ACTION_KEYS[d.verdict.action] as Key)}
                  </span>
                </div>
              ))}

              {pendencias.agir.length > 3 && (
                <p className="tk-caption">
                  {t("home.andMore", { count: pendencias.agir.length - 3 })}
                </p>
              )}
            </section>
          )}
            </>
          )}

          {/* Atalhos.
              A home tinha uma acao so e sobrava meia tela vazia. Estes levam
              direto pras respostas que o app sabe dar e que ninguem descobria
              sozinho — o ranking e os counters viviam a dois toques de
              distancia, escondidos dentro da Pokedex. */}
          <h2 className="tk-h2">{t("home.shortcuts")}</h2>
          <div className="tk-quickgrid">
            {/* Cada atalho leva a intencao junto. Sem isso os tres primeiros
                abriam a mesma tela — a busca por nome — e so o texto do botao
                mudava. */}
            <button
              type="button"
              className="tk-tile tk-tile--raid"
              onClick={() => onGo("pokedex", { view: "best", mode: "raid" })}
            >
              <IconTrophy size={20} />
              <span className="tk-tile-t">{t("home.go.raidBest")}</span>
              <span className="tk-tile-d">{t("home.go.raidBestDetail")}</span>
            </button>
            <button
              type="button"
              className="tk-tile tk-tile--pvp"
              onClick={() => onGo("pokedex", { view: "best", mode: "pvp" })}
            >
              <IconShield size={20} />
              <span className="tk-tile-t">{t("home.go.pvpBest")}</span>
              <span className="tk-tile-d">{t("home.go.pvpBestDetail")}</span>
            </button>
            <button
              type="button"
              className="tk-tile tk-tile--dex"
              onClick={() => onGo("pokedex", { view: "browse" })}
            >
              <IconSearch size={20} />
              <span className="tk-tile-t">{t("home.go.search")}</span>
              <span className="tk-tile-d">{t("home.go.searchDetail")}</span>
            </button>
            {/*
              No modo consulta este atalho era mentira.

              Ele dizia "Coleção · Tudo que você salvou" pra quem escolheu NAO
              salvar nada, e levava pra Pokedex — outra tela, com outro nome.
              Prometer uma coisa e entregar outra e o tipo de detalhe que faz o
              app parecer mal encaixado.

              Agora ele oferece o que de fato falta: LIGAR a coleção. Era a
              única forma de mudar de ideia sem ir cavar nos Ajustes.
            */}
            <button
              type="button"
              className="tk-tile tk-tile--coll"
              onClick={() => {
                if (setup.mode === "colecao") {
                  onGo("colecao");
                  return;
                }
                updateSetup({ mode: "colecao" });
                onGo("colecao");
              }}
            >
              <IconPlus size={20} />
              <span className="tk-tile-t">
                {setup.mode === "colecao" ? t("home.go.collection") : t("home.go.startCollection")}
              </span>
              <span className="tk-tile-d">
                {setup.mode === "colecao"
                  ? t("home.go.collectionDetail")
                  : t("home.go.startCollectionDetail")}
              </span>
            </button>
          </div>

          <DidYouKnow data={dataset.data} />
        </>
      )}

      {/* Escolher a especie vem ANTES de ler o print, e nao depois: a tela de
          avaliacao mostra o apelido, nao a especie, entao o app nunca teria como
          adivinhar. Pedir primeiro elimina a classe inteira de erro. */}
      {scanning && ready && data && (
        <SpeciesPicker
          species={data.species}
          onPick={(sp) => {
            setPicked(sp);
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      )}

      {picked && data && (
        <IVCalculator species={picked} data={data} onClose={() => setPicked(null)} />
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
