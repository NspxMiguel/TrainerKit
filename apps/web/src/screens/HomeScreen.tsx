import { useMemo, useState, type CSSProperties } from "react";

import { useTelaLarga } from "../ui/telaLarga.ts";
import { PEDEM_ACAO } from "../storage/pendencias.ts";

import {
  ACOES_QUE_COBRAM,
  ACTION_KEYS,
  cumpriu,
  decide,
  fazGigantamax,
  ivTotalOf,
  type Action,
  type Verdict,
} from "@trainerkit/core";

import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { moveLabel, useLanguage } from "../i18n/language.ts";
import { formatNumber, useT, type Key } from "../i18n/t.ts";
import type { PokedexIntent } from "../App.tsx";
import { tetoDePowerUp, useSetup } from "../onboarding/setup.ts";
import { typeColor, typeKey } from "../sprites/provider.ts";
import { useSpriteSettings } from "../sprites/settings.ts";
import {
  evolvePokemon,
  setDoneAction,
  useCollection,
  type OwnedPokemon,
} from "../storage/collection.ts";
import { useInstallState } from "../storage/install.ts";
import type { PersistState } from "../storage/persist.ts";
import { formatBytes } from "../storage/tamanho.ts";
import { DidYouKnow } from "../ui/DidYouKnow.tsx";
import { Esqueleto, Offline, Vazio } from "../ui/Estados.tsx";
import { IconAlert, IconCamera, IconSearch, IconShield, IconSwords } from "../ui/Icons.tsx";
import { InstallBanner } from "../ui/InstallBanner.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { enquadrar, usarPaleta } from "../ui/paleta.ts";
import { TOM_VEREDITO as TONE } from "../ui/tomVeredito.ts";
import { Colecoes } from "./Colecoes.tsx";
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

/**
 * O simbolo que abre o veredito no cartao da tela larga.
 *
 * Vem do desenho, que traz o mapa pronto: `investir:'↑ INVESTIR'`,
 * `evoluir:'✦ EVOLUIR'`, `guardar:'◆ GUARDAR'`, `transferir:'→ TRANSFERIR'`.
 *
 * ⚠️ SO ENFEITE, DE PROPOSITO. O simbolo vem SEMPRE acompanhado da palavra, e
 * nunca no lugar dela — a mesma regra do "✓ FEITO" logo abaixo. Sozinho ele
 * seria informacao por forma, e quem nao decora quatro glifos ficaria sem o
 * veredito. Por isso tambem fica fora do `aria-label` do cartao: pra leitor de
 * tela "seta pra cima investir" e ruido, nao reforco.
 *
 * ⚠️ O `descobrir` NAO EXISTE NO DESENHO — o mapa de la tem quatro entradas, e
 * o app tem cinco acoes. O "?" e escolha minha, e e a escolha honesta: esse
 * veredito e literalmente uma pergunta ("eu nao sei, me da o IV", como diz o
 * comentario do `Action` no core), entao o simbolo diz o mesmo que a palavra.
 */
const ACTION_GLYPHS: Record<Action, string> = {
  investir: "↑",
  evoluir: "✦",
  guardar: "◆",
  transferir: "→",
  descobrir: "?",
};

/**
 * O que a home mostra da colecao.
 *
 * Nao e a colecao inteira — para isso existe a aba. Aqui aparece so o que PEDE
 * ACAO: evoluir e transferir mudam o Pokemon, investir gasta recurso. "Guardar"
 * e o veredito de quem nao precisa fazer nada, e portanto nao merece espaco na
 * primeira tela.
 *
 * ⚠️ A LISTA `PEDEM_ACAO` MUDOU DE ENDERECO: ela agora mora em
 * `storage/pendencias.ts`, e esta tela a IMPORTA.
 *
 * O motivo e o mesmo que a nota antiga ja dava — "duas telas com a mesma regra
 * escrita em dois lugares divergem; ja divergiram antes, neste mesmo app". O
 * selo da barra lateral precisava do mesmo criterio, e copiar o filtro pra la
 * teria criado exatamente a divergencia que a nota previa: o selo dizendo 4 e a
 * fila mostrando 3.
 */

/**
 * Quantos Pokemon aparecem na fila. O quinto lugar e sempre o "VER MAIS".
 *
 * "ao invez de uma faixa com scroll pro lado, coloca tipo, no lugar do 5 um ver
 * mais."
 *
 * Eram 12 com rolagem lateral, e ele esta certo em cortar: rolagem horizontal
 * numa tela que nao rola na vertical e um gesto que ninguem descobre. O que
 * estava fora da tela existia so pra quem tentasse arrastar — ou seja, quase
 * ninguem — e o "+3" no fim so aparecia acima de 12.
 *
 * Com quatro e um destino fixo, tudo que a fila mostra esta visivel, e o
 * caminho pra colecao inteira e um alvo permanente em vez de uma descoberta.
 */
