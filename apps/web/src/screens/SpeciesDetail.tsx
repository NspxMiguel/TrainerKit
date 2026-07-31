import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useFolha } from "../ui/folha.ts";
import { createPortal } from "react-dom";

import {
  CONTEXT_KEYS,
  avaliarTroca,
  GREAT_LEAGUE,
  MASTER_LEAGUE,
  ULTRA_LEAGUE,
  computeCPAtLevel,
  groupIdenticalContexts,
  rankMovesets,
  shadowDamageMultiplier,
  topSpreads,
  withFrustration,
  type Context,
  type League,
  type MoveWithPvp,
} from "@trainerkit/core";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { moveLabel, useLanguage, useShowTranslation } from "../i18n/language.ts";
import { useT, type Key } from "../i18n/t.ts";
import { useSetup } from "../onboarding/setup.ts";
import { addPokemon, useCollection, type OwnedPokemon } from "../storage/collection.ts";
import { typeColor, typeKey } from "../sprites/provider.ts";
import { AssistantCard } from "../ui/AssistantCard.tsx";
import { IconSwords } from "../ui/Icons.tsx";
import { Segmented } from "../ui/Segmented.tsx";
import { dexSystem, speciesDossier } from "../ai/dossier.ts";
import { AiBubble } from "../ui/AiBubble.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { VerdictCard } from "../ui/VerdictCard.tsx";
import { useSpriteSettings } from "../sprites/settings.ts";
import { enquadrar, usarPaleta } from "../ui/paleta.ts";
import { IVCalculator } from "./IVCalculator.tsx";
import { RaidCounters } from "./RaidCounters.tsx";

interface Props {
  species: DatasetSpecies;
  data: Dataset;
  onClose: () => void;
  /** Abrir outra especie a partir daqui — a linha de evolucao usa isto. */
  onPickSpecies?: (s: DatasetSpecies) => void;
  /** O Pokemon salvo, quando a tela vem da Colecao. */
  owned?: OwnedPokemon | undefined;
}

const PERFECT = { atk: 15, def: 15, hp: 15 };

const LEAGUES: readonly League[] = [GREAT_LEAGUE, ULTRA_LEAGUE, MASTER_LEAGUE];

/** Quantas linhas do topo mostrar. Dez cabe na tela e ja basta pra caçar. */
const TOP_SPREADS = 10;

/**
 * O maior stat base que existe no jogo, usado para escalar as barras.
 * Fixo de proposito: se fosse relativo a especie exibida, toda especie
 * pareceria igualmente forte.
 */
const STAT_SCALE = 300;

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 58, font: "500 12px var(--tk-font)", color: "var(--tk-txt3)" }}>
        {label}
      </span>
      <span style={{ width: 34, font: "700 13px var(--tk-mono)" }}>{value}</span>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: "var(--tk-surf2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(100, (value / STAT_SCALE) * 100)}%`,
            height: "100%",
            background: "var(--tk-pri)",
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
}

