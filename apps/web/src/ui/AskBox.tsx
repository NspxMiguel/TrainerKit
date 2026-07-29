import { useMemo, useRef, useState } from "react";

import { useGroq } from "../ai/groq.ts";
import { askAboutCollection, collectionFacts } from "../ai/ask.ts";
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
  const groq = useGroq();
  const { t } = useT();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const facts = useMemo(() => collectionFacts(items, data), [items, data]);

  if (!groq.key || items.length === 0) return null;

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
        apiKey: groq.key!,
        model: groq.model,
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