const NA_FILA = 4;

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
  evolui,
  feito,
  onToggleFeito,
}: {
  species: DatasetSpecies;
  labelKey: Key;
  linha: string;
  tom?: string | undefined;
  onOpen: () => void;
  /** O botao redondo vai EVOLUIR o bicho, e nao so marcar como feito. */
  evolui?: boolean | undefined;
  /** Presente so quando o destaque e um veredito pendente de um bicho seu. */
  feito?: boolean | undefined;
  onToggleFeito?: (() => void) | undefined;
}) {
  const { t } = useT();
  /* O hero encolhe pra 74px na tela larga (documento de desktop) e continua
     sendo o retrato de 220px no celular. Ver a nota do `size` abaixo. */
  const telaLarga = useTelaLarga();

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

  /*
   * O enquadramento depende da FONTE de imagem escolhida nos Ajustes.
   *
   * A arte oficial e os renders 3D enquadram os mesmos bichos de jeitos
   * diferentes, entao cada uma tem a sua caixa medida. Com a fonte desligada
   * (monograma) nada disso vale, e `enquadrar` devolve a identidade.
   */
  const fonteSprite = useSpriteSettings().source;
  const semImagem = fonteSprite === "off";
  const quadro = enquadrar(
    species.spriteId,
    fonteSprite === "pokeapi-home" ? "3d" : "artwork",
  );

  return (
    <div
      className="tk-hero"
      style={
        {
          /*
            As DUAS versoes do degrade viajam juntas; quem escolhe e o CSS.
            
            "faz o degrade ser branco no modo claro ne...."
            
            So o `ui/paleta.ts` sabe fazer a conta de contraste de cada parada,
            e so o CSS sabe qual tema esta valendo. Escrever as duas e deixar a
            cascata decidir evita um ouvinte de `prefers-color-scheme` em JS —
            que e onde os dois lados dessincronizam.
          */
          "--tk-hero-grad": paleta.gradiente,
          "--tk-hero-grad-claro": paleta.gradienteClaro,
        } as CSSProperties
      }
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
      {/*
        Sem imagem, o numero da dex sai de cena.

        "e sem imagens tbm." Nesse modo quem faz o papel de assunto e o
        monograma, e ele fica grande no meio do hero — e o numero gigante atras
        passaria a competir com ele em vez de ficar atras dele, porque letra nao
        tem silhueta pra recortar o algarismo. Duas formas claras do mesmo
        tamanho no mesmo lugar nao somam, brigam.

        Com arte, o recorte acontece e os dois convivem: e daí que vem a
        profundidade.
      */}
      {semImagem ? null : (
      <span className="tk-hero-numero" aria-hidden="true">
        {/*
          Tres digitos sempre: "001", nao "1".
          
          Um algarismo sozinho a 272px nao le como numero — le como uma barra
          clara no meio do cartao, e o Bulbasaur mostrou isso na tela. Com o
          zero a esquerda a forma vira reconhecivelmente um NUMERO, que e o que
          justifica ele estar ali, e ainda e como a dex se escreve no jogo.
        */}
        {String(species.dex).padStart(3, "0")}
      </span>
      )}

      {/*
        O assunto, na frente de tudo.

        Sem arte — fonte de imagens desligada, sprite ainda baixando, especie sem
        arquivo — o `SpeciesTile` ja mostra o monograma no lugar, e a composicao
        continua de pe: o "DR" vira o assunto e o numero continua atras dele. So
        o recorte fica reto, porque letra nao tem silhueta.

        `bare` tira a moldura do tile: aqui o fundo ja e o gradiente do hero, e
        um tile arredondado por cima dele seria uma caixa dentro de outra.
      */}
      {/*
        O enquadramento vem MEDIDO da arte, e nao chutado.

        "tem q testar pokemon por pokemon, pra sempre dar certo." A caixa justa
        de cada sprite foi medida no gerador; aqui ela vira escala e
        deslocamento, e o efeito e que todo Pokemon ocupa o MESMO retangulo —
        que e o que faz um unico layout servir pros 1.142. Ver `enquadrar()`.
      */}
      <span
        className="tk-hero-art"
        aria-hidden="true"
        data-sem-imagem={semImagem || undefined}
        style={
          {
            "--tk-art-larg": quadro.larg,
            "--tk-art-alt": quadro.alt,
            "--tk-art-topo": quadro.topo,
            "--tk-art-cx": quadro.centroX,
            /*
              ⚠️ A conta ja vem FEITA: `barriga x alt`, e nao os dois separados.
              
              O CSS precisa de `95cqh / (barriga x alt)`, e dividir por uma
              EXPRESSAO dentro de `calc()` e Values 4 — nem todo navegador que
              este app atende aceita, e um `calc()` invalido nao avisa: a
              propriedade inteira e descartada em silencio e o sprite volta ao
              tamanho intrinseco. Multiplicar aqui deixa o CSS com uma divisao
              por variavel simples, que todos aceitam.
            */
            "--tk-art-cara": quadro.barriga * quadro.alt,
          } as CSSProperties
        }
      >
        <SpeciesTile
          spriteId={species.spriteId}
          dex={species.dex}
          speciesId={species.id}
          name={species.name}
          types={species.types}
          /*
            ⚠️ 220 NO CELULAR, 74 NA TELA LARGA — e o tamanho e PROP, nao CSS.
            
            `SpeciesTile` escreve `width`/`height`/`font-size` inline, e estilo
            inline ganha de qualquer classe: eu tentei encolher o tile do hero
            por CSS e o monograma continuou em 62,9px vazando de um tile de
            74px, sem erro nenhum aparecer. Segunda vez que este mesmo detalhe
            me pegou nesta tela — a primeira foi na tira da colecao.
            
            Os 74px sao a medida do hero compacto do documento de desktop; os
            220 sao o retrato que ele pediu no celular ("sem cara de Pokémon").
          */
          size={telaLarga ? 74 : 220}
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

          {/*
            O botao redondo confirma o veredito. So existe quando o destaque e
            um veredito pendente de um bicho seu — sem isso, nao ha o que
            confirmar.

            ⚠️ EM "EVOLUIR" ELE NAO E UM CHECK, e o rotulo e o desenho tem que
            dizer isso: ele TRANSFORMA o Pokemon na proxima forma. Um check
            significaria "anotei", e o que acontece e outra coisa — a especie
            muda na colecao. Rotulo que descreve mal uma acao irreversivel e
            pior que rotulo nenhum.

            A seta pra cima e o glifo que o proprio handoff usa pra evolucao.
          */}
          {onToggleFeito && (
            <button
              type="button"
              className="tk-hero-feito"
              aria-pressed={evolui ? undefined : feito}
              aria-label={t(
                evolui ? "collection.evolved" : feito ? "collection.undoDone" : "collection.markDone",
              )}
              onClick={onToggleFeito}
              style={feito && tom ? { color: tom } : undefined}
            >
              {evolui ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              )}
              {/*
                A PALAVRA so aparece na tela larga — o CSS a esconde no celular.

                "Já fiz isso" e o rotulo do documento de desktop. O texto e o
                MESMO do `aria-label` acima, de proposito: assim ele acompanha
                os tres estados e os dez idiomas sem chave nova, e nao ha risco
                de o botao dizer uma coisa pra quem ve e outra pra quem ouve.

                `aria-hidden` porque o `aria-label` do botao ja anuncia este
                texto; sem isso o leitor de tela leria a mesma frase duas vezes.
              */}
              <span className="tk-hero-feito-rot" aria-hidden="true">
                {t(
                  evolui ? "collection.evolved" : feito ? "collection.undoDone" : "collection.markDone",
                )}
              </span>
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
  const [contasAberto, setContasAberto] = useState(false);
  const [detail, setDetail] = useState<
    { species: DatasetSpecies; owned?: OwnedPokemon | undefined } | null
  >(null);
  const abrirEspecie = (species: DatasetSpecies) => setDetail({ species });

  const ready = dataset.status === "ready";
  const data = ready ? dataset.data : null;
  const colecao = setup.mode === "colecao";
  /* "Ha coleção pra buscar?" — o modo sozinho nao responde: quem acabou de
     escolher "coleção" no setup ainda tem zero bichos. Ver `.tk-home-busca`. */
  const temColecao = colecao && (items?.length ?? 0) > 0;
  /*
   * SEIS na tela larga, quatro no celular.
   *
   * Era cinco mais o cartao "VER MAIS", pra fechar as seis colunas. O documento
   * de desktop nao faz assim: ele poe SEIS bichos na grade e manda o destino
   * pro cabecalho, como link ("Ver tudo na Pokédex →", a direita de "SUA
   * COLEÇÃO"). Fecha a linha do mesmo jeito e devolve uma coluna a colecao —
   * era um sexto do espaco gasto com um botao.
   *
   * ⚠️ NO CELULAR NAO MUDA NADA: la continuam quatro mais o "VER MAIS" no
   * quinto lugar, que e a regra dele — "ao invez de uma faixa com scroll pro
   * lado, coloca tipo, no lugar do 5 um ver mais". O cabecalho e estreito
   * demais pra caber titulo e link na mesma linha.
   */
  const telaLarga = useTelaLarga();
  const naFila = telaLarga ? 6 : NA_FILA;
  /* Só as canônicas, como a contagem do seletor da Pokédex — `cosmeticOf`
     marca variações de fantasia, que têm stats idênticos e ficam fora da
     busca. Contá-las daria um total que não bate com a lista. */
  const totalEspecies =
    dataset.status === "ready"
      ? dataset.data.species.filter((s) => !s.cosmeticOf).length
      : 0;

  /** A colecao com veredito calculado, ordenada: quem pede acao primeiro. */
  const meus = useMemo(() => {
    if (!data || !colecao || !items || items.length === 0) return null;

    const decided = items.flatMap((owned) => {
      const s = data.species.find((x) => x.id === owned.speciesId);
      if (!s) return [];

      /*
       * ⚠️ O GUARDA DE "SEM IV" SAIU DAQUI e virou regra do `decide()`.
       *
       * Ele existia só nesta tela, e montava um veredito à mão com
       * `action: "investir"`. Duas consequências:
       *
       *   · aqui, a home escrevia "Falta o IV pra eu decidir" com um botão
       *     INVESTIR do lado — se contradizendo em dois centímetros;
       *   · e a ficha da espécie, que não tinha guarda nenhum, respondia
       *     "Transferir · IV 0 de 45 · confiança 65%" pro mesmo Bulbasaur.
       *
       * Agora `decide()` devolve a ação `descobrir` quando o IV não foi medido,
       * e as duas telas dizem a mesma coisa porque leem a mesma resposta.
       */
      const verdict = decide({
        ivDesconhecido: owned.ivDesconhecido === true,
        name: s.name,
        baseStats: s.baseStats,
        ivs: owned.ivs,
        level: owned.level ?? 20,
        cpm: data.cpm,
        levelCap: tetoDePowerUp(setup.level, data.version.levelCap),
        evolvesInto: s.evolvesInto,
        candyToEvolve: s.evolvesInto[0]
          ? (s.candyToEvolve[s.evolvesInto[0]] ?? null)
          : null,
        lucky: owned.lucky,
        shadow: owned.shadow,
        gigantamax: fazGigantamax(s.id, data.dynamax),
      });

      return [
        {
          id: owned.id,
          semIv: verdict.action === "descobrir",
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
          // `-1` marca "não tem IV" pra ordenação: sem isto, o Pokémon sem IV
          // medido entraria na fila como se fosse 0/45, ou seja, como o pior de
          // todos — que é justamente a leitura que este app não faz.
          iv: verdict.action === "descobrir" ? -1 : ivTotalOf(owned.ivs),
          // Cumprido so quando a acao marcada e a MESMA que o veredito indica
          // hoje: subiu de nivel e virou "evoluir"? Volta a cobrar, porque e
          // outra coisa a fazer.
          feito: cumpriu(verdict.action, owned.doneAction),
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
    /*
     * E o que a pessoa DISCORDOU sai junto.
     *
     * "e tem q ter um botão, discordo..." — o veredito continua calculado e
     * continua visível na ficha; o que ele perde é o direito de COBRAR. Deixar
     * na fila da home um bicho que a pessoa já disse que vai ficar é insistir,
     * e insistir é dizer que a razão do app vale mais que a dela.
     */
    const agir = decided
      .filter(
        (d) =>
          !d.feito && d.owned.meuMotivo == null && PEDEM_ACAO.includes(d.verdict.action),
      )
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="tk-saudacao">
            {t(greetingKey())}, {setup.name.trim() || t("home.trainer")}.
          </p>
          {/*
            A LINHA DA DATA — so na tela larga, e por isso o CSS a esconde.

            "Quarta, 30 de julho · 4 decisões esperam você", do documento de
            desktop. No celular a saudacao ja ocupa a largura toda e a segunda
            linha empurraria o hero pra fora da primeira tela — que e o que a
            nota do `.tk-hero` chama de "favor sem scroll na tela de inicio".

            `toLocaleDateString` no idioma do app: quem escolheu japones nao
            quer "Quarta" nem "Wednesday".
          */}
          <p className="tk-home-data">
            {new Date().toLocaleDateString(language, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            {meus !== null && meus.agir.length > 0 &&
              ` · ${
                meus.agir.length === 1
                  ? t("home.needsDecision.one")
                  : t("home.needsDecision.many", { count: meus.agir.length })
              }`}
          </p>
        </div>
        {/*
          A BUSCA DA HOME NAO BUSCA NA HOME — ela leva pra lista, com o termo.

          "Buscar na coleção", canto direito do cabecalho, no documento de
          desktop. A home nao tem lista pra filtrar: o que ela tem e um
          destaque, uma fila de seis e uns numeros. Um campo que filtrasse
          "aqui" nao teria o que filtrar.

          Entao ele e uma PORTA. Digitou a primeira letra, a Pokedex abre ja com
          o termo e com o cursor no campo de la — o resto do que a pessoa esta
          digitando cai no lugar certo, sem ela perceber a troca. E a mesma
          ideia do `PokedexIntent`: o atalho chega onde o texto dele promete.

          ⚠️ O DESTINO SEGUE O QUE EXISTE, e por isso o rotulo tambem muda.
          Sem colecao (modo consulta, ou colecao vazia) nao ha "coleção" pra
          buscar; mandar pra "Meus" entregaria uma lista vazia e um campo
          preenchido, que e a falha que o comentario do `mine` descreve. Nesse
          caso o campo diz "Buscar Pokémon" e vai pra "Todos".

          ⚠️ QUEM ESCONDE NO CELULAR E O CSS — ver `.tk-home-busca`. La embaixo
          a aba Pokedex fica a um toque de distancia na barra, e o campo so
          roubaria altura da primeira dobra ("favor sem scroll na tela de
          inicio").
        */}
        <form
          className="tk-search tk-home-busca"
          role="search"
          onSubmit={(e) => e.preventDefault()}
        >
          <IconSearch size={15} />
          <input
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder={t(temColecao ? "home.search" : "home.searchAll")}
            aria-label={t(temColecao ? "home.search" : "home.searchAll")}
            onChange={(e) => {
              const termo = e.target.value;
              if (termo) {
                onGo("pokedex", {
                  view: temColecao ? "mine" : "browse",
                  busca: termo,
                });
              }
            }}
          />
        </form>
        {/*
          O avatar abre a TROCA DE CONTA, e nao mais a lista "Meus".

          "esse M, no caso, a conta da pessoa ... onde vc pode criar varias
          contas, varias coleçÕes."

          Antes ele levava pra colecao — um destino plausivel, mas nao o que o
          simbolo promete. Disco com a inicial e, em todo app, "a sua conta"; e
          agora ha conta de verdade atras dele.

          "esse M, no caso, a conta da pessoa, so aparece no modo coleção, onde
          vc pode criar varias contas, varias coleçÕes. pra pessoas q tem varias
          contas."

          Faz sentido e conserta uma promessa falsa: no modo so consulta nao ha
          colecao, nao ha conta e nao ha nada atras daquele disco — ele seria um
          botao de perfil num app sem perfil. O destino dele (a lista "Meus")
          tambem nao existe ali.

          ⚠️ E a troca de contas EXISTE — este comentario dizia que nao.

          Ele foi escrito quando o disco so levava pra colecao ("a troca de
          contas em si ainda nao existe; por enquanto ele leva pra colecao"), e
          ficou pra tras quando a tela `Colecoes` ganhou criar, renomear, trocar
          e apagar. Hoje o avatar abre exatamente o que ele pediu.

          Comentario que descreve um estado antigo e pior que comentario nenhum:
          quem le acredita, e neste arquivo essa categoria de erro ja custou
          varias caçadas — so que sempre no sentido contrario, com o comentario
          prometendo mais do que o codigo dava.
        */}
        {colecao && (
          <button
            type="button"
            className="tk-avatar"
            onClick={() => setContasAberto(true)}
            aria-label={t("colecoes.title")}
          >
            {(setup.name.trim() || t("home.trainer")).slice(0, 1).toUpperCase()}
          </button>
        )}
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

      {dataset.status === "loading" && <Esqueleto linhas={3} />}

      {dataset.status === "error" && (
        <Offline detalhe={dataset.message} />
      )}

      {dataset.status === "ready" && (
        <>
          {/*
            ⚠️ O HERO GANHA UM IRMAO NA TELA LARGA, e por isso o embrulho.

            No documento de desktop o destaque nao ocupa a largura toda: ele
            divide a linha com um cartao de numeros, em `1.3fr 1fr`. No celular
            este `<div>` e transparente — a regra da grade so existe a partir de
            900px, entao aqui embaixo ele nao muda um pixel do que ja havia.
          */}
          <div className="tk-home-linha1">
          {hero && (
            <Hero
              species={hero.species}
              labelKey={hero.labelKey}
              linha={hero.linha}
              tom={hero.tom}
              onOpen={() => setDetail({ species: hero.species, owned: hero.owned })}
              evolui={hero.verdict?.action === "evoluir" && hero.species.evolvesInto.length > 0}
              feito={hero.feito}
              {...(/*
                 * A checagem de "cobra?" aqui é REDUNDANTE, e de propósito.
                 *
                 * Eu vim atrás de um bug e não achei: fui conferir se o botão
                 * redondo aparecia num "Guardar" — como aconteceu no cartão da
                 * ficha — e ele não aparece. O destaque só carrega `verdict`
                 * quando vem de `meus.agir[0]`, e `agir` já filtra por
                 * `PEDEM_ACAO`. No outro ramo ("o seu melhor") nem `ownedId`
                 * nem `verdict` são passados. Testado na tela, com o Hoopa
                 * marcado como feito pra forçar o segundo ramo.
                 *
                 * Fica escrito porque hoje o invariante mora a dois saltos
                 * daqui, num filtro de outra `useMemo`. Quem mexer no `agir`
                 * amanhã não tem como saber que este botão depende dele — e o
                 * sintoma seria silencioso: um botão que grava um `doneAction`
                 * que o `cumpriu()` ignora, ou seja, um toque que não muda
                 * nada.
                 */
              hero.ownedId !== undefined &&
              hero.verdict &&
              ACOES_QUE_COBRAM.includes(hero.verdict.action)
                ? {
                    onToggleFeito: () => {
                      /*
                        EVOLUIR de verdade evolui — nao marca um check.

                        "ao evoluir um pokemon q pede pra evoluir (bulbasauro)
                        ao invez de so dar um check, porque nao transformarlo em
                        sua evolução? continua o trajeto garai"

                        Ele achou um defeito de produto: o app mandava evoluir,
                        a pessoa evoluia no jogo, marcava como feito — e a
                        colecao continuava com um Bulbasaur. Dali em diante toda
                        analise saia da especie ERRADA, e o app ainda achava que
                        tinha ajudado.

                        Nos outros vereditos o check continua certo: investir
                        nao muda a especie, e transferir tira o bicho da colecao
                        pelo caminho normal. ("guardar" nem chega aqui — a
                        condicao acima ja o barra, porque ele nao cobra nada.)
                      */
                      const evolucao =
                        hero.verdict!.action === "evoluir"
                          ? hero.species.evolvesInto[0]
                          : undefined;
                      if (evolucao) void evolvePokemon(hero.ownedId!, evolucao);
                      else void setDoneAction(hero.ownedId!, hero.verdict!.action);
                    },
                  }
                : {})}
            />
          )}

          {/*
            O CARTAO DE NUMEROS — so na tela larga.

            "Coleção 247 / 1.182 · Pedem decisão 4 · Armazenamento offline
            1,2 GB", do documento de desktop.

            ⚠️ A POEIRA ESTELAR DO DESENHO NAO ESTA AQUI. O documento mostra a
            linha, e o app nao guarda esse dado em lugar nenhum — nao ha de onde
            tirar sem pedir pra pessoa digitar. Inventar um numero num app cuja
            tese e "todo numero que ele diz foi calculado" seria o pior tipo de
            fidelidade ao desenho. Fica de fora ate existir de onde ler.
          */}
          {colecao && (
            <aside className="tk-home-numeros">
              <div className="tk-home-num">
                <span className="tk-home-num-r">{t("home.yourCollection")}</span>
                <span className="tk-home-num-v">
                  {(items?.length ?? 0).toLocaleString(language)} /{" "}
                  {totalEspecies.toLocaleString(language)}
                </span>
              </div>
              {meus !== null && meus.agir.length > 0 && (
                <div className="tk-home-num">
                  <span className="tk-home-num-r">{t("home.pedemDecisao")}</span>
                  <span className="tk-home-num-v tk-home-num-v--ultra">
                    {meus.agir.length.toLocaleString(language)}
                  </span>
                </div>
              )}
              {persist?.supported === true && persist.usageBytes != null && (
                <div className="tk-home-num">
                  <span className="tk-home-num-r">{t("home.armazenamento")}</span>
                  <span className="tk-home-num-v tk-home-num-v--ok">
                    {formatBytes(persist.usageBytes)}
                  </span>
                </div>
              )}
            </aside>
          )}
          </div>

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
                {/* Titulo e contador num grupo SO.
                    Na tela larga este cabecalho vira `flex` pra encaixar o link
                    a direita, e flex trata cada pedaco de texto solto como um
                    item proprio: sem este `span`, o titulo, o "·" e o contador
                    viravam tres itens e a caixa espalhava os tres pela linha
                    inteira. Aqui dentro eles continuam sendo uma frase so. No
                    celular e um `span` inline no meio do texto — nao muda nada. */}
                <span className="tk-overline-sec-t">
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
                </span>
                {/*
                  O DESTINO VIRA LINK NO CABECALHO — so na tela larga.

                  "Ver tudo na Pokédex →", a direita do titulo, e o que o
                  documento de desktop desenha; no celular ele continua sendo o
                  cartao no fim da fila (ver a nota do `naFila`). Reaproveita a
                  chave `home.seeAll` que o cartao ja usava, entao os dez
                  idiomas vem juntos sem chave nova — a unica diferenca pro
                  documento e nao repetir "na Pokédex", que a seta e o contexto
                  ja dizem.
                */}
                {telaLarga && meus.porIv.length > naFila && (
                  <button
                    type="button"
                    className="tk-overline-verdex"
                    onClick={() => onGo("pokedex", { view: "mine" })}
                  >
                    {t("home.seeAll")} →
                  </button>
                )}
              </div>

              <div className="tk-strip-row">
                {meus.porIv.slice(0, naFila).map((d, i) => (
                  <button
                    key={d.id}
                    type="button"
                    className="tk-strip-cell"
                    data-hot={(!d.feito && PEDEM_ACAO.includes(d.verdict.action)) || undefined}
                    /*
                      ⚠️ CUMPRIDO TEM QUE PARECER CUMPRIDO.

                      "eu ja coloquei feito. pq ainda aparece investir? o botao
                      certinho ali do lado tbm n faz nada."

                      O botao FAZIA: a acao era gravada, o contador caia e o
                      destaque passava pro proximo. So que a celula da fila
                      continuava com o anel verde e a palavra INVESTIR embaixo,
                      e o proximo destaque tambem dizia "Investir" — entao a
                      unica confirmacao visivel era um numero mudando de 3 pra 2
                      no meio de uma linha em versalete.

                      Um botao cujo efeito nao aparece e indistinguivel de um
                      botao quebrado, e ele leu como quebrado. Estava certo em
                      ler assim.

                      O `feito` ja era calculado logo acima e servia so pra
                      filtrar a lista de pendencias; a fila recebia o mesmo
                      objeto e ignorava o campo. Terceira vez nesta sessao que o
                      nucleo calcula e a tela nao mostra.
                    */
                    data-feito={d.feito || undefined}
                    style={{
                      // Cumprido perde o tom do veredito: cor de veredito num
                      // bicho que ja foi resolvido continua cobrando algo.
                      ["--tk-cell-tone" as string]: d.feito
                        ? "var(--tk-border-strong)"
                        : TONE[d.verdict.action],
                      // Indice da cascata: a fila entra da esquerda pra direita,
                      // o que ja diz que ela rola.
                      ["--tk-i" as string]: i,
                    }}
                    onClick={() => setDetail({ species: d.species, owned: d.owned })}
                    aria-label={`${d.species.name} · ${
                      d.feito ? t("collection.done") : t(ACTION_KEYS[d.verdict.action] as Key)
                    }`}
                    title={`${d.species.name} · ${
                      d.feito ? t("collection.done") : t(ACTION_KEYS[d.verdict.action] as Key)
                    }`}
                  >
                    <SpeciesTile
                      spriteId={d.species.spriteId}
                      dex={d.species.dex}
                      speciesId={d.species.id}
                      name={d.species.name}
                      types={d.species.types}
                      /*
                        ⚠️ O TAMANHO E PROP, e nao CSS — `SpeciesTile` escreve
                        `width`/`height` inline, e estilo inline ganha de
                        qualquer classe. Eu tinha tentado esticar por
                        `width: 100%` na regra do cartao e o tile continuou em
                        48px, sem erro nenhum aparecer.
                      */
                      size={telaLarga ? 92 : 48}
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
                    {/* O nome so aparece na tela larga (o CSS esconde no
                        celular): la a celula e um cartao e ha largura pra dizer
                        de QUEM e o veredito, em vez de so qual e. */}
                    <span className="tk-strip-nome">{d.species.name}</span>
                    <span className="tk-strip-verdito">
                      {/*
                        O visto vem ANTES da palavra, e nao no lugar dela.

                        Sozinho, o "✓" seria informacao so por forma — a mesma
                        falha que o rotulo do veredito existe pra corrigir. Com
                        a palavra junto, quem enxerga mal cor le "FEITO" e quem
                        bate o olho ve o visto.

                        O simbolo do veredito (`ACTION_GLYPHS`) entra pela mesma
                        porta e com a mesma regra — e por isso `telaLarga`: no
                        celular esta caixa e um rotulo estreito debaixo do anel,
                        onde "↑ INVESTIR" so tira letra da palavra. O desenho
                        pede o simbolo no CARTAO, e cartao so existe aqui.
                      */}
                      {d.feito
                        ? `✓ ${t("collection.done")}`
                        : telaLarga
                          ? `${ACTION_GLYPHS[d.verdict.action]} ${t(ACTION_KEYS[d.verdict.action] as Key)}`
                          : t(ACTION_KEYS[d.verdict.action] as Key)}
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
                {/*
                  "VER MAIS" so quando HA mais.

                  "tira o botao ver mais se nao tem mais pokemon ne." Com tres
                  Pokemon na colecao ele aparecia mesmo assim, prometendo uma
                  lista que era a mesma que ja estava na tela.
                */}
                {/* `!telaLarga`: na tela larga o destino subiu pro cabecalho da
                    secao (ver a nota do link ali em cima), e manter o cartao
                    aqui embaixo seria o mesmo botao duas vezes na mesma tela. */}
                {!telaLarga && meus.porIv.length > naFila && (
                <button
                  type="button"
                  className="tk-strip-cell tk-strip-cell--mais"
                  onClick={() => onGo("pokedex", { view: "mine" })}
                  style={{ ["--tk-i" as string]: naFila }}
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
                )}
              </div>
            </>
          )}

          {/*
            Sem nada salvo o convite substitui a fila: um espaço vazio com
            moldura nao convida ninguem.

            ⚠️ SEM BOTAO, e o handoff pede botao.

            A regra dele ("vazio tem titulo, frase e acao de 42px") supoe um
            vazio SOZINHO na tela. Na home nao e o caso: a acao principal —
            "Escanear um print", a mesma coisa — fica 40px acima, em pilula
            cheia. Repetir dava dois botoes identicos empilhados, que foi o que
            apareceu na tela dele.

            Duas vezes a mesma acao nao e duas chances, e duvida: a pessoa para
            pra descobrir se fazem coisas diferentes.
          */}
          {colecao && !meus && (
            <Vazio titulo={t("home.empty.title")} frase={t("home.empty.body")} />
          )}

          {/*
            ⚠️ O QUE FECHA A HOME NO MODO SO CONSULTA.

            *"eu sinto q ta pra cima dms, ta faltando coisa ali em baixo tbm"*, e
            depois a causa: *"quando vc tira a msg de pwa q fica assim estranho,
            mt pra cima"*.

            Tirar o aviso de PWA nao movia nada pra cima — ele devolvia ao hero o
            sangramento negativo de 71px que o `:has(> .tk-banner)` cancelava, e
            a coluna inteira subia. So que 71px sozinhos nao explicam o buraco: a
            home no modo consulta ACABAVA nas duas acoes, e dali pro rodape
            sobravam ~450px de nada. O aviso estava tampando o furo, e por isso
            tirar ele foi o que revelou o furo.

            O desenho fecha a Inicio com a "Tira da coleção". Quem escolheu so
            consultar nao tem colecao — mas tem a mesma pergunta ("e agora, o que
            eu uso?"), e o dataset ja responde: `raidOverall` e ranking
            calculado, com moveset, nao lista escolhida a dedo. Entao a tira
            existe nos dois modos; muda de QUEM ela fala.

            Comeca no segundo colocado porque o primeiro ja e o hero desta tela,
            logo acima, com o rotulo "Melhor atacante de raide agora". Repetir
            ele aqui embaixo faria a fila abrir com o bicho que a pessoa acabou
            de ver.
          */}
          {!colecao && data?.rankings && (
            <>
              <div className="tk-overline tk-overline--sec">
                <span>{t("usos.tira")}</span>
                {telaLarga && (
                  <button
                    type="button"
                    className="tk-overline-verdex"
                    onClick={() => onGo("pokedex", { view: "best", mode: "raid" })}
                  >
                    {t("home.seeAll")} →
                  </button>
                )}
              </div>

              <div className="tk-strip-row">
                {data.rankings.raidOverall
                  .slice(1, 1 + naFila)
                  .map((r, i) => {
                    const sp = data.species.find((s) => s.id === r.speciesId);
                    if (!sp) return null;
                    // A posicao REAL na lista, e nao o indice da fatia: o
                    // primeiro cartao daqui e o #2 do jogo.
                    const posicao = i + 2;
                    return (
                      <button
                        key={r.speciesId}
                        type="button"
                        className="tk-strip-cell"
                        style={{
                          ["--tk-cell-tone" as string]: "var(--tk-border-strong)",
                          ["--tk-i" as string]: i,
                        }}
                        onClick={() => abrirEspecie(sp)}
                        aria-label={`#${posicao} · ${sp.name}`}
                        title={`#${posicao} · ${sp.name}`}
                      >
                        <SpeciesTile
                          spriteId={sp.spriteId}
                          dex={sp.dex}
                          speciesId={sp.id}
                          name={sp.name}
                          types={sp.types}
                          size={telaLarga ? 92 : 48}
                        />
                        <span className="tk-strip-nome">{sp.name}</span>
                        {/* O numero e o rotulo. A tira da colecao poe o veredito
                            aqui; esta poe a colocacao, que e a informacao
                            equivalente — diz por que aquele bicho esta na fila e
                            em que ordem ler. */}
                        <span className="tk-strip-verdito">
                          #{formatNumber(posicao, language)}
                        </span>
                      </button>
                    );
                  })}

                {!telaLarga && (
                  <button
                    type="button"
                    className="tk-strip-cell tk-strip-cell--mais"
                    onClick={() => onGo("pokedex", { view: "best", mode: "raid" })}
                    style={{ ["--tk-i" as string]: naFila }}
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
                )}
              </div>
            </>
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

      {contasAberto && <Colecoes onClose={() => setContasAberto(false)} />}

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
