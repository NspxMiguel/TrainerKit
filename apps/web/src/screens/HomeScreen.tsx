import { useMemo, useState } from "react";

import { ACTION_KEYS, decide, type Action } from "@trainerkit/core";

import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { useT, type Key } from "../i18n/t.ts";
import type { PokedexIntent } from "../App.tsx";
import { useSetup } from "../onboarding/setup.ts";
import { useCollection } from "../storage/collection.ts";
import { useInstallState } from "../storage/install.ts";
import type { PersistState } from "../storage/persist.ts";
import { DidYouKnow } from "../ui/DidYouKnow.tsx";
import { IconAlert, IconCamera, IconPlus, IconShield, IconSwords, IconTrophy } from "../ui/Icons.tsx";
import { InstallBanner } from "../ui/InstallBanner.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { InstallGuide } from "./InstallGuide.tsx";
import { IVCalculator } from "./IVCalculator.tsx";
import { SpeciesDetail } from "./SpeciesDetail.tsx";
import { SpeciesPicker } from "./SpeciesPicker.tsx";
import { TeamBuilder } from "./TeamBuilder.tsx";

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

/**
 * Quantas pendencias caber na home.
 *
 * Duas, nao tres. O Miguel: "na tela inicial, n precisa de scroll, scroll
 * inutil ali". Cada linha custa 40px e a terceira era justamente a que
 * empurrava a tela pra fora do celular — e quem tem tres pendencias abre a aba
 * da colecao, que existe pra isso.
 */
