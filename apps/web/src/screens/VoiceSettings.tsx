import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { KOKORO_MB, ensureKokoro, kokoroReady, onKokoroChange, type KokoroProgress } from "../ai/kokoro.ts";
import { creditosRestantes } from "../ai/elevenShared.ts";
import { elevenAvailable, setElevenKey } from "../ai/elevenlabs.ts";
import { listarVozes, outras, recomendadas, type Voz } from "../ai/vozes.ts";
import { useLanguage } from "../i18n/language.ts";
import { useT } from "../i18n/t.ts";
import {
  assinarSubstituicao,
  listVoices,
  setVoiceOn,
  setVozEscolhida,
  speak,
  speechSupported,
  stopSpeaking,
  ultimaSubstituicao,
  voiceOn,
  vozEscolhida,
} from "../ui/dexVoice.ts";

/**
 * Uma pergunta, uma lista.
 *
 * Trinta opções de voz, nenhuma delas dizendo o que era.
 *
 * A tela anterior estava organizada por MOTOR: uma seção pro Kokoro (com botão
 * de baixar 95 MB), uma pra neural (com interruptor), uma pra ElevenLabs (com
 * campo de chave, mais um interruptor de chave compartilhada, mais lista de voz),
 * e uma pras vozes do sistema. Quatro interruptores independentes que juntos
 * respondiam a UMA pergunta — e como nenhum deles sozinho decidia o resultado,
 * não dava pra prever qual voz ia sair.
 *
 * Agora: uma lista, ordenada, com a resposta certa em primeiro lugar. O motor
 * virou etiqueta embaixo do nome, junto com o que a pessoa precisa saber pra
 * escolher — sotaque, se gasta cota, se funciona offline.
 *
 * O que sumiu de propósito:
 *   · o interruptor da voz neural — ela é só mais uma voz na lista agora;
 *   · o interruptor da ElevenLabs compartilhada — idem;
 *   · a lista separada de vozes do sistema.
 *
 * O que ficou embaixo, como CONFIGURAÇÃO e não como escolha de voz: o download
 * do Kokoro e o campo de chave da ElevenLabs. Os dois são coisas que a pessoa
 * faz uma vez, não toda vez.
 */
/**
 * O nome do motor como a PESSOA o ve na lista, nao como o codigo o chama.
 *
 * Dizer "quem leu foi edge" nao ajuda ninguem: `edge` e detalhe de
 * implementacao, e a propria tela ja decidiu ha tempos que motor e etiqueta,
 * nao categoria.
 */
const NOME_MOTOR: Record<string, string> = {
  edge: "neural",
  kokoro: "Kokoro",
  sistema: "sistema",
  "eleven-share": "ElevenLabs",
  "eleven-user": "ElevenLabs",
};

