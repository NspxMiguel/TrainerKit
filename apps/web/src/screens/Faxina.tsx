import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  ivTotalOf,
  planejarFaxina,
  type BichoFaxina,
  type EspecieFaxina,
  type Solto,
} from "@trainerkit/core";

import type { Dataset, DatasetSpecies } from "../data/useDataset.ts";
import { useT } from "../i18n/t.ts";
import {
  removerVarios,
  restaurar,
  useCollection,
  type OwnedPokemon,
} from "../storage/collection.ts";
import { tetoDePowerUp, useSetup } from "../onboarding/setup.ts";
import { useFolha } from "../ui/folha.ts";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";

interface Props {
  data: Dataset;
  onClose: () => void;
}

/**
 * A faxina.
 *
 * A terceira situação em que alguém abre um app auxiliar — mochila cheia — e a
 * única que não se resolve um Pokémon por vez. Ninguém abre 300 fichas.
 *
 * ── O que esta tela promete, e o que ela NÃO promete ─────────────────────────
 *
 * ⚠️ O app não transfere nada. Não fala com o jogo, não tem como falar, e o
 * disclaimer da tela Sobre promete por escrito que não fala. Quem transfere é a
 * pessoa, no jogo; o que acontece aqui é só a lista e, no fim, a remoção da
 * coleção DAQUI.
 *
 * Isso não é letra miúda jurídica — é a diferença entre a pessoa entender o
 * botão e a pessoa achar que o app apagou um Pokémon dela. Por isso o texto do
 * botão diz "tirar da lista" e não "transferir", e a confirmação explica a
 * ordem das coisas: primeiro no jogo, depois aqui.
 *
 * ── Por que o "não vou sugerir" é metade da tela ─────────────────────────────
 *
 * A lista dos guardados, com o motivo de cada um, é o que responde "cadê o meu
 * sortudo?" antes que a pergunta vire desconfiança na lista inteira. Um app de
 * faxina que não deixa auditar o que ficou de fora é um app que se usa uma vez.
 */
