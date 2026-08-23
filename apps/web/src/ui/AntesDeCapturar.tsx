import { useMemo, useState } from "react";

import {
  ORIGENS,
  badgeFor,
  climaImporta,
  faixaDePC,
  ivPercentOf,
  ivTotalOf,
  lerEncontro,
  niveisDaOrigem,
  type OrigemDeEncontro,
} from "@trainerkit/core";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { useT } from "../i18n/t.ts";
import { Segmented } from "./Segmented.tsx";

interface Props {
  species: DatasetSpecies;
  data: Dataset;
}

/**
 * O IV antes da captura, a partir do PC.
 *
 * A calculadora ao lado desta secao pede as tres barras da avaliacao, e elas so
 * existem depois que a especie esta na mochila. Na tela de encontro ha UM
 * numero, e a decisao de gastar bola dourada e tomada ali.
 *
 * ⚠️ A TELA SO RESPONDE QUANDO A CONTA RESPONDE, e essa e a regra que sustenta
 * o resto do app. Numa raide, num ovo e numa pesquisa o jogo fixa o nivel do
 * encontro, entao o PC determina o IV e a resposta e exata. No selvagem o nivel
 * e sorteado e o PC deixa ~167 combinacoes de pe (medido em `encounter.test.ts`,
 * nunca menos de uma dezena): ali a tela diz que nao decide, com o numero na
 * mao, em vez de mostrar "entre 6 e 38 de 45" com cara de medicao.
 *
 * A escolha de origem vem ANTES do campo de PC de propósito. E ela, e nao o PC,
 * que faz a conta existir — pedir o numero primeiro sugeriria que o PC basta.
 */
