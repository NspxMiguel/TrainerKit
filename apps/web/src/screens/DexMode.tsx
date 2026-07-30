import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { buildDexEntry, type DexEntry } from "@trainerkit/core";

import { chat } from "../ai/provider.ts";
import { identifySpecies, visionAvailable } from "../ai/vision.ts";
import { fold } from "../data/fold.ts";
import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { useLanguage } from "../i18n/language.ts";
import { useT, type Key } from "../i18n/t.ts";
import { typeColor, typeKey } from "../sprites/provider.ts";
import { IconCamera, IconSearch } from "../ui/Icons.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { beep, setVoiceOn, speak, speechSupported, stopSpeaking, voiceOn } from "../ui/dexVoice.ts";

interface Props {
  data: Dataset;
  onClose: () => void;
  /** Abrir a ficha completa da especie — a Pokedex e a porta, nao o destino. */
  onOpenSpecies: (s: DatasetSpecies) => void;
}

const LIGAS = ["great", "ultra", "master"] as const;

/**
 * Modo Pokedex.
 *
 * A ideia do Miguel, em maiuscula porque ele escreveu assim: "PODERIA FUNCIONAR
 * IGUAL UMA POKEDEX DA SERIE, VC APONTA PRO POKEMON, MANDA PRINT E ETC, E PODE
 * FAZER PERGUNTAS, TALVEZ COM ALGUMA IA AVANÇADA, ATÉ IMITAR A VOZ DA POKEDEX
 * ORIGINAL".
 *
 * O que a Pokedex da serie faz, e o que dá pra fazer aqui:
 *
 *   APONTA      camera ou print. Precisa de modelo que enxergue, e so a Groq
 *               tem — os que rodam no aparelho sao de texto. A tela diz isso.
 *   IDENTIFICA  o nome que o modelo devolve e CASADO contra o dataset antes de
 *               valer. Sem casar, "sem dados" — nunca a ficha do bicho errado.
 *   ANUNCIA     em voz, com a cadencia de aparelho. Ver `dexVoice.ts`.
 *   CONVERSA    campo de pergunta, respondido com a ficha como contexto.
 *
 * ⚠️ O texto da ficha e ESCRITO PELO APP, a partir do que o app calculou. As
 * descricoes do jogo ("Machamp tem quatro braços que se movem tão rápido…") sao
 * obra criativa da Pokemon Company e nao entram aqui. Isso saiu melhor do que
 * copiar: "entre os atacantes de Lutador, é o quarto melhor para raides" muda a
 * decisao de quem joga hoje; a descricao original e bonita e nao serve pra nada.
 */
