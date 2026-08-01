import { useEffect, useRef, useState } from "react";

import { ACOES_QUE_COBRAM, ACTION_KEYS, decide, type VerdictInput } from "@trainerkit/core";

import { explainVerdict } from "../ai/explain.ts";
import { useAi } from "../ai/provider.ts";
import { useT, type Key } from "../i18n/t.ts";
import {
  evolvePokemon,
  setDoneAction,
  setMeuMotivo,
  useCollection,
  type MeuMotivo,
  type OwnedPokemon,
} from "../storage/collection.ts";
import { TOM_VEREDITO as TONE } from "./tomVeredito.ts";

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

/** O motivo guardado vira a frase da tela. Mapa explícito: as duas uniões são
    fechadas, e ligá-las por concatenação de string mataria as duas travas. */
const MOTIVO_KEY: Record<MeuMotivo, Key> = {
  gosto: "verdict.mine.gosto",
  uso: "verdict.mine.uso",
  desafio: "verdict.mine.desafio",
};

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
  const [discordando, setDiscordando] = useState(false);

  /*
   * O veredito manda evoluir E ha pra onde evoluir.
   *
   * As duas condicoes importam: uma especie de estagio final pode receber
   * "evoluir" por engano de dados, e evoluir pra lugar nenhum apagaria o
   * Pokemon da colecao ao gravar um `speciesId` vazio.
   */
  const vaiEvoluir = verdict.action === "evoluir" && props.evolvesInto.length > 0;
  const color = TONE[verdict.action] ?? "var(--tk-txt)";

  // A prop `owned` e uma foto do momento em que a tela abriu; quem responde ao
  // toque e o banco. Sem reler daqui, o botao nao mudava de estado.
  const atual = items?.find((x) => x.id === owned?.id) ?? owned;
  const feito = atual?.doneAction === verdict.action;
  /** Houve conta? "Descobrir o IV" não é uma conclusão, é um pedido de dado. */
  const temRastro = verdict.signals.length > 0;
  /** A pessoa discordou e o app aceitou. Ver `OwnedPokemon.meuMotivo`. */
  const meuMotivo = atual?.meuMotivo ?? null;

  /**
   * O peso da regra em palavra, e não em número.
   *
   * "+0.85" não diz nada pra quem não escreveu o motor. Três faixas dizem tudo
   * o que a pessoa precisa: se aquela linha mandou muito, mandou um pouco, ou
   * só opinou.
   */
  const forca = (peso: number): Key =>
    peso >= 0.8 ? "trace.strong" : peso >= 0.5 ? "trace.medium" : "trace.weak";

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

      {/*
        ⚠️ SEM REGRA NENHUMA, NÃO HÁ BARRA.

        Confiança é o grau de concordância ENTRE regras. Quando `decide()`
        devolve "descobrir o IV", nenhuma regra chegou a rodar — e desenhar uma
        barra vazia com "confiança 0%" ao lado seria mostrar o resultado de uma
        conta que não aconteceu.

        A condição é `signals.length`, e não `action === "descobrir"`, de
        propósito: qualquer resposta futura sem sinais herda o comportamento
        certo sem ninguém lembrar de vir aqui.
      */}
      {temRastro && (
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
      )}

      {/*
        "Ja fiz isso" no cartao do veredito.

        Ficava so na linha da Colecao, escondido num rotulo colorido que ninguem
        adivinha que e botao. Aqui, colado no veredito que esta cobrando a acao,
        e onde a pessoa esta olhando quando decide que ja fez.

        Marca QUAL acao foi feita, nao um sim/nao: o veredito muda quando o
        Pokemon sobe de nivel ou evolui, e "ja evolui" nao responde a um
        "transferir" que apareca depois.
      */}
      {/*
        ⚠️ EM "EVOLUIR" ESTE BOTAO EVOLUI, e nao marca um check.

        "cliquei em evoluir e o bulbasauro n foi, ja fiz e n foi. bulbasauro
        ainda aq"

        Eu tinha ligado a evolucao SO no botao redondo do hero da home e
        reportado como feito. Mas o caminho natural e outro: a pessoa toca em
        "Evoluir", o que ABRE A FICHA, e confirma aqui dentro — que era
        justamente o botao que eu nao tinha tocado. Ele continuava chamando
        `setDoneAction`, entao o Bulbasaur seguia Bulbasaur.

        Conserto de verdade: a decisao de o que fazer sai do componente que
        conhece o veredito, e vale nos dois lugares que mostram o cartao (a
        ficha e a calculadora de IV).
      */}
      {/* "Já fiz isso" só existe onde há algo a fazer. Marcar como cumprido um
          "me dá o IV" seria dizer que o IV chegou. */}
      {owned && temRastro && (
        <button
          type="button"
          className="tk-done"
          data-done={feito || undefined}
          aria-pressed={vaiEvoluir ? undefined : feito}
          onClick={() => {
            if (vaiEvoluir) void evolvePokemon(owned.id, props.evolvesInto[0]!);
            else void setDoneAction(owned.id, feito ? null : verdict.action);
          }}
        >
          <span className="tk-done-mark" aria-hidden="true">
            {vaiEvoluir ? "↑" : feito ? "✓" : "○"}
          </span>
          {vaiEvoluir
            ? t("collection.evolved")
            : feito
              ? t("collection.done")
              : t("collection.markDone")}
        </button>
      )}

      {temRastro && (
        <button
          type="button"
          className="tk-btn tk-btn--secondary tk-btn--block"
          style={{ height: 40, fontSize: 13, marginTop: 10 }}
          onClick={() => setTraceOpen((v) => !v)}
          aria-expanded={traceOpen}
        >
          {traceOpen ? t("verdict.hide") : t("verdict.howIGotHere")}
        </button>
      )}

      {/*
        ⚠️ O RASTRO EM PORTUGUÊS, e o `decide(bulbasaur) ├─ evolucao.pendente
        ..... +0.70` saiu da tela.

        "como cheguei nisso meio paia, meio dificil de entender, escreve mais
        facil..."

        Ele está certo, e o erro era de endereço: aquele desenho é a saída de um
        LOG — nomes de regra em snake_case, pesos de 0 a 1, arte ASCII. Ele foi
        feito pra eu depurar o motor, e eu o deixei na tela do usuário achando
        que "auditável" e "cru" eram a mesma coisa. Não são: auditável é a
        pessoa CONSEGUIR conferir, e ninguém confere `+0.70`.

        Agora cada regra vira uma frase com três partes — o que ela viu, pra
        onde ela puxou, e quanto ela pesou — e o fecho diz o resultado com a
        concordância em porcentagem. A informação é exatamente a mesma; o
        `formatTrace` continua no core, servindo aos testes e ao log, que é onde
        ele sempre foi bom.
      */}
      {traceOpen && (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {verdict.signals.map((s) => (
            <div key={s.rule} className="tk-trace-linha">
              <span className="tk-trace-bolha" style={{ background: TONE[s.towards] }} aria-hidden="true" />
              <span>
                <span className="tk-trace-porque">{tm(s.because)}</span>
                <span className="tk-trace-peso">
                  {t("trace.pull", { acao: t(ACTION_KEYS[s.towards] as Key) })} ·{" "}
                  {t(forca(s.weight))}
                </span>
              </span>
            </div>
          ))}
          <p className="tk-caption" style={{ lineHeight: 1.5, marginTop: 2 }}>
            {t("trace.result", {
              acao: t(ACTION_KEYS[verdict.action] as Key),
              percent: Math.round(verdict.confidence * 100),
            })}
          </p>
        </div>
      )}

      {/*
        ⚠️ DISCORDAR É UMA RESPOSTA VÁLIDA.

        "e tem q ter um botão, discordo... vai q o cara gosta do pokemon q quer
        colecionar? vai q ele ta num desafio e quer usa o pokemon pra fazer reid
        e ponto final? pense em tudo isso..."

        O motor decide com o que dá pra calcular. Gostar de um bicho, colecionar
        uma linha inteira, jogar um desafio de tipo único — nada disso entra
        numa conta, e nada disso é menos válido que um stat product. Sem esta
        saída, o app só sabia insistir, e insistir é dizer que a razão dele vale
        mais que a da pessoa.

        O veredito continua sendo calculado e continua na tela. O que muda é que
        ele para de COBRAR: sai da fila da home e nunca aparece na faxina.

        ⚠️ O TEXTO É NEUTRO QUANTO AO VEREDITO, e isso não é preferência de
        estilo — a versão anterior estava errada.

        O botão dizia "Discordo — fico com ele" e a pergunta seguinte, "Por que
        você fica com ele?". As duas frases foram escritas supondo que o veredito
        é TRANSFERIR. Num "Guardar" o botão oferecia, como discordância,
        exatamente o que o app tinha acabado de recomendar: concordar e discordar
        davam no mesmo. Ele apontou isso na tela — "discordo fico com ele?
        deveria ser so discordo".

        E não é só o Guardar: discordar de "Evoluir" também não é "fico com ele",
        é "não vou evoluir". O que este botão faz, em TODOS os casos, é uma coisa
        só — o app para de cobrar. É disso que o texto tem que falar.

        ⚠️ E NUM "GUARDAR" ELE NEM APARECE, porque ali não havia o que silenciar.

        Investigando o texto eu descobri que o problema era maior: `guardar` não
        entra na fila da home (`ACOES_QUE_COBRAM`) nem na faxina. Discordar dele
        gravava um motivo, mudava a tela — e não tinha efeito nenhum sobre nada.
        Botão que existe e não faz é pior que botão ausente: ele ensina que os
        outros também podem não fazer.

        A lista mora no core justamente para a home e este cartão não divergirem
        de novo.
      */}
      {owned && temRastro && ACOES_QUE_COBRAM.includes(verdict.action) && (
        meuMotivo ? (
          <div className="tk-meu-motivo">
            <span>
              {t("verdict.mine.kept")} — {t(MOTIVO_KEY[meuMotivo])}
            </span>
            <button
              type="button"
              className="tk-btn tk-btn--ghost"
              style={{ height: 34, fontSize: 12.5 }}
              onClick={() => void setMeuMotivo(owned.id, null)}
            >
              {t("verdict.mine.undo")}
            </button>
          </div>
        ) : discordando ? (
          <div className="tk-meu-motivo tk-meu-motivo--perguntando">
            <span className="tk-caption">{t("verdict.disagree.title")}</span>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {(["gosto", "uso", "desafio"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="tk-btn tk-btn--secondary tk-btn--block"
                  style={{ height: 40, fontSize: 13 }}
                  onClick={() => {
                    void setMeuMotivo(owned.id, m);
                    setDiscordando(false);
                  }}
                >
                  {t(MOTIVO_KEY[m])}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="tk-btn tk-btn--ghost tk-btn--block"
            style={{ height: 38, fontSize: 12.5, marginTop: 4 }}
            onClick={() => setDiscordando(true)}
          >
            {t("verdict.disagree")}
          </button>
        )
      )}
    </section>
  );
}