const PENDENCIAS_NA_HOME = 2;

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
  const [teamOpen, setTeamOpen] = useState(false);
  const [detail, setDetail] = useState<DatasetSpecies | null>(null);

  const ready = dataset.status === "ready";
  const data = ready ? dataset.data : null;
  const colecao = setup.mode === "colecao";

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

  /** Ha aviso ocupando o topo? Se ha, a dica do dia cede o lugar. */
  const temAviso = showInstall || (install.installed && atRisk) || dataset.status === "error";

  return (
    <>
      {/*
        Uma linha, nao duas.

        A saudacao ficava sozinha em cima e o nome em 34px embaixo — 74px de
        altura pra dizer "boa noite". Numa tela que precisa caber inteira, e o
        primeiro lugar onde procurar espaço, e o texto nem perde nada: "Boa
        noite, Miguel" e a frase que uma pessoa diria.

        O que NAO podia voltar era o nome do APP aqui: era isso que fazia ler
        "Boa noite TrainerKit", como se o app fosse o cumprimentado.
      */}
      <h1 className="tk-hello">
        {t(greetingKey())}
        {setup.name.trim() ? `, ${setup.name.trim()}` : ""}
      </h1>

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
            As duas coisas que o app FAZ, uma embaixo da outra.

            O resto da home e consulta e mora nas abas. Ler um print e montar um
            time sao as unicas acoes que produzem algo — a primeira responde
            "esse presta?", a segunda devolve uma lista pra levar pra rua.
          */}
          <div className="tk-acts">
            <button type="button" className="tk-quick" onClick={() => setScanning(true)}>
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

            <button
              type="button"
              className="tk-quick tk-quick--team"
              onClick={() => setTeamOpen(true)}
            >
              <span className="tk-quick-mark" aria-hidden="true">
                <IconSwords size={22} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="tk-quick-title">{t("team.open")}</span>
                <span className="tk-quick-detail">{t("team.openDetail")}</span>
              </span>
              <span className="tk-quick-go" aria-hidden="true">
                ›
              </span>
            </button>
          </div>

          {/* No modo consulta nao existe colecao nem aba pra ela: um bloco
              vazio apontando pra uma aba que nao esta na tela e so confusao. */}
          {colecao && (
            <>
              {/* O quanto pede acao vai no CABEÇALHO da secao, nao numa linha
                  propria dentro do cartao. Era uma frase de 18px mais 12 de
                  respiro pra dizer um numero que caberia aqui de graça. */}
              <div className="tk-overline tk-overline--sec">
                {t("home.yourCollection")}
                {pendencias && pendencias.agir.length > 0 && (
                  <span className="tk-overline-hot">
                    {" · "}
                    {pendencias.agir.length === 1
                      ? t("home.needsDecision.one")
                      : t("home.needsDecision.many", { count: pendencias.agir.length })}
                  </span>
                )}
              </div>

              {/*
                Resumo e pendencias no MESMO cartao.

                Eram dois blocos com moldura, titulo e respiro proprios, e a
                pergunta que os dois respondem e uma so: "e a minha colecao,
                como esta?". Juntos economizam uns 60px — que e a diferenca
                entre caber na tela e nao caber.
              */}
              <section className="tk-card tk-home-coll">
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
                  <div className="tk-home-empty">
                    <span className="tk-home-empty-mark" aria-hidden="true">
                      <IconPlus size={18} />
                    </span>
                    <span>
                      <span className="tk-quick-title">{t("home.empty.title")}</span>
                      <span className="tk-quick-detail">{t("home.empty.body")}</span>
                    </span>
                  </div>
                ) : pendencias.agir.length === 0 ? (
                  <div style={{ font: "700 14px var(--tk-font)" }}>
                    {pendencias.total === 1
                      ? t("home.nothingPending.one")
                      : t("home.nothingPending.many", { count: pendencias.total })}
                  </div>
                ) : (
                  <>
                    {pendencias.agir.slice(0, PENDENCIAS_NA_HOME).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className="tk-pend"
                        onClick={() => setDetail(d.species)}
                      >
                        <SpeciesTile
                          spriteId={d.species.spriteId}
                          dex={d.species.dex}
                          speciesId={d.species.id}
                          name={d.species.name}
                          types={d.species.types}
                          size={36}
                        />
                        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                          <span className="tk-pend-name">{d.species.name}</span>
                          <span className="tk-pend-why">{tm(d.verdict.reason)}</span>
                        </span>
                        <span
                          className="tk-pend-act"
                          style={{ color: TONE[d.verdict.action] }}
                        >
                          {t(ACTION_KEYS[d.verdict.action] as Key)}
                        </span>
                      </button>
                    ))}

                    {/* Texto, nao botao. "Ver as outras" seria um botao pra
                        aba que esta na barra de baixo, a um toque de aqui — a
                        mesma redundancia que o Miguel apontou nos atalhos. */}
                    {pendencias.agir.length > PENDENCIAS_NA_HOME && (
                      <p className="tk-caption">
                        {t("home.andMore", {
                          count: pendencias.agir.length - PENDENCIAS_NA_HOME,
                        })}
                      </p>
                    )}
                  </>
                )}
              </section>
            </>
          )}

          {/*
            Dois atalhos, nao quatro.

            O Miguel: "pq tem um atalho pra pokedex e um atalho para coleção??
            sendo q simplesmente ja tem a porra do botao". Tinha razao — os dois
            duplicavam abas que estao na barra de baixo, a um toque de qualquer
            tela. Estes dois ficam porque levam a uma PERGUNTA que a barra nao
            faz: o ranking por tipo e o de liga viviam escondidos dentro da
            Pokedex e ninguem achava sozinho.
          */}
          <div className="tk-overline tk-overline--sec">{t("home.shortcuts")}</div>
          <div className="tk-quickgrid">
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
          </div>

          {/*
            A dica cede a vez pro aviso.

            Ela e o item de menor prioridade da home — o unico que ninguem
            perde nada por nao ver hoje. Quando ha aviso na tela (instalar,
            armazenamento em risco) as duas coisas juntas fazem a home rolar, e
            entre "leia esta dica" e "seus dados podem sumir" nao ha duvida de
            quem sai.
          */}
          {!temAviso && <DidYouKnow data={dataset.data} />}
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

      {teamOpen && data && (
        <TeamBuilder
          data={data}
          onClose={() => setTeamOpen(false)}
          onPickSpecies={(s) => {
            setTeamOpen(false);
            setDetail(s);
          }}
        />
      )}

      {detail && data && (
        <SpeciesDetail
          species={detail}
          data={data}
          onClose={() => setDetail(null)}
          onPickSpecies={setDetail}
        />
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
