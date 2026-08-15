import { useState } from "react";

import { useT } from "../i18n/t.ts";

/**
 * O canal pra dizer que algo está errado.
 *
 * A tela diz, com todas as letras, que o projeto e de uma pessoa so, pede
 * desculpa pelo que estiver errado e abre um caminho pra quem quiser avisar.
 *
 * O texto é dele, não meu — a frase "eu, as IAs e Deus" está lá porque foi assim
 * que ele descreveu o projeto, e trocar isso por "equipe" ou "desenvolvedor
 * independente" seria apagar a única voz humana da tela.
 *
 * ⚠️ POR QUE ISTO É UM `mailto:` E NÃO UM FORMULÁRIO: formulário exigiria um
 * servidor recebendo texto de estranhos, o que significa guardar dado de
 * terceiro — exatamente o que a política de privacidade promete que este app não
 * faz. Um `mailto:` abre o app de e-mail da própria pessoa: ela vê o que está
 * mandando, decide se manda, e nada passa por nós. Custa um toque a mais e
 * mantém a promessa inteira.
 */

const EMAIL = "spxmiguel@icloud.com";

export function FeedbackScreen() {
  const { t } = useT();
  const [copiado, setCopiado] = useState(false);

  /*
   * O corpo já vem com o que eu sempre precisaria perguntar depois.
   *
   * Aparelho, navegador e idioma são o que decide metade dos bugs deste app (o
   * leitor de print e a voz mudam de comportamento em cada um), e pedir isso num
   * segundo e-mail é como um relato de bug morre.
   */
  const corpo = [
    "",
    "",
    "---",
    `${t("feedback.ctx.app")}: TrainerKit ${__TK_VERSAO__}`,
    `${t("feedback.ctx.lang")}: ${navigator.language}`,
    `${t("feedback.ctx.device")}: ${navigator.userAgent}`,
  ].join("\n");

  const href =
    `mailto:${EMAIL}` +
    `?subject=${encodeURIComponent(t("feedback.subject"))}` +
    `&body=${encodeURIComponent(corpo)}`;

  return (
    <>
      <section className="tk-card" style={{ display: "grid", gap: 10 }}>
        <p className="tk-caption" style={{ lineHeight: 1.6 }}>
          {t("feedback.alone")}
        </p>
        <p className="tk-caption" style={{ lineHeight: 1.6 }}>
          {t("feedback.sorry")}
        </p>
        <p className="tk-caption" style={{ lineHeight: 1.6 }}>
          {t("feedback.ask")}
        </p>
      </section>

      <a
        className="tk-btn tk-btn--primary tk-btn--block"
        style={{ marginTop: 12, textDecoration: "none" }}
        href={href}
      >
        {t("feedback.send")}
      </a>

      {/*
        ⚠️ O ENDEREÇO VIROU BOTÃO DE COPIAR — antes era só texto.

        Relato de botões que não funcionam em Ajustes. Varredura nas treze telas:
        todas abrem, e todo botão tem gatilho. O único beco sem saída é este —
        `mailto:` não faz NADA em computador sem app de e-mail configurado, que é
        justamente onde o relato apareceu.

        O comentário antigo aqui já reconhecia o problema ("aí o botão não faz
        nada. Poder copiar salva o relato") e parava em mostrar o texto: a pessoa
        tinha que selecionar com o dedo um parágrafo de 11px. Reconhecer um
        defeito no comentário não é consertá-lo.

        Agora o endereço é um botão que copia e confirma. O `mailto:` continua
        sendo o caminho principal onde ele funciona (celular), e isto é a saída
        que sempre existe.
      */}
      <button
        type="button"
        className="tk-btn tk-btn--ghost tk-btn--block"
        style={{ marginTop: 10, height: 38, fontSize: 13 }}
        onClick={() => {
          void navigator.clipboard
            ?.writeText(EMAIL)
            .then(() => {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            })
            /* Sem área de transferência (http sem TLS, navegador antigo) o texto
               continua na tela pra selecionar na mão. Falhar calado aqui é
               melhor que um alerta sobre uma conveniência. */
            .catch(() => {});
        }}
      >
        {copiado ? t("feedback.copied") : EMAIL}
      </button>

      <p className="tk-caption" style={{ marginTop: 14, lineHeight: 1.6 }}>
        {t("feedback.privacy")}
      </p>
    </>
  );
}
