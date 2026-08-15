import { useT } from "../i18n/t.ts";
import {
  DIAS_ADIADO,
  applyUpdate,
  neverAskUpdate,
  snoozeUpdate,
  useUpdate,
} from "../storage/updates.ts";
import { IconDownload } from "./Icons.tsx";

/**
 * "Tem versao nova."
 *
 * Aparece so quando ha, de fato, uma versao BAIXADA e parada esperando — nunca
 * como promessa. Atualizar leva um segundo porque o arquivo ja esta no
 * aparelho; o botao so solta o freio.
 *
 * As tres saidas dizem coisas diferentes, e por isso sao tres:
 *
 *   Atualizar — agora.
 *   Daqui a 3 dias — some por tres dias, pra quem esta no meio de alguma coisa.
 *   Nao avisar mais — some pra sempre. A atualizacao continua acontecendo
 *   sozinha quando o app for fechado de vez; o que se desliga e o AVISO, nao a
 *   atualizacao. Voltar a avisar fica nos Ajustes.
 *
 * Usa a mesma forma do convite de instalar, de proposito: sao os dois avisos do
 * app, e avisos que se parecem sao avisos que se aprende a ler uma vez so.
 */
export function UpdateBanner() {
  const { t } = useT();
  const update = useUpdate();

  if (!update.visible) return null;

  return (
    <div className="tk-banner tk-banner--update" role="status">
      <IconDownload size={20} />
      <div className="tk-banner-text">
        <div className="tk-banner-title">{t("update.title")}</div>
        <p className="tk-banner-body">{t("update.body")}</p>

        <div className="tk-banner-acts">
          <button type="button" className="tk-btn tk-btn--primary" onClick={applyUpdate}>
            {t("update.apply")}
          </button>
          <button
            type="button"
            className="tk-btn tk-btn--secondary"
            onClick={() => snoozeUpdate()}
          >
            {t("update.later", { days: DIAS_ADIADO })}
          </button>
          <button type="button" className="tk-btn tk-btn--ghost" onClick={neverAskUpdate}>
            {t("update.never")}
          </button>
        </div>
      </div>
    </div>
  );
}
