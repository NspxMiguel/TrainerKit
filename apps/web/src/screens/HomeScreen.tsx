import { useMemo, useState } from "react";

import { ACTION_KEYS, decide, ivTotalOf, type Action, type Verdict } from "@trainerkit/core";

import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { moveLabel, useLanguage } from "../i18n/language.ts";
import { useT, type Key } from "../i18n/t.ts";
import type { PokedexIntent } from "../App.tsx";
import { useSetup } from "../onboarding/setup.ts";
import { typeColor, typeKey } from "../sprites/provider.ts";
import { setDoneAction, useCollection, type OwnedPokemon } from "../storage/collection.ts";
import { useInstallState } from "../storage/install.ts";
import type { PersistState } from "../storage/persist.ts";
import { DidYouKnow } from "../ui/DidYouKnow.tsx";
import { IconAlert, IconCamera, IconShield, IconSwords } from "../ui/Icons.tsx";
import { InstallBanner } from "../ui/InstallBanner.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { usarPaleta } from "../ui/paleta.ts";
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
  /*
   * So "pokedex": a Colecao virou um modo dentro dela.
   *
   * O tipo mudou de propósito em vez de eu aceitar `"colecao"` e traduzir aqui —
   * assim o compilador aponta quem ainda navega pra uma aba que nao existe, que
   * foi exatamente como estes dois usos apareceram.
   */
  onGo: (tab: "pokedex", intent?: PokedexIntent) => void;
}

/*
 * As cores de veredito, agora nos tokens do handoff.
 *
 * ⚠️ Duas estavam erradas, e o erro tinha significado: "Guardar" saia AZUL
 * (`--tk-info`) e "Transferir" saia VERMELHO (`--tk-dang`). O handoff define
 * Guardar em ambar e Transferir em cinza — e a escolha dele e melhor que a
 * minha por um motivo de produto, nao de gosto.
 *
 * Vermelho e a cor de perigo do app. Transferir um Pokemon nao e um erro nem um
 * risco: e uma recomendacao tranquila sobre um bicho que nao vale investimento.
 * Pintar de vermelho transformava um conselho rotineiro em alarme, e num app
 * cuja tese e DECIDIR por voce, assustar na decisao mais comum e o pior lugar
 * possivel pra errar o tom.
 *
 * Os tokens ja existiam desde o porte da paleta; eu simplesmente nao tinha
 * trocado quem os usa.
 */