export function SpeciesDetail({ species: especieAberta, data, onClose, onPickSpecies, owned }: Props) {
  /*
   * ⚠️ A ESPECIE SEGUE O POKEMON SALVO, e nao a foto de quando a tela abriu.
   *
   * "cliquei em evoluir e o bulbasauro n foi, ja fiz e n foi."
   *
   * A prop `species` e um retrato do instante em que a ficha foi aberta. Depois
   * que evoluir passou a MUDAR a especie do bicho salvo, esse retrato virou
   * mentira: a tela continuava dizendo "Bulbasaur" com o botao de evoluir
   * armado, e o proximo toque evoluia de novo — pulando o Ivysaur e indo direto
   * pro Venusaur, que foi exatamente o que apareceu no teste.
   *
   * Lendo do registro salvo, a ficha acompanha: evoluiu, ela vira a forma nova,
   * o veredito recalcula e o botao passa a oferecer o proximo passo real. E o
   * "continua o trajeto" que ele pediu, sem pular degrau.
   */
  const { items } = useCollection();
  /*
   * ⚠️ Acha o Pokemon salvo MESMO quando a tela nao recebeu `owned`.
   *
   * "ele duplico e tem 2 venusaur agr"
   *
   * Abrindo a especie pela Pokedex, `owned` vem indefinido — e ai o app agia
   * como se voce nao tivesse aquele bicho: a calculadora oferecia "Salvar na
   * coleção" e criava uma SEGUNDA linha da mesma especie. Duplicar era o
   * comportamento programado, nao um acidente.
   *
   * Procurando por id primeiro (quando veio) e por especie depois, a mesma tela
   * responde as duas perguntas com o mesmo Pokemon, venha de onde vier.
   */
  const salvo =
    items?.find((x) => x.id === owned?.id) ??
    owned ??
    items?.find((x) => x.speciesId === especieAberta.id);
  const species =
    (salvo ? data.species.find((s) => s.id === salvo.speciesId) : undefined) ?? especieAberta;
  /* A folha sai animada: quem segura o no durante a saida e o `useFolha`. Todo
     caminho de fechamento passa por `fechar`, nunca pelo `onClose` cru — um que
     escape volta a piscar, e so aquele. */
  const { saindo, fechar } = useFolha(onClose);

  const [calcOpen, setCalcOpen] = useState(false);
  const [raidOpen, setRaidOpen] = useState(false);
  const [context, setContext] = useState<Context>("general");
  const [shadow, setShadow] = useState(false);
  const [league, setLeague] = useState<League>(GREAT_LEAGUE);
  const setup = useSetup();
  const language = useLanguage();
  const { t } = useT();
  useShowTranslation(); // re-renderiza ao ligar/desligar a traducao

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);

  const cpAt = (level: number) =>
    computeCPAtLevel(data.cpm, species.baseStats, PERFECT, level);

  const moveName = (id: string): string =>
    data.fastMoves.find((m) => m.id === id)?.name ??
    data.chargedMoves.find((m) => m.id === id)?.name ??
    id;

  const moveById = (id: string): MoveWithPvp | null => {
    const fast = data.fastMoves.find((m) => m.id === id);
    if (fast) return fast as MoveWithPvp;
    const charged = data.chargedMoves.find((m) => m.id === id);
    return charged ? (charged as MoveWithPvp) : null;
  };

  const collect = (ids: string[], elite: string[]): MoveWithPvp[] =>
    [
      ...ids.map((id) => moveById(id)),
      ...elite.map((id) => {
        const m = moveById(id);
        return m ? { ...m, elite: true } : null;
      }),
    ].filter((m): m is MoveWithPvp => m !== null);

  // Sombroso nao aprende nada a mais — ele PERDE um slot para a Frustracao, que
  // TM comum nao remove. Por isso o modo sombroso injeta o golpe em vez de so
  // aplicar um multiplicador: e a Frustracao que muda a recomendacao.
  const frustration = moveById("frustration");
  const chargedPool = collect(species.chargedMoves, species.eliteChargedMoves);
  /*
   * Os quatro contextos, com os que coincidem JUNTOS.
   *
   * "daria pra unificar todos q sao iguais. pra n deixar diversos botoes, que no
   * final sao exatamente iguais." A decisao e de dado, nao de layout: quem sabe
   * se dois contextos coincidem e o core, e a resposta muda por especie.
   *
   * Eternatus: "Tudo" e "Raide" dao as MESMAS cinco linhas e viram um botao so;
   * PvP tem o mesmo primeiro lugar mas ordem diferente abaixo, entao continua
   * separado — unificar ali esconderia uma diferenca de verdade.
   * Machamp: os quatro diferem, e os quatro botoes continuam.
   */
  const grupos = groupIdenticalContexts(
    collect(species.fastMoves, species.eliteFastMoves),
    shadow ? withFrustration(chargedPool, frustration) : chargedPool,
    {
      attackerTypes: species.types,
      chart: data.typeChart,
      order: data.typeOrder,
      stabMultiplier: 1.2,
    },
  );

  /** O grupo que contem o contexto escolhido. Sempre existe: todo contexto cai
   *  em exatamente um grupo (garantido por teste no core). */
  const grupoAtivo = grupos.find((g) => g.contexts.includes(context)) ?? grupos[0]!;
  const movesets = grupoAtivo.movesets;


  // Quanto custa continuar com a Frustracao.
  //
  // A conta e "e se ela fosse o UNICO carregado" — que e o estado em que o
  // sombroso sai da luta contra a Rocket, antes de o jogador pagar o segundo
  // slot de golpe. Medir contra a lista completa dava um numero pequeno e
  // enganoso: com dois slots, a Frustracao vira so uma isca ruim, e o app
  // diria que ela quase nao atrapalha. Atrapalha, e muito, no caso comum.
  //
  // Medido sempre em PvP, mesmo quando outro contexto esta selecionado: e onde
  // a Frustracao doi mais e onde o numero e mais facil de ler. As duas notas
  // saem da MESMA lista de propósito — `rankMovesets` normaliza pela melhor de
  // cada chamada, entao notas de listas diferentes nao se comparam.
  const custoDaFrustracao = (() => {
    if (!shadow || !frustration) return null;

    const juntos = rankMovesets(
      collect(species.fastMoves, species.eliteFastMoves),
      withFrustration(chargedPool, frustration),
      "pvp",
      {
        attackerTypes: species.types,
        chart: data.typeChart,
        order: data.typeOrder,
        stabMultiplier: 1.2,
      },
    );

    const livre = juntos.find((m) => !m.isFrustration);
    const presa = juntos.find((m) => m.isFrustration);
    if (!livre || !presa) return null;
    return Math.round((1 - presa.score / livre.score) * 100);
  })();

  // Ranquear 4.096 combinacoes nao e barato; sem memo isso rodaria de novo a
  // cada clique no seletor de moveset, que nao tem nada a ver com a liga.
  /**
   * Quais ligas valem um botao.
   *
   * Uma liga so muda a resposta se o teto de PC dela REALMENTE limitar a
   * especie. Um Azumarill nao chega aos 2.500 da Ultra: ali, na Master e em
   * qualquer teto acima, todo IV sobe ao nivel maximo e o melhor vira 15/15/15
   * — a mesma tabela tres vezes.
   *
   * Tres botoes que dao o mesmo resultado nao sao escolha, sao ruido. Entao a
   * tela mostra so as ligas em que o teto morde, e junta o resto numa unica
   * entrada honesta: "sem teto que limite".
   */
  const leagues = useMemo(() => {
    const cap = data.version.levelCap;
    const limita = (l: League) =>
      l.cpCap !== null &&
      (topSpreads(data.cpm, species.baseStats, l, 1)[0]?.level ?? 0) < cap;

    const comTeto = LEAGUES.filter(limita);
    // A Master (e qualquer liga que nao limite) colapsam numa so: o resultado
    // e identico, entao mostrar as duas seria mentir sobre haver escolha.
    return [...comTeto, MASTER_LEAGUE];
  }, [data.cpm, data.version.levelCap, species.baseStats]);

  // Se a liga selecionada sumiu ao trocar de especie, cai na primeira.
  const activeLeague = leagues.some((l) => l.id === league.id) ? league : leagues[0]!;

  // Ranquear 4.096 combinacoes nao e barato; sem memo isso rodaria de novo a
  // cada clique no seletor de moveset, que nao tem nada a ver com a liga.
  const spreads = useMemo(
    () => topSpreads(data.cpm, species.baseStats, activeLeague, TOP_SPREADS),
    [data.cpm, species.baseStats, activeLeague],
  );

  /*
   * Quem aparece como chefe de raide: so forma FINAL.
   *
   * A lista real muda a cada evento e nao esta no GAME_MASTER, entao isto e
   * regra, nao dado. A primeira versao dizia "lendario OU forma final" — e a
   * varredura nas 1.182 especies mostrou que "lendario" sozinho nao serve:
   * existem oito lendarios e miticos que AINDA EVOLUEM (Cosmog, Cosmoem,
   * Meltan, Poipole, Kubfu, Type: Null, Zygarde e Zygarde 10%), e nenhum deles
   * e chefe de raide — sao bichos de pesquisa e evolucao.
   *
   * "Nao evolui mais" cobre os dois lados sozinho: pega Mewtwo e Rayquaza,
   * descarta Caterpie e Cosmog. Perguntar "consigo derrubar esse numa raide?"
   * pro Caterpie fazia o app parecer que nao sabe do que fala.
   */
  const podeSerChefe = species.evolvesInto.length === 0;

  // A ficha manda na paleta enquanto esta aberta, e a home retoma ao fechar.
  // A pilha em `ui/paleta.ts` cuida da troca nos dois sentidos.
  const paleta = usarPaleta(species.spriteId);
  // Mesmo enquadramento medido do hero da home — ver `enquadrar()`.
  const quadro = enquadrar(
    species.spriteId,
    useSpriteSettings().source === "pokeapi-home" ? "3d" : "artwork",
  );

  const evolutions = species.evolvesInto
    .map((id) => data.species.find((s) => s.id === id))
    .filter((s): s is DatasetSpecies => s !== undefined);

  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label={species.name} data-saindo={saindo || undefined}>
      {/*
        O MESMO HERO DA HOME, aqui na ficha.

        "o app parece tres apps diferentes dependendo da tela" — era a queixa
        dele no briefing, e esta tela era o exemplo mais caro, porque e a mais
        visitada: a home ganhou um Pokemon gigante com a cor da especie, e a
        ficha continuava um tile de 116px ao lado de um titulo.

        As classes sao literalmente as do hero da home, com um modificador. Nao
        e economia de CSS: e o que impede as duas de divergirem de novo na
        proxima mudanca. Se o hero mudar, muda nos dois.

        Sem titulo no cabecalho, como antes: ele dizia "Pokédex" e mentia quando
        a tela era aberta pela Colecao. Fica so a seta, e quem nomeia a tela e o
        nome gigante do bicho.
      */}
      <div
        className="tk-hero tk-hero--ficha"
        style={{ ["--tk-hero-grad" as string]: paleta.gradiente }}
      >
        <span className="tk-hero-brilho" aria-hidden="true" />
        <span className="tk-hero-numero" aria-hidden="true">
          {species.dex}
        </span>

        <span
          className="tk-hero-art"
          aria-hidden="true"
          style={
            {
              "--tk-art-larg": quadro.larg,
              "--tk-art-alt": quadro.alt,
              "--tk-art-topo": quadro.topo,
              "--tk-art-cx": quadro.centroX,
            } as CSSProperties
          }
        >
          <SpeciesTile
            spriteId={species.spriteId}
            dex={species.dex}
            speciesId={species.id}
            name={species.name}
            types={species.types}
            size={220}
            bare
          />
        </span>

        <span className="tk-hero-scrim" aria-hidden="true" />

        <div className="tk-hero-topo">
          <button
            type="button"
            className="tk-sheet-close"
            onClick={fechar}
            aria-label={t("common.back")}
          >
            ‹
          </button>
        </div>

        <div className="tk-hero-base">
          <div className="tk-hero-name">{species.name}</div>
          <div className="tk-hero-dex">#{String(species.dex).padStart(3, "0")}</div>
          <div className="tk-hero-tipos">
            {species.types.map((tp) => (
              <span key={tp} className="tk-hero-tipo" style={{ background: typeColor(tp) }}>
                {t(typeKey(tp) as "type.normal")}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/*
        O CARTAO DO VEREDITO — a peça central do handoff, e ela simplesmente
        nao existia nesta tela.

        "ta faltando muita coisa q eu pedi, e muita coisa do app bom de vdd."

        O `VerdictCard` ja estava escrito, com barra de confianca e rastro
        auditavel, e era usado SO na calculadora de IV. A ficha — a tela mais
        visitada, e a que o handoff detalha mais — nunca o mostrava. Quem tocava
        num Pokemon da propria colecao via "Calcular IV do meu" num bicho cujo
        IV o app ja sabia.

        Duas falhas somadas: a navegacao nao levava o Pokemon salvo (ver a nota
        no `HomeScreen`), e a tela nao pedia o cartao nem quando tinha. O motor
        decidia, a barra de confianca era calculada, o rastro existia — e nada
        disso chegava aos olhos. E a tese do produto inteiro: "decide, e aceita
        ser conferido".
      */}
      {salvo && (
        <VerdictCard
          owned={salvo}
          name={species.name}
          baseStats={species.baseStats}
          ivs={salvo.ivs}
          level={salvo.level ?? 20}
          cpm={data.cpm}
          levelCap={data.version.levelCap}
          evolvesInto={species.evolvesInto}
          candyToEvolve={
            species.evolvesInto[0]
              ? (species.candyToEvolve[species.evolvesInto[0]] ?? null)
              : null
          }
          lucky={salvo.lucky}
          shadow={salvo.shadow}
        />
      )}

      {/*
        "EU TENHO ESSE" — entrar na colecao sem escanear IV.

        "o unico jeito atual de colocar eles no eu tenho, é escaneando iv. e se
        a pessoa n qr escanear iv?"

        Ele achou um funil fechado: quem nao quer (ou nao pode) escanear
        simplesmente nao conseguia registrar um Pokemon. Escanear e o melhor
        caminho, e nao pode ser o UNICO — a pessoa acabou de pegar o bicho, quer
        marcar que tem, e resolve o IV depois.

        ⚠️ Sem IV o app NAO inventa veredito. O Pokemon entra marcado como "sem
        IV" e o veredito dele passa a ser "falta o IV pra eu decidir", que e
        literalmente o proximo passo. Ver a nota em `HomeScreen`: decidir em
        cima dos zeros daria "Transferir" com confianca cheia pra um possivel
        100%.
      */}
      {setup.mode === "colecao" && !salvo && (
        <button
          type="button"
          className="tk-btn tk-btn--secondary tk-btn--block"
          style={{ marginBottom: 10 }}
          onClick={() => {
            void addPokemon({
              speciesId: species.id,
              nickname: null,
              ivs: { atk: 0, def: 0, hp: 0 },
              ivDesconhecido: true,
              level: null,
              cp: null,
              hp: null,
              lucky: false,
              shadow: false,
              doneAction: null,
            });
          }}
        >
          {t("species.iHaveThis")}
        </button>
      )}

      <button
        type="button"
        className="tk-btn tk-btn--primary tk-btn--block"
        onClick={() => setCalcOpen(true)}
      >
        {/* Vindo da Colecao o IV ja e conhecido: o botao abre o que ja existe,
            nao pede pra calcular de novo. */}
        {salvo ? t("species.seeMyIV") : t("species.calcIV")}
      </button>


      {/*
        A BOLHA DA IA — "54px de vidro, canto inferior direito, estrela em
        gradiente violeta" (handoff §5), e a tarefa que ele abriu ha tempo
        ("bolinha flutuante da IA, tipo o WhatsApp").

        Ela nao substitui o cartao: leva ate ele. O assistente explica um
        veredito que ja existe, entao ele mora ABAIXO da analise, e a bolha e o
        atalho pra quem rolou ate a metade e quer perguntar agora.

        ⚠️ Violeta, e nao a cor da especie. A IA e funcao DO APP, como o botao
        primario era antes — e ela precisa ser reconhecivel como a mesma coisa
        em qualquer ficha.
      */}
      {setup.assistant && (
        <button
          type="button"
          className="tk-ia-bolha"
          aria-label={t("assistant.ask")}
          onClick={() => {
            document
              .querySelector(".tk-assistente")
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 3l1.9 4.9L19 9.8l-4.3 3 .6 5.2-3.3-2.5-3.3 2.5.6-5.2L5 9.8l5.1-1.9L12 3z"
              fill="url(#tk-estrela)"
            />
            <defs>
              <linearGradient id="tk-estrela" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#c4b5ff" />
                <stop offset="1" stopColor="#6b4bff" />
              </linearGradient>
            </defs>
          </svg>
        </button>
      )}

      {setup.assistant && (
        <AssistantCard
          name={species.name}
          baseStats={species.baseStats}
          cpm={data.cpm}
          levelCap={data.version.levelCap}
        />
      )}

      {/*
        Trocar vem DEPOIS do veredito, e a ordem importa.

        A pergunta "vale trocar?" e uma segunda opiniao sobre uma decisao que o
        "O que eu acho" ja tomou — e no caso mais util as duas discordam de
        propósito: especie boa com IV ruim leva "Transferir", e a troca e
        justamente o que se faz EM VEZ de transferir. Ler a etiqueta antes do
        veredito inverteria a conversa.

        So aparece quando ha UM Pokemon concreto: "vale trocar?" nao existe pra
        uma especie, e sim pro IV deste exemplar. Na Pokedex sem colecao o bloco
        some inteiro em vez de mostrar numeros genericos.

        O caso bloqueado (sombroso, sortudo) tambem aparece, com o motivo — nao
        saber POR QUE a etiqueta nao veio e o que faz parecer que o app esqueceu.
      */}
      {salvo && <BlocoTroca owned={salvo} baseStats={species.baseStats} />}

      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        {t("species.baseStats")}
      </div>
      <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <StatBar label={t("common.attack")} value={species.baseStats.atk} />
        <StatBar label={t("common.defense")} value={species.baseStats.def} />
        <StatBar label={t("common.stamina")} value={species.baseStats.hp} />
      </section>

      {/*
        "Consigo derrubar numa raide?" — menor, e mais embaixo.

        Estava logo abaixo do nome, num bloco do tamanho da acao principal, e
        aparecia ate em Caterpie. Duas coisas erradas ao mesmo tempo: peso de
        acao primaria pra uma pergunta secundaria, e a pergunta em si sem
        sentido pra quem nunca e chefe de raide.
      */}
      {setup.mode === "colecao" && podeSerChefe && (
        <button
          type="button"
          className="tk-btn tk-btn--secondary tk-btn--block"
          style={{ marginTop: 22, height: 44, fontSize: 14 }}
          onClick={() => setRaidOpen(true)}
        >
          <IconSwords size={17} />
          {t("raid.open")}
        </button>
      )}

      <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
        {t("species.maxCP")}
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 24 }}>
          {[40, 50, data.version.levelCap].map((level) => (
            <div key={level}>
              <div style={{ font: "800 22px/1.1 var(--tk-font)", letterSpacing: "-0.02em" }}>
                {cpAt(level).toLocaleString(language)}
              </div>
              <div className="tk-caption">{t("common.level")} {level}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
        {t("species.bestMoves")}
      </div>

      {/*
        Um botao por GRUPO, e nenhum quando ha grupo unico.

        Seletor com uma opcao so nao e escolha, e enfeite que ocupa espaco e
        sugere que existe outra coisa pra ver.
      */}
      {grupos.length > 1 && (
        <div style={{ margin: "10px 0" }}>
          <Segmented
            ariaLabel={t("species.bestMoves")}
            value={grupoAtivo.contexts[0]!}
            onChange={setContext}
            size="compact"
            options={grupos.map((g) => ({
              value: g.contexts[0]!,
              // "Tudo · Raide" quando dois contextos caem no mesmo lugar. O
              // rotulo composto e o que explica por que ha tres botoes e nao
              // quatro — sem ele, pareceria que um sumiu.
              label: g.contexts.map((c) => t(CONTEXT_KEYS[c].title as Key)).join(" · "),
            }))}
          />
        </div>
      )}

      <p className="tk-caption" style={{ margin: "0 2px 10px", lineHeight: 1.45 }}>
        {grupoAtivo.contexts.length > 1
          ? t("species.sameForAll", {
              contexts: grupoAtivo.contexts
                .map((c) => t(CONTEXT_KEYS[c].title as Key))
                .join(", "),
            })
          : t(CONTEXT_KEYS[grupoAtivo.contexts[0]!].detail as Key)}
      </p>

      {/* Chip, nao botao de bloco: o sombroso e um filtro do que esta abaixo,
          nao a acao principal da tela — quem compete por essa atencao e o
          "Calcular IV do meu" la em cima. */}
      <button
        type="button"
        className={`tk-btn ${shadow ? "tk-btn--primary" : "tk-btn--secondary"}`}
        style={{ height: 34, fontSize: 12, padding: "0 14px", marginBottom: 10 }}
        aria-pressed={shadow}
        onClick={() => setShadow((v) => !v)}
      >
        {shadow ? t("species.shadowToggleOn") : t("species.shadowToggle")}
      </button>

      {shadow && (
        <p className="tk-caption" style={{ margin: "0 2px 10px", lineHeight: 1.45 }}>
          {t("species.shadowNote", {
            percent: Math.round((shadowDamageMultiplier(data.settings.battle) - 1) * 100),
          })}
          {custoDaFrustracao !== null &&
            t("species.frustrationCost", { percent: custoDaFrustracao })}
        </p>
      )}

      <section className="tk-card">
        {movesets.length === 0 ? (
          <p className="tk-body">{t("species.noMoves")}</p>
        ) : (
          movesets.slice(0, 5).map((m, i) => {
            const f = moveLabel(m.fast.name, data.moveNames, m.fast.id, language);
            const c = moveLabel(m.charged.name, data.moveNames, m.charged.id, language);
            const traducao = [f.secondary, c.secondary].filter(Boolean).join(" · ");
            const extras = [
              m.bait
                ? t("species.bait", {
                    move: moveLabel(m.bait.name, data.moveNames, m.bait.id, language).primary,
                  })
                : null,
              m.isFrustration ? t("species.stuckOnFrustration") : null,
              m.needsElite ? t("species.needsElite") : null,
            ].filter(Boolean);

            return (
              /*
               * Duas linhas fixas em vez de um paragrafo que se enrola.
               *
               * Antes o nome ingles, a traducao entre parenteses e o "+" viviam
               * na mesma linha, e "Vine Whip (Chicote de Vinha) + Power Whip
               * (Chicote Poderoso)" quebrava em tres — com a nota flutuando no
               * meio. Separando nome de traducao, os cinco movesets viram cinco
               * linhas do mesmo tamanho, e a coluna da nota alinha.
               */
              <div className="tk-move" key={`${m.fast.id}/${m.charged.id}/${m.bait?.id ?? ""}`}>
                <span className="tk-move-main">
                  <span className={`tk-move-name${i === 0 ? " tk-move-name--top" : ""}`}>
                    {f.primary} + {c.primary}
                  </span>
                  {traducao && <span className="tk-move-sub">{traducao}</span>}
                  {extras.length > 0 && (
                    <span
                      className="tk-move-sub"
                      style={m.isFrustration ? { color: "var(--tk-dang)" } : undefined}
                    >
                      {extras.join(" · ")}
                    </span>
                  )}
                </span>
                <span className={`tk-move-score${i === 0 ? " tk-move-score--top" : ""}`}>
                  {Math.round(m.score * 100)}
                </span>
              </div>
            );
          })
        )}
      </section>

      {/* O IV que se procura, por liga.
          A tela do jogo mostra porcentagem, e porcentagem e a metrica errada
          aqui: em liga com teto o 100% quase sempre perde. */}
      <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
        {leagues.length > 1 ? t("spread.title") : t("spread.titleSimple")}
      </div>

      {/* Um botao so quando so ha uma resposta: nao ha o que escolher. */}
      {leagues.length > 1 && (
        <div style={{ margin: "10px 0" }}>
          <Segmented
            ariaLabel={t("spread.title")}
            value={activeLeague.id}
            onChange={(id) => {
              const escolhida = leagues.find((l) => l.id === id);
              if (escolhida) setLeague(escolhida);
            }}
            size="compact"
            options={leagues.map((l) => ({
              value: l.id,
              label: l.id === "master" ? t("spread.noLimit") : l.name.replace(" League", ""),
            }))}
          />
        </div>
      )}

      {/* Grade propria em vez de `tk-row`: sao dez linhas de numeros curtos, e
          o espacamento de linha de formulario deixava a tabela com mais de mil
          pixels de altura, com o IV quebrando em duas linhas. */}
      {/*
        Sem teto que limite, a tabela e ruido.
        Dez linhas de 15/15/15, 14/15/15, 15/14/15… nao sao dez respostas: sao a
        mesma resposta escrita dez vezes. Quem chega aqui quer saber que IV
        procurar, e quando o teto nao morde a resposta e "o mais alto possivel".
        Mostrar a tabela mesmo assim seria encher tela pra parecer que o app
        trabalhou.
      */}
      {leagues.length === 1 ? (
        <section className="tk-card">
          <p className="tk-body" style={{ color: "var(--tk-txt)", margin: 0 }}>
            {t("spread.neverCapped", {
              name: species.name,
              maxCp: cpAt(data.version.levelCap).toLocaleString(language),
            })}
          </p>
        </section>
      ) : (
      <section className="tk-card">
      {/*
        UMA coluna de IV, no formato 14/15/13.

        "na opção melhores iv por liga nao mostra o iv? kkk" — mostrava, e era
        impossivel de ler. As tres colunas se chamavam "Atq / Def / PS", que sao
        EXATAMENTE as palavras que o app usa pra atributo base duas secoes acima.
        Entao "Atq 0" nao parecia um IV zero, parecia um ataque zero — que seria
        absurdo, e por isso ninguem lia como IV.

        `14/15/13` e como todo jogador escreve IV, dentro e fora do jogo. A forma
        carrega o significado sem precisar de rotulo explicando.
      */}
      <div className="tk-spread-head">
          <span>{t("spread.rank")}</span>
          <span>{t("spread.ivs")}</span>
          <span>{t("spread.level")}</span>
          <span>{t("spread.cp")}</span>
        </div>

        {spreads.map((sp) => (
          <div
            key={`${sp.ivs.atk}-${sp.ivs.def}-${sp.ivs.hp}`}
            className={`tk-spread${sp.rank === 1 ? " tk-spread--top" : ""}`}
          >
            <span>{sp.rank}</span>
            <span>
              {sp.ivs.atk}/{sp.ivs.def}/{sp.ivs.hp}
            </span>
            <span className="tk-spread-dim">{sp.level}</span>
            <span>{sp.cp.toLocaleString(language)}</span>
          </div>
        ))}

        <p className="tk-caption" style={{ marginTop: 12, lineHeight: 1.5 }}>
          {activeLeague.cpCap === null
            ? t("spread.noCap")
            : t("spread.capped", { cap: activeLeague.cpCap.toLocaleString(language) })}
        </p>
      </section>
      )}

      {evolutions.length > 0 && (
        <>
          <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
            {t("species.evolvesInto")}
          </div>
          <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 12 }}>
            {/* Clicavel. Um usuario que ve "Evolui para Venusaur" com o sprite
                do lado vai tentar tocar — e ate agora nao acontecia nada. */}
            {evolutions.map((e) => (
              <button
                type="button"
                key={e.id}
                className="tk-evo"
                onClick={() => onPickSpecies?.(e)}
              >
                <SpeciesTile
                  spriteId={e.spriteId}
                  dex={e.dex}
                  speciesId={e.id}
                  name={e.name}
                  types={e.types}
                  size={44}
                />
                <span className="tk-row-label">{e.name}</span>
                {species.candyToEvolve[e.id] !== undefined && (
                  <span className="tk-row-value">
                    {t("species.candy", { count: species.candyToEvolve[e.id]! })}
                  </span>
                )}
                <span className="tk-quick-go" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </section>
        </>
      )}

      {calcOpen && (
        <IVCalculator species={species} data={data} onClose={() => setCalcOpen(false)} owned={salvo} />
      )}
      {raidOpen && (
        <RaidCounters boss={species} data={data} onClose={() => setRaidOpen(false)} />
      )}

      {/*
        A bolha, com o dossie DESTA especie.

        E o "chatbot ao clicar num Pokémon" que ele pediu. O contexto e o mesmo
        `speciesDossier` que a Pokedex ja usa — nao ha segundo caminho de dados,
        entao as duas telas nunca podem discordar sobre o mesmo bicho.

        Fica fora dos dois modais acima de propósito: com o calculador de IV ou
        os counters abertos, a pergunta seria sobre outra coisa que nao a tela
        na frente.
      */}
      {!calcOpen && !raidOpen && (
        <AiBubble
          titulo={species.name}
          sistema={dexSystem(language)}
          // `owned` aqui e UM Pokemon (o da tela), nao a colecao — vira lista de um.
          contexto={speciesDossier(species, data, salvo ? [salvo] : [], language)}
        />
      )}
    </div>,
    document.body,
  );
}

/**
 * O bloco de troca.
 *
 * Tres cenarios em vez de um numero so, porque o resultado da troca depende de
 * quem esta do outro lado — e isso o app nao tem como saber. Mostrar "vale a
 * pena" sem dizer sob qual amizade seria a mesma promessa vaga que o app existe
 * pra nao fazer.
 *
 * A chance de a troca SAIR sortuda nao aparece em lugar nenhum, de proposito:
 * ela depende de tempo de amizade, de Lucky Friends e da data de captura dos
 * dois Pokemon. Chutar uma porcentagem ali seria inventar precisao — o que se
 * mostra e o cenario, "se sair sortudo, e isto".
 */
function BlocoTroca({
  owned,
  baseStats,
}: {
  owned: OwnedPokemon;
  baseStats: DatasetSpecies["baseStats"];
}) {
  const { t, tm } = useT();
  const language = useLanguage();
  /*
   * A media sai com virgula ou ponto conforme o idioma, e sem ".0".
   *
   * `toFixed(1)` escrevia "24.0/45 na média" em portugues: ponto decimal errado
   * pro idioma e uma casa decimal que nao existe (a media do piso 1 e 24 cravado).
   * Quem tem casa de verdade e so o sortudo, 40,5.
   */
  const media = (n: number) => n.toLocaleString(language, { maximumFractionDigits: 1 });
  const troca = avaliarTroca({
    ivs: owned.ivs,
    baseStats,
    lucky: owned.lucky,
    shadow: owned.shadow,
  });

  return (
    <>
      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        {t("trade.title")}
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        <p className="tk-body" style={{ margin: 0 }}>
          {troca.vale && <span className="tk-tag-trade">{t("trade.tag")}</span>}
          {tm(troca.motivo)}
        </p>
        {/* Os cenarios so aparecem quando trocar e possivel. Num sombroso eles
            seriam uma tabela sobre algo que nao pode acontecer. */}
        {troca.vale && (
          <dl className="tk-trade-odds">
            <dt>{t("trade.friend")}</dt>
            <dd>{t("trade.odds", { media: media(troca.amigo.media) })}</dd>
            <dt>{t("trade.bestFriend")}</dt>
            <dd>{t("trade.odds", { media: media(troca.melhorAmigo.media) })}</dd>
            <dt>{t("trade.lucky")}</dt>
            <dd>{t("trade.luckyOdds", { media: media(troca.sortudo.media) })}</dd>
          </dl>
        )}
      </section>
    </>
  );
}
