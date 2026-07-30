import { useState } from "react";
import { createPortal } from "react-dom";

import { useT } from "../i18n/t.ts";
import { useSetup } from "../onboarding/setup.ts";
import { exportJson, useCollection } from "../storage/collection.ts";
import { wipeEverything } from "../storage/wipe.ts";
import { IconAlert } from "./Icons.tsx";

/**
 * Apagar tudo, com o freio no lugar certo.
 *
 * Nao ha servidor: o que for apagado aqui nao existe em lugar nenhum depois.
 * Entao o dialogo faz tres coisas, nessa ordem:
 *
 *   1. LISTA o que se perde, item por item. "Apagar dados" e vago; "a sua
 *      coleção inteira" nao e.
 *   2. OFERECE o backup ali mesmo, antes do botao vermelho. Mandar a pessoa
 *      procurar o export noutra tela e o mesmo que nao oferecer.
 *   3. Exige um SEGUNDO toque num botao que muda de texto. Nao e teatro: o
 *      primeiro toque pode ser engano, o segundo num botao que agora diz
 *      "apagar mesmo" nao e.
 *
 * O botao destrutivo nunca e o primario da tela — ele e vermelho e discreto, e
 * o de cancelar e o que tem peso. Quem chegou aqui por engano sai pelo caminho
 * mais facil.
 */
export function WipeDialog({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const setup = useSetup();
  const { items } = useCollection();
  /*
   * Quem nao guarda colecao nao perde colecao.
   *
   * A lista dizia "a sua coleção inteira" pra quem escolheu modo so consulta e
   * nunca salvou um Pokemon. Alem de errado, enfraquece o aviso: uma lista com
   * um item falso ensina a nao ler a lista. Mesma coisa com o botao de backup —
   * baixar um arquivo com zero Pokemon dentro nao e rede de seguranca nenhuma.
   */
  const temColecao = setup.mode === "colecao" && (items?.length ?? 0) > 0;
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [exportou, setExportou] = useState(false);

  const baixarBackup = async () => {
    const json = await exportJson();
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `trainerkit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportou(true);
  };

  return createPortal(
    <div className="tk-scrim" role="dialog" aria-modal="true" aria-label={t("wipe.title")}>
      <div className="tk-modal">
        <div className="tk-wipe-mark" aria-hidden="true">
          <IconAlert size={22} />
        </div>

        <h2 className="tk-modal-title" style={{ marginTop: 12 }}>
          {t("wipe.title")}
        </h2>

        <p className="tk-body" style={{ marginTop: 4 }}>
          {t("wipe.body")}
        </p>

        {/* O que se perde, nomeado. Uma lista curta e concreta assusta na medida
            certa; um paragrafo generico nao assusta e por isso nao protege. */}
        <ul className="tk-wipe-list">
          {temColecao && <li>{t("wipe.item.collection")}</li>}
          <li>{t("wipe.item.settings")}</li>
          <li>{t("wipe.item.cache")}</li>
        </ul>

        <p className="tk-caption" style={{ marginTop: 12, lineHeight: 1.55 }}>
          {t("wipe.noServer")}
        </p>

        <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
          {/* O backup vem ANTES do botao vermelho. */}
          {temColecao && (
            <button
              type="button"
              className="tk-btn tk-btn--secondary tk-btn--block"
              onClick={() => void baixarBackup()}
            >
              {exportou ? t("wipe.exported") : t("wipe.exportFirst")}
            </button>
          )}

          <button
            type="button"
            className="tk-btn tk-btn--primary tk-btn--block"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>

          <button
            type="button"
            className="tk-btn tk-btn--danger tk-btn--block"
            disabled={apagando}
            onClick={() => {
              if (!confirmando) {
                setConfirmando(true);
                return;
              }
              setApagando(true);
              void wipeEverything();
            }}
          >
            {apagando
              ? t("wipe.wiping")
              : confirmando
                ? t("wipe.confirm")
                : t("wipe.action")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