export function AntesDeCapturar({ species, data }: Props) {
  const { t, language } = useT();
  const [origem, setOrigem] = useState<OrigemDeEncontro>("raide");
  const [clima, setClima] = useState(false);
  const [cp, setCp] = useState("");

  const climaVale = climaImporta(origem);
  const climaAtivo = clima && climaVale;

  const faixa = useMemo(
    () => faixaDePC(species.baseStats, origem, data.cpm, climaAtivo),
    [species.baseStats, origem, data.cpm, climaAtivo],
  );

  const cpNum = Number(cp);
  const temCp = cp !== "" && Number.isInteger(cpNum) && cpNum >= 10;

  const leitura = useMemo(() => {
    if (!temCp) return null;
    return lerEncontro(
      { base: species.baseStats, cp: cpNum, origem, clima: climaAtivo },
      data.cpm,
    );
  }, [temCp, cpNum, species.baseStats, origem, climaAtivo, data.cpm]);

  /*
   * ⚠️ "NAO EXISTE" SO PODE SER DITO DEPOIS DE OLHAR O OUTRO CLIMA.
   *
   * O clima sobe a captura de 20 pra 25, e as duas faixas nao se tocam: um
   * Mewtwo de 2.900 esta fora da faixa normal (2.294–2.387) e dentro da
   * faixa com clima (2.868–2.984). Recusar ali seria o app dizendo "esse PC
   * nao existe" sobre um PC que a pessoa esta VENDO na tela.
   *
   * O argumento nao e novo: e o mesmo que fez o `bossCatchRange` mostrar as
   * duas faixas em vez de uma. Aqui ele volta como conserto, e nao como
   * enfeite — sem isto a origem mais usada da tela recusa o caso mais comum,
   * porque quem esquece de marcar o clima e a regra, nao a excecao.
   */
  const cabeNoOutroClima = useMemo(() => {
    if (!climaVale) return false;
    const outra = faixaDePC(species.baseStats, origem, data.cpm, !climaAtivo);
    return temCp && cpNum >= outra.min && cpNum <= outra.max;
  }, [climaVale, species.baseStats, origem, data.cpm, climaAtivo, temCp, cpNum]);

  const niveis = niveisDaOrigem(origem, climaAtivo);
  const nivelTexto =
    niveis.length === 1
      ? String(niveis[0])
      : `${niveis[0]}–${niveis[niveis.length - 1]}`;

  const exato = leitura?.exato ?? null;
  const badge = exato ? badgeFor(ivTotalOf(exato)) : null;

  return (
    <>
      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        {t("pre.title")}
      </div>

      <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 14 }}>
        <p className="tk-caption" style={{ lineHeight: 1.6 }}>
          {t("pre.why")}
        </p>

        <Segmented
          ariaLabel={t("pre.origin")}
          options={ORIGENS.map((o) => ({ value: o, label: t(`pre.origin.${o}`) }))}
          value={origem}
          onChange={setOrigem}
          size="compact"
        />

        {/* O controle de clima SOME onde o clima nao muda nada. Um interruptor
            que nao faz diferenca nao e so inutil: ensina errado sobre a
            mecanica do jogo — clima nao alcanca ovo nem pesquisa. */}
        {climaVale && (
          <button
            type="button"
            className="tk-option"
            data-active={clima || undefined}
            aria-pressed={clima}
            onClick={() => setClima((v) => !v)}
          >
            <span className="tk-option-mark" aria-hidden="true">
              {clima ? "●" : "○"}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="tk-option-title">{t("pre.weather")}</span>
              <span className="tk-option-detail">{t("pre.weatherDetail")}</span>
            </span>
          </button>
        )}

        <label className="tk-field">
          <span className="tk-caption">{t("pre.cp")}</span>
          <div className="tk-search">
            <input
              type="number"
              inputMode="numeric"
              placeholder={String(faixa.max)}
              value={cp}
              onChange={(e) => setCp(e.target.value)}
              aria-label={t("pre.cp")}
            />
          </div>
        </label>

        {/*
          A faixa aparece ANTES de digitar, e nao so quando o numero erra.
          Ela e a metade da resposta que nao depende do PC: quem ve "2.294 a
          2.387" ja sabe conferir a especie e ja sabe que 2.387 e o 100%.
        */}
        <div className="tk-row">
          <span className="tk-row-label">{t("pre.rangeLabel")}</span>
          <span className="tk-row-value">
            {faixa.min.toLocaleString(language)} – {faixa.max.toLocaleString(language)}
          </span>
        </div>
        <div className="tk-row">
          <span className="tk-row-label">{t("pre.levelLabel")}</span>
          <span className="tk-row-value">
            {nivelTexto}
            {leitura ? ` · IV ≥ ${leitura.piso}` : ""}
          </span>
        </div>
      </section>

      {leitura?.impossivel && (
        <div className="tk-banner tk-banner--warn" style={{ marginTop: 10 }} role="alert">
          <div className="tk-banner-text">
            <div className="tk-banner-title">{t("pre.impossible.title")}</div>
            <p className="tk-banner-body">
              {t("pre.impossible.body", {
                cp: cpNum.toLocaleString(language),
                name: species.name,
                min: faixa.min.toLocaleString(language),
                max: faixa.max.toLocaleString(language),
              })}
            </p>
            {cabeNoOutroClima && (
              <p className="tk-banner-body" style={{ marginTop: 8 }}>
                {climaAtivo ? t("pre.impossible.noWeather") : t("pre.impossible.weather")}
              </p>
            )}
          </div>
        </div>
      )}

      {leitura && !leitura.impossivel && (
        <section className="tk-card" style={{ marginTop: 10 }}>
          {exato && badge ? (
            <>
              {/* Mesma apresentacao do IV do resto do app: a palavra, o numero
                  grande, e as estrelas que ele ja le de relance. */}
              <div className="tk-iv-label">IV</div>
              <div className="tk-iv-total">
                {ivTotalOf(exato)}
                <span>/ 45</span>
              </div>
              <div className="tk-caption" style={{ marginTop: 2 }}>
                {Math.round(ivPercentOf(exato))}% ·{" "}
                <span style={badge.pink ? { color: "var(--tk-dang)" } : undefined}>
                  {"★".repeat(badge.litStars)}
                  {"☆".repeat(3 - badge.litStars)}
                </span>
              </div>
              <p className="tk-caption" style={{ marginTop: 10, lineHeight: 1.6 }}>
                {t("pre.exact", {
                  atk: exato.atk,
                  def: exato.def,
                  hp: exato.hp,
                })}
              </p>
            </>
          ) : (
            <>
              <div className="tk-iv-label">IV</div>
              <div className="tk-iv-total">
                {leitura.totalMin}–{leitura.totalMax}
                <span>/ 45</span>
              </div>
              <p className="tk-caption" style={{ marginTop: 10, lineHeight: 1.6 }}>
                {t("pre.combos", { n: leitura.ivs.length.toLocaleString(language) })}
                {origem === "selvagem" ? ` ${t("pre.wildWeak")}` : ""}
              </p>
            </>
          )}
        </section>
      )}
    </>
  );
}
