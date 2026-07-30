import { useEffect, useState } from "react";

import {
  KOKORO_MB,
  ensureKokoro,
  kokoroReady,
  kokoroSupports,
  kokoroVoicesFor,
  onKokoroChange,
  type KokoroProgress,
} from "../ai/kokoro.ts";
import {
  ELEVEN_SHARED_VOICES,
  creditosRestantes,
  elevenSharedOn,
  getSharedVoice,
  setElevenSharedOn,
  setSharedVoice,
} from "../ai/elevenShared.ts";
import {
  edgeSupports,
  edgeVoicesFor,
  getEdgeVoice,
  setEdgeVoice,
} from "../ai/edgeTts.ts";
import {
  ELEVEN_VOICES,
  elevenAvailable,
  getElevenVoice,
  setElevenKey,
  setElevenVoice,
} from "../ai/elevenlabs.ts";
import { useLanguage } from "../i18n/language.ts";
import { useT } from "../i18n/t.ts";
import {
  getKokoroVoice,
  getPickedVoiceUri,
  neuralOn,
  setNeuralOn,
  listVoices,
  previewVoice,
  setKokoroVoice,
  setPickedVoiceUri,
  setVoiceOn,
  speak,
  speechSupported,
  stopSpeaking,
  voiceOn,
  type VoiceOption,
} from "../ui/dexVoice.ts";

/**
 * Escolher a voz da Pokedex, ouvindo antes.
 *
 * "coloca nas configurações pro usuario escolher a voz. reproduzindo previas ao
 * clicar em cima de um."
 *
 * A prévia nao e enfeite: os nomes que o sistema da ("Luciana", "Joana",
 * "Samantha") nao dizem nada sobre como soam, e escolher voz lendo nome e
 * escolher as cegas. Tocar ao tocar resolve — e e por isso que a lista TOCA em
 * vez de so marcar.
 *
 * As vozes caricatas da Apple (Eddy, Grandma, Zarvox…) nao aparecem aqui. Foram
 * elas que causaram o "leitor paia": a versao antiga pegava a primeira do idioma
 * e caia em cima delas. Oferecer agora seria oferecer o proprio defeito.
 */
