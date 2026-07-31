import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { mensagemDeErro } from "../ai/erro.ts";
import { aiReady, chat } from "../ai/provider.ts";
import { LIMITE_DIARIO, onQuotaChange, restantes } from "../ai/quota.ts";
import { useT } from "../i18n/t.ts";

/**
 * A bolinha da IA, tipo a do WhatsApp.
 *
 * "#42 Bolinha flutuante da IA, tipo o WhatsApp com um logo diferente" — e o
 * pedido dele. O que ela resolve, alem do visual: hoje a IA vive escondida em
 * duas telas diferentes (a caixa de perguntas da Coleção e a da Pokédex), e quem
 * nao entra nelas nunca descobre que o app responde pergunta.
 *
 * ⚠️ O QUE ELA **NAO** E: um chatbot geral. Ela so aparece onde ha CONTEXTO —
 * uma especie aberta, a colecao, a Pokedex. "IA só na Pokédex + Você sabia +
 * chatbot ao clicar num Pokémon", nas palavras dele.
 *
 * Isso nao e limitacao de escopo, e o que faz a resposta prestar: sem contexto,
 * o modelo so tem a pergunta, e a pergunta sozinha ("ele é bom?") nao tem
 * resposta. Com o dossie da especie, tem. Uma bolha que aparece em toda tela
 * seria uma bolha que responde mal na maioria delas.
 *
 * Por isso `contexto` e obrigatorio: quem nao tem o que passar nao monta a
 * bolha, e o compilador cobra isso.
 */

interface Props {
  /**
   * O que a IA sabe, montado por quem abriu a tela (o dossiê da espécie, o
   * resumo da coleção). É o mesmo texto que já ia pro modelo antes — a bolha só
   * muda por onde a pergunta entra.
   */
  contexto: string;
  /** O prompt de sistema da tela. */
  sistema: string;
  /** Nome do que está em foco, pro cabeçalho da conversa. */
  titulo: string;
}

interface Fala {
  de: "eu" | "dex";
  texto: string;
}

export function AiBubble({ contexto, sistema, titulo }: Props) {
  const { t } = useT();
  const [aberta, setAberta] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [falas, setFalas] = useState<Fala[]>([]);
  const [pensando, setPensando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  const [sobram, setSobram] = useState(restantes);
  useEffect(() => onQuotaChange(() => setSobram(restantes())), []);

  // Rola pro fim a cada fala nova — numa conversa, o que importa e a ultima.
  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [falas, pensando]);

  useEffect(() => {
    if (!aberta) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberta(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberta]);

  // Sem IA configurada nao ha bolha. Um botao que so sabe dizer "ligue a IA nos
  // Ajustes" e um anuncio, nao um recurso.
  if (!aiReady()) return null;

  const perguntar = async () => {
    const q = pergunta.trim();
    if (q === "" || pensando) return;

    setPergunta("");
    setFalas((f) => [...f, { de: "eu", texto: q }]);
    setPensando(true);

    try {
      /*
       * O contexto vai INTEIRO a cada pergunta, e o historico NAO vai.
       *
       * Mandar a conversa toda dobraria o custo a cada turno — e com 20
       * perguntas por dia (ver `quota.ts`), isso e caro de verdade. Como o
       * contexto e sempre o mesmo dossie, cada pergunta e autossuficiente: "e o
       * ataque dele?" continua respondivel sem saber o que veio antes, porque o
       * ataque esta no dossie.
       *
       * A troca e assumida: perguntas que dependem MESMO da anterior ("e o
       * outro?") vao falhar. Preferi isso a queimar a cota do dia em quatro
       * perguntas.
       */
      const texto = await chat(
        [
          { role: "system", content: sistema },
          { role: "user", content: `${contexto}\n\n${t("bubble.question")}: ${q}` },
        ],
        { temperature: 0.2, maxTokens: 260, pergunta: q },
      );
      setFalas((f) => [...f, { de: "dex", texto }]);
    } catch (e) {
      setFalas((f) => [...f, { de: "dex", texto: mensagemDeErro(e, t) }]);
    } finally {
      setPensando(false);
    }
  };

  return (
    <>
      {/*
        A bolha vive num portal, presa a viewport.

        Dentro da arvore da tela ela rolaria junto com o conteudo e sumiria — que
        e o oposto de "flutuante".
      */}
      {createPortal(
        <button
          type="button"
          className="tk-bubble"
          data-open={aberta || undefined}
          aria-label={t("bubble.open")}
          onClick={() => setAberta((v) => !v)}
        >
          {/*
            A estrela em gradiente violeta do handoff §5.

            O ícone anterior era o `IconSpark` monocromático, herdado de quando
            esta bolha era só um botão azul. O gradiente é o que a liga
            visualmente ao resto da IA no app — e é a única coisa violeta que
            sobrevive sobre o vidro, que assume a cor do que está atrás.
          */}
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
        </button>,
        document.body,
      )}

      {aberta &&
        createPortal(
          <div
            className="tk-chat"
            role="dialog"
            aria-modal="true"
            aria-label={t("bubble.open")}
          >
            <div className="tk-chat-top">
              <span className="tk-chat-title">{titulo}</span>
              <span className="tk-chat-quota">
                {t("bubble.left", { n: sobram, total: LIMITE_DIARIO })}
              </span>
              <button
                type="button"
                className="tk-chat-close"
                onClick={() => setAberta(false)}
                aria-label={t("common.close")}
              >
                ✕
              </button>
            </div>

            <div className="tk-chat-body">
              {falas.length === 0 && (
                <p className="tk-chat-hint">{t("bubble.hint", { name: titulo })}</p>
              )}
              {falas.map((f, i) => (
                <div key={`${f.de}-${i}`} className="tk-chat-fala" data-de={f.de}>
                  {f.texto}
                </div>
              ))}
              {pensando && (
                <div className="tk-chat-fala" data-de="dex" data-pensando="true">
                  {t("ai.thinking")}
                </div>
              )}
              <div ref={fim} />
            </div>

            <div className="tk-chat-bottom">
              <div className="tk-search" style={{ flex: 1, minWidth: 0, height: 44 }}>
                <input
                  type="text"
                  value={pergunta}
                  placeholder={t("bubble.placeholder")}
                  onChange={(e) => setPergunta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void perguntar();
                  }}
                  aria-label={t("bubble.placeholder")}
                />
              </div>
              <button
                type="button"
                className="tk-chat-send"
                disabled={pensando || pergunta.trim() === ""}
                onClick={() => void perguntar()}
                aria-label={t("bubble.send")}
              >
                ↑
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
