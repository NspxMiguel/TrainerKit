import type { Platform } from "../storage/install.ts";
import { useT } from "../i18n/t.ts";
import { IconDownload } from "./Icons.tsx";

interface Props {
  platform: Platform;
  /** Armazenamento sem garantia de durabilidade — muda o tom da mensagem. */
  atRisk: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}

/**
 * Convite para instalar na tela inicial.
 *
 * No iOS a mensagem nao e sobre conveniencia: o Safari apaga os dados de
 * origens que passam 7 dias sem interacao, e estar instalado e o que faz o
 * WebKit conceder modo persistente. Por isso o texto muda quando o
 * armazenamento ainda nao esta protegido — ali e aviso, nao sugestao.
 *
 * Tinha dois botoes de 36px empilhados abaixo do texto, e eles custavam 46px de
 * altura numa tela que precisa caber inteira. Agora o aviso INTEIRO abre o
 * passo a passo e o dispensar e um × no canto — o padrao do sistema pra isto, e
 * o unico jeito de o aviso caber sem virar duas telas.
 */
export function InstallBanner({ platform, atRisk, onOpen, onDismiss }: Props) {
  const urgent = (platform === "iphone" || platform === "ipad") && atRisk;
  const { t } = useT();

  return (
    <div className={`tk-banner tk-banner--act ${urgent ? "tk-banner--warn" : "tk-banner--info"}`}>
      {/* Camada invisivel por cima de tudo: o alvo e o aviso inteiro, e nao um
          botao dentro dele. Botao dentro de botao nao existe em HTML. */}
      <button type="button" className="tk-banner-open" onClick={onOpen} aria-label={t("install.banner.how")} />

      <IconDownload size={20} />
      <div className="tk-banner-text">
        <div className="tk-banner-title">
          {urgent ? t("install.banner.urgentTitle") : t("install.banner.title")}
        </div>
        <p className="tk-banner-body">
          {urgent ? t("install.banner.urgentBody") : t("install.banner.body")}
        </p>
      </div>

      <button
        type="button"
        className="tk-banner-x"
        onClick={onDismiss}
        aria-label={t("install.banner.later")}
      >
        ×
      </button>
    </div>
  );
}
