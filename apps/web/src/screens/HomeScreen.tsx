import { useMemo, useState } from "react";

import { ACTION_KEYS, decide, ivTotalOf, type Action, type Verdict } from "@trainerkit/core";

import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { moveLabel, useLanguage } from "../i18n/language.ts";
import { useT, type Key } from "../i18n/t.ts";
import type { PokedexIntent } from "../App.tsx";
import { useSetup } from "../onboarding/setup.ts";
import { typeColor, typeKey } from "../sprites/provider.ts";
import { setDoneAction, useCollection } from "../storage/collection.ts";
import { useInstallState } from "../storage/install.ts";
import type { PersistState } from "../storage/persist.ts";
import { DidYouKnow } from "../ui/DidYouKnow.tsx";
import { IconAlert, IconCamera, IconShield, IconSwords } from "../ui/Icons.tsx";
import { InstallBanner } from "../ui/InstallBanner.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { GymPicks } from "./GymPicks.tsx";
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

/** Quantos sprites cabem na fila antes de ela virar rolagem lateral. */
const NA_FILA = 12;

function greetingKey(): Key {
  const h = new Date().getHours();
  if (h < 5) return "home.greeting.lateNight";
  if (h < 12) return "home.greeting.morning";
  if (h < 18) return "home.greeting.afternoon";
  return "home.greeting.night";
}

/**
 * O destaque da home.
 *
 * A home tinha duas acoes cinzas, um cartao cinza e uma dica cinza — o Miguel:
 * "ficou sem graça / sem cara de Pokémon" e "tudo com o mesmo peso". Estava
 * certo nas duas: sem nenhum elemento dominante a tela lia como lista de
 * Ajustes, e num app de Pokemon isso e um erro de identidade, nao de layout.
 *
 * Entao a primeira coisa da tela e UM Pokemon, grande, com a cor do tipo dele
 * atras. E sempre o mais relevante que o app sabe apontar, nunca um enfeite
 * sorteado:
 *
 *   1. o seu que mais pede decisao (e o unico que cobra algo de voce hoje);
 *   2. sem pendencia, o seu melhor;
 *   3. sem colecao — ou em modo so consulta — o melhor atacante de raide da
 *      base, que e informacao de verdade e nao invencao.
 *
 * O rotulo diz qual dos tres e, porque um destaque sem rotulo faz a pessoa
 * adivinhar por que aquele bicho esta ali.
 */
function Hero({
  species,
  labelKey,
  linha,
  tom,
  onOpen,
  feito,
  onToggleFeito,
}: {
  species: DatasetSpecies;
  labelKey: Key;
  linha: string;
  tom?: string | undefined;
  onOpen: () => void;
  /** Presente so quando o destaque e um veredito pendente de um bicho seu. */
  feito?: boolean | undefined;
  onToggleFeito?: (() => void) | undefined;
}) {
  const { t } = useT();
  const cor = typeColor(species.types[0] ?? "normal");

  return (
    <div
      className="tk-hero"
      /* A cor do tipo entra por variavel pra ficar so no CSS quem decide como
         ela e usada — aqui e um veu atras do sprite, la e o gradiente. */
      style={{ ["--tk-hero-type" as string]: cor }}
    >
      {/*
        Camada invisivel: abrir e a acao do bloco INTEIRO, e nao de um botao
        dentro dele. Botao dentro de botao nao existe em HTML, e era o que
        impedia o "ja fiz" de morar aqui — que e exatamente onde ele faltava.
      */}
      <button type="button" className="tk-hero-open" onClick={onOpen} aria-label={species.name} />

      <span className="tk-hero-art" aria-hidden="true">
        <SpeciesTile
          spriteId={species.spriteId}
          dex={species.dex}
          speciesId={species.id}
          name={species.name}
          types={species.types}
          size={84}
        />
      </span>

      <span className="tk-hero-text">
        <span className="tk-hero-label" style={tom ? { color: tom } : undefined}>
          {t(labelKey)}
        </span>
        <span className="tk-hero-name">{species.name}</span>
        <span className="tk-hero-meta">
          #{String(species.dex).padStart(3, "0")} ·{" "}
          {species.types.map((tp) => t(typeKey(tp) as "type.normal")).join(" · ")}
        </span>
        <span className="tk-hero-why">{linha}</span>

        {/*
          "Ja fiz isso", na coisa mais visivel da tela.

          O Miguel, duas vezes: "ainda continua essa desgraça de investir sem
          jeito de tirar isso". Estava certo — o botao existia SO na linha da
          Colecao, escondido num rotulo colorido, e o destaque da home anunciava
          INVESTIR sem oferecer nada. Aqui ele fica ao lado do aviso que cobra.
        */}
        {onToggleFeito && (
          <button
            type="button"
            className="tk-done tk-done--hero"
            data-done={feito || undefined}
            aria-pressed={feito ?? false}
            onClick={onToggleFeito}
          >
            <span className="tk-done-mark" aria-hidden="true">
              {feito ? "✓" : "○"}
            </span>
            {feito ? t("collection.done") : t("collection.markDone")}
          </button>
        )}
      </span>

      <span className="tk-hero-go" aria-hidden="true">
        ›
      </span>
    </div>
  );
}

