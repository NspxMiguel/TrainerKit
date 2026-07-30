import { useMemo, useRef, useState } from "react";

import { askAboutCollection, collectionFacts } from "../ai/ask.ts";
import { ensureEngine, type LoadProgress } from "../ai/local.ts";
import { useAi } from "../ai/provider.ts";
import type { Dataset } from "../data/useDataset.ts";
import { useT } from "../i18n/t.ts";
import type { OwnedPokemon } from "../storage/collection.ts";
import { IconSpark } from "./Icons.tsx";

interface Props {
  items: readonly OwnedPokemon[];
  data: Dataset;
}

/**
 * A caixa de perguntas sobre a colecao.
 *
 * Fica na aba Colecao porque e sobre a colecao — perguntar "qual o meu melhor"
 * numa tela que nao e a dos seus Pokemon seria estranho.
 *
 * So aparece com chave configurada. Um campo morto dizendo "configure a IA nos
 * ajustes" seria propaganda ocupando espaco de quem nao pediu.
 */
export function AskBox({ items, data }: Props) {
  const ai = useAi();
  const { t } = useT();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [baixando, setBaixando] = useState<LoadProgress | null>(null);

  const facts = useMemo(() => collectionFacts(items, data), [items, data]);

  if (items.length === 0) return null;
  // Nem pronta nem baixavel (desligada, ou Groq sem chave, ou sem WebGPU): a
  // caixa nao aparece. Campo morto dizendo "configure a IA" e propaganda
  // ocupando espaco de quem nao pediu.
  if (!ai.ready && !ai.needsDownload) return null;

  /*
   * Escolheu IA local e ainda nao baixou o modelo.
   *
   * Antes `ready` dizia sim so por existir WebGPU, entao a caixa aparecia
   * normal, a primeira pergunta disparava 900 MB em SILENCIO e ela ficava
   * parada — era o "chat nao funcionando". Agora o estado aparece, com botao e
   * barra, e o download acontece porque alguem pediu.
   */
  if (ai.needsDownload) {
    return (
      <section className="tk-ask">
        <div className="tk-ask-head">
          <IconSpark size={17} />
          <span>{t("ask.title")}</span>
        </div>

        {baixando ? (
          <>
            <div className="tk-meter" style={{ marginTop: 10 }}>
              <div
                className="tk-meter-fill"
                style={{
                  width: `${Math.round((baixando.fraction ?? 0) * 100)}%`,
                  background: "var(--tk-pri)",
                }}
              />
            </div>
            <p className="tk-ask-wait">{baixando.text}</p>
          </>
        ) : (
          <>
            <p className="tk-caption" style={{ marginTop: 8, lineHeight: 1.5 }}>
              {t("ask.needsDownload")}
            </p>
            <button
              type="button"
              className="tk-btn tk-btn--primary tk-btn--block"
              style={{ marginTop: 10 }}
              onClick={() => {
                setBaixando({ fraction: 0, text: t("ai.local.starting") });
                void ensureEngine(ai.localModel, setBaixando)
                  .then(() => setBaixando(null))
                  .catch((e: unknown) => {
                    setBaixando(null);
                    setError(e instanceof Error ? e.message : String(e));
                  });
              }}
            >
              {t("ai.local.download")}
            </button>
          </>
        )}

        {error && (
          <p className="tk-ask-answer" style={{ color: "var(--tk-dang)" }}>
            {t("ask.failed", { reason: error })}
          </p>
        )}
      </section>
    );
  }

  const ask = async (q: string) => {
    const texto = q.trim();
    if (!texto) return;

    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await askAboutCollection({
        question: texto,
        facts,
        signal: controller.signal,
      });
      setAnswer(res);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  /** Sugestoes prontas: quem nunca perguntou nada a um app nao sabe o que cabe. */
  const suggestions: Array<"ask.s1" | "ask.s2" | "ask.s3"> = ["ask.s1", "ask.s2", "ask.s3"];

  return (
    <section className="tk-ask">
      <div className="tk-ask-head">
        <span className="tk-ask-mark" aria-hidden="true">
          <IconSpark size={15} />
        </span>
        <span className="tk-ask-title">{t("ask.title")}</span>
      </div>

      <div className="tk-search" style={{ height: 44 }}>
        <input
          type="text"
          value={question}
          placeholder={t("ask.placeholder")}
          aria-label={t("ask.title")}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ask(question);
          }}
        />
        <button
          type="button"
          className="tk-ask-send"
          aria-label={t("ask.send")}
          disabled={busy || question.trim() === ""}
          onClick={() => void ask(question)}
        >
          ↑
        </button>
      </div>

      {!answer && !busy && (
        <div className="tk-chips" style={{ marginTop: 8 }}>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="tk-chip"
              onClick={() => {
                setQuestion(t(s));
                void ask(t(s));
              }}
            >
              {t(s)}
            </button>
          ))}
        </div>
      )}

      {busy && <p className="tk-ask-wait">{t("ask.thinking")}</p>}

      {answer && <p className="tk-ask-answer">{answer}</p>}

      {error && (
        <p className="tk-ask-answer" style={{ color: "var(--tk-dang)" }}>
          {t("ask.failed", { reason: error })}
        </p>
      )}

      {(answer || error) && (
        <button
          type="button"
          className="tk-btn tk-btn--ghost"
          style={{ height: 34, fontSize: 12, padding: 0, marginTop: 4 }}
          onClick={() => {
            setAnswer(null);
            setError(null);
            setQuestion("");
          }}
        >
          {t("ask.again")}
        </button>
      )}
    </section>
  );
}
