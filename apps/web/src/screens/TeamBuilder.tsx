import { useEffect, useMemo, useState } from "react";
import { useFolha } from "../ui/folha.ts";
import { createPortal } from "react-dom";

import {
  attackTypesAgainst,
  countDistinctTypes,
  pickTeam,
  rankMovesets,
  type Candidate,
  type MoveWithPvp,
} from "@trainerkit/core";

import { fold } from "../data/fold.ts";
import type { Dataset, DatasetSpecies, DatasetMove } from "../data/useDataset.ts";
import { moveLabel, useLanguage } from "../i18n/language.ts";
import { useT } from "../i18n/t.ts";
import { useSetup } from "../onboarding/setup.ts";
import { typeKey } from "../sprites/provider.ts";
import { useCollection } from "../storage/collection.ts";
import { IconSearch } from "../ui/Icons.tsx";
import { Segmented } from "../ui/Segmented.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";

interface Props {
  data: Dataset;
  onClose: () => void;
  onPickSpecies: (s: DatasetSpecies) => void;
}

const TEAM_SIZE = 6;

/** Pra quê o time serve. A pergunta que vem antes de qualquer outra. */
type Goal = "raid" | "pvp";

type LeagueId = "great" | "ultra" | "master";

const LEAGUES: readonly LeagueId[] = ["great", "ultra", "master"];

/** Quantos nomes sugerir enquanto a pessoa digita o chefe. */
const SUGESTOES = 6;

/**
 * "Monta um time pra mim."
 *
 * Isto e melhor que o ranking que ja existia: um ranking e
 * uma lista de trinta nomes que ninguem decora. Um time e seis nomes com um
 * proposito — e vira LISTA DE CAÇA, porque o app marca o que voce ja tem e o
 * que falta ir buscar.
 *
 * O criterio fica escrito na tela. Nao ha dado nenhum sobre meta, sobre o que
 * as pessoas usam ou sobre o que esta forte no mes, e fingir que ha seria
 * facil: bastava escrever uma lista bonita. Entao o time sai de conta declarada
 * e a tela diz qual e a conta.
 */
/**
 * O golpe so existe com MT Elite?
 *
 * ⚠️ Sem isto o app dava um conselho que a pessoa nao tem como seguir.
 *
 * Pra Mewtwo, o time montado punha Xerneas em primeiro com "Geomancy +
 * Megahorn". Conferido no dataset: Geomancy e mesmo golpe rapido do Xerneas —
 * mas esta em `eliteFastMoves`, ou seja, so entra com uma MT Elite de Ataque
 * Rapido, que e dos itens mais raros do jogo. "Vai capturar esse, com esse
 * golpe" vira instrucao impossivel pra quase todo mundo, e o app nao dizia.
 *
 * O core ja calculava `needsElite` em `moves.ts` desde sempre. Ninguem
 * mostrava — o dado existia e morria no caminho, que e o mesmo padrao do
 * `lastTtsError` que ninguem lia.
 */
const ELITE = "✦";

function marcarElite(
  sp: { eliteFastMoves: readonly string[]; eliteChargedMoves: readonly string[] },
  fastId: string,
  chargedId: string,
): boolean {
  return sp.eliteFastMoves.includes(fastId) || sp.eliteChargedMoves.includes(chargedId);
}

