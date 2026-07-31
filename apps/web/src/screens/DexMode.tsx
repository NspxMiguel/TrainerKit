import { useEffect, useMemo, useRef, useState } from "react";
import { useFolha } from "../ui/folha.ts";
import { createPortal } from "react-dom";

import { buildDexEntry, type DexEntry } from "@trainerkit/core";

import { dexSystem, speciesDossier } from "../ai/dossier.ts";
import { mensagemDeErro } from "../ai/erro.ts";
import { chat } from "../ai/provider.ts";
import { identifySpecies, visionAvailable } from "../ai/vision.ts";
import { fold } from "../data/fold.ts";
import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { useLanguage } from "../i18n/language.ts";
import { useT, type Key } from "../i18n/t.ts";
import { useSetup } from "../onboarding/setup.ts";
import { typeColor, typeInk, typeKey } from "../sprites/provider.ts";
import { useCollection } from "../storage/collection.ts";
import { markSeen, seenIds, useSeenCount, wasSeen } from "../storage/seen.ts";
import { IconCamera, IconSearch } from "../ui/Icons.tsx";
import { BetaBadge } from "../ui/BetaBadge.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { supportsCamera, useCamera } from "../ui/useCamera.ts";
import { beep, setVoiceOn, speak, speechSupported, stopSpeaking, voiceOn } from "../ui/dexVoice.ts";

interface Props {
  data: Dataset;
  onClose: () => void;
  /** Abrir a ficha completa da especie — a Pokedex e a porta, nao o destino. */
  onOpenSpecies: (s: DatasetSpecies) => void;
  /**
   * Abrir a lista dos capturados.
   *
   * "kd a colection ai na pokedex?" — o aparelho contava "CAPTURADOS: 6" e o
   * numero nao levava a lugar nenhum. Uma Pokedex de verdade e uma LISTA que
   * voce percorre; o contador sozinho e a capa de um livro que nao abre.
   */
  onOpenMine?: (() => void) | undefined;
}

const LIGAS = ["great", "ultra", "master"] as const;

/**
 * Modo Pokedex.
 *
 * "quero q pareça muito com uma pokedex, até em aparencia, em funcionalidades e
 * etc". Duas frentes, e as duas estao aqui:
 *
 * APARENCIA — a tela e um APARELHO, nao uma pagina: carcaça, lente redonda com
 * as tres luzinhas, visor com scanline, grade de alto-falante e os botoes de
 * navegacao embaixo. Ver `.tk-dexdev` no CSS.
 *
 *   ⚠️ E por isso o `data-skin`: o desenho do aparelho e prop da Nintendo/TPC,
 *   nao dado de jogo. Vale a mesma decisao dos sprites — build pessoal, sem
 *   publicar. Trocar `data-skin="device"` por `"plain"` devolve o visual autoral
 *   e nada mais quebra. Fica um atributo, nao uma refatoracao.
 *
 * FUNCIONALIDADE — o que uma Pokedex de verdade faz:
 *   · registra VISTOS separado de CAPTURADOS, e mostra os dois contadores
 *   · navega POR NUMERO, com anterior e proximo
 *   · le a ficha em voz alta
 *   · identifica pela camera ou por print
 *   · aceita pergunta sobre o que esta na tela
 *
 * O texto da ficha continua ESCRITO PELO APP a partir do que ele calculou. As
 * descricoes do jogo sao obra escrita e nao entram — e a troca saiu boa: altura,
 * peso e "é o 17º atacante de Dragão" e o que muda a decisao de hoje.
 */
