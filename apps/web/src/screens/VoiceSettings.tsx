import { useEffect, useState } from "react";

import { useLanguage } from "../i18n/language.ts";
import { useT } from "../i18n/t.ts";
import {
  getPickedVoiceUri,
  listVoices,
  previewVoice,
  setPickedVoiceUri,
  setVoiceOn,
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

      {vozes.length === 0 ? (
        <p className="tk-caption" style={{ margin: "14px 2px 0", lineHeight: 1.5 }}>
          {t("voice.none")}
        </p>
      ) : (
        <>
          <div className="tk-overline" style={{ display: "block", margin: "22px 0 8px" }}>
            {t("voice.pick")}
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