export function HomeScreen({ dataset, persist, onGo }: Props) {
  const install = useInstallState();
  const setup = useSetup();
  const { items } = useCollection();
  const { t, tm } = useT();
  const language = useLanguage();
  const [guideOpen, setGuideOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [picked, setPicked] = useState<DatasetSpecies | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [gymOpen, setGymOpen] = useState(false);
  const [detail, setDetail] = useState<DatasetSpecies | null>(null);

  const ready = dataset.status === "ready";
  const data = ready ? dataset.data : null;
  const colecao = setup.mode === "colecao";

  /** A colecao com veredito calculado, ordenada: quem pede acao primeiro. */
  const meus = useMemo(() => {
    if (!data || !colecao || !items || items.length === 0) return null;

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

      return [
        {
          id: owned.id,
          species: s,
          verdict,
          iv: ivTotalOf(owned.ivs),
          // Cumprido so quando a acao marcada e a MESMA que o veredito indica
          // hoje: subiu de nivel e virou "evoluir"? Volta a cobrar, porque e
          // outra coisa a fazer.
          feito: owned.doneAction === verdict.action,
        },
      ];
    });

    /*
     * O que JA FOI FEITO sai da lista.
     *
     * Aqui estava o defeito que o Miguel reclamou duas vezes: "essa desgraça de
     * investir sem jeito de tirar isso". Havia jeito — o rotulo na linha da
     * Colecao era um botao — mas a home nao olhava pra ele. Marcava como feito
     * e o "INVESTIR" continuava no destaque, com o anel aceso na fila. Marcar
     * nao tirava nada da vista, e um botao que nao muda a tela e o mesmo que
     * botao que nao existe.
     */
    const agir = decided
      .filter((d) => !d.feito && PEDEM_ACAO.includes(d.verdict.action))
      .sort(
        (a, b) =>
          PEDEM_ACAO.indexOf(a.verdict.action) - PEDEM_ACAO.indexOf(b.verdict.action) ||
          b.verdict.confidence - a.verdict.confidence,
      );

    const porIv = [...decided].sort((a, b) => b.iv - a.iv);

    return {
      total: decided.length,
      perfeitos: decided.filter((d) => d.iv === 45).length,
      agir,
      porIv,
      melhor: porIv[0]!,
    };
  }, [items, data, colecao]);

  /**
   * Quem e o destaque, e por que.
   *
   * A ordem e de utilidade, nao de vaidade: o que cobra uma decisao hoje vem
   * antes do que so e bonito de olhar.
   */
  const hero = useMemo((): {
    species: DatasetSpecies;
    labelKey: Key;
    linha: string;
    tom?: string;
    verdict?: Verdict;
    /** Id na colecao, presente so quando o destaque cobra uma acao. */
    ownedId?: string;
    feito?: boolean;
  } | null => {
    if (!data) return null;

    const pendente = meus?.agir[0];
    if (pendente) {
      return {
        species: pendente.species,
        labelKey: ACTION_KEYS[pendente.verdict.action] as Key,
        linha: tm(pendente.verdict.reason),
        tom: TONE[pendente.verdict.action],
        verdict: pendente.verdict,
        ownedId: pendente.id,
        feito: false,
      };
    }

    if (meus) {
      return {
        species: meus.melhor.species,
        labelKey: "home.hero.best",
        linha: `${meus.melhor.iv}/45 · ${tm(meus.melhor.verdict.reason)}`,
      };
    }

    // Sem colecao: o melhor atacante de raide da base. E dado calculado, com
    // fonte declarada — a alternativa seria sortear um bicho, e sortear e o
    // tipo de enfeite que faz o resto do app perder credito.
    const top = data.rankings?.raidOverall[0];
    const sp = top ? data.species.find((s) => s.id === top.speciesId) : undefined;
    if (!sp || !top?.fast || !top.charged) return null;

    // Nome do golpe no idioma da pessoa quando ha traducao oficial — o resto do
    // app faz assim, e um "Poison Jab" solto em portugues destoaria.
    const nome = (m: { name: string; id: string }) =>
      moveLabel(m.name, data.moveNames, m.id, language).primary;

    return {
      species: sp,
      labelKey: "home.hero.topRaid",
      linha: `${nome(top.fast)} + ${nome(top.charged)}`,
    };
  }, [data, meus, tm, language]);

  // Armazenamento sem garantia de durabilidade. So avisa quando ha risco real:
  // navegador que suporta modo persistente mas ainda nao concedeu.
  const atRisk = persist?.supported === true && !persist.persisted;

  /*
   * O convite de instalar nao aparece no computador.
   *
   * O motivo dele e um so, e e de celular: o Safari apaga os dados de origens
   * paradas ha 7 dias, e estar na tela de inicio e o que faz o WebKit conceder
   * armazenamento persistente. No desktop nao ha esse despejo, o navegador ja
   * fica aberto, e "instale este site" vira uma sugestao estranha.
   */
  const showInstall =
    !install.installed && !install.dismissed && install.platform !== "desktop";

  /** Ha aviso ocupando o topo? Se ha, a dica do dia cede o lugar. */
  const temAviso = showInstall || (install.installed && atRisk) || dataset.status === "error";

  return (
    <>
      {/* A saudacao e o nome, nos dois tamanhos de sempre. Ficaram numa linha so
          de 26px pra economizar altura, e o Miguel notou na hora — o nome e a
          unica coisa da tela que e sobre ELE, e encolher isso pra caber mais
          informacao foi trocar a coisa certa pela coisa errada. */}
      <p className="tk-greeting">{t(greetingKey())}</p>
      <h1 className="tk-h1 tk-h1--home">{setup.name.trim() || t("home.trainer")}</h1>

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
          {hero && (
            <Hero
              species={hero.species}
              labelKey={hero.labelKey}
              linha={hero.linha}
              tom={hero.tom}
              onOpen={() => setDetail(hero.species)}
              feito={hero.feito}
              {...(hero.ownedId !== undefined && hero.verdict
                ? {
                    onToggleFeito: () =>
                      void setDoneAction(hero.ownedId!, hero.verdict!.action),
                  }
                : {})}
            />
          )}

          {/*
            Uma acao principal, uma secundaria.

            Eram duas linhas identicas, e ai nenhuma das duas era a principal.
            Ler um print e o que a pessoa faz com o celular na mao no meio da
            rua; montar time e o que ela faz sentada, planejando. Peso diferente
            porque a frequencia e diferente.
          */}
          <button type="button" className="tk-cta" onClick={() => setScanning(true)}>
            <span className="tk-cta-mark" aria-hidden="true">
              <IconCamera size={24} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="tk-cta-title">{t("home.quickScan")}</span>
              <span className="tk-cta-detail">{t("home.quickScanDetail")}</span>
            </span>
          </button>

          {/*
            As tres acoes secundarias numa fileira, nao empilhadas.

            Cada linha empilhada custava 46px, e a terceira (o ginasio) faria a
            home voltar a rolar — o que ele pediu duas vezes pra nao acontecer.
            Em fileira as tres somam 76px em vez de 138, e elas se leem melhor
            juntas: sao as coisas que o app FAZ por voce, ao lado uma da outra.
          */}
          {/*
            DUAS acoes, nao tres.

            A terceira era "Pokédex" — do lado de uma ABA chamada Pokédex. O
            Miguel: "2 funcoes com o msm nome, pokedex e pokedex". O aparelho
            mudou pra dentro da aba Pokedex, que e onde ele pertence, e aqui
            sobraram as duas coisas que NAO existem em aba nenhuma: montar time
            e escolher quem fica no ginasio.

            Em duas colunas o rotulo tambem para de quebrar: "Monta um time pra
            mim" em coluna de 110px virava tres linhas.
          */}
          <div className="tk-acts2">
            <button type="button" className="tk-act" onClick={() => setTeamOpen(true)}>
              <IconSwords size={19} />
              <span className="tk-act-t">{t("team.open")}</span>
            </button>
            <button type="button" className="tk-act" onClick={() => setGymOpen(true)}>
              <IconShield size={19} />
              <span className="tk-act-t">{t("gym.title")}</span>
            </button>
          </div>

          {/* A colecao como FILA de sprites, nao como cartao de texto.
              Era um bloco com tres numeros, duas linhas de nome e uma frase de
              rodape — muita leitura pra dizer "olha o que voce tem". A fila diz
              a mesma coisa de relance, e cada bicho abre com um toque. */}
          {colecao && meus && (
            <>
              {/* Um cabecalho de UMA linha.
                  "SUA COLEÇÃO · 5 SALVOS · 1 SÃO 100% · 4 PEDEM UMA DECISÃO" em
                  maiuscula monoespacada quebrava em duas e virava uma parede.
                  Quantos voce tem se conta na fila abaixo; o que precisa estar
                  escrito e o que COBRA algo de voce. */}
              <div className="tk-overline tk-overline--sec">
                {t("home.yourCollection")}
                {meus.agir.length > 0 && (
                  <span className="tk-overline-hot">
                    {" · "}
                    {meus.agir.length === 1
                      ? t("home.needsDecision.one")
                      : t("home.needsDecision.many", { count: meus.agir.length })}
                  </span>
                )}
              </div>

              <div className="tk-strip-row">
                {meus.porIv.slice(0, NA_FILA).map((d, i) => (
                  <button
                    key={d.id}
                    type="button"
                    className="tk-strip-cell"
                    data-hot={(!d.feito && PEDEM_ACAO.includes(d.verdict.action)) || undefined}
                    style={{
                      ["--tk-cell-tone" as string]: TONE[d.verdict.action],
                      // Indice da cascata: a fila entra da esquerda pra direita,
                      // o que ja diz que ela rola.
                      ["--tk-i" as string]: i,
                    }}
                    onClick={() => setDetail(d.species)}
                    aria-label={`${d.species.name} · ${t(ACTION_KEYS[d.verdict.action] as Key)}`}
                    title={`${d.species.name} · ${t(ACTION_KEYS[d.verdict.action] as Key)}`}
                  >
                    <SpeciesTile
                      spriteId={d.species.spriteId}
                      dex={d.species.dex}
                      speciesId={d.species.id}
                      name={d.species.name}
                      types={d.species.types}
                      size={48}
                    />
                  </button>
                ))}
                {meus.porIv.length > NA_FILA && (
                  <button
                    type="button"
                    className="tk-strip-more"
                    onClick={() => onGo("colecao")}
                  >
                    +{meus.porIv.length - NA_FILA}
                  </button>
                )}
              </div>
            </>
          )}

          {/* Sem nada salvo o convite substitui a fila: um espaço vazio com
              moldura nao convida ninguem. */}
          {colecao && !meus && (
            <p className="tk-caption tk-home-nudge">{t("home.empty.body")}</p>
          )}

          {/*
            Os atalhos de "Melhores" sairam.

            Eram os dois ultimos sobreviventes daquela grade, e o argumento pra
            manter era que o ranking por tipo vivia escondido dentro da Pokedex.
            Isso deixou de ser verdade nesta versao: a aba Pokedex abre com
            "Buscar | Melhores" em cima, entao a lista esta a dois toques de
            qualquer tela — e o proprio Miguel deu a regra quando tirou os
            outros: "sendo q simplesmente ja tem a porra do botao".

            E ha um motivo melhor. O que aquelas listas respondiam mal, o app
            agora responde bem: pra atacar, "Monta um time pra mim" devolve seis
            nomes com proposito; pra defender, "Ginásio" cruza com a sua
            colecao. Um ranking de trinta nomes ao lado disso e o passo atras.

            Ficam 130px livres, que e o que faz a home caber com as quatro
            acoes. Se voce quiser de volta, e um bloco de JSX — mas eu apostaria
            que nao vai sentir falta.
          */}

          {/*
            A dica cede a vez pro aviso.

            E o item de menor prioridade da home — o unico que ninguem perde
            nada por nao ver hoje. Entre "leia esta dica" e "seus dados podem
            sumir" nao ha duvida de quem sai.
          */}
          {!temAviso && <DidYouKnow data={dataset.data} />}
        </>
      )}

      {/* Escolher a especie vem ANTES de ler o print, e nao depois: a tela de
          avaliacao mostra o apelido, nao a especie, entao o app nunca teria como
          adivinhar. Pedir primeiro elimina a classe inteira de erro. */}
      {scanning && ready && data && (
        <SpeciesPicker
          data={data}
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

      {gymOpen && data && (
        <GymPicks
          data={data}
          onClose={() => setGymOpen(false)}
          onPickSpecies={(s) => {
            setGymOpen(false);
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
