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
 */
export function InstallBanner({ platform, atRisk, onOpen, onDismiss }: Props) {
  const urgent = platform === "ios" && atRisk;
  const { t } = useT();

  return (
    <div className={`tk-banner ${urgent ? "tk-banner--warn" : "tk-banner--info"}`}>
      <IconDownload size={20} />
      <div className="tk-banner-text">
        <div className="tk-banner-title">
          {urgent ? t("install.banner.urgentTitle") : t("install.banner.title")}
        </div>
        <p className="tk-banner-body">
          {urgent ? t("install.banner.urgentBody") : t("install.banner.body")}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            className="tk-btn tk-btn--primary"
            style={{ height: 36, fontSize: 13, padding: "0 14px" }}
            onClick={onOpen}
          >
            {t("install.banner.how")}
          </button>
          <button
            type="button"
            className="tk-btn tk-btn--secondary"
            style={{ height: 36, fontSize: 13, padding: "0 14px" }}
            onClick={onDismiss}
          >
            {t("install.banner.later")}
          </button>
        </div>
      </div>
    </div>
  );
}