export function DexMode({ data, onClose, onOpenSpecies, onOpenMine }: Props) {
  /* A folha sai animada: quem segura o no durante a saida e o `useFolha`. Todo
     caminho de fechamento passa por `fechar`, nunca pelo `onClose` cru — um que
     escape volta a piscar, e so aquele. */
  const { saindo, ref: refFolha, fechar, sair } = useFolha(onClose);

  const { t } = useT();
  const language = useLanguage();
  const { items } = useCollection();
  const setup = useSetup();
  const vistos = useSeenCount();
  const [busca, setBusca] = useState("");
  const [alvo, setAlvo] = useState<DatasetSpecies | null>(null);
  const [lendo, setLendo] = useState(false);
  const [semDados, setSemDados] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [voz, setVoz] = useState(voiceOn);
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);
  const [pensando, setPensando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const camera = useCamera();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      // Sair da tela cala o aparelho E apaga a camera. Voz continuando (ou pior,
      // luz da camera acesa) depois de a tela fechar e o tipo de bug que faz
      // alguem desinstalar o app no meio da rua.
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);

  /**
   * A lista navegavel, em ordem de numero.
   *
   * E o que permite anterior/proximo: uma Pokedex e uma lista ordenada, e pular
   * de bicho em bicho e metade do prazer de ter uma. Formas cosmeticas ficam
   * fora — dezoito Unown com a mesma ficha nao e navegacao, e ruido.
   */
  const ordenadas = useMemo(
    () =>
      data.species
        .filter((s) => s.cosmeticOf === null)
        .sort((a, b) => a.dex - b.dex || a.id.localeCompare(b.id)),
    [data.species],
  );

  /** Registra como visto ao abrir a ficha. E o que a Pokedex do jogo faz. */
  useEffect(() => {
    if (alvo) markSeen(alvo.id);
  }, [alvo]);

  const capturados = useMemo(() => {
    if (setup.mode !== "colecao") return 0;
    return new Set((items ?? []).map((o) => o.speciesId)).size;
  }, [items, setup.mode]);

  /*
   * VISTOS inclui os CAPTURADOS, porque nao existe capturar sem ter visto.
   *
   * O aparelho mostrava "VISTOS: 0 · CAPTURADOS: 6", que e impossivel em
   * qualquer Pokedex. O registro de vistos so era escrito ao identificar
   * alguem AQUI dentro, e a colecao mora noutro lugar (IndexedDB) — dois
   * numeros verdadeiros cada um por si, mentindo juntos.
   *
   * A uniao e calculada na hora em vez de gravar os capturados no registro de
   * vistos: transferir um Pokemon nao deveria "desver" a especie, e gravar
   * tornaria isso irreversivel. Aqui o numero se corrige sozinho.
   */
  const vistosTotal = useMemo(() => {
    if (setup.mode !== "colecao") return vistos;
    const uniao = new Set(seenIds());
    for (const o of items ?? []) uniao.add(o.speciesId);
    return uniao.size;
  }, [items, setup.mode, vistos]);

  /** Sugestoes por nome. */
  const sugestoes = useMemo(() => {
    const q = fold(busca);
    if (q.length < 2) return [];
    return ordenadas
      .filter((s) => fold(s.name).includes(q))
      .sort((a, b) => {
        const ai = fold(a.name).startsWith(q) ? 0 : 1;
        const bi = fold(b.name).startsWith(q) ? 0 : 1;
        return ai - bi || a.dex - b.dex;
      })
      .slice(0, 6);
  }, [busca, ordenadas]);

  /** A ficha, calculada. Nada aqui vem de texto do jogo. */
  const ficha = useMemo((): DexEntry | null => {
    if (!alvo) return null;

    const tipoPrimario = alvo.types[0] ?? "normal";
    const listaRaide = data.rankings?.raidByType[tipoPrimario] ?? [];
    const posRaide = listaRaide.findIndex((r) => r.speciesId === alvo.id);

    let melhorLiga: { league: "great" | "ultra" | "master"; position: number } | null = null;
    for (const liga of LIGAS) {
      const pos = (data.rankings?.statProductByLeague[liga] ?? []).findIndex(
        (r) => r.speciesId === alvo.id,
      );
      if (pos >= 0 && (melhorLiga === null || pos + 1 < melhorLiga.position)) {
        melhorLiga = { league: liga, position: pos + 1 };
      }
    }

    return buildDexEntry({
      name: alvo.name,
      dex: alvo.dex,
      types: alvo.types,
      baseStats: alvo.baseStats,
      cpm: data.cpm,
      levelCap: data.version.levelCap,
      evolvesInto: alvo.evolvesInto,
      raidRank: posRaide >= 0 ? { type: tipoPrimario, position: posRaide + 1 } : null,
      leagueRank: melhorLiga,
    });
  }, [alvo, data]);

  /**
   * A locucao, montada em frases.
   *
   * Cada linha e uma chave de idioma com parametro — o app fala dez idiomas, e
   * concatenar pedaco de frase em codigo quebra em metade deles. A ordem imita a
   * do aparelho da serie: nome e numero, tipo, o que ele e, medidas, e o resto.
   */
  const locucao = useMemo((): string[] => {
    if (!ficha || !alvo) return [];

    const nomeTipo = (tp: string) => t(typeKey(tp) as "type.normal");
    const linhas = [
      t("dex.line.name", { name: ficha.name, dex: ficha.dexNumber }),
      t("dex.line.types", { types: ficha.types.map(nomeTipo).join(" / ") }),
      t(`dex.build.${ficha.build}` as Key),
    ];

    // Altura e peso, quando a base tem. Sao medidas, e por isso podem estar aqui:
    // a diferenca entre fato e obra escrita e o que decide o que este app copia.
    if (alvo.heightDm != null && alvo.weightHg != null) {
      linhas.push(
        t("dex.line.size", {
          height: (alvo.heightDm / 10).toLocaleString(language, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }),
          weight: (alvo.weightHg / 10).toLocaleString(language, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }),
        }),
      );
    }

    linhas.push(
      t("dex.line.stats", {
        atk: ficha.baseStats.atk,
        def: ficha.baseStats.def,
        hp: ficha.baseStats.hp,
      }),
      t("dex.line.maxCp", {
        cp: ficha.maxCP.toLocaleString(language),
        level: data.version.levelCap,
      }),
      ficha.evolves ? t("dex.line.evolves") : t("dex.line.final"),
    );

    // Ranking so entra quando ele EXISTE na lista. Elogio inventado destruiria a
    // unica coisa que faz o resto do app valer: os numeros serem conferiveis.
    if (ficha.raidRank) {
      linhas.push(
        t("dex.line.raid", {
          type: nomeTipo(ficha.raidRank.type),
          position: ficha.raidRank.position,
        }),
      );
    }
    if (ficha.leagueRank) {
      linhas.push(
        t("dex.line.league", {
          league: t(`rank.league.${ficha.leagueRank.league}` as "rank.league.great"),
          position: ficha.leagueRank.position,
        }),
      );
    }

    return linhas;
  }, [ficha, alvo, t, language, data.version.levelCap]);

  /** Anuncia: bipe, depois a locucao inteira como um texto so. */
  const anunciar = async (linhas: string[]) => {
    if (!voz || !speechSupported()) return;
    await beep();
    /*
      `true` = pode ir pro cache compartilhado do CDN.
      A ficha do Blissey em portugues e IDENTICA pra todo mundo que abrir o mesmo
      bicho no mesmo idioma — entao quem ouvir primeiro paga pelos outros.
    */
    await speak(linhas.join(" "), language, true);
  };

  const escolher = (s: DatasetSpecies) => {
    stopSpeaking();
    setAlvo(s);
    setBusca("");
    setSemDados(false);
    setErro(null);
    setResposta(null);
  };

  /** Anterior e proximo por numero — navegacao de Pokedex de verdade. */
  const pular = (passo: number) => {
    if (!alvo) return;
    const i = ordenadas.findIndex((s) => s.id === alvo.id);
    if (i < 0) return;
    // Circular: do ultimo pro primeiro. Beco sem saida no fim da lista seria pior
    // que dar a volta.
    const proximo = ordenadas[(i + passo + ordenadas.length) % ordenadas.length];
    if (proximo) escolher(proximo);
  };

  /* -------------------------------------------------------- ao vivo */

  /**
   * Congela o quadro atual e identifica.
   *
   * Nao analisa CONTINUAMENTE de propósito: o limite gratuito da Groq e 8.000
   * tokens por minuto e cada imagem custa uns 2.500 — analisar a cada segundo
   * gastaria a cota em tres segundos e depois falharia sem parar. Entao a pessoa
   * aponta, ve o que a lente ve, e aperta quando esta enquadrado.
   */
  const lerAoVivo = async () => {
    const quadro = await camera.grab();
    if (!quadro) return;
    await lerFoto(quadro);
    // Achou: desliga a camera. Deixar a luz acesa atras da ficha e o tipo de
    // coisa que faz alguem desconfiar do app.
    camera.stop();
  };

  /* ----------------------------------------------------------- pela foto */

  const lerFoto = async (file: File) => {
    setLendo(true);
    setSemDados(false);
    setErro(null);
    setResposta(null);
    try {
      const nome = await identifySpecies(file);
      if (nome === null) {
        setSemDados(true);
        return;
      }

      // O casamento com o dataset e o que impede a ficha errada: o modelo pode
      // devolver um nome que nao existe, e ai a resposta certa e "sem dados".
      const chave = fold(nome);
      const achou =
        ordenadas.find((s) => fold(s.name) === chave) ??
        ordenadas.find((s) => fold(s.name).startsWith(chave));

      if (!achou) {
        setSemDados(true);
        return;
      }
      escolher(achou);
    } catch (e) {
      setErro(mensagemDeErro(e, t));
    } finally {
      setLendo(false);
    }
  };

  /* -------------------------------------------------------- conversar */

  const perguntar = async () => {
    const q = pergunta.trim();
    // `alvo` no teste tambem: `ficha` deriva dele, mas o TS nao sabe disso — e
    // sem o alvo nao ha dossie pra montar.
    if (!q || !ficha || !alvo) return;

    setPensando(true);
    setResposta(null);
    try {
      /*
        O modelo recebe o DOSSIE, nao a locucao.

        Aqui morava o defeito que o Miguel pegou: eu mandava as oito linhas
        faladas e escrevia "responda usando SÓ a ficha". Ele perguntou "é bom pra
        segurar ginásio?" e levou "Não tem esse dado" — sendo que o app calcula
        exatamente isso no `rankDefenders` desde ontem. A resposta existia e o
        modelo nao tinha como alcançar.

        Agora vai tudo que o app sabe da especie: aguento como defensor, tabela
        de tipos com os multiplicadores, posicao nos quatro rankings, melhores
        golpes por contexto, linha evolutiva, e quais o jogador tem. Continua sem
        inventar nada — todo numero saiu do `packages/core`.
      */
      const texto = await chat(
        [
          // O idioma DA TELA, nao o da pergunta: quem poe o app em japones
          // quer resposta em japones mesmo digitando o nome do bicho em ingles.
          { role: "system", content: dexSystem(language) },
          {
            role: "user",
            content: `Dossiê:\n${speciesDossier(alvo, data, items ?? [], language)}\n\nPergunta: ${q}`,
          },
        ],
        // `pergunta: q` liga o porteiro (ver `guarda.ts`): so o texto CRU que a
        // pessoa digitou passa pelo filtro, nunca o dossie que eu montei.
        { temperature: 0.2, maxTokens: 260, pergunta: q },
      );
      setResposta(texto);
      /*
        SEM `true` aqui, de propósito: esta e a resposta da IA, e ela pode citar
        a colecao de quem perguntou. Dado de usuario nao vai pra URL, porque URL
        de cache fica em log de CDN e em qualquer proxy do caminho.
      */
      if (voz && speechSupported()) void speak(texto, language);
    } catch (e) {
      setErro(mensagemDeErro(e, t));
    } finally {
      setPensando(false);
    }
  };

  const cor = alvo ? typeColor(alvo.types[0] ?? "normal") : "#6b7280";
  const jaTenho = alvo !== null && (items ?? []).some((o) => o.speciesId === alvo.id);

  return createPortal(
    <div
      ref={refFolha}
      className="tk-dex"
      data-saindo={saindo || undefined}
      /*
       * A casca do aparelho. Trocar por "plain" devolve o visual autoral do app
       * — e o que uma build publicavel usaria, pelo mesmo motivo dos sprites.
       */
      data-skin="device"
      role="dialog"
      aria-modal="true"
      aria-label={t("dex.title")}
      style={{ ["--tk-dex-type" as string]: cor }}
    >
      {/* ------------------------------------------------- a parte de cima */}

      <div className="tk-dexdev-top">
        {/* A lente grande e as tres luzes. E a assinatura visual do aparelho, e
            a lente PISCA enquanto ele le — a unica animacao que informa algo. */}
        <span className="tk-dexdev-lens" data-busy={lendo || pensando || undefined} aria-hidden="true">
          <span className="tk-dexdev-lens-glint" />
        </span>
        <span className="tk-dexdev-leds" aria-hidden="true">
          <i data-led="red" />
          <i data-led="yellow" />
          <i data-led="green" />
        </span>

        <button
          type="button"
          className="tk-dexdev-close"
          onClick={fechar}
          aria-label={t("common.back")}
        >
          ‹
        </button>
      </div>

      {/* O contador de vistos e capturados: a razao de existir uma Pokedex. */}
      {/*
        BETA junto dos contadores.
        
        O modo Pokedex e a tela com mais coisa nova e menos rodagem: camera,
        identificacao por foto, voz neural e conversa com a IA — cada uma com um
        jeito proprio de falhar em aparelho que eu nao tenho. Marcar isso e mais
        honesto que deixar a pessoa descobrir sozinha que a camera nao abriu.
      */}
      <div className="tk-dexdev-counters">
        <BetaBadge />
        <span>{t("dex.seen", { n: vistosTotal })}</span>
        {/*
          CAPTURADOS abre a lista. Vistos nao, e a assimetria e proposital: a
          lista dos capturados existe (e a colecao), a dos vistos seria uma tela
          nova pra um dado que o app registra de raspao. Um numero clicavel ao
          lado de um que nao e seria pior que os dois inertes.
        */}
        {setup.mode === "colecao" &&
          (onOpenMine ? (
            <button type="button" className="tk-dexdev-count-btn" onClick={() => sair(onOpenMine)}>
              {t("dex.caught", { n: capturados })}
            </button>
          ) : (
            <span>{t("dex.caught", { n: capturados })}</span>
          ))}
      </div>

      {/* ---------------------------------------------------------- o visor */}

      <div className="tk-dexdev-screen">
        {/*
          A camera AO VIVO dentro do visor.
          
          "nao funcionando modo live da pokedex. so tem opcao de usar foto" — e
          verdade: `<input capture>` abre o app de camera do sistema, tira uma
          foto e volta. Nao e apontar, e fotografar. Aqui o video roda DENTRO do
          visor, entao a tela mostra o que a lente ve antes de dizer o nome — que
          e o que o aparelho da serie faz.

          `playsInline` e obrigatorio: sem ele o Safari joga o video em tela cheia
          nativa e engole a interface toda.
        */}
        <video
          ref={camera.videoRef}
          className="tk-dexdev-video"
          data-on={camera.state === "on" || undefined}
          playsInline
          muted
          autoPlay
        />

        {camera.state === "on" ? (
          <span className="tk-dexdev-reticle" aria-hidden="true" />
        ) : alvo ? (
          <>
            <button
              type="button"
              className="tk-dexdev-art"
              onClick={() => sair(() => onOpenSpecies(alvo))}
              aria-label={alvo.name}
            >
              {/* `bare`: dentro do visor a arte fica solta na tela, sem o
                  selo de gradiente. Com o selo, o bicho aparecia num quadrado
                  colorido EM CIMA da tela em vez de estar nela. */}
              <SpeciesTile
                spriteId={alvo.spriteId}
                dex={alvo.dex}
                speciesId={alvo.id}
                name={alvo.name}
                types={alvo.types}
                size={132}
                bare
              />
            </button>
            {/* Selo de capturado no canto do visor, como o jogo faz. */}
            {jaTenho && (
              <span className="tk-dexdev-caught" aria-label={t("dex.caughtMark")}>
                ●
              </span>
            )}
          </>
        ) : (
          <div className="tk-dexdev-idle" aria-hidden="true">
            <IconCamera size={30} />
          </div>
        )}
        <span className="tk-dexdev-scan" aria-hidden="true" />
      </div>

      {/* --------------------------------------------------- nome e numero */}

      {ficha && (
        <div className="tk-dexdev-plate">
          <span className="tk-dexdev-num">Nº {ficha.dexNumber}</span>
          <span className="tk-dexdev-nome">{ficha.name}</span>
          <span className="tk-dexdev-tipos">
            {ficha.types.map((tp) => (
              <span
                key={tp}
                className="tk-dexdev-tipo"
                style={{ background: typeColor(tp), color: typeInk(tp) }}
              >
                {t(typeKey(tp) as "type.normal")}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* ------------------------------------------------------- a ficha */}

      {ficha ? (
        <>
          <section className="tk-dexdev-entry">
            {locucao.map((linha) => (
              <p key={linha}>{linha}</p>
            ))}
          </section>

          {/* Os controles do aparelho: navegar, falar, calar. */}
          <div className="tk-dexdev-pad">
            <button
              type="button"
              className="tk-dexdev-key"
              onClick={() => pular(-1)}
              aria-label={t("dex.prev")}
            >
              ◀
            </button>
            <button
              type="button"
              className="tk-dexdev-key tk-dexdev-key--wide"
              disabled={!speechSupported() || !voz}
              onClick={() => void anunciar(locucao)}
            >
              {t("dex.speak")}
            </button>
            <button
              type="button"
              className="tk-dexdev-key"
              onClick={() => pular(1)}
              aria-label={t("dex.next")}
            >
              ▶
            </button>
          </div>

          <div className="tk-dexdev-row">
            <button
              type="button"
              className="tk-dexdev-soft"
              aria-pressed={voz}
              onClick={() => {
                const proximo = !voz;
                setVoz(proximo);
                setVoiceOn(proximo);
                if (!proximo) stopSpeaking();
              }}
            >
              {voz ? t("dex.voiceOn") : t("dex.voiceOff")}
            </button>
            <button
              type="button"
              className="tk-dexdev-soft"
              onClick={() => {
                stopSpeaking();
                setAlvo(null);
                setResposta(null);
                setErro(null);
              }}
            >
              {t("dex.pick")}
            </button>
          </div>

          {!speechSupported() && (
            <p className="tk-dexdev-note">{t("dex.noSpeech")}</p>
          )}

          {/* Conversar com a ficha. */}
          <div className="tk-search tk-dexdev-ask">
            <input
              type="text"
              placeholder={t("dex.askPlaceholder")}
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void perguntar();
              }}
              aria-label={t("dex.ask")}
            />
          </div>
          <button
            type="button"
            className="tk-dexdev-key tk-dexdev-key--block"
            disabled={pensando || pergunta.trim() === ""}
            onClick={() => void perguntar()}
          >
            {pensando ? t("ai.thinking") : t("dex.ask")}
          </button>

          {resposta && <p className="tk-dexdev-answer">{resposta}</p>}
        </>
      ) : (
        /* ------------------------------------------------------- entradas */
        <>
          {/*
            FOLHEAR, sem escanear nada — e a primeira opcao, nao a ultima.

            "tem q ter como ver os pokemon no modo pokedex ... igual pokemon
            original."

            Dava pra chegar num Pokemon so por busca ou por foto. Faltava a
            porta mais obvia: ABRIR o aparelho e começar a passar. Este botao
            entra no primeiro e dali e anterior/proximo, que ja existiam no
            codigo e nao tinham botao.

            Vem antes da camera de propósito: apontar exige ter o bicho na
            frente, e folhear e o que se faz sentado — que e quando a Pokedex
            de verdade e usada.
          */}
          {ordenadas[0] && (
            <button
              type="button"
              className="tk-dexdev-key tk-dexdev-key--block"
              style={{ marginBottom: 10 }}
              onClick={() => escolher(ordenadas[0]!)}
            >
              {t("dex.browse")}
            </button>
          )}

          {/* AO VIVO primeiro, foto depois: apontar e o que ele pediu, e mandar
              print e o caminho alternativo pra quem ja tem a imagem salva. */}
          {supportsCamera() && (
            <button
              type="button"
              className="tk-dexdev-key tk-dexdev-key--block"
              disabled={lendo || camera.state === "starting"}
              onClick={() => {
                if (camera.state === "on") void lerAoVivo();
                else camera.start();
              }}
            >
              {camera.state === "on"
                ? lendo
                  ? t("dex.reading")
                  : t("dex.scanNow")
                : camera.state === "starting"
                  ? t("dex.cameraStarting")
                  : t("dex.live")}
            </button>
          )}

          {camera.state === "on" && (
            <button
              type="button"
              className="tk-dexdev-soft"
              style={{ width: "100%", marginTop: 8 }}
              onClick={camera.stop}
            >
              {t("dex.cameraStop")}
            </button>
          )}

          {camera.state === "denied" && (
            <p className="tk-dexdev-note">{t("dex.cameraDenied")}</p>
          )}

          <button
            type="button"
            className="tk-dexdev-key tk-dexdev-key--block"
            disabled={lendo}
            onClick={() => arquivo.current?.click()}
          >
            {lendo ? t("dex.reading") : t("dex.photo")}
          </button>

          {/*
            SEM `capture`, de propósito.

            Com `capture="environment"` este botao abria a camera do sistema e
            pedia pra TIRAR uma foto — o mesmo que o botao de cima ja faz, e
            melhor, dentro do visor. Ficavam dois caminhos pra fotografar e
            nenhum pra anexar, e quem tinha o print salvo na galeria nao tinha
            por onde entrar.

            Sem o atributo, `accept="image/*"` abre o seletor: no Android a
            galeria; no iPhone a folha com Fototeca em cima e o print mais
            recente em primeiro lugar. Fotografar e o AO VIVO; este e o anexar.
          */}
          <input
            ref={arquivo}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void lerFoto(f);
            }}
          />

          {!visionAvailable() && <p className="tk-dexdev-note">{t("dex.photoNeedsAi")}</p>}

          <div className="tk-search tk-dexdev-ask">
            <IconSearch size={18} />
            <input
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder={t("dex.pick")}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label={t("dex.pick")}
            />
          </div>

          {sugestoes.length > 0 && (
            <div className="tk-dexdev-list">
              {sugestoes.map((s) => (
                <button key={s.id} type="button" className="tk-dexdev-item" onClick={() => escolher(s)}>
                  <span className="tk-dexdev-item-n">
                    {String(s.dex).padStart(3, "0")}
                  </span>
                  <SpeciesTile
                    spriteId={s.spriteId}
                    dex={s.dex}
                    speciesId={s.id}
                    name={s.name}
                    types={s.types}
                    size={34}
                  />
                  <span className="tk-dexdev-item-nome">{s.name}</span>
                  {/* Ponto de visto, como o jogo marca na lista. */}
                  {wasSeen(s.id) && (
                    <span className="tk-dexdev-item-seen" aria-hidden="true">
                      ●
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {semDados && (
            <p className="tk-dexdev-nodata" role="status">
              {t("dex.notFound")}
            </p>
          )}
        </>
      )}

      {erro && <p className="tk-dexdev-nodata">{erro}</p>}

      {/* A grade do alto-falante, no pe do aparelho. Puro enfeite, e e o enfeite
          que mais faz a coisa parecer um objeto em vez de uma pagina. */}
      <span className="tk-dexdev-grille" aria-hidden="true" />
    </div>,
    document.body,
  );
}