const TONE: Record<Action, string> = {
  investir: "var(--tk-v-investir)",
  evoluir: "var(--tk-v-evoluir)",
  guardar: "var(--tk-v-guardar)",
  transferir: "var(--tk-v-transferir)",
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

  /*
   * A cor sai da ESPECIE, por tabela — nao do tipo, nem do sprite.
   *
   * "quando digo a cor do pokemon, nao pegar do sprite. inclusive, mesmo sem
   * sprite, o famoso DR pra qm nao ta com os sprites ativos, tem q aparecer a
   * cor do pokemon."
   *
   * As duas versoes anteriores estavam erradas, cada uma do seu jeito: o tipo
   * pintava o Dragonite de roxo (Dragao) e o Mewtwo de rosa (Psiquico); ler do
   * sprite acertava a cor mas so quando havia imagem carregada. A tabela acerta
   * sempre, inclusive no modo monograma. Ver `ui/paleta.ts`.
   */
  const paleta = usarPaleta(species.spriteId);

  return (
    <div
      className="tk-hero"
      style={{ ["--tk-hero-grad" as string]: paleta.gradiente }}
    >
      {/* O brilho atras da cabeca, na SEGUNDA cor da especie. E o primeiro
          lugar onde "mais uma cor pra encaixar no app" aparece de fato: no
          Dragonite e o verde-agua da asa, e nao mais laranja sobre laranja. */}
      <span className="tk-hero-brilho" aria-hidden="true" />

      {/*
        O NUMERO GIGANTE ATRAS DO BICHO — e daqui que vem a profundidade.

        "tenta da um efeito de profundiddade, seria topppp. tipo os q tem nas
        fotos da apple saca? tipo o relogio da apple, se vc coloca uma cabeca,
        ele fica meio atras dando efeito de profundidade."

        O mostrador de fotos do Apple Watch recorta o assunto e passa a hora POR
        TRAS da cabeca. Aqui sai de graca, e essa e a sacada: o sprite e um PNG
        com transparencia, entao ele JA E a mascara do assunto. Basta desenhar o
        numero antes dele — o alfa da arte recorta o algarismo sozinho, sem
        segmentacao, sem canvas, sem uma linha de JS.

        Escolhi o numero da dex, e nao o monograma que ele cogitou ("ou tlvz
        deixar a letra ali no fundo sla"): as duas letras repetiriam o nome que
        ja esta logo abaixo, enquanto o numero acrescenta o unico dado que a
        home nao mostrava. Camisa de time, nao marca d'agua.
      */}
      <span className="tk-hero-numero" aria-hidden="true">
        {species.dex}
      </span>

      {/*
        O assunto, na frente de tudo.

        Sem arte — fonte de imagens desligada, sprite ainda baixando, especie sem
        arquivo — o `SpeciesTile` ja mostra o monograma no lugar, e a composicao
        continua de pe: o "DR" vira o assunto e o numero continua atras dele. So
        o recorte fica reto, porque letra nao tem silhueta.

        `bare` tira a moldura do tile: aqui o fundo ja e o gradiente do hero, e
        um tile arredondado por cima dele seria uma caixa dentro de outra.
      */}
      <span className="tk-hero-art" aria-hidden="true">
        <SpeciesTile
          spriteId={species.spriteId}
          dex={species.dex}
          speciesId={species.id}
          name={species.name}
          types={species.types}
          size={220}
          bare
        />
        {/* A sombra de contato no chao. Sem ela o bicho flutua e a profundidade
            vira so "coisas empilhadas"; com ela ele POUSA sobre o hero. */}
        <span className="tk-hero-chao" aria-hidden="true" />
      </span>

      {/* Garante contraste sobre gradiente claro (Elétrico, Gelo) E funde a base
          do hero com o fundo do app, pra nao haver linha de corte. */}
      <span className="tk-hero-scrim" aria-hidden="true" />

      <div className="tk-hero-base">
        {/*
          O chip "DESTAQUE DE HOJE" saiu.
          
          "tira a tile destaque de hj pra poder aumentar o pokemon em destaque
          tbm. legal deixar ele grande pra chamar atenção."
          
          Concordo, e ha um argumento alem do espaco: o chip dizia o OBVIO. Um
          Pokemon sozinho, gigante, no topo da tela inicial ja e visivelmente o
          destaque — o rotulo so ocupava 30px pra repetir o que a composicao ja
          diz. O que ele NAO dizia, e o unico que importa, e por que este bicho
          esta ali; isso continua na frase logo abaixo do nome.
        */}
        <div className="tk-hero-name">{species.name}</div>
        <p className="tk-hero-frase">{linha}</p>

        <div className="tk-hero-acoes">
          <button type="button" className="tk-hero-cta" onClick={onOpen}>
            {t(labelKey)}
          </button>

          {/* "Ja fiz isso" silencia o destaque. So existe quando o destaque e um
              veredito pendente de um bicho seu — sem isso, nao ha o que marcar. */}
          {onToggleFeito && (
            <button
              type="button"
              className="tk-hero-feito"
              aria-pressed={feito}
              aria-label={t(feito ? "collection.undoDone" : "collection.markDone")}
              onClick={onToggleFeito}
              style={feito && tom ? { color: tom } : undefined}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
            </button>
          )}
        </div>
      </div>
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
  /*
   * O detalhe carrega a ESPECIE e, quando houver, O SEU Pokemon.
   *
   * Era so a especie, e por isso a ficha nunca via o veredito de quem estava na
   * colecao. Guardar os dois juntos e o que permite a mesma tela responder as
   * duas perguntas — "esse Pokemon presta?" e "o que eu faco com o MEU?".
   */
  const [detail, setDetail] = useState<
    { species: DatasetSpecies; owned?: OwnedPokemon | undefined } | null
  >(null);
  const abrirEspecie = (species: DatasetSpecies) => setDetail({ species });

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
          /*
           * ⚠️ O POKEMON SALVO INTEIRO, e nao so o `id`.
           *
           * Sem ele, tocar num bicho da SUA colecao abria a ficha generica da
           * ESPECIE: "Calcular IV do meu" num Dragonite que ja esta salvo com
           * IV conhecido, e nenhum veredito a vista. O app calculava a decisao
           * (esta bem aqui, no `verdict`) e a tela seguinte nao recebia.
           *
           * E o mesmo padrao que ja mordeu em `lastTtsError`, `needsElite` e
           * `bossCatchCP`: o nucleo computa e a interface nao mostra, porque o
           * dado nao viaja junto com a navegacao.
           */
          owned,
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
    /** O Pokemon salvo, pra ficha poder mostrar o veredito DELE. */
    owned?: OwnedPokemon;
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
        owned: pendente.owned,
        feito: false,
      };
    }

    if (meus) {
      return {
        species: meus.melhor.species,
        labelKey: "home.hero.best",
        linha: `${meus.melhor.iv}/45 · ${tm(meus.melhor.verdict.reason)}`,
        owned: meus.melhor.owned,
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
    /*
      A home e uma COLUNA que ocupa a tela toda, e nao uma pilha que cresce.

      "favor sem scroll na tela de inicio" + "legal deixar ele grande pra
      chamar atencao" sao, juntos, um problema de repartir altura: o hero
      precisa ser o maior possivel SEM empurrar nada pra fora. Eu vinha
      resolvendo isso escolhendo um numero (`42svh`) e conferindo num aparelho
      de 812px — o que so responde pelo aparelho que eu testei.

      Em coluna, o hero fica com `flex: 1` e o resto declara o que precisa.
      "Nao rola" deixa de ser um numero que eu acertei e passa a ser uma
      propriedade do layout: sobrou espaco, vai pro Pokemon; faltou, o Pokemon
      cede primeiro. Vale em qualquer tela, inclusive nas que eu nao tenho.
    */
    <div className="tk-home">
      {/*
        A SAUDACAO SAIU DE DENTRO DO HERO.

        "tira da cabeca do pokemon a saudação."

        Ela vivia sobre o gradiente, e enquanto o destaque era um monograma isso
        funcionava — o mockup desenhou assim porque la nao ha arte nenhuma. Com
        o sprite ocupando o hero inteiro, qualquer posicao dela cruza ALGUM
        bicho: eu empurrei a arte pra baixo duas vezes e o Dragonite continuou
        passando a antena por cima do texto, porque cada especie tem a sua
        silhueta.

        Numa faixa propria o problema deixa de existir por construcao, e nao por
        ajuste — nenhum sprite, de nenhuma forma, encosta nela. E o avatar de
        vidro que o handoff pede ("saudação 34/700 e avatar de vidro 40px")
        finalmente tem onde morar.
      */}
      <header className="tk-home-topo">
        <p className="tk-saudacao">
          {t(greetingKey())}, {setup.name.trim() || t("home.trainer")}.
        </p>
        {/* O avatar leva pra "Meus" — e o unico lugar da home que fala do
            treinador, entao e pra onde ele deve apontar. */}
        <button
          type="button"
          className="tk-avatar"
          onClick={() => onGo("pokedex", { view: "mine" })}
          aria-label={t("nav.pokedex")}
        >
          {(setup.name.trim() || t("home.trainer")).slice(0, 1).toUpperCase()}
        </button>
      </header>


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
              onOpen={() => setDetail({ species: hero.species, owned: hero.owned })}
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
                  <>
                    {/* O separador fica FORA do destaque, e nao por estilo.
                        Ele morava dentro, e saia "SUA COLEÇÃO· 4 PEDEM UMA
                        DECISÃO", grudado. A causa nao esta aqui: uma regra la
                        embaixo do CSS deu `display: inline-block` a este span
                        pra poder anima-lo, e caixa inline-block COME o proprio
                        espaco inicial. Fora dela o espaco e texto normal e
                        sobrevive a qualquer regra de animacao futura. */}
                    {" · "}
                    <span className="tk-overline-hot">
                      {meus.agir.length === 1
                        ? t("home.needsDecision.one")
                        : t("home.needsDecision.many", { count: meus.agir.length })}
                    </span>
                  </>
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
                    onClick={() => setDetail({ species: d.species, owned: d.owned })}
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
                    {/*
                      O ROTULO DO VEREDITO, que faltava.

                      O handoff pede "rótulo do veredito em 9,5/800 embaixo" em
                      cada anel, e eu tinha portado so o anel colorido. Sem o
                      rotulo, a tira comunica veredito SO POR COR — que e
                      exatamente o que a restricao de daltonismo proibe, e que o
                      resto do app respeita em todo lugar.

                      Era acessibilidade quebrada, nao enfeite faltando: a
                      informacao estava so no `aria-label`, entao existia pra
                      leitor de tela e nao pra quem enxerga mal cor.
                    */}
                    <span className="tk-strip-verdito">
                      {t(ACTION_KEYS[d.verdict.action] as Key)}
                    </span>
                  </button>
                ))}
                {/*
                  "VER MAIS" fecha a fila — tambem do handoff ("Último item da
                  tira é VER MAIS, anel neutro com chevron, e leva para a
                  Pokédex").

                  Substitui o "+3" que existia antes e so aparecia quando havia
                  mais de 12 bichos. Com poucos, a tira simplesmente terminava
                  no vazio e nao dizia que havia uma colecao inteira atras dela.
                */}
                <button
                  type="button"
                  className="tk-strip-cell tk-strip-cell--mais"
                  onClick={() => onGo("pokedex", { view: "mine" })}
                  style={{ ["--tk-i" as string]: Math.min(meus.porIv.length, NA_FILA) }}
                >
                  <span className="tk-strip-mais-anel" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                         strokeLinejoin="round">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                  <span className="tk-strip-verdito">{t("home.seeAll")}</span>
                </button>
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
          {/*
            O "Você sabia" saiu da home.

            "tira o voce sabia se for necessario pra acaba com scroll" — era
            necessario, e com folga: o cartao custava ~180px, que e exatamente
            a diferenca entre um Dragonite de 110px e um de 290px.

            A troca e boa alem da conta de pixels. O fato era interessante e
            generico; o hero e interessante e SOBRE VOCE. Numa tela que
            responde "o que eu faco agora?", o segundo ganha do primeiro. O
            componente continua existindo e pode voltar noutra tela — o que
            saiu foi o lugar, nao o conteudo.
          */}
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
            abrirEspecie(s);
          }}
        />
      )}

      {gymOpen && data && (
        <GymPicks
          data={data}
          onClose={() => setGymOpen(false)}
          onPickSpecies={(s) => {
            setGymOpen(false);
            abrirEspecie(s);
          }}
        />
      )}

      {detail && data && (
        <SpeciesDetail
          species={detail.species}
          data={data}
          owned={detail.owned}
          onClose={() => setDetail(null)}
          onPickSpecies={abrirEspecie}
        />
      )}

      {guideOpen && (
        <InstallGuide
          platform={install.platform}
          promptInstall={install.promptInstall}
          onClose={() => setGuideOpen(false)}
        />
      )}
    </div>
  );
}