export function Faxina({ data, onClose }: Props) {
  const { saindo, ref: refFolha, fechar } = useFolha(onClose);
  const { t, tm, language } = useT();
  const { items } = useCollection();
  const setup = useSetup();

  /** Marcados pra sair. */
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set());
  const [confirmando, setConfirmando] = useState(false);
  /*
   * O desfazer mora AQUI, na memória da tela.
   *
   * Guardar em IndexedDB uma "lixeira" seria mais durável e seria pior: viraria
   * um segundo lugar onde Pokémon existem, com todas as perguntas que isso traz
   * (aparece na contagem? entra no backup? vale pra counters?). A remoção é
   * anunciada, cabe numa barra, e a barra fica até a pessoa sair da tela.
   */
  const [desfazivel, setDesfazivel] = useState<OwnedPokemon[] | null>(null);
  const [abrirGuardados, setAbrirGuardados] = useState(false);

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

  const donoPor = useMemo(() => {
    const m = new Map<string, OwnedPokemon>();
    for (const o of items ?? []) m.set(o.id, o);
    return m;
  }, [items]);

  /*
   * O plano. Custa alguns milissegundos por espécie (stat product em três
   * ligas), e a lista de marcados muda a cada toque — sem o memo, cada toque
   * recalcularia a coleção inteira.
   */
  const plano = useMemo(() => {
    if (!items) return null;

    const especies = new Map<string, EspecieFaxina>();
    for (const o of items) {
      if (especies.has(o.speciesId)) continue;
      const s = especiePor.get(o.speciesId);
      if (!s) continue;
      especies.set(o.speciesId, {
        id: s.id,
        baseStats: s.baseStats,
        evolvesInto: s.evolvesInto,
        candyToEvolve: s.evolvesInto[0] ? (s.candyToEvolve[s.evolvesInto[0]] ?? null) : null,
        legendary: s.legendary ?? false,
      });
    }

    const bichos: BichoFaxina[] = items.map((o) => ({
      id: o.id,
      speciesId: o.speciesId,
      ivs: o.ivs,
      level: o.level,
      lucky: o.lucky,
      shadow: o.shadow,
      ivDesconhecido: o.ivDesconhecido === true,
      meuMotivo: o.meuMotivo != null,
    }));

    return planejarFaxina({
      bichos,
      especies,
      cpm: data.cpm,
      levelCap: tetoDePowerUp(setup.level, data.version.levelCap),
    });
  }, [items, especiePor, data.cpm, data.version.levelCap, setup.level]);

  /*
   * ⚠️ SÓ OS "SEM DÚVIDA" NASCEM MARCADOS.
   *
   * É a regra de projeto inteira desta tela em uma linha. "Sem dúvida" é o
   * duplicado que perde para um irmão da mesma espécie em todos os critérios —
   * a pessoa consegue conferir a afirmação item por item. O resto aparece
   * explicado e desmarcado, porque ali o app não tem um irmão pra apontar.
   *
   * ⚠️ A SEMEADURA SEGUE A ASSINATURA DO CONJUNTO, e não um "já semeei".
   *
   * A primeira versão era `if (marcados !== null) return`, e ela perdia uma
   * corrida real — medida, não hipotética. Ao DESFAZER, a ordem é: `restaurar`
   * grava e avisa (o recarregamento da coleção é assíncrono), o React
   * re-renderiza com a lista ANTIGA, a semeadura roda em cima dela e grava um
   * conjunto vazio; só então os 8 Pokémon voltam. Como o marcador já não era
   * nulo, a semeadura não rodava de novo — os 8 reapareciam todos DESMARCADOS,
   * e a barra de ação sumia junto.
   *
   * Comparar a assinatura resolve os dois lados: ela muda exatamente quando o
   * conjunto "sem dúvida" muda (remover, desfazer, escanear algo novo) e não
   * muda em re-render nenhum. Marcar e desmarcar na mão continua intocado.
   */
  const assinatura = plano
    ? plano.soltos
        .filter((s) => s.classe === "semDuvida")
        .map((s) => s.id)
        .join(",")
    : null;
  const semeado = useRef<string | null>(null);

  useEffect(() => {
    if (assinatura === null || semeado.current === assinatura) return;
    semeado.current = assinatura;
    setMarcados(new Set(assinatura === "" ? [] : assinatura.split(",")));
  }, [assinatura]);

  const escolhidos = marcados;

  const alternar = (id: string) => {
    setMarcados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  };

  const remover = async () => {
    const ids = [...escolhidos];
    const removidos = await removerVarios(ids);
    setDesfazivel(removidos);
    setConfirmando(false);
    // A seleção não se limpa aqui: o plano muda quando a coleção recarregar, e
    // a semeadura por assinatura refaz a marcação sozinha, do lado certo da
    // corrida. Ver a nota longa acima.
  };

  const desfazer = async () => {
    if (!desfazivel) return;
    await restaurar(desfazivel);
    setDesfazivel(null);
  };

  const nome = (speciesId: string) => especiePor.get(speciesId)?.name ?? speciesId;

  /**
   * Agrupa por espécie, na ordem de quem tem mais sobra.
   *
   * A tela é de mochila cheia, e mochila cheia é feita de pilha: quem tem 9
   * Pidgey sobrando quer ver os 9 juntos, com o nome uma vez só. Uma lista
   * plana ordenada por data mostraria os mesmos 9 espalhados no meio de 40
   * outros — e a pessoa teria que reconstruir o agrupamento com os olhos.
   */
  const agrupar = (lista: readonly Solto[]) => {
    const grupos = new Map<string, Solto[]>();
    for (const s of lista) {
      const g = grupos.get(s.speciesId);
      if (g) g.push(s);
      else grupos.set(s.speciesId, [s]);
    }
    return [...grupos.entries()].sort(
      (a, b) => b[1].length - a[1].length || nome(a[0]).localeCompare(nome(b[0]), language),
    );
  };

  const semDuvida = plano?.soltos.filter((s) => s.classe === "semDuvida") ?? [];
  const voceDecide = plano?.soltos.filter((s) => s.classe === "voceDecide") ?? [];

  const linha = (s: Solto) => {
    const owned = donoPor.get(s.id);
    const sp = especiePor.get(s.speciesId);
    if (!owned || !sp) return null;
    const marcado = escolhidos.has(s.id);

    return (
      <label key={s.id} className="tk-fax-row" data-on={marcado || undefined}>
        {/*
          Caixa de marcar NATIVA, e não um botão com aparência de caixa.

          Ela traz de graça o que uma imitação precisaria refazer: foco pelo
          teclado, espaço pra alternar, o estado anunciado pelo leitor de tela e
          o gesto que o sistema já desenha. O que o CSS faz é só engordá-la pro
          alvo de 44px — aparência, não comportamento.
        */}
        <input
          type="checkbox"
          className="tk-fax-check"
          checked={marcado}
          onChange={() => alternar(s.id)}
        />
        <SpeciesTile
          spriteId={sp.spriteId}
          dex={sp.dex}
          speciesId={sp.id}
          name={sp.name}
          types={sp.types}
          size={40}
        />
        <span className="tk-fax-text">
          <span className="tk-fax-name">
            {ivTotalOf(owned.ivs)}/45
            {owned.cp !== null && ` · ${t("common.cp")} ${owned.cp.toLocaleString(language)}`}
          </span>
          {/* O motivo vem do CORE, traduzido por `tm` como todo o resto. As
              chaves de `Message` já vivem no dicionário — ligar as duas por
              concatenação de string aqui faria as duas travas de tipo (a união
              `MessageKey` e a união do dicionário) pararem de valer. */}
          <span className="tk-fax-why">{tm(s.motivo)}</span>
        </span>
      </label>
    );
  };

  const secao = (
    titulo: string,
    explica: string,
    lista: readonly Solto[],
    destaque: boolean,
  ) => {
    if (lista.length === 0) return null;
    return (
      <section style={{ marginTop: 22 }}>
        <div className={destaque ? "tk-overline tk-overline-hot" : "tk-overline"} style={{ display: "block" }}>
          {titulo} · {lista.length.toLocaleString(language)}
        </div>
        <p className="tk-caption" style={{ margin: "6px 0 10px", lineHeight: 1.5 }}>
          {explica}
        </p>
        <div className="tk-card tk-fax-card">
          {agrupar(lista).map(([speciesId, itens]) => (
            <div key={speciesId} className="tk-fax-group">
              <div className="tk-fax-group-head">
                <span>{nome(speciesId)}</span>
                {/* O doce é POR FAMÍLIA no jogo, então ele só faz sentido junto
                    do nome da espécie. Um total geral de "23 doces" somaria
                    quinze moedas diferentes num número só. */}
                <span className="tk-fax-candy">
                  {itens.length === 1
                    ? t("faxina.candy.one")
                    : t("faxina.candy.many", { n: itens.length.toLocaleString(language) })}
                </span>
              </div>
              {itens.map(linha)}
            </div>
          ))}
        </div>
      </section>
    );
  };

  const total = escolhidos.size;
  const temBarra = desfazivel !== null || total > 0;

  return createPortal(
    <div
      ref={refFolha}
      className={`tk-sheet-full${temBarra ? " tk-sheet-full--barra" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("faxina.title")}
      data-saindo={saindo || undefined}
    >
      <header className="tk-sheet-head">
        <button type="button" className="tk-sheet-close" onClick={fechar} aria-label={t("common.back")}>
          ‹
        </button>
      </header>
      <h1 className="tk-h1">{t("faxina.title")}</h1>

      {/*
        A frase que impede o mal-entendido, e ela vem ANTES de qualquer lista.

        Depois da lista seria tarde: a pessoa já teria formado a ideia de que o
        app mexe no jogo dela.
      */}
      <p className="tk-body" style={{ marginTop: 2, lineHeight: 1.55 }}>
        {t("faxina.intro")}
      </p>

      {!plano ? (
        <p className="tk-caption" style={{ marginTop: 20 }}>{t("common.loading")}</p>
      ) : plano.soltos.length === 0 ? (
        <div className="tk-empty" style={{ marginTop: 24 }}>
          <div className="tk-empty-title">{t("faxina.empty.title")}</div>
          <p className="tk-body">{t("faxina.empty.body")}</p>
        </div>
      ) : (
        <>
          {secao(t("faxina.sure"), t("faxina.sure.body"), semDuvida, true)}
          {secao(t("faxina.maybe"), t("faxina.maybe.body"), voceDecide, false)}
        </>
      )}

      {/*
        Os guardados, fechados por padrão.

        Fechados porque não são a tarefa — a tarefa é a lista de cima. Mas
        PRESENTES, com contagem na etiqueta, porque a pergunta "e o meu sortudo,
        sumiu?" tem que ter resposta a um toque de distância, e não numa tela de
        ajuda que ninguém abre.
      */}
      {plano && plano.guardados.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <button
            type="button"
            className="tk-btn tk-btn--secondary tk-btn--block"
            aria-expanded={abrirGuardados}
            onClick={() => setAbrirGuardados((v) => !v)}
          >
            {plano.guardados.length === 1
              ? t("faxina.kept.one")
              : t("faxina.kept.many", {
                  n: plano.guardados.length.toLocaleString(language),
                })}
          </button>

          {abrirGuardados && (
            <div className="tk-card tk-fax-card" style={{ marginTop: 10 }}>
              {plano.guardados.map((g) => {
                const sp = especiePor.get(g.speciesId);
                const owned = donoPor.get(g.id);
                if (!sp || !owned) return null;
                return (
                  <div key={g.id} className="tk-fax-row tk-fax-row--kept">
                    <SpeciesTile
                      spriteId={sp.spriteId}
                      dex={sp.dex}
                      speciesId={sp.id}
                      name={sp.name}
                      types={sp.types}
                      size={36}
                    />
                    <span className="tk-fax-text">
                      <span className="tk-fax-name">{sp.name}</span>
                      <span className="tk-fax-why">{tm(g.motivo)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/*
        A barra do desfazer TROCA a barra de ação.

        Não convivem: enquanto há algo a desfazer, a ação mais provável é
        desfazer, e oferecer as duas ao mesmo tempo põe um botão destrutivo do
        lado do botão que conserta.
      */}
      {desfazivel ? (
        <div className="tk-fax-bar tk-fax-bar--undo" role="status">
          <span className="tk-fax-bar-text">
            {desfazivel.length === 1
              ? t("faxina.removed.one")
              : t("faxina.removed.many", {
                  n: desfazivel.length.toLocaleString(language),
                })}
          </span>
          <button type="button" className="tk-btn tk-btn--secondary" onClick={() => void desfazer()}>
            {t("faxina.undo")}
          </button>
        </div>
      ) : (
        total > 0 && (
          <div className="tk-fax-bar">
            <span className="tk-fax-bar-text">
              {total === 1
                ? t("faxina.selected.one")
                : t("faxina.selected.many", { n: total.toLocaleString(language) })}
            </span>
            <button
              type="button"
              className="tk-btn tk-btn--primary"
              onClick={() => setConfirmando(true)}
            >
              {t("faxina.action")}
            </button>
          </div>
        )
      )}

      {/*
        A confirmação diz a ORDEM das coisas.

        "Transferir no jogo, depois tirar daqui" — porque quem inverte a ordem
        perde a lista antes de saber quais eram. É o único conselho operacional
        que esta tela precisa dar, e ele cabe numa frase.
      */}
      {confirmando &&
        /*
         * ⚠️ PORTAL PRÓPRIO, direto no `body` — não pode ser filho da folha.
         *
         * Mesma armadilha do `position: fixed` na barra, e ela morde uma
         * segunda vez porque o scrim também é `fixed`: a folha anima com
         * `fill-mode: both`, o transform residual vira bloco contentor, e o
         * scrim passa a se posicionar contra o CONTEÚDO ROLÁVEL da folha. Na
         * prática o diálogo aparecia lá em cima, fora da tela, com a lista
         * intacta e clicável por baixo — um diálogo de confirmação que não
         * confirma nada e não bloqueia nada.
         *
         * Foi assim que eu escrevi da primeira vez; o `WipeDialog` já fazia
         * certo, e eu não olhei.
         */
        createPortal(
          <div
            className="tk-scrim"
            role="dialog"
            aria-modal="true"
            aria-label={t("faxina.confirm.title", { n: total.toLocaleString(language) })}
          >
            <div className="tk-modal">
              <h2 className="tk-modal-title">
                {t("faxina.confirm.title", { n: total.toLocaleString(language) })}
              </h2>
              <p className="tk-body" style={{ marginTop: 6, lineHeight: 1.55 }}>
                {t("faxina.confirm.body")}
              </p>
              <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
                {/* Cancelar é o botão com PESO, e tirar é o discreto em
                    vermelho — a mesma ordem do `WipeDialog`, pelo mesmo motivo:
                    quem chegou aqui por engano sai pelo caminho mais fácil. */}
                <button
                  type="button"
                  className="tk-btn tk-btn--primary tk-btn--block"
                  onClick={() => setConfirmando(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="tk-btn tk-btn--danger tk-btn--block"
                  onClick={() => void remover()}
                >
                  {t("faxina.confirm.action")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>,
    document.body,
  );
}
