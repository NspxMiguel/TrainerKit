import { useMemo, useState } from "react";

import { ACTION_KEYS, decide, ivTotalOf } from "@trainerkit/core";

import type { DatasetSpecies, DatasetState } from "../data/useDataset.ts";
import { useT, type Key } from "../i18n/t.ts";
import type { OwnedPokemon } from "../storage/collection.ts";
import {
  exportJson,
  importJson,
  removePokemon,
  setDoneAction,
  useCollection,
} from "../storage/collection.ts";
import { AskBox } from "../ui/AskBox.tsx";
import { IconGrid, IconList, IconPlus } from "../ui/Icons.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";
import { SpeciesDetail } from "./SpeciesDetail.tsx";
import { SpeciesPicker } from "./SpeciesPicker.tsx";

interface Props {
  /** Dentro da aba Pokédex: sem título próprio, pra não repetir o de cima. */
  embutida?: boolean;
  dataset: DatasetState;
}

const TONE: Record<string, string> = {
  investir: "var(--tk-succ)",
  evoluir: "var(--tk-pri)",
  guardar: "var(--tk-info)",
  transferir: "var(--tk-dang)",
};

export function CollectionScreen({ dataset, embutida = false }: Props) {
  const { items, reload } = useCollection();
  const { t, language } = useT();
  const [picking, setPicking] = useState(false);
  /* Guarda a ESPECIE e o bicho salvo. Sem o segundo, a tela de IV abria em
     branco pedindo pra escanear algo que ja estava gravado no aparelho. */
  const [open, setOpen] = useState<{ species: DatasetSpecies; owned?: OwnedPokemon } | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);

  /**
   * Grade ou lista — e a escolha fica salva.
   *
   * Grade por padrao: e a "cara de Pokedex" que ele pediu, e e a vista que a
   * aba Pokedex ja usa. Quem prefere ver IV e veredito escritos troca uma vez e
   * o app lembra.
   */
  const [grade, setGrade] = useState(() => {
    try {
      return globalThis.localStorage?.getItem("tk:colecao-grade") !== "0";
    } catch {
      return true;
    }
  });

  const ready = dataset.status === "ready";
  const species = ready ? dataset.data.species : [];

  // Um veredito custa alguns milissegundos porque ranqueia 4.096 combinacoes de
  // IV em tres ligas. Recalcular tudo a cada re-render — abrir uma folha, digitar
  // no backup — travaria a tela numa colecao grande.
  const rows = useMemo(() => {
    if (!ready || items === null) return null;

    return items.map((owned) => {
      const s = species.find((x) => x.id === owned.speciesId);
      if (!s) return { owned, species: null, verdict: null };

      const verdict = decide({
        name: s.name,
        baseStats: s.baseStats,
        ivs: owned.ivs,
        level: owned.level ?? 20,
        cpm: dataset.data.cpm,
        levelCap: dataset.data.version.levelCap,
        evolvesInto: s.evolvesInto,
        candyToEvolve: s.evolvesInto[0]
          ? (s.candyToEvolve[s.evolvesInto[0]] ?? null)
          : null,
        lucky: owned.lucky,
        shadow: owned.shadow,
      });

      return { owned, species: s, verdict };
    });
  }, [items, ready, species, dataset]);

  const download = async () => {
    const json = await exportJson();
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `trainerkit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File) => {
    try {
      const count = await importJson(await file.text());
      reload();
      setMessage(t("collection.imported", { count }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      {/*
        Titulo e o alternador de vista na MESMA linha.

        "#43 Coleção com cara de Pokédex de verdade". A cara de Pokedex e a
        GRADE — e a aba Pokedex ja tem uma, com o mesmo desenho de ficha. A
        colecao era a unica tela do app que mostrava Pokemon em lista, e essa
        divergencia sozinha ja fazia as duas parecerem apps diferentes.
      */}
      {/*
        Sem titulo quando embutida.

        Dentro da aba Pokedex ela aparece debaixo de um `<h1>Pokédex</h1>`, e um
        segundo titulo logo abaixo ("Coleção") e a redundancia que ele vem
        cobrando o app inteiro — dois nomes pra um lugar so. O seletor
        "Todos/Meus" ja diz onde a pessoa esta.
      */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!embutida && (
          <h1 className="tk-h1" style={{ flex: 1, minWidth: 0 }}>
            {t("collection.title")}
          </h1>
        )}
        {embutida && <span style={{ flex: 1 }} />}
        {rows !== null && rows.length > 0 && (
          <button
            type="button"
            className="tk-filter-btn"
            aria-label={t(grade ? "collection.asList" : "collection.asGrid")}
            title={t(grade ? "collection.asList" : "collection.asGrid")}
            onClick={() => {
              setGrade((v) => !v);
              try {
                globalThis.localStorage?.setItem("tk:colecao-grade", grade ? "0" : "1");
              } catch {
                /* preferencia nao persistida vale mais que app quebrado */
              }
            }}
          >
            {grade ? <IconList size={18} /> : <IconGrid size={18} />}
          </button>
        )}
      </div>

      {rows === null ? (
        <p className="tk-body">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <div className="tk-empty">
          <div className="tk-empty-mark">
            <IconPlus size={26} />
          </div>
          <div className="tk-empty-title">{t("collection.empty.title")}</div>
          <p className="tk-body">{t("collection.empty.body")}</p>
        </div>
      ) : (
        <div
          className={grade ? "tk-species-grid tk-cascade" : "tk-cascade"}
          style={grade ? undefined : { display: "grid", gap: 8 }}
        >
          {rows.map(({ owned, species: s, verdict }, i) => {
            if (!s || !verdict) return null;

            /*
              GRADE: a mesma ficha da aba Pokedex, mais o que so a colecao sabe
              — o IV e a cor do veredito. O nome vira o IV porque numa grade da
              colecao a pergunta nao e "qual bicho e esse" (a arte responde), e
              sim "esse aqui presta?".
            */
            if (grade) {
              return (
                <button
                  key={owned.id}
                  type="button"
                  className="tk-species-cell tk-owned-cell"
                  style={{ ["--tk-i" as string]: i }}
                  onClick={() => setOpen({ species: s, owned })}
                >
                  <SpeciesTile
                    spriteId={s.spriteId}
                    dex={s.dex}
                    speciesId={s.id}
                    name={s.name}
                    types={s.types}
                    size={64}
                  />
                  <span className="tk-species-name">{s.name}</span>
                  <span className="tk-owned-iv">{ivTotalOf(owned.ivs)}/45</span>
                  {/* O ponto do veredito: a mesma cor da lista, sem a palavra.
                      Numa grade nao cabe texto, mas cabe a informacao. */}
                  <span
                    className="tk-owned-dot"
                    style={{
                      background:
                        owned.doneAction === verdict.action
                          ? "var(--tk-txt3)"
                          : TONE[verdict.action],
                    }}
                    aria-label={t(ACTION_KEYS[verdict.action] as Key)}
                  />
                </button>
              );
            }

            return (
              <div
                key={owned.id}
                className="tk-owned"
                style={{ ["--tk-i" as string]: i }}
              >
                {/*
                  Abrir e a acao da LINHA inteira, entao ela e uma camada
                  invisivel por cima de tudo — e nao um botao que precisa
                  embrulhar o conteudo.

                  Assim o nome e o veredito dividem a primeira linha e os
                  numeros ocupam a segunda INTEIRA. Antes tudo disputava a mesma
                  faixa estreita ao lado da etiqueta, e "44/45 · PC 2.800 ·
                  nível 30" quebrava deixando o "30" sozinho embaixo.
                */}
                <button
                  type="button"
                  className="tk-owned-open"
                  aria-label={s.name}
                  onClick={() => setOpen({ species: s, owned })}
                />

                <SpeciesTile
                  spriteId={s.spriteId}
                  dex={s.dex}
                  speciesId={s.id}
                  name={s.name}
                  types={s.types}
                  size={48}
                />

                <span className="tk-owned-name">{s.name}</span>

                <span className="tk-owned-meta">
                  {ivTotalOf(owned.ivs)}/45
                  {owned.cp !== null &&
                    ` · ${t("common.cp")} ${owned.cp.toLocaleString(language)}`}
                  {owned.level !== null && ` · ${t("common.level")} ${owned.level}`}
                </span>

                {/*
                  O veredito como BOTAO, nao como etiqueta.

                  Enquanto era so texto, "Investir" ficava em verde pra sempre —
                  inclusive depois de a pessoa ter investido. Agora tocar nele
                  diz "ja fiz": a cor sai, vira um ✓ discreto, e o cartao para
                  de cobrar. Tocar de novo desfaz.

                  Ele so conta como cumprido se a acao marcada for a MESMA que o
                  veredito indica hoje. Subiu de nivel e o conselho virou
                  "evoluir"? Volta a cobrar, porque e outra coisa a fazer.
                */}
                <button
                  type="button"
                  className="tk-owned-act"
                  data-done={owned.doneAction === verdict.action || undefined}
                  aria-pressed={owned.doneAction === verdict.action}
                  style={
                    owned.doneAction === verdict.action
                      ? undefined
                      : { color: TONE[verdict.action] }
                  }
                  title={
                    owned.doneAction === verdict.action
                      ? t("collection.undoDone")
                      : t("collection.markDone")
                  }
                  onClick={() =>
                    void setDoneAction(
                      owned.id,
                      owned.doneAction === verdict.action ? null : verdict.action,
                    )
                  }
                >
                  {/* O "○" e o que faz o rotulo LER como botao. Sem ele era uma
                      palavra colorida, e o Miguel passou semanas sem descobrir
                      que dava pra tocar: "sem jeito de tirar isso". */}
                  <span className="tk-done-mark" aria-hidden="true">
                    {owned.doneAction === verdict.action ? "✓" : "○"}
                  </span>
                  {owned.doneAction === verdict.action
                    ? t("collection.done")
                    : t(ACTION_KEYS[verdict.action] as Key)}
                </button>

                <button
                  type="button"
                  className="tk-owned-remove"
                  aria-label={t("common.remove", { name: s.name })}
                  onClick={() => void removePokemon(owned.id)}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* A caixa de perguntas vive AQUI porque e sobre a colecao. So aparece
          com chave configurada — campo morto dizendo "configure a IA" seria
          propaganda ocupando espaco de quem nao pediu. */}
      {ready && items && items.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <AskBox items={items} data={dataset.data} />
        </div>
      )}

      {/* Backup fica sempre visivel, nao escondido atras de "avancado": e a
          unica coisa que sobrevive se o navegador despejar os dados. */}
      <div className="tk-overline" style={{ display: "block", marginTop: 36 }}>
        {t("collection.backup")}
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="tk-btn tk-btn--secondary"
            style={{ flex: 1, height: 44, fontSize: 13 }}
            onClick={() => void download()}
          >
            {t("collection.export")}
          </button>
          <label
            className="tk-btn tk-btn--secondary"
            style={{ flex: 1, height: 44, fontSize: 13, cursor: "pointer" }}
          >
            {t("collection.import")}
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {message && (
          <p className="tk-caption" style={{ marginTop: 10 }}>
            {message}
          </p>
        )}
      </section>

      {/* Reserva a altura do botao flutuante: sem isto ele cobria o "Importar"
          quando a tela estava rolada ate o fim. */}
      <span className="tk-fab-clear" aria-hidden="true" />

      <button
        type="button"
        className="tk-fab"
        aria-label={t("collection.add")}
        disabled={!ready}
        onClick={() => setPicking(true)}
      >
        <IconPlus size={26} />
      </button>

      {picking && ready && (
        <SpeciesPicker
          data={dataset.data}
          onPick={(s) => {
            setOpen({ species: s });
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {open && ready && (
        <SpeciesDetail
          species={open.species}
          data={dataset.data}
          onClose={() => setOpen(null)}
          onPickSpecies={(s) => setOpen({ species: s })}
          owned={open.owned}
        />
      )}
    </>
  );
}