export function VoiceSettings() {
  const { t } = useT();
  const language = useLanguage();
  const [vozes, setVozes] = useState<VoiceOption[]>([]);
  const [escolhida, setEscolhida] = useState<string | null>(getPickedVoiceUri);
  const [ligada, setLigada] = useState(voiceOn);
  const [kokoro, setKokoro] = useState(kokoroReady);
  const [kokoroVoz, setKokoroVoz] = useState(getKokoroVoice);
  const [baixando, setBaixando] = useState<KokoroProgress | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [neural, setNeural] = useState(neuralOn);
  const [share11, setShare11] = useState(elevenSharedOn);
  const [voz11share, setVoz11share] = useState(getSharedVoice);
  /** `undefined` = ainda perguntando; `null` = nao consegui saber; numero = saldo. */
  const [saldo11, setSaldo11] = useState<number | null | undefined>(undefined);
  const [edgeVoz, setEdgeVoz] = useState(() => getEdgeVoice(language));

  // O motor avisa quando termina de carregar: sem isto a lista de vozes boas
  // so apareceria na proxima vez que a tela abrisse.
  useEffect(() => onKokoroChange(() => setKokoro(kokoroReady())), []);

  /*
   * O saldo da ElevenLabs compartilhada, perguntado ao abrir a tela.
   *
   * Vem do servidor, que pergunta pra propria ElevenLabs — nao e estimativa
   * minha. Com ~50 leituras por MES pra todo mundo, saber quanto sobrou antes de
   * apertar e a diferenca entre um recurso limitado e um recurso quebrado.
   */
  useEffect(() => {
    const ctrl = new AbortController();
    void creditosRestantes(ctrl.signal).then((n) => setSaldo11(n));
    return () => ctrl.abort();
  }, []);

  const vozesBoas = kokoroVoicesFor(language);
  const [chave11, setChave11] = useState("");
  const [tem11, setTem11] = useState(elevenAvailable);
  const [voz11, setVoz11] = useState(getElevenVoice);

  /*
   * A lista chega VAZIA na primeira chamada em varios navegadores.
   *
   * `getVoices()` e preenchido de forma assincrona e avisa por
   * `voiceschanged`. Sem escutar esse evento, a tela abriria sem opcao nenhuma
   * no primeiro acesso e so funcionaria na segunda vez — que e o tipo de bug
   * que a pessoa descreve como "às vezes não aparece".
   */
  useEffect(() => {
    const atualizar = () => setVozes(listVoices(language));
    atualizar();

    const synth = globalThis.speechSynthesis;
    synth?.addEventListener("voiceschanged", atualizar);
    return () => {
      synth?.removeEventListener("voiceschanged", atualizar);
      stopSpeaking();
    };
  }, [language]);

  if (!speechSupported()) {
    return (
      <p className="tk-caption" style={{ margin: "0 2px", lineHeight: 1.5 }}>
        {t("dex.noSpeech")}
      </p>
    );
  }

  return (
    <>
      <p className="tk-caption" style={{ margin: "0 2px", lineHeight: 1.5 }}>
        {t("voice.what")}
      </p>

      <button
        type="button"
        className="tk-option"
        data-active={ligada || undefined}
        aria-pressed={ligada}
        style={{ marginTop: 12 }}
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

      {/* --------------------------------------------- a voz que resolveu */}

      {/*
        A voz neural online vem PRIMEIRO de todas.

        E a unica das quatro que junta as tres coisas que ele pediu: humana,
        gratis e sem configurar nada. Kokoro so fala ingles (o `kokoro-js`
        fonemiza sempre em ingles — ver a nota la), ElevenLabs pede chave e e
        paga, e a do sistema em portugues e a Luciana, que foi o comeco desta
        conversa. Nao ha download nem permissao: abrir a tela e apertar ▶ ja
        toca a voz de verdade.
      */}
      {edgeSupports(language) && (
        <>
          <div className="tk-overline" style={{ display: "block", margin: "22px 0 8px" }}>
            {t("voice.online")}
          </div>

          <button
            type="button"
            className="tk-option"
            data-active={neural || undefined}
            aria-pressed={neural}
            onClick={() => {
              const proximo = !neural;
              setNeural(proximo);
              setNeuralOn(proximo);
              if (proximo) void speak(t("voice.sample"), language);
            }}
          >
            <span className="tk-option-mark" aria-hidden="true">
              {neural ? "●" : "○"}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="tk-option-title">{t("voice.onlineTitle")}</span>
              <span className="tk-option-detail">{t("voice.onlineDetail")}</span>
            </span>
          </button>

          {neural && (
            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
              {edgeVoicesFor(language).map((v) => {
                const ativa = edgeVoz === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className="tk-option"
                    data-active={ativa || undefined}
                    aria-pressed={ativa}
                    onClick={() => {
                      setEdgeVoz(v.id);
                      setEdgeVoice(v.id);
                      // A previa passa pelo motor de verdade: tem que soar como
                      // vai soar na Pokedex, nao como a voz do sistema.
                      void speak(t("voice.sample"), language);
                    }}
                  >
                    <span className="tk-option-mark" aria-hidden="true">
                      {ativa ? "●" : "○"}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="tk-option-title">{v.label}</span>
                      <span className="tk-option-detail">{t("voice.onlineTag")}</span>
                    </span>
                    <span className="tk-voice-play" aria-hidden="true">
                      ▶
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ------------------------------------------------- a voz de verdade */}

      {/*
        Kokoro vem depois: no aparelho e offline, mas so em ingles.
        
        "bem ruim luciana e joana... quero vozes reais, vozes boas estilo eleven
        labs. mas gratis obvio". As vozes do sistema tem teto — sao de uma
        geracao anterior de sintese, e escolher a melhor delas nao muda isso.
        Kokoro e TTS neural rodando aqui mesmo: sem chave, sem conta, sem
        servidor, e com voz brasileira de verdade.
      */}
      {kokoroSupports(language) && (
        <>
          <div className="tk-overline" style={{ display: "block", margin: "22px 0 8px" }}>
            {t("voice.neural")}
          </div>

          {!kokoro ? (
            <section className="tk-card" style={{ display: "grid", gap: 10 }}>
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

              {erro && (
                <p className="tk-caption" style={{ color: "var(--tk-dang)" }}>
                  {erro}
                </p>
              )}
            </section>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {vozesBoas.map((v, i) => {
                const ativa = kokoroVoz === null ? i === 0 : kokoroVoz === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className="tk-option"
                    data-active={ativa || undefined}
                    aria-pressed={ativa}
                    onClick={() => {
                      setKokoroVoz(v.id);
                      setKokoroVoice(v.id);
                      // Toca com o motor de verdade, nao com o do sistema: a
                      // previa tem que soar como vai soar.
                      void speak(t("voice.sample"), language);
                    }}
                  >
                    <span className="tk-option-mark" aria-hidden="true">
                      {ativa ? "●" : "○"}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="tk-option-title">{v.label}</span>
                      <span className="tk-option-detail">{t("voice.neuralTag")}</span>
                    </span>
                    <span className="tk-voice-play" aria-hidden="true">
                      ▶
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ---------------------------------------------- ElevenLabs, com chave */}

      {/*
        A voz que ele pediu pelo nome, e a unica com portugues humano.
        
        Aparece depois do Kokoro porque custa cota: 10.000 caracteres por mes no
        plano gratuito, e uma ficha da Pokedex gasta uns 400. Quem usa o app em
        ingles fica bem servido pelo Kokoro sem gastar credito nenhum.
      */}
      <div className="tk-overline" style={{ display: "block", margin: "22px 0 8px" }}>
        {t("voice.eleven")}
      </div>

      {/*
        A compartilhada vem ANTES da caixa de chave, e vem DESLIGADA.

        Antes porque é a que a pessoa pode usar agora, sem criar conta. Desligada
        porque são ~50 leituras por MÊS pra todos os usuários somados — ligar
        sozinho gastaria a cota de todo mundo em quem nem pediu. Ver `tts11.ts`.

        O saldo aparece na própria linha: com um teto desse tamanho, descobrir
        que acabou apertando o botão faria o app parecer quebrado por 28 dias.
      */}
      <button
        type="button"
        className="tk-option"
        data-active={share11 || undefined}
        aria-pressed={share11}
        disabled={saldo11 === 0}
        onClick={() => {
          const proximo = !share11;
          setShare11(proximo);
          setElevenSharedOn(proximo);
          if (proximo) void speak(t("voice.sample"), language);
        }}
      >
        <span className="tk-option-mark" aria-hidden="true">
          {share11 ? "●" : "○"}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="tk-option-title">{t("voice.elevenShared")}</span>
          <span className="tk-option-detail">
            {saldo11 === undefined
              ? t("common.loading")
              : saldo11 === null
                ? t("voice.elevenSharedDetail")
                : saldo11 === 0
                  ? t("voice.elevenSharedOut")
                  : t("voice.elevenSharedLeft", { n: Math.floor(saldo11 / 400) })}
          </span>
        </span>
      </button>

      {share11 && (
        <div style={{ display: "grid", gap: 6, marginTop: 6, marginBottom: 6 }}>
          {ELEVEN_SHARED_VOICES.map((v) => {
            const ativa = voz11share === v.id;
            return (
              <button
                key={v.id}
                type="button"
                className="tk-option"
                data-active={ativa || undefined}
                aria-pressed={ativa}
                onClick={() => {
                  setVoz11share(v.id);
                  setSharedVoice(v.id);
                  // Sem prévia automática aqui: cada toque custa da cota do mês
                  // de todo mundo. Trocar a voz é escolha, ouvir é outro gesto.
                }}
              >
                <span className="tk-option-mark" aria-hidden="true">
                  {ativa ? "●" : "○"}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="tk-option-title">{v.label}</span>
                  <span className="tk-option-detail">{t("voice.elevenTag")}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

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
              setChave11("");
              setTem11(true);
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

        {tem11 &&
          ELEVEN_VOICES.map((v) => (
            <button
              key={v.id}
              type="button"
              className="tk-option"
              data-active={voz11 === v.id || undefined}
              aria-pressed={voz11 === v.id}
              onClick={() => {
                setVoz11(v.id);
                setElevenVoice(v.id);
                void speak(t("voice.sample"), language);
              }}
            >
              <span className="tk-option-mark" aria-hidden="true">
                {voz11 === v.id ? "●" : "○"}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="tk-option-title">{v.label}</span>
                <span className="tk-option-detail">{t("voice.elevenTag")}</span>
              </span>
              <span className="tk-voice-play" aria-hidden="true">
                ▶
              </span>
            </button>
          ))}
      </section>

      {vozes.length === 0 ? (
        <p className="tk-caption" style={{ margin: "14px 2px 0", lineHeight: 1.5 }}>
          {t("voice.none")}
        </p>
      ) : (
        <>
          <div className="tk-overline" style={{ display: "block", margin: "22px 0 8px" }}>
            {kokoro && kokoroSupports(language) ? t("voice.system") : t("voice.pick")}
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            {vozes.map((v) => {
              const ativa =
                escolhida === null ? v.recommended : escolhida === v.uri;
              return (
                <button
                  key={v.uri}
                  type="button"
                  className="tk-option"
                  data-active={ativa || undefined}
                  aria-pressed={ativa}
                  onClick={() => {
                    // Escolhe E toca: o toque serve pras duas coisas de uma vez,
                    // que e o que ele pediu.
                    setEscolhida(v.uri);
                    setPickedVoiceUri(v.uri);
                    previewVoice(v.uri, t("voice.sample"));
                  }}
                >
                  <span className="tk-option-mark" aria-hidden="true">
                    {ativa ? "●" : "○"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="tk-option-title">
                      {v.name}
                      {v.recommended && (
                        <span className="tk-voice-rec"> · {t("voice.recommended")}</span>
                      )}
                    </span>
                    <span className="tk-option-detail">{v.lang}</span>
                  </span>
                  <span className="tk-voice-play" aria-hidden="true">
                    ▶
                  </span>
                </button>
              );
            })}
          </div>

          {escolhida !== null && (
            <button
              type="button"
              className="tk-btn tk-btn--ghost tk-btn--block"
              style={{ height: 38, fontSize: 13, marginTop: 10 }}
              onClick={() => {
                setEscolhida(null);
                setPickedVoiceUri(null);
              }}
            >
              {t("voice.auto")}
            </button>
          )}

          {/* No iPhone da pra baixar vozes melhores, e o app passa a preferi-las
              sozinho porque elas pontuam mais alto. Dizer onde e mais util que
              qualquer ajuste que eu possa fazer no codigo. */}
          <p className="tk-caption" style={{ margin: "16px 2px 0", lineHeight: 1.5 }}>
            {t("voice.better")}
          </p>
        </>
      )}
    </>
  );
}
