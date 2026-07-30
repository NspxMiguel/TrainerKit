import { useState } from "react";

import { LIMITE_DIARIO } from "../ai/quota.ts";
import { getGroqKey, setGroqKey } from "../ai/groq.ts";
import { elevenAvailable, setElevenKey } from "../ai/elevenlabs.ts";
import { useT } from "../i18n/t.ts";

/**
 * "Ajude o projeto" — e por que ele NÃO recebe a sua chave.
 *
 * O Miguel pediu outra coisa: "ter uma função, um botao, dos usuários
 * compartilhar a sua propria api key com todo mundo (…) armazenando nos cofres
 * (vercel) do projeto, e dai aumenta os limites para todo mundo".
 *
 * Eu não construí isso, e a razão é a outra frase dele, na mesma mensagem: "nao
 * quero ter nenhuma complicação legal nesse projeto nao". As duas coisas não
 * cabem juntas:
 *
 *   · Os termos da Groq e da ElevenLabs proíbem repassar a chave. Quem "doa"
 *     está quebrando o contrato DELE, e um botão pedindo isso induz a quebra.
 *   · Guardar credencial de terceiro transforma o Miguel em custodiante. Hoje o
 *     pior caso de um vazamento é a conta dele; com chaves alheias, é a conta
 *     dos outros — e ele como responsável.
 *   · Chave de API ligada a uma conta é dado pessoal sob a LGPD. Coletar isso o
 *     torna controlador, com base legal, retenção, incidente e exclusão. É
 *     exatamente o backend-com-conta que o app inteiro foi desenhado pra não ter.
 *
 * O QUE ESTA TELA FAZ NO LUGAR, e que atinge o mesmo objetivo: mostrar que usar
 * a própria chave JÁ é a ajuda. Quem põe a sua sai do bolo compartilhado — e é
 * literalmente isso que aumenta o limite de todo mundo. Zero custódia, zero
 * quebra de termos, zero LGPD.
 *
 * É a mesma ação que ele imaginou, com o sentido invertido: em vez de mandar a
 * chave pro servidor, a chave fica no aparelho e o servidor deixa de ser usado.
 */

const GROQ_KEYS = "https://console.groq.com/keys";
const ELEVEN_KEYS = "https://elevenlabs.io/app/settings/api-keys";

export function HelpProject({ onOpenAi }: { onOpenAi: () => void }) {
  const { t } = useT();
  const [temGroq, setTemGroq] = useState(() => getGroqKey() !== null);
  const [tem11, setTem11] = useState(elevenAvailable);

  return (
    <>
      <section className="tk-card" style={{ display: "grid", gap: 10 }}>
        <p className="tk-caption" style={{ lineHeight: 1.6 }}>
          {t("help.why", { n: LIMITE_DIARIO })}
        </p>
        <p className="tk-caption" style={{ lineHeight: 1.6 }}>
          {t("help.how")}
        </p>
      </section>

      <div className="tk-overline" style={{ display: "block", margin: "22px 0 8px" }}>
        {t("help.steps")}
      </div>

      <section className="tk-card" style={{ display: "grid", gap: 12 }}>
        <p className="tk-caption" style={{ lineHeight: 1.6 }}>
          {t("help.step1")}
        </p>
        {/*
          Link normal, não um `window.open` — a pessoa vê pra onde vai antes de
          tocar, e pode abrir noutra aba se quiser.
        */}
        <a
          className="tk-btn tk-btn--secondary tk-btn--block"
          href={GROQ_KEYS}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t("help.openGroq")}
        </a>
        <p className="tk-caption" style={{ lineHeight: 1.6 }}>
          {t("help.step2")}
        </p>
        <button type="button" className="tk-btn tk-btn--primary tk-btn--block" onClick={onOpenAi}>
          {t("help.openSettings")}
        </button>
      </section>

      {/*
        TIRAR a chave, e o passo que importa mais depois dele.

        "tem q ter um negocio de tirar a key das ia do ajude o projeto tambem
        né.... e ensinar como apagar a key no proprio painel (mais seguro)".

        Ele tem razao, e a ordem que ele deu e a ordem certa: apagar aqui limpa o
        APARELHO, o que e util mas nao e seguranca. Se a chave ja vazou — print,
        aparelho emprestado, backup — apagar do `localStorage` nao a invalida:
        ela continua funcionando pra quem tiver o valor.

        Quem invalida de verdade e o painel do provedor. Por isso os dois botoes
        aparecem juntos, e o texto diz qual dos dois e o que resolve.
      */}
      {(temGroq || tem11) && (
        <>
          <div className="tk-overline" style={{ display: "block", margin: "22px 0 8px" }}>
            {t("help.removeTitle")}
          </div>

          <section className="tk-card" style={{ display: "grid", gap: 12 }}>
            <p className="tk-caption" style={{ lineHeight: 1.6 }}>
              {t("help.removeBody")}
            </p>

            {temGroq && (
              <>
                <button
                  type="button"
                  className="tk-btn tk-btn--secondary tk-btn--block"
                  onClick={() => {
                    setGroqKey(null);
                    setTemGroq(false);
                  }}
                >
                  {t("help.removeGroq")}
                </button>
                <a
                  className="tk-caption"
                  href={GROQ_KEYS}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ lineHeight: 1.6 }}
                >
                  {t("help.revokeGroq")}
                </a>
              </>
            )}

            {tem11 && (
              <>
                <button
                  type="button"
                  className="tk-btn tk-btn--secondary tk-btn--block"
                  onClick={() => {
                    setElevenKey(null);
                    setTem11(false);
                  }}
                >
                  {t("help.removeEleven")}
                </button>
                <a
                  className="tk-caption"
                  href={ELEVEN_KEYS}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ lineHeight: 1.6 }}
                >
                  {t("help.revokeEleven")}
                </a>
              </>
            )}
          </section>
        </>
      )}

      {/*
        A pergunta que ele fez, respondida na tela.

        Alguém vai ter a mesma ideia dele — é uma ideia razoável à primeira
        vista. Melhor responder aqui do que deixar a pessoa achando que o app
        simplesmente não pensou nisso.
      */}
      <div className="tk-overline" style={{ display: "block", margin: "22px 0 8px" }}>
        {t("help.whyNotShare")}
      </div>
      <section className="tk-card">
        <p className="tk-caption" style={{ lineHeight: 1.6 }}>
          {t("help.whyNotShareBody")}
        </p>
      </section>
    </>
  );
}
