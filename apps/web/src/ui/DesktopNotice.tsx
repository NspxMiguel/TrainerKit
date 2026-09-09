import { useT } from "../i18n/t.ts";
import { useTelaLarga } from "./telaLarga.ts";

/**
 * Aviso de que esta e a versao de computador de um app feito pro celular.
 *
 * Nao e um pedido de desculpas nem um bloqueio: tudo funciona aqui. E que a
 * leitura de print espera uma captura de celular, os dados offline foram
 * dimensionados pra tela pequena, e quem chega pelo computador nao tem como
 * saber disso antes de tentar.
 *
 * Some sozinho no celular, que e onde o app deveria estar — nao ha o que
 * dispensar, porque no aparelho certo ele nunca aparece.
 */
export function DesktopNotice() {
  const { t } = useT();
  if (!useTelaLarga()) return null;

  return (
    <div className="tk-banner tk-banner--info" role="note">
      <div className="tk-banner-text">
        <div className="tk-banner-title">{t("desktop.notice.title")}</div>
        <p className="tk-banner-body">{t("desktop.notice.body")}</p>
      </div>
    </div>
  );
}