export function DexMode({ data, onClose, onOpenSpecies }: Props) {
  const { t } = useT();
  const language = useLanguage();
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

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      // Sair da tela cala o aparelho. Voz continuando depois de a tela fechar e
      // o tipo de bug que faz alguem desinstalar o app no meio da rua.
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Sugestoes por nome. Formas cosmeticas ficam fora: mesmos stats, so poluem. */
  const sugestoes = useMemo(() => {
    const q = fold(busca);
    if (q.length < 2) return [];
    return data.species
      .filter((s) => s.cosmeticOf === null && fold(s.name).includes(q))
      .sort((a, b) => {
        const ai = fold(a.name).startsWith(q) ? 0 : 1;
        const bi = fold(b.name).startsWith(q) ? 0 : 1;
        return ai - bi || a.dex - b.dex;
      })
      .slice(0, 6);
  }, [busca, data.species]);

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
   * do aparelho da serie: nome e numero, tipo, o que ele e, e depois os numeros.
   */
  const locucao = useMemo((): string[] => {
    if (!ficha) return [];

    const nomeTipo = (tp: string) => t(typeKey(tp) as "type.normal");
    const linhas = [
      t("dex.line.name", { name: ficha.name, dex: ficha.dexNumber }),
      t("dex.line.types", { types: ficha.types.map(nomeTipo).join(" / ") }),
      t(`dex.build.${ficha.build}` as Key),
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
    ];

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
  }, [ficha, t, language, data.version.levelCap]);

  /** Anuncia: bipe, depois a locucao inteira como um texto so. */
  const anunciar = async (linhas: string[]) => {
    if (!voz || !speechSupported()) return;
    await beep();
    await speak(linhas.join(" "), language);
  };

  const escolher = (s: DatasetSpecies) => {
    setAlvo(s);
    setBusca("");
    setSemDados(false);
    setErro(null);
    setResposta(null);
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
        data.species.find((s) => s.cosmeticOf === null && fold(s.name) === chave) ??
        data.species.find((s) => s.cosmeticOf === null && fold(s.name).startsWith(chave));

      if (!achou) {
        setSemDados(true);
        return;
      }
      setAlvo(achou);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setLendo(false);
    }
  };

  /* -------------------------------------------------------- conversar */

  const perguntar = async () => {
    const q = pergunta.trim();
    if (!q || !ficha) return;

    setPensando(true);
    setResposta(null);
    try {
      const texto = await chat(
        [
          {
            role: "system",
            content: `Você é a Pokédex do TrainerKit, um app de Pokémon GO.

Responda a pergunta usando SÓ a ficha que receber. Ela foi calculada pelo app.

Regras rígidas:
- Nunca invente números, movesets, posições nem mecânicas fora da ficha.
- Se a ficha não responde, diga que não tem esse dado.
- Não gere, descreva nem ofereça imagens.
- Tom de aparelho: direto, sem saudação, no máximo 3 frases curtas.
- Responda no idioma da pergunta.`,
          },
          { role: "user", content: `Ficha:\n${locucao.join("\n")}\n\nPergunta: ${q}` },
        ],
        { temperature: 0.2, maxTokens: 220 },
      );
      setResposta(texto);
      if (voz && speechSupported()) void speak(texto, language);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setPensando(false);
    }
  };

  const cor = alvo ? typeColor(alvo.types[0] ?? "normal") : "var(--tk-dang)";

  return createPortal(
    <div
      className="tk-dex"
      role="dialog"
      aria-modal="true"
      aria-label={t("dex.title")}
      style={{ ["--tk-dex-type" as string]: cor }}
    >
      <header className="tk-sheet-head">
        <button
          type="button"
          className="tk-sheet-close"
          onClick={onClose}
          aria-label={t("common.back")}
        >
          ‹
        </button>
        <h2 className="tk-sheet-title">{t("dex.title")}</h2>

        {/* A luz do aparelho. Pisca enquanto ele "le" — e o unico enfeite da
            tela, e ele esta dizendo algo: que ha trabalho acontecendo. */}
        <span className="tk-dex-lamp" data-busy={(lendo || pensando) || undefined} aria-hidden="true" />
      </header>

      {/* ------------------------------------------------------- a lente */}

      <div className="tk-dex-lens">
        {alvo ? (
          <button
            type="button"
            className="tk-dex-art"
            onClick={() => onOpenSpecies(alvo)}
            aria-label={alvo.name}
          >
            <SpeciesTile
              spriteId={alvo.spriteId}
              dex={alvo.dex}
              speciesId={alvo.id}
              name={alvo.name}
              types={alvo.types}
              size={132}
            />
          </button>
        ) : (
          <div className="tk-dex-empty" aria-hidden="true">
            <IconCamera size={34} />
          </div>
        )}
      </div>

      {/* ------------------------------------------------------ entradas */}

      {!alvo && (
        <>
          <button
            type="button"
            className="tk-cta"
            style={{ marginTop: 18 }}
            disabled={lendo}
            onClick={() => arquivo.current?.click()}
          >
            <span className="tk-cta-mark" aria-hidden="true">
              <IconCamera size={22} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="tk-cta-title">{lendo ? t("dex.reading") : t("dex.photo")}</span>
              <span className="tk-cta-detail">{t("dex.photoDetail")}</span>
            </span>
          </button>

          {/*
            `capture="environment"` abre a camera de tras direto no Android; no
            iPhone o Safari mostra a folha com Camera e Fototeca, que e melhor
            ainda — quem quer mandar print escolhe print.
          */}
          <input
            ref={arquivo}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void lerFoto(f);
            }}
          />

          {/* Sem chave da Groq a foto nao tem como funcionar, e dizer isso antes
              e melhor que deixar tentar e falhar. */}
          {!visionAvailable() && (
            <p className="tk-caption" style={{ margin: "10px 2px 0", lineHeight: 1.5 }}>
              {t("dex.photoNeedsAi")}
            </p>
          )}

          <div className="tk-overline" style={{ display: "block", margin: "22px 0 8px" }}>
            {t("dex.pick")}
          </div>

          <div className="tk-search">
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
            <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
              {sugestoes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="tk-teamrow"
                  onClick={() => escolher(s)}
                >
                  <SpeciesTile
                    spriteId={s.spriteId}
                    dex={s.dex}
                    speciesId={s.id}
                    name={s.name}
                    types={s.types}
                    size={36}
                  />
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span className="tk-teamrow-name">{s.name}</span>
                    <span className="tk-teamrow-moves">
                      #{String(s.dex).padStart(3, "0")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {semDados && (
            <p className="tk-caption tk-dex-nodata" role="status">
              {t("dex.notFound")}
            </p>
          )}
        </>
      )}

      {/* --------------------------------------------------------- a ficha */}

      {ficha && (
        <>
          <div className="tk-dex-name">{ficha.name}</div>
          <div className="tk-dex-sub">
            #{ficha.dexNumber}
            {" · "}
            {ficha.types.map((tp) => t(typeKey(tp) as "type.normal")).join(" · ")}
          </div>

          <div className="tk-overline" style={{ display: "block", marginTop: 20 }}>
            {t("dex.entry")}
          </div>
          <section className="tk-card tk-dex-entry" style={{ marginTop: 8 }}>
            {locucao.map((linha) => (
              <p key={linha}>{linha}</p>
            ))}
          </section>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="tk-btn tk-btn--secondary"
              style={{ flex: 1, height: 42, fontSize: 13 }}
              disabled={!speechSupported() || !voz}
              onClick={() => void anunciar(locucao)}
            >
              {t("dex.speak")}
            </button>
            <button
              type="button"
              className="tk-btn tk-btn--secondary"
              style={{ flex: 1, height: 42, fontSize: 13 }}
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
          </div>

          {!speechSupported() && (
            <p className="tk-caption" style={{ marginTop: 8 }}>
              {t("dex.noSpeech")}
            </p>
          )}

          {/* Conversar com a ficha. So aparece com IA ligada — um campo morto
              dizendo "configure a IA" e propaganda ocupando espaco de quem nao
              pediu. */}
          <div className="tk-overline" style={{ display: "block", marginTop: 22 }}>
            {t("dex.ask")}
          </div>
          <div className="tk-search" style={{ marginTop: 8 }}>
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
            className="tk-btn tk-btn--primary tk-btn--block"
            style={{ marginTop: 8 }}
            disabled={pensando || pergunta.trim() === ""}
            onClick={() => void perguntar()}
          >
            {pensando ? t("ai.thinking") : t("dex.ask")}
          </button>

          {resposta && <p className="tk-ai">{resposta}</p>}

          <button
            type="button"
            className="tk-btn tk-btn--ghost tk-btn--block"
            style={{ marginTop: 18 }}
            onClick={() => {
              stopSpeaking();
              setAlvo(null);
              setResposta(null);
              setErro(null);
            }}
          >
            {t("dex.pick")}
          </button>
        </>
      )}

      {erro && (
        <p className="tk-caption" style={{ marginTop: 12, color: "var(--tk-dang)" }}>
          {erro}
        </p>
      )}
    </div>,
    document.body,
  );
}
