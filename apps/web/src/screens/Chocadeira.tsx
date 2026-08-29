import { useMemo } from "react";
import { createPortal } from "react-dom";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import {
  DISTANCIAS,
  FONTE_CREDITO,
  FONTE_LINK,
  nomesPossiveis,
  ordemDaDistancia,
  ovosUnicos,
  useOvos,
  type OvoAgenda,
} from "../data/agenda.ts";
import { useT } from "../i18n/t.ts";
import { useFolha } from "../ui/folha.ts";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";

interface Props {
  data: Dataset;
  onClose: () => void;
  onPickSpecies: (s: DatasetSpecies) => void;
}

/**
 * O que sai de cada ovo.
 *
 * ── O que esta tela faz que uma lista nao faz ───────────────────────────────
 *
 * A lista de choco existe em varios sites. Tres coisas so este app consegue:
 *
 *   1. **O PC DO 100%.** Ovo choca em nivel 20 com piso 10 de IV, entao o PC
 *      determina o IV — e o `combatPower.max` da fonte E o PC de 15/15/15.
 *      Quem esta olhando o ovo abrir ve UM numero na tela; saber de cor qual e
 *      o numero perfeito e a diferenca entre guardar e transferir. Nenhuma
 *      lista diz isso porque nenhuma lista tem a conta do lado;
 *   2. **o nome no idioma da pessoa**, porque quem nomeia e o `gamedata.json` e
 *      nao a fonte, que so fala ingles;
 *   3. **um toque abre a ficha** — IV, counters, veredito. A lista deixa de ser
 *      o fim e vira o comeco.
 */
export function Chocadeira({ data, onClose, onPickSpecies }: Props) {
  const { saindo, ref: refFolha, fechar } = useFolha(onClose);
  const { t, language } = useT();
  const estado = useOvos();

  /* Nome da fonte -> especie do app. Ver `nomesPossiveis`: a fonte escreve
     "Galarian Meowth" e o jogo escreve "Meowth (Galarian)", e o jogo usa duas
     grafias de Alola. Medido, 76 de 76 casam. */
  const porNome = useMemo(() => {
    const m = new Map<string, DatasetSpecies>();
    for (const s of data.species) m.set(s.name.toLowerCase(), s);
    return m;
  }, [data.species]);

  const casar = (ovo: OvoAgenda): DatasetSpecies | null => {
    for (const n of nomesPossiveis(ovo.name)) {
      const s = porNome.get(n.toLowerCase());
      if (s) return s;
    }
    return null;
  };

  /* Agrupado por distancia, na ordem do jogo — nao na alfabetica, que poria
     "10 km" antes de "2 km". */
  const grupos = useMemo(() => {
    const m = new Map<string, OvoAgenda[]>();
    for (const o of ovosUnicos(estado.itens ?? [])) {
      const lista = m.get(o.eggType);
      if (lista) lista.push(o);
      else m.set(o.eggType, [o]);
    }
    return [...m.entries()].sort((a, b) => ordemDaDistancia(a[0]) - ordemDaDistancia(b[0]));
  }, [estado.itens]);

  const vazio = estado.itens === null;

  return createPortal(
    <div
      ref={refFolha}
      className="tk-sheet-full"
      role="dialog"
      aria-modal="true"
      aria-label={t("eggs.title")}
      data-saindo={saindo || undefined}
    >
      <header className="tk-sheet-head">
        <button type="button" className="tk-sheet-close" onClick={fechar} aria-label={t("common.back")}>
          ‹
        </button>
      </header>
      <h1 className="tk-h1">{t("eggs.title")}</h1>

      {vazio ? (
        /* Sem rede E sem copia guardada. A tela diz o que aconteceu em vez de
           mostrar uma lista vazia, que leria como "nao ha nada chocando". */
        <section className="tk-card">
          <p className="tk-caption" style={{ lineHeight: 1.6 }}>{t("eggs.semRede")}</p>
        </section>
      ) : (
        grupos.map(([distancia, ovos]) => (
          <section key={distancia} style={{ marginTop: 18 }}>
            <div className="tk-overline" style={{ display: "block" }}>
              {distancia}
              {ovos[0]?.isAdventureSync ? ` · ${t("eggs.sync")}` : ""}
            </div>

            <div className="tk-card" style={{ marginTop: 8, padding: 0 }}>
              {ovos.map((o) => {
                const s = casar(o);
                const perfeito = o.combatPower?.max;
                return (
                  <button
                    key={`${distancia}-${o.name}`}
                    type="button"
                    className="tk-ovo"
                    disabled={!s}
                    onClick={() => s && onPickSpecies(s)}
                  >
                    <SpeciesTile
                      spriteId={s?.spriteId ?? null}
                      dex={s?.dex ?? 0}
                      speciesId={s?.id ?? ""}
                      name={s?.name ?? o.name}
                      types={s?.types ?? []}
                      size={44}
                    />
                    <span className="tk-ovo-txt">
                      {/* O nome do app, nao o da fonte: traduzido. */}
                      <span className="tk-ovo-nome">{s?.name ?? o.name}</span>
                      <span className="tk-ovo-meta">
                        {perfeito !== undefined
                          ? t("eggs.pcPerfeito", { cp: perfeito.toLocaleString(language) })
                          : ""}
                        {o.isRegional ? ` · ${t("eggs.regional")}` : ""}
                      </span>
                    </span>
                    {/* O brilhante e um asterisco, e nao um emoji: o app nao usa
                        emoji em lugar nenhum, e um simbolo tipografico desenha
                        igual em todo sistema. */}
                    {o.canBeShiny && (
                      <span className="tk-ovo-shiny" aria-label={t("eggs.shiny")}>
                        ✦
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/*
        O credito e obrigacao, nao cortesia: o dado e raspado por outra pessoa e
        publicado de graca. E a data existe porque uma lista de choco velha e
        pior que nenhuma — quem le tem que saber de quando ela e.
      */}
      <p className="tk-caption" style={{ marginTop: 22, lineHeight: 1.6 }}>
        {t("agenda.fonte", { fonte: FONTE_CREDITO })}{" "}
        <a href={FONTE_LINK} target="_blank" rel="noopener noreferrer">
          leekduck.com
        </a>
        {estado.em !== null && (
          <>
            {" · "}
            {new Date(estado.em).toLocaleDateString(language, { day: "2-digit", month: "2-digit" })}
            {estado.offline ? ` · ${t("agenda.guardado")}` : ""}
          </>
        )}
      </p>
    </div>,
    document.body,
  );
}
