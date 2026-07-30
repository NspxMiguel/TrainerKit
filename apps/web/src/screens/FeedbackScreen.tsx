import { useT } from "../i18n/t.ts";

/**
 * O canal pra dizer que algo está errado.
 *
 * O Miguel: "coloca um botao de feedback la nos ajustes. explica q ta fazendo o
 * projeto tudo sozinho, so eu, as ias e Deus. que pede desculpa se tiver algum
 * erro e ficaria feliz se pudesse comunicar para mim".
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
    `${t("feedback.ctx.app")}: TrainerKit 0.1.0`,
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

      {/* O endereço também em texto: no computador nem sempre há app de e-mail
          configurado, e aí o botão não faz nada. Poder copiar salva o relato. */}
      <p className="tk-caption" style={{ marginTop: 10, textAlign: "center" }}>
        {EMAIL}
      </p>

      <p className="tk-caption" style={{ marginTop: 14, lineHeight: 1.6 }}>
        {t("feedback.privacy")}
      </p>
    </>
  );
}