export function VoiceSettings() {
  const { t } = useT();
  const language = useLanguage();
  const [ligada, setLigada] = useState(voiceOn);
  const [escolha, setEscolha] = useState<string | null>(vozEscolhida);
  const [sistema, setSistema] = useState<Array<{ voiceURI: string; name: string; lang: string }>>([]);
  const [kokoro, setKokoro] = useState(kokoroReady);
  const [baixando, setBaixando] = useState<KokoroProgress | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [chave11, setChave11] = useState("");
  const [tem11, setTem11] = useState(elevenAvailable);
  const [saldo11, setSaldo11] = useState<number | null | undefined>(undefined);

  useEffect(() => onKokoroChange(() => setKokoro(kokoroReady())), []);

  /*
   * As vozes do sistema chegam ASSÍNCRONAS.
   *
   * `getVoices()` costuma vir vazio na primeira chamada e só popula depois do
   * evento — foi por isso que a lista antiga às vezes abria sem nenhuma voz do
   * aparelho. `listVoices` já trata isso; aqui só re-consulto no evento.
   */
  useEffect(() => {
    const carregar = () =>
      setSistema(listVoices(language).map((v) => ({ voiceURI: v.uri, name: v.name, lang: v.lang })));
    carregar();
    globalThis.speechSynthesis?.addEventListener?.("voiceschanged", carregar);
    return () => globalThis.speechSynthesis?.removeEventListener?.("voiceschanged", carregar);
  }, [language]);

  useEffect(() => {
    const ctrl = new AbortController();
    void creditosRestantes(ctrl.signal).then(setSaldo11);
    return () => ctrl.abort();
  }, []);

  useEffect(() => () => stopSpeaking(), []);

  const todas = useMemo(() => listarVozes(language, sistema), [language, sistema]);
  const boas = useMemo(() => recomendadas(todas), [todas]);
  const resto = useMemo(() => outras(todas), [todas]);

  /** Nenhuma escolha salva = vale a primeira recomendada, e a tela mostra isso. */
  const ativa = escolha ?? boas[0]?.chave ?? null;

  /**
   * A etiqueta de cada voz: tudo que decide a escolha, numa linha.
   *
   * Sotaque primeiro porque é o defeito mais audível — foi o que ele pegou em
   * "as vozes nao tao em portugues, tao em outra lingua".
   */
  const etiqueta = (v: Voz): string => {
    const partes: string[] = [];
    if (v.sotaque && v.sotaque !== language) partes.push(v.sotaque);
    else if (!v.nativa) partes.push(t("voice.tag.foreign"));
    partes.push(
      v.motor === "edge"
        ? t("voice.tag.neural")
        : v.motor === "kokoro"
          ? t("voice.tag.device")
          : v.motor === "sistema"
            ? t("voice.tag.system")
            : t("voice.tag.eleven"),
    );
    if (v.gastaCota) partes.push(t("voice.tag.quota"));
    if (!v.online) partes.push(t("voice.tag.offline"));
    if (v.precisaBaixar && !kokoro) partes.push(t("voice.tag.needsDownload"));
    return partes.join(" · ");
  };

  const escolher = (v: Voz) => {
    setEscolha(v.chave);
    setVozEscolhida(v.chave);
    // Toca com o motor de verdade: a prévia tem que soar como vai soar na
    // Pokédex, não como a voz do sistema.
    void speak(t("voice.sample"), language);
  };

  /*
   * Se a prévia foi lida por OUTRA voz, a tela diz.
   *
   * Era o buraco que fazia Brian, Eric e Adriano soarem como a mesma voz: o
   * Adriano devolve 402 (voz de biblioteca em plano gratuito), o app caía calado
   * pra neural, e o rótulo continuava dizendo "Adriano". Não havia como
   * perceber sem comparar os áudios byte a byte — que foi o que eu
   * acabei tendo que fazer.
   *
   * A escolha dele não é desfeita: só fica dito quem leu de verdade.
   */
  const substituida = useSyncExternalStore(assinarSubstituicao, ultimaSubstituicao, () => null);

  const linha = (v: Voz) => (
    <button
      key={v.chave}
      type="button"
      className="tk-option"
      data-active={ativa === v.chave || undefined}
      aria-pressed={ativa === v.chave}
      disabled={v.gastaCota && saldo11 === 0}
      onClick={() => escolher(v)}
    >
      <span className="tk-option-mark" aria-hidden="true">
        {ativa === v.chave ? "●" : "○"}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="tk-option-title">{v.nome}</span>
        <span className="tk-option-detail">{etiqueta(v)}</span>
      </span>
      <span className="tk-voice-play" aria-hidden="true">
        ▶
      </span>
    </button>
  );

  return (
    <>
      <p className="tk-caption" style={{ margin: "0 2px 14px", lineHeight: 1.5 }}>
        {t("voice.intro")}
      </p>

      <button
        type="button"
        className="tk-option"
        data-active={ligada || undefined}
        aria-pressed={ligada}
        onClick={() => {
          const proximo = !ligada;
          setLigada(proximo);
          setVoiceOn(proximo);
          if (!proximo) stopSpeaking();
        }}
      >
        <span className="tk-option-mark" aria-hidden="true">
          {ligada ? "●" : "○"}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="tk-option-title">{t("voice.enabled")}</span>
          <span className="tk-option-detail">{t("voice.enabledDetail")}</span>
        </span>
      </button>

      {!speechSupported() && <p className="tk-dexdev-note">{t("dex.noSpeech")}</p>}

      {/* Quem LEU de verdade, quando não foi quem a pessoa escolheu. */}
      {substituida && (
        <p className="tk-dexdev-note" role="status">
          {t("voice.substituida", { voz: NOME_MOTOR[substituida.usada] ?? substituida.usada })}
        </p>
      )}

      {/* ------------------------------------------------ as que valem a pena */}

      {boas.length > 0 && (
        <>
          <div className="tk-overline" style={{ display: "block", margin: "22px 0 8px" }}>
            {t("voice.forYourLanguage")}
          </div>
          <div style={{ display: "grid", gap: 6 }}>{boas.map(linha)}</div>
        </>
      )}

      {/* --------------------------------------------------------- as outras */}

      {resto.length > 0 && (
        <>
          <div className="tk-overline" style={{ display: "block", margin: "22px 0 8px" }}>
            {t("voice.otherLanguages")}
          </div>
          {/*
            O aviso que faltava.

            As 21 vozes da biblioteca padrão da ElevenLabs são todas american,
            british ou australian — consultei a API dela. Elas FALAM português,
            mas com sotaque de quem aprendeu, e a tela antiga não dizia isso em
            lugar nenhum. Ele descobriu ouvindo.
          */}
          <p className="tk-caption" style={{ margin: "0 2px 8px", lineHeight: 1.5 }}>
            {t("voice.otherLanguagesWhy")}
          </p>
          <div style={{ display: "grid", gap: 6 }}>{resto.map(linha)}</div>
        </>
      )}

      {/* ------------------------------------------------------ configurações */}

      <div className="tk-overline" style={{ display: "block", margin: "26px 0 8px" }}>
        {t("voice.setup")}
      </div>

      {/* Kokoro: um download, uma vez. Não é escolha de voz — é o que faz as
          vozes dele aparecerem na lista de cima. */}
      {!kokoro && (
        <section className="tk-card" style={{ display: "grid", gap: 10, marginBottom: 10 }}>
          <p className="tk-caption" style={{ lineHeight: 1.5 }}>
            {t("voice.neuralWhat")}
          </p>
          <div className="tk-row">
            <span className="tk-row-label">{t("ai.local.size")}</span>
            <span className="tk-row-value">
              {t("ai.local.aboutMb", { mb: KOKORO_MB.toLocaleString(language) })}
            </span>
          </div>
          {baixando ? (
            <>
              <div className="tk-meter">
                <div
                  className="tk-meter-fill"
                  style={{
                    width: `${Math.round((baixando.fraction ?? 0) * 100)}%`,
                    background: "var(--tk-pri)",
                  }}
                />
              </div>
              <p className="tk-caption">{baixando.text}</p>
            </>
          ) : (
            <button
              type="button"
              className="tk-btn tk-btn--primary tk-btn--block"
              onClick={() => {
                setErro(null);
                setBaixando({ fraction: 0, text: t("ai.local.starting") });
                void ensureKokoro(setBaixando)
                  .then(() => setBaixando(null))
                  .catch((e: unknown) => {
                    setBaixando(null);
                    setErro(e instanceof Error ? e.message : String(e));
                  });
              }}
            >
              {t("voice.neuralGet")}
            </button>
          )}
        </section>
      )}

      {/* ElevenLabs: a chave própria, pra quem quer sem cota compartilhada. */}
      <section className="tk-card" style={{ display: "grid", gap: 10 }}>
        <p className="tk-caption" style={{ lineHeight: 1.5 }}>
          {t("voice.elevenWhat")}
        </p>
        <div className="tk-search" style={{ height: 44 }}>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={tem11 ? "••••••••" : "sk_…"}
            value={chave11}
            onChange={(e) => setChave11(e.target.value)}
            aria-label={t("voice.elevenKey")}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="tk-btn tk-btn--primary"
            style={{ flex: 1, height: 44, fontSize: 14 }}
            disabled={chave11.trim() === ""}
            onClick={() => {
              setElevenKey(chave11);
              setTem11(true);
              setChave11("");
            }}
          >
            {t("ai.save")}
          </button>
          <button
            type="button"
            className="tk-btn tk-btn--secondary"
            style={{ flex: 1, height: 44, fontSize: 14 }}
            disabled={!tem11}
            onClick={() => {
              setElevenKey(null);
              setTem11(false);
            }}
          >
            {t("ai.clear")}
          </button>
        </div>
      </section>

      {erro && (
        <p className="tk-caption" style={{ color: "var(--tk-dang)", marginTop: 10 }}>
          {erro}
        </p>
      )}
    </>
  );
}
