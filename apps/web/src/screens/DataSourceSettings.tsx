import { useState } from "react";

import {
  BUILTIN_DATASET,
  checkUrl,
  getDataSource,
  looksLikeDataset,
  setDataSource,
  useDataSource,
} from "../data/source.ts";
import { useT, type Key, type TFunction } from "../i18n/t.ts";
import { DIAS_PRA_AVISAR, type DatasetSource } from "./../data/useDataset.ts";

/**
 * "07/08 · de 2 dias" — a data mais a idade.
 *
 * Mora aqui e e exportada porque as duas telas que mostram a base leem a MESMA
 * linha: a lista de Ajustes e o painel de dentro. Duas formatacoes paralelas e
 * como elas se separam no dia em que uma muda.
 */
export function textoIdade(t: TFunction, dias: number | null): string | null {
  if (dias === null) return null;
  if (dias === 0) return t("data.age.today");
  if (dias === 1) return t("data.age.one");
  return t("data.age.many", { n: dias });
}

interface Props {
  datasetLabel: string | null;
  /** Idade da base em dias, ou `null` se ela nao carimba. */
  datasetIdade: number | null;
  /** Fontes declaradas pelo dataset carregado — nao pelo app. */
  sources?: DatasetSource[] | undefined;
}

/**
 * De onde vem o dado do jogo.
 *
 * Mesma ideia das fontes de imagem, e pelo mesmo motivo: o TrainerKit nao
 * hospeda dado de jogo como quem e dono dele — ele aponta. Trocar a fonte
 * desacopla o app de mim, e quem precisar de uma base mais nova que a minha
 * nao fica esperando meu deploy.
 *
 * O endereco e TESTADO antes de valer. Um JSON qualquer aceito em silencio
 * daria tela branca ou, muito pior, numeros calculados sobre lixo — o unico
 * tipo de erro que este app nao pode cometer.
 */
export function DataSourceSettings({ datasetLabel, datasetIdade, sources }: Props) {
  const source = useDataSource();
  const { t } = useT();
  const [url, setUrl] = useState(getDataSource() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const custom = source !== null;
  const idade = textoIdade(t, datasetIdade);
  const velha = datasetIdade !== null && datasetIdade >= DIAS_PRA_AVISAR;

  const apply = async () => {
    const target = url.trim();
    if (!target) return;
    const bad = checkUrl(target);
    if (bad) {
      setError(bad);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(target);
      if (!res.ok) throw new Error(`${res.status}`);
      const problem = looksLikeDataset(await res.json());
      if (problem) throw new Error(problem);
      setDataSource(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/*
        Um assunto, um bloco.

        Aqui havia DUAS secoes coladas — "Dados do jogo" e "De onde vêm os
        números" — respondendo a mesma pergunta, e a primeira dizia "o app traz
        os dele", o que nao responde nada: o app nao PRODUZ numero nenhum, ele
        junta tres origens. Agora e uma lista com nome, e a versao da base logo
        acima dela. Sai do proprio dataset, entao apontar pra outra base mostra
        as fontes DAQUELA base.
      */}
      <p className="tk-caption" style={{ margin: "0 2px", lineHeight: 1.5 }}>
        {t("data.what")}
      </p>

      <section className="tk-card" style={{ marginTop: 12 }}>
        {sources && sources.length > 0 ? (
          <ul className="tk-sources">
            {sources.map((src) => (
              <li key={src.url}>
                <a href={src.url} target="_blank" rel="noreferrer noopener">
                  {src.name}
                </a>
                <span className="tk-caption">{t(src.provides as Key)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tk-caption" style={{ lineHeight: 1.55 }}>
            {t("data.sourcesNone")}
          </p>
        )}

        <hr className="tk-sep" />

        <div className="tk-row">
          <span className="tk-row-label">{t("settings.datasetVersion")}</span>
          <span className="tk-row-value">
            {datasetLabel ?? "—"}
            {idade && <span className="tk-caption"> · {idade}</span>}
          </span>
        </div>

        {/*
          O aviso so aparece quando ha o que avisar.

          Um "esta atualizada" permanente seria ruido em 99% das aberturas — e
          treinaria a pessoa a nao ler a linha justamente ate o dia em que ela
          passa a dizer outra coisa. Ver `DIAS_PRA_AVISAR`.
        */}
        {velha && (
          <p className="tk-caption" style={{ margin: "8px 2px 0", lineHeight: 1.55, color: "var(--tk-warn)" }} role="status">
            {t("data.stale", { n: datasetIdade as number })}
          </p>
        )}
        <button type="button" className="tk-row" onClick={() => setOpen((v) => !v)}>
          <span className="tk-row-label">{t("data.source")}</span>
          <span className="tk-row-value">
            {custom ? t("data.custom") : t("data.builtin")} ›
          </span>
        </button>
      </section>

      {open && (
        <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div className="tk-search" style={{ height: 44 }}>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={BUILTIN_DATASET}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label={t("data.sourceAria")}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="tk-btn tk-btn--primary"
              style={{ flex: 1, height: 44, fontSize: 14 }}
              disabled={busy || url.trim() === ""}
              onClick={() => void apply()}
            >
              {busy ? t("data.checking") : t("data.use")}
            </button>
            <button
              type="button"
              className="tk-btn tk-btn--secondary"
              style={{ flex: 1, height: 44, fontSize: 14 }}
              disabled={busy || !custom}
              onClick={() => {
                setDataSource(null);
                setUrl("");
                setError(null);
              }}
            >
              {t("data.reset")}
            </button>
          </div>

          {error && (
            <p className="tk-caption" style={{ color: "var(--tk-dang)" }}>
              {t("data.rejected", { reason: error })}
            </p>
          )}

          <p className="tk-caption" style={{ lineHeight: 1.5 }}>
            {t("data.help")}
          </p>
        </section>
      )}
    </>
  );
}