export function TeamBuilder({ data, onClose, onPickSpecies }: Props) {
  /* A folha sai animada: quem segura o no durante a saida e o `useFolha`. Todo
     caminho de fechamento passa por `fechar`, nunca pelo `onClose` cru — um que
     escape volta a piscar, e so aquele. */
  const { saindo, ref: refFolha, fechar, sair } = useFolha(onClose);

  const { t } = useT();
  const language = useLanguage();
  const { items } = useCollection();
  const setup = useSetup();

  const [goal, setGoal] = useState<Goal>("raid");
  /** `null` e "não sei" — e o estado INICIAL, de proposito. */
  const [tipo, setTipo] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [chefe, setChefe] = useState<DatasetSpecies | null>(null);
  const [league, setLeague] = useState<LeagueId>("great");

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

  const PokemonPor = useMemo(() => {
    const m = new Map<string, DatasetSpecies>();
    for (const s of data.species) m.set(s.id, s);
    return m;
  }, [data.species]);

  /* --------------------------------------------------------------- o chefe */

  /** Sugestoes de nome enquanto digita. Formas cosmeticas ficam fora. */
  const sugestoes = useMemo(() => {
    const q = fold(busca);
    if (q.length < 2) return [];
    return data.species
      .filter((s) => s.cosmeticOf === null && fold(s.name).includes(q))
      .sort((a, b) => {
        // Quem comeca com o termo primeiro: "mew" mostra Mew antes de Mewtwo.
        const ai = fold(a.name).startsWith(q) ? 0 : 1;
        const bi = fold(b.name).startsWith(q) ? 0 : 1;
        return ai - bi || a.dex - b.dex;
      })
      .slice(0, SUGESTOES);
  }, [busca, data.species]);

  /**
   * Contra o que o time vai lutar.
   *
   * Vem do chefe escolhido pelo nome (e ai sao os DOIS tipos dele) ou do tipo
   * escolhido na mao. Sem nenhum dos dois nao ha time — e a tela mostra o
   * campo de busca em vez de inventar uma lista.
   */
  const alvos: readonly string[] = chefe?.types ?? (tipo === null ? [] : [tipo]);

  /* -------------------------------------------------------------- o time */

  /**
   * Com que tipo de golpe se bate nesse alvo, e de qual lista cada um veio.
   *
   * Aqui morava um erro que parecia funcionar: a tela pedia o tipo do chefe e
   * ia buscar `raidByType[tipoDoChefe]`, que e a lista dos melhores atacantes
   * DAQUELE tipo. Pra um chefe de Dragao dava certo por acidente. Pra um chefe
   * de Fogo o app montava um time de atacantes de Fogo — o pior time possivel,
   * porque Fogo resiste a Fogo.
   */
  const { candidatos, movesets, tiposDeGolpe } = useMemo(() => {
    const movesets = new Map<string, string>();

    if (goal === "pvp") {
      const lista = data.rankings?.statProductByLeague[league] ?? [];
      const cands: Candidate[] = [];
      for (const r of lista) {
        const sp = PokemonPor.get(r.speciesId);
        if (!sp) continue;
        cands.push({ speciesId: r.speciesId, name: r.name, score: r.score, types: sp.types });
      }
      return { candidatos: cands, movesets, tiposDeGolpe: [] as string[] };
    }

    if (alvos.length === 0) {
      return { candidatos: [] as Candidate[], movesets, tiposDeGolpe: [] as string[] };
    }

    const tipos = attackTypesAgainst(alvos, data.typeChart, data.typeOrder);
    // Nada e super efetivo contra o alvo (nao acontece no jogo de hoje, mas uma
    // base customizada pode ter qualquer tabela): cai no ranking geral.
    const listas =
      tipos.length > 0
        ? tipos.map((tp) => data.rankings?.raidByType[tp] ?? [])
        : [data.rankings?.raidOverall ?? []];

    // Uma especie pode aparecer em varias listas (um Dragao com golpe de Gelo,
    // por exemplo). Fica com a nota maior, e o moveset e o daquela lista.
    const melhor = new Map<string, Candidate>();
    for (const linhas of listas) {
      for (const r of linhas) {
        const sp = PokemonPor.get(r.speciesId);
        if (!sp) continue;
        const anterior = melhor.get(r.speciesId);
        if (anterior !== undefined && anterior.score >= r.score) continue;

        melhor.set(r.speciesId, {
          speciesId: r.speciesId,
          name: r.name,
          score: r.score,
          types: sp.types,
        });
        // `fast` e `charged` sao opcionais: uma especie sem golpe (Smeargle, no
        // dataset atual) entra no ranking com nota zero e sem moveset.
        if (r.fast && r.charged) {
          const nome = (m: { name: string; id: string }) =>
            moveLabel(m.name, data.moveNames, m.id, language).primary;
          const elite = marcarElite(sp, r.fast.id, r.charged.id) ? ` ${ELITE}` : "";
          movesets.set(r.speciesId, `${nome(r.fast)} + ${nome(r.charged)}${elite}`);
        } else {
          movesets.delete(r.speciesId);
        }
      }
    }

    const cands = [...melhor.values()].sort((a, b) => b.score - a.score);
    return { candidatos: cands, movesets, tiposDeGolpe: tipos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, league, alvos.join(","), data, PokemonPor, language]);

  const time = useMemo(() => pickTeam(candidatos, TEAM_SIZE), [candidatos]);

  /**
   * O melhor moveset de PvP de cada escolhido.
   *
   * O ranking de liga e stat product puro — ele nao olha golpe nenhum, entao
   * nao tem moveset pra mostrar. Calcular aqui e barato (seis especies) e e o
   * que transforma a linha em conselho: "busque esse, com esse golpe".
   */
  const movesetsPvp = useMemo(() => {
    if (goal !== "pvp") return new Map<string, string>();

    const porId = new Map<string, DatasetMove>();
    for (const m of data.fastMoves) porId.set(m.id, m);
    for (const m of data.chargedMoves) porId.set(m.id, m);

    const out = new Map<string, string>();
    for (const p of time) {
      const sp = PokemonPor.get(p.speciesId);
      if (!sp) continue;
      const fast = [...sp.fastMoves, ...sp.eliteFastMoves]
        .map((id) => porId.get(id))
        .filter((m): m is DatasetMove => m !== undefined) as unknown as MoveWithPvp[];
      const charged = [...sp.chargedMoves, ...sp.eliteChargedMoves]
        .map((id) => porId.get(id))
        .filter((m): m is DatasetMove => m !== undefined) as unknown as MoveWithPvp[];
      if (fast.length === 0 || charged.length === 0) continue;

      const best = rankMovesets(fast, charged, "pvp", {
        attackerTypes: sp.types,
        chart: data.typeChart,
        order: data.typeOrder,
        stabMultiplier: data.settings.battle.sameTypeAttackBonusMultiplier,
      })[0];
      if (!best) continue;

      const nome = (m: { name: string; id: string }) =>
        moveLabel(m.name, data.moveNames, m.id, language).primary;
      const elite = marcarElite(sp, best.fast.id, best.charged.id) ? ` ${ELITE}` : "";
      out.set(p.speciesId, `${nome(best.fast)} + ${nome(best.charged)}${elite}`);
    }
    return out;
  }, [goal, time, PokemonPor, data, language]);

  /** Ja tenho este? A comparacao e por ESPECIE — o time pede um bicho, nao um IV. */
  const tenho = useMemo(() => {
    const s = new Set<string>();
    for (const o of items ?? []) s.add(o.speciesId);
    return s;
  }, [items]);

  // Sem colecao ligada nao ha "você tem" nem "ir buscar": tudo e ir buscar, e a
  // etiqueta viraria ruido em toda linha.
  const marcaColecao = setup.mode === "colecao";
  const faltam = time.filter((p) => !tenho.has(p.speciesId)).length;
  const variedade = countDistinctTypes(time);

  const nomeDoTipo = (tp: string) => t(typeKey(tp) as "type.normal");
  const alvoEscrito = chefe
    ? chefe.name
    : alvos.map(nomeDoTipo).join(" / ");

  /** Voltar pro "não sei": limpa o chefe e o campo junto. */
  const naoSei = () => {
    setTipo(null);
    setChefe(null);
    setBusca("");
  };

  const escolherTipo = (tp: string) => {
    setTipo(tp);
    setChefe(null);
    setBusca("");
  };

  const semAlvo = goal === "raid" && alvos.length === 0;

  return createPortal(
    <div ref={refFolha}
      className="tk-sheet-full" role="dialog" aria-modal="true" aria-label={t("team.title")} data-saindo={saindo || undefined}>
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
      <h1 className="tk-h1">{t("team.title")}</h1>

      {/* Pra quê, antes de contra quem: um time de raide e um time de PvP nao
          se parecem nem um pouco, e perguntar o tipo do chefe pra quem quer
          jogar Grande Liga e perguntar a coisa errada. */}
      <div className="tk-overline" style={{ display: "block" }}>
        {t("team.goal")}
      </div>
      <div style={{ margin: "10px 0 20px" }}>
        <Segmented
          ariaLabel={t("team.goal")}
          value={goal}
          onChange={setGoal}
          options={[
            { value: "raid", label: t("team.goal.raid") },
            { value: "pvp", label: t("team.goal.pvp") },
          ]}
        />
      </div>

      {goal === "pvp" ? (
        <>
          <div className="tk-overline" style={{ display: "block" }}>
            {t("team.league")}
          </div>
          <div style={{ margin: "10px 0 4px" }}>
            <Segmented
              ariaLabel={t("team.league")}
              value={league}
              onChange={setLeague}
              size="compact"
              options={LEAGUES.map((l) => ({
                value: l,
                label: t(`rank.league.${l}` as "rank.league.great"),
              }))}
            />
          </div>
        </>
      ) : (
        <>
          <div className="tk-overline" style={{ display: "block" }}>
            {t("team.pickType")}
          </div>

          {/* "Não sei" e a PRIMEIRA opcao, e vem selecionada. Quem abre esta
              tela normalmente sabe o nome do chefe do evento, nao a tabela de
              tipos dele — pedir o tipo primeiro e pedir a resposta antes da
              pergunta. */}
          <div className="tk-chips" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="tk-chip"
              data-on={tipo === null && chefe === null ? true : undefined}
              aria-pressed={tipo === null && chefe === null}
              onClick={naoSei}
            >
              {t("team.dontKnow")}
            </button>
            {data.typeOrder.map((tp) => (
              <button
                key={tp}
                type="button"
                className="tk-chip"
                data-on={tipo === tp || undefined}
                aria-pressed={tipo === tp}
                onClick={() => escolherTipo(tp)}
              >
                {nomeDoTipo(tp)}
              </button>
            ))}
          </div>

          {/* Escolheu "não sei": digita o nome e o app deduz o tipo. E o unico
              caminho em que a pessoa nao precisa saber nada de tabela. */}
          {tipo === null && (
            <div style={{ marginTop: 14 }}>
              {chefe === null ? (
                <>
                  <div className="tk-search">
                    <IconSearch size={18} />
                    <input
                      type="search"
                      inputMode="search"
                      autoComplete="off"
                      placeholder={t("team.bossPlaceholder")}
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      aria-label={t("team.bossName")}
                    />
                  </div>

                  {sugestoes.length > 0 && (
                    <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                      {sugestoes.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="tk-teamrow"
                          onClick={() => {
                            setChefe(s);
                            setBusca("");
                          }}
                        >
                          <SpeciesTile
                            spriteId={s.spriteId}
                            dex={s.dex}
                            speciesId={s.id}
                            name={s.name}
                            types={s.types}
                            size={36}
                          />
                          <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                            <span className="tk-teamrow-name">{s.name}</span>
                            <span className="tk-teamrow-moves">
                              {s.types.map(nomeDoTipo).join(" · ")}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {fold(busca).length >= 2 && sugestoes.length === 0 && (
                    <p className="tk-caption" style={{ marginTop: 10 }}>
                      {t("team.bossNotFound", { query: busca })}
                    </p>
                  )}

                  {fold(busca).length < 2 && (
                    <p className="tk-caption" style={{ marginTop: 10, lineHeight: 1.5 }}>
                      {t("team.bossHint")}
                    </p>
                  )}
                </>
              ) : (
                /* Chefe achado: o app diz o que deduziu, e da como desfazer.
                   Deduzir em silencio seria magica — e magica que erra nao tem
                   como ser corrigida por quem nao sabe que ela aconteceu. */
                <button
                  type="button"
                  className="tk-teamrow"
                  data-have
                  onClick={naoSei}
                  aria-label={t("team.bossChange")}
                >
                  <SpeciesTile
                    spriteId={chefe.spriteId}
                    dex={chefe.dex}
                    speciesId={chefe.id}
                    name={chefe.name}
                    types={chefe.types}
                    size={40}
                  />
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span className="tk-teamrow-name">{chefe.name}</span>
                    <span className="tk-teamrow-moves">
                      {chefe.types.map(nomeDoTipo).join(" · ")}
                    </span>
                  </span>
                  <span className="tk-teamrow-tag">{t("team.bossChange")}</span>
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Sem alvo nao ha time. A tela simplesmente para aqui, com o campo de
          nome e a dica dele — inventar uma lista "geral" pra preencher o espaço
          seria responder uma pergunta que ninguem fez. */}
      {semAlvo ? null : (
        <>
          {/* O resumo vem antes da lista: e a resposta, e a lista e a justificativa. */}
          <section className="tk-card" style={{ marginTop: 22 }}>
            <div className="tk-overline">{t("team.summary")}</div>
            <p style={{ font: "800 20px/1.2 var(--tk-font)", margin: "8px 0 0" }}>
              {!marcaColecao
                ? t("team.sixFor", { target: alvoEscrito })
                : faltam === 0
                  ? t("team.haveAll")
                  : faltam === 1
                    ? t("team.missingOne")
                    : t("team.missingMany", { count: faltam })}
            </p>
            <p className="tk-caption" style={{ marginTop: 6, lineHeight: 1.5 }}>
              {goal === "raid" && tiposDeGolpe.length > 0
                ? t("team.effectiveAll", {
                    target: alvoEscrito,
                    types: tiposDeGolpe.slice(0, 3).map(nomeDoTipo).join(", "),
                  })
                : t("team.variety", { n: variedade, total: time.length })}
            </p>
          </section>

          <div className="tk-overline" style={{ display: "block", marginTop: 24 }}>
            {t("team.theTeam")}
          </div>

          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {time.map((p, i) => {
              const sp = PokemonPor.get(p.speciesId);
              if (!sp) return null;
              const moves = goal === "pvp" ? movesetsPvp.get(p.speciesId) : movesets.get(p.speciesId);
              const jaTenho = tenho.has(p.speciesId);

              return (
                <button
                  key={p.speciesId}
                  type="button"
                  className="tk-teamrow"
                  data-have={(marcaColecao && jaTenho) || undefined}
                  onClick={() => sair(() => onPickSpecies(sp))}
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
                    {moves && <span className="tk-teamrow-moves">{moves}</span>}
                  </span>
                  {/* A etiqueta e a razao de a tela existir: ela transforma o
                      ranking numa lista de caça. Sem colecao ligada ela sai —
                      "ir buscar" em todas as seis linhas nao informa nada. */}
                  {marcaColecao && (
                    <span className="tk-teamrow-tag">
                      {jaTenho ? t("team.have") : t("team.hunt")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* A nota da MT Elite so aparece se ALGUEM do time precisar de uma.
              Explicar um simbolo que nao esta na tela e ruido. */}
          {time.some((p) => (movesetsPvp.get(p.speciesId) ?? movesets.get(p.speciesId) ?? "").includes(ELITE)) && (
            <p className="tk-caption" style={{ marginTop: 14, lineHeight: 1.6 }}>
              {t("team.eliteNote")}
            </p>
          )}

          <p className="tk-caption" style={{ marginTop: 16, lineHeight: 1.6 }}>
            {goal === "raid" ? t("team.howBuilt") : t("team.howBuiltPvp")}
          </p>
        </>
      )}

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
