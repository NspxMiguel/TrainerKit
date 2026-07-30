import { useEffect, useMemo, useState } from "react";
import { useFolha } from "../ui/folha.ts";
import { createPortal } from "react-dom";

import {
  coinMath,
  isObtainable,
  pickDefenders,
  rankDefenders,
  type DefenderInput,
} from "@trainerkit/core";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { useT } from "../i18n/t.ts";
import { useSetup } from "../onboarding/setup.ts";
import { typeKey } from "../sprites/provider.ts";
import { useCollection } from "../storage/collection.ts";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";

interface Props {
  data: Dataset;
  onClose: () => void;
  onPickSpecies: (s: DatasetSpecies) => void;
}

/** Quantos mostrar. Seis e o que cabe num ginasio. */
const QUANTOS = 6;

/** Nivel de referencia pra lista geral, quando nao ha colecao pra cruzar. */
const NIVEL_PADRAO = 40;

/**
 * Quem deixar no ginasio pra farmar moeda.
 *
 * Ideia do Miguel, e ela cabe no app porque a resposta e CALCULAVEL e
 * CONTRAINTUITIVA — as duas coisas que fazem uma tela valer aqui.
 *
 * O contraintuitivo: o ataque nao conta. Um defensor de ginasio nao escolhe
 * golpe, nao ataca no seu ritmo e nao mira fraqueza; o que estica o tempo dele e
 * defesa vezes vida, dividido pelo quanto a tabela de tipos deixa ele sofrer.
 * Ou seja, aquele 100% guardado pra raide e desperdicio aqui — e o app mostra
 * isso com os numeros dos SEUS bichos, nao com um conselho generico.
 *
 * A segunda coisa que a tela diz, e que nenhum ranking de defensor substitui: o
 * teto e 50 moedas por dia, e isso sao 500 minutos SOMADOS. Espalhar em dez
 * ginasios bate o teto em cinquenta minutos de relogio; caprichar num so leva
 * mais de oito horas. Essa conta muda mais o resultado de quem farma do que a
 * escolha do defensor.
 */
