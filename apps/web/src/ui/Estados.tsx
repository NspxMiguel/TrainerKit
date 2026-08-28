import type { ReactNode } from "react";

import { useT } from "../i18n/t.ts";

/**
 * Os três estados que o handoff desenha (§10) e o app improvisava.
 *
 * "Estados vazios, de carregamento e de erro desenhados, não improvisados" —
 * estava no briefing que ele mandou pro Claude Design, e voltou desenhado.
 *
 * Até aqui o app resolvia cada um com uma frase solta em `<p>`: nenhum tinha
 * forma, nenhum oferecia saída, e o de carregamento era uma linha de texto que
 * empurrava o conteúdo pra baixo quando os dados chegavam. Três telas que a
 * pessoa VÊ com frequência — vazio no primeiro uso, carregando em toda abertura
 * fria, erro sempre que o metrô entra no túnel.
 */

/**
 * Vazio: "tile neutro 56px com `?`, título 16/700, frase de 13,5px centralizada
 * (máx. 260px) e botão de ação 42px".
 *
 * ⚠️ O botão é parte do estado, e não enfeite. Um vazio sem saída informa e
 * abandona; o trabalho dele é dizer o que falta E como preencher.
 */
export function Vazio({
  titulo,
  frase,
  acao,
}: {
  titulo: string;
  frase: string;
  acao?: { label: string; onClick: () => void } | undefined;
}) {
  return (
    <div className="tk-vazio" data-sem-acao={acao ? undefined : true}>
      <span className="tk-vazio-tile" aria-hidden="true">
        ?
      </span>
      <h2 className="tk-vazio-t">{titulo}</h2>
      <p className="tk-vazio-d">{frase}</p>
      {acao && (
        <button type="button" className="tk-vazio-btn" onClick={acao.onClick}>
          {acao.label}
        </button>
      )}
    </div>
  );
}

/**
 * Esqueleto: "mesma geometria da lista real, blocos `rgba(255,255,255,.08)`
 * para tile e título, `rgba(255,255,255,.05)` para metadados, chip de 74×22px".
 *
 * ⚠️ Mesma GEOMETRIA é o ponto todo, e é o que separa esqueleto de "spinner com
 * cara de lista". Se os blocos não ocuparem exatamente o espaço que o conteúdo
 * vai ocupar, a tela salta quando os dados chegam — que é o defeito que o
 * esqueleto existe pra resolver, não pra decorar.
 */
export function Esqueleto({ linhas = 4 }: { linhas?: number }) {
  const { t } = useT();
  return (
    <div className="tk-card" aria-busy="true" aria-label={t("common.loading")}>
      {Array.from({ length: linhas }, (_, i) => (
        /* `--tk-i` defasa o brilho de cada linha em 120ms — sem isso as quatro
           brilham em uníssono e o conjunto pisca em bloco, que lê como erro de
           renderização e não como carregamento. */
        <div key={i} className="tk-esq-linha" style={{ ["--tk-i" as string]: i }}>
          <span className="tk-esq tk-esq-tile" />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="tk-esq tk-esq-titulo" />
            <span className="tk-esq tk-esq-meta" />
          </span>
          <span className="tk-esq tk-esq-chip" />
        </div>
      ))}
    </div>
  );
}

/**
 * Erro / offline: "cartão âmbar, ícone de wi-fi cortado em círculo 44px, título
 * 15/700, explicação de que os dados são do último sync e **que os vereditos
 * continuam valendo**, ação Tentar de novo".
 *
 * ⚠️ A frase em negrito no handoff é a parte que importa, e é decisão de
 * produto, não de texto: sem rede o app CONTINUA funcionando, porque o dataset
 * está no aparelho e a matemática roda local. Um erro que não diz isso faz a
 * pessoa fechar o app achando que ele quebrou — quando ele acabou de responder
 * a pergunta dela corretamente.
 */
export function Offline({
  detalhe,
  onRetry,
}: {
  detalhe?: string | undefined;
  onRetry?: (() => void) | undefined;
}) {
  const { t } = useT();
  return (
    <div className="tk-offline" role="status">
      <span className="tk-offline-ico" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l22 22" />
          <path d="M16.7 12.5a6 6 0 0 0-2.1-1.3" />
          <path d="M5 12.5a10 10 0 0 1 3.3-2.2" />
          <path d="M2 8.8a15 15 0 0 1 4.3-2.6" />
          <path d="M19.8 8.8a15 15 0 0 0-8.6-2.7" />
          <path d="M12 20h.01" />
        </svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tk-offline-t">{t("estados.offlineTitle")}</div>
        <p className="tk-offline-d">{t("estados.offlineBody")}</p>
        {detalhe && <p className="tk-offline-detalhe">{detalhe}</p>}
      </div>
      {onRetry && (
        <button type="button" className="tk-offline-btn" onClick={onRetry}>
          {t("estados.retry")}
        </button>
      )}
    </div>
  );
}

/** Envelope só pra dar nome ao grupo quando alguma tela quiser os três juntos. */
export function Estados({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
