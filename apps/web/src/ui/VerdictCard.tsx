import { useEffect, useRef, useState } from "react";

import { ACTION_KEYS, decide, formatTrace, type VerdictInput } from "@trainerkit/core";

import { explainVerdict } from "../ai/explain.ts";
import { useAi } from "../ai/provider.ts";
import { useT, type Key } from "../i18n/t.ts";
import { setDoneAction, useCollection, type OwnedPokemon } from "../storage/collection.ts";

const TONE: Record<string, string> = {
  investir: "var(--tk-succ)",
  evoluir: "var(--tk-pri)",
  guardar: "var(--tk-info)",
  transferir: "var(--tk-dang)",
};

/**
 * O veredito, com o rastro atras.
 *
 * A frase de motivo e UMA. Nunca duas — foi a regra do prototipo e ela esta
 * certa: duas frases viram parede de texto e o jogador para de ler.
 *
 * O rastro fica escondido atras de "como cheguei nisso", mas EXISTE. E a
 * diferenca entre um app que manda voce confiar e um que aceita ser conferido.
 */
/**
 * O Pokemon salvo, quando o veredito e sobre um bicho da colecao.
 *
 * Sem isto o cartao anunciava "INVESTIR" em verde de 26px e nao oferecia nada —
 * o Miguel, duas vezes: "essa desgraça de investir sem jeito de tirar isso". Um
 * aviso que nao sai depois de atendido para de ser aviso e vira ruido, e pior:
 * ensina a ignorar os outros.
 */
interface Props extends VerdictInput {
  owned?: OwnedPokemon | undefined;
}

export function VerdictCard({ owned, ...props }: Props) {
  const verdict = decide(props);
  const { t, tm, language } = useT();
  const { items } = useCollection();
  const motor = useAi();
  const [ai, setAi] = useState<string | null>(null);
  const [aiError, setAiError] = useState(false);
  const asked = useRef<string | null>(null);

  /**
   * A explicacao em texto do modelo, quando o usuario ligou uma chave.
   *
   * Ela ACOMPANHA o veredito, nunca o substitui: a frase por regras continua
   * acima, e o rastro continua atras do botao. Se a chamada falhar, o cartao
   * fica exatamente como era sem IA — por isso o erro so some com a caixinha em
   * vez de virar um alerta.
   */
  useEffect(() => {
    if (!motor.ready) return;
    // Uma chamada por veredito, nao por render.
    const fingerprint = `${props.name}|${verdict.action}|${verdict.confidence.toFixed(3)}`;
    if (asked.current === fingerprint) return;
    asked.current = fingerprint;

    const abort = new AbortController();
    setAi(null);
    setAiError(false);

    void explainVerdict(
      {
        language,
        species: props.name,
        action: t(ACTION_KEYS[verdict.action] as Key),
        confidence: verdict.confidence,
        reason: tm(verdict.reason),
        signals: verdict.signals.map((s) => ({
          rule: s.rule,
          weight: s.weight,
          because: tm(s.because),
        })),
        ivTotal: props.ivs.atk + props.ivs.def + props.ivs.hp,
        cp: null,
      },
      abort.signal,
    )
      .then(setAi)
      .catch(() => setAiError(true));

    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motor.ready, motor.provider, motor.localModel, language, props.name, verdict.action, verdict.confidence]);
  const [traceOpen, setTraceOpen] = useState(false);
  const color = TONE[verdict.action] ?? "var(--tk-txt)";

  // A prop `owned` e uma foto do momento em que a tela abriu; quem responde ao
  // toque e o banco. Sem reler daqui, o botao nao mudava de estado.
  const atual = items?.find((x) => x.id === owned?.id) ?? owned;
  const feito = atual?.doneAction === verdict.action;

  return (
    <section className="tk-card" style={{ borderColor: color }}>
      <div className="tk-overline">{t("verdict.title")}</div>

      <div
        style={{
          font: "800 26px/1.1 var(--tk-font)",
          letterSpacing: "-0.02em",
          color,
          margin: "8px 0 6px",
        }}
      >
        {t(ACTION_KEYS[verdict.action] as Key)}
      </div>

      <p className="tk-body" style={{ color: "var(--tk-txt)" }}>
        {tm(verdict.reason)}
      </p>

      {/* A voz do modelo vem DEPOIS da frase por regras, com marca propria: o
          que o app garante e o veredito; o texto abaixo e so a mesma coisa dita
          de outro jeito. Misturar os dois apagaria essa diferenca. */}
      {motor.ready && !aiError && (
        <p className="tk-ai">
          {ai ?? <span className="tk-ai-wait">{t("ai.thinking")}</span>}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
        {/* A barra CRESCE ao aparecer. Nao e enfeite: ela esta dizendo que
            aquele numero acabou de sair de uma conta. Ver `.tk-meter` no CSS. */}
        <div className="tk-meter">
          <div
            className="tk-meter-fill"
            style={{ width: `${Math.round(verdict.confidence * 100)}%`, background: color }}
          />
        </div>
        <span className="tk-caption">
          {t("verdict.confidence", { percent: Math.round(verdict.confidence * 100) })}
        </span>
      </div>

      {/*
        "Ja fiz isso" no cartao do veredito.

        Ficava so na linha da Colecao, escondido num rotulo colorido que ninguem
        adivinha que e botao. Aqui, colado no veredito que esta cobrando a acao,
        e onde a pessoa esta olhando quando decide que ja fez.

        Marca QUAL acao foi feita, nao um sim/nao: o veredito muda quando o
        Pokemon sobe de nivel ou evolui, e "ja evolui" nao responde a um
        "transferir" que apareca depois.
      */}
      {owned && (
        <button
          type="button"
          className="tk-done"
          data-done={feito || undefined}
          aria-pressed={feito}
          onClick={() => void setDoneAction(owned.id, feito ? null : verdict.action)}
        >
          <span className="tk-done-mark" aria-hidden="true">
            {feito ? "✓" : "○"}
          </span>
          {feito ? t("collection.done") : t("collection.markDone")}
        </button>
      )}

      <button
        type="button"
        className="tk-btn tk-btn--secondary tk-btn--block"
        style={{ height: 40, fontSize: 13, marginTop: 10 }}
        onClick={() => setTraceOpen((v) => !v)}
        aria-expanded={traceOpen}
      >
        {traceOpen ? t("verdict.hide") : t("verdict.howIGotHere")}
      </button>

      {traceOpen && (
        <>
          <pre className="tk-trace">{formatTrace(props.name.toLowerCase(), verdict)}</pre>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {verdict.signals.map((s) => (
              <div key={s.rule} className="tk-caption" style={{ lineHeight: 1.45 }}>
                <span style={{ fontFamily: "var(--tk-mono)", color: "var(--tk-txt2)" }}>
                  {s.rule}
                </span>{" "}
                — {tm(s.because)}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