export function GymPicks({ data, onClose, onPickSpecies }: Props) {
  /* A folha sai animada: quem segura o no durante a saida e o `useFolha`. Todo
     caminho de fechamento passa por `fechar`, nunca pelo `onClose` cru — um que
     escape volta a piscar, e so aquele. */
  const { saindo, fechar } = useFolha(onClose);

  const { t } = useT();
  const { items } = useCollection();
  const setup = useSetup();
  const [ginasios, setGinasios] = useState(3);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);

  const especiePor = useMemo(() => {
    const m = new Map<string, DatasetSpecies>();
    for (const s of data.species) m.set(s.id, s);
    return m;
  }, [data.species]);

  const temColecao = setup.mode === "colecao" && (items?.length ?? 0) > 0;

  /**
   * Os candidatos.
   *
   * Com colecao, sao os SEUS, com o IV e o nivel que eles tem — e o que
   * transforma a tela em decisao em vez de curiosidade. Sem colecao, a lista e
   * do jogo inteiro com IV perfeito no nivel 40, e o titulo diz isso: prometer
   * "os seus" pra quem nao cadastrou nada seria mentira.
   */
  const candidatos = useMemo((): DefenderInput[] => {
    if (temColecao) {
      return (items ?? []).flatMap((o) => {
        const sp = especiePor.get(o.speciesId);
        if (!sp) return [];
        return [
          {
            id: o.id,
            speciesId: sp.id,
            name: sp.name,
            types: sp.types,
            baseStats: sp.baseStats,
            ivs: o.ivs,
            level: o.level ?? 20,
          },
        ];
      });
    }

    // `isObtainable` vem do core, e nao de uma copia aqui: sem ele a lista
    // anunciava Eternatus (Eternamax) como o melhor defensor do jogo — 505 de
    // defesa base num bicho que so existe como chefe de Dynamax.
    return data.species
      .filter((s) => s.cosmeticOf === null && isObtainable(s.id))
      .map((s) => ({
        id: s.id,
        speciesId: s.id,
        name: s.name,
        types: s.types,
        baseStats: s.baseStats,
        ivs: { atk: 15, def: 15, hp: 15 },
        level: NIVEL_PADRAO,
      }));
  }, [temColecao, items, especiePor, data.species]);

  const escolhidos = useMemo(() => {
    const ranked = rankDefenders(candidatos, data.cpm, data.typeChart, data.typeOrder);
    return pickDefenders(ranked, QUANTOS);
  }, [candidatos, data.cpm, data.typeChart, data.typeOrder]);

  const conta = coinMath(ginasios);
  const nomeTipo = (tp: string) => t(typeKey(tp) as "type.normal");

  return createPortal(
    <div className="tk-sheet-full" role="dialog" aria-modal="true" aria-label={t("gym.title")} data-saindo={saindo || undefined}>
      <header className="tk-sheet-head">
        <button
          type="button"
          className="tk-sheet-close"
          onClick={fechar}
          aria-label={t("common.back")}
        >
          ‹
        </button>
      </header>
      <h1 className="tk-h1">{t("gym.title")}</h1>

      {/*
        A conta da moeda vem ANTES da lista.

        Porque ela muda mais o resultado do que a escolha do defensor, e quase
        ninguem faz essa conta: o teto e por DIA e por MINUTO SOMADO, entao dez
        ginasios medianos rendem muito mais que um ginasio perfeito.
      */}
      <section className="tk-card">
        <div className="tk-overline">{t("gym.howMany")}</div>

        <div className="tk-step" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="tk-step-btn"
            disabled={ginasios <= 1}
            onClick={() => setGinasios((n) => Math.max(1, n - 1))}
            aria-label="-"
          >
            −
          </button>
          <span className="tk-step-n">{ginasios}</span>
          <button
            type="button"
            className="tk-step-btn"
            disabled={ginasios >= 20}
            onClick={() => setGinasios((n) => Math.min(20, n + 1))}
            aria-label="+"
          >
            +
          </button>
        </div>

        <p style={{ font: "800 20px/1.25 var(--tk-font)", margin: "14px 0 0" }}>
          {t("gym.withGyms", {
            coins: conta.coinsPerHour,
            mins: conta.minutesOfClock,
          })}
        </p>
        <p className="tk-caption" style={{ marginTop: 6, lineHeight: 1.5 }}>
          {t("gym.capLine", { minutes: conta.minutesForCap })}
        </p>
      </section>

      {/* O aviso contraintuitivo. E a razao de a tela existir: sem ele, a pessoa
          poe o melhor Pokemon dela no ginasio e perde o melhor atacante dela. */}
      <div className="tk-banner tk-banner--info" style={{ marginTop: 16 }}>
        <div className="tk-banner-text">
          <div className="tk-banner-title">{t("gym.attackTitle")}</div>
          <p className="tk-banner-body">{t("gym.attackBody")}</p>
        </div>
      </div>

      <div className="tk-overline" style={{ display: "block", marginTop: 20 }}>
        {temColecao ? t("gym.yours") : t("gym.best")}
      </div>

      {escolhidos.length === 0 ? (
        <p className="tk-caption" style={{ marginTop: 10, lineHeight: 1.5 }}>
          {t("gym.emptyCollection")}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {escolhidos.map((d, i) => {
            const sp = especiePor.get(d.speciesId);
            if (!sp) return null;

            return (
              <button
                key={d.id}
                type="button"
                className="tk-teamrow"
                onClick={() => onPickSpecies(sp)}
              >
                <span className="tk-teamrow-n">{i + 1}</span>
                <SpeciesTile
                  spriteId={sp.spriteId}
                  dex={sp.dex}
                  speciesId={sp.id}
                  name={sp.name}
                  types={sp.types}
                  size={44}
                />
                <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <span className="tk-teamrow-name">{sp.name}</span>
                  {/* A fraqueza nomeada, porque e ela que decide quem te
                      derruba. "Fraco a Lutador" e informacao acionavel; uma nota
                      de 0 a 100 sozinha nao e. */}
                  <span className="tk-teamrow-moves">
                    {d.weakTo.length === 0
                      ? t("gym.noWeak")
                      : t("gym.weakTo", { types: d.weakTo.map(nomeTipo).join(", ") })}
                  </span>
                </span>
                <span className="tk-teamrow-tag">{Math.round(d.score)}</span>
              </button>
            );
          })}
        </div>
      )}

      <p className="tk-caption" style={{ marginTop: 16, lineHeight: 1.6 }}>
        {t("gym.howBuilt")}
      </p>

      <button
        type="button"
        className="tk-btn tk-btn--secondary tk-btn--block"
        style={{ marginTop: 22 }}
        onClick={fechar}
      >
        {t("common.done")}
      </button>
    </div>,
    document.body,
  );
}
