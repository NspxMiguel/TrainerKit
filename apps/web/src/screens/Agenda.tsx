import { useMemo } from "react";
import { createPortal } from "react-dom";

import {
  FONTE_CREDITO,
  FONTE_LINK,
  emCartaz,
  rolandoAgora,
  semEntidades,
  useEventos,
  type EventoAgenda,
} from "../data/agenda.ts";
import { useT } from "../i18n/t.ts";
import { useFolha } from "../ui/folha.ts";

interface Props {
  onClose: () => void;
}

/**
 * O que esta acontecendo.
 *
 * ⚠️ ESTA E A UNICA TELA DO APP QUE NAO RESPONDE SOBRE UM BICHO.
 *
 * Todo o resto responde "o que faco com este aqui" — IV, veredito, counters,
 * faxina. Nada respondia "o que esta rolando esta semana", e essa e a pergunta
 * que o jogador faz mais vezes: e hora de raide? vale sair agora? o Community
 * Day e quando?
 *
 * ── Por que agrupado por QUANDO, e nao por tipo de evento ───────────────────
 *
 * Porque a pergunta e temporal. Uma lista por categoria ("raides", "pesquisa",
 * "Community Day") obriga a pessoa a varrer tudo pra montar a semana na cabeca;
 * agrupar por tempo entrega a resposta pronta. "Agora" vem primeiro e sozinho:
 * e o unico grupo que muda o que fazer nos proximos minutos.
 *
 * ── Sobre o idioma ──────────────────────────────────────────────────────────
 *
 * Os NOMES dos eventos chegam em ingles e ficam em ingles. Traduzir na mao seria
 * inventar; traduzir por maquina daria "Hora do Holofote de Mankey". O que esta
 * em volta — os grupos, as datas, o rodape — sai no idioma da pessoa, e a data
 * usa o fuso e o formato dela, que e o que realmente muda a leitura.
 */
export function Agenda({ onClose }: Props) {
  const { saindo, ref: refFolha, fechar } = useFolha(onClose);
  const { t, language } = useT();
  const estado = useEventos();

  const grupos = useMemo(() => {
    const agora = Date.now();
    const lista = emCartaz(estado.itens ?? [], agora);

    /* As bordas sao do calendario da PESSOA, e nao "agora + 24 h": um evento
       que comeca as 23h de hoje e "hoje", e um que comeca as 6h de amanha nao
       e — mesmo que os dois estejam a sete horas de distancia. */
    const fimDeHoje = new Date();
    fimDeHoje.setHours(23, 59, 59, 999);
    const fimDaSemana = new Date(fimDeHoje);
    fimDaSemana.setDate(fimDaSemana.getDate() + 7);

    const agoraL: EventoAgenda[] = [];
    const hoje: EventoAgenda[] = [];
    const semana: EventoAgenda[] = [];
    const depois: EventoAgenda[] = [];

    for (const e of lista) {
      if (rolandoAgora(e, agora)) {
        agoraL.push(e);
        continue;
      }
      const inicio = e.start ? Date.parse(e.start) : NaN;
      if (Number.isNaN(inicio)) depois.push(e);
      else if (inicio <= fimDeHoje.getTime()) hoje.push(e);
      else if (inicio <= fimDaSemana.getTime()) semana.push(e);
      else depois.push(e);
    }

    /*
     * Dentro de "agora", o que ACABA ANTES vem primeiro.
     *
     * `emCartaz` ordena por inicio, e isso e certo pros grupos futuros — mas em
     * "agora" todo mundo ja comecou, e ordenar por inicio poe a temporada de
     * dois meses no topo e a hora de raide que acaba em 40 minutos no fim. A
     * pergunta de quem abre esse grupo e "o que eu perco se nao sair agora", e
     * quem responde isso e o fim.
     */
    agoraL.sort((a, b) => {
      const fa = a.end ? Date.parse(a.end) : Infinity;
      const fb = b.end ? Date.parse(b.end) : Infinity;
      return (Number.isNaN(fa) ? Infinity : fa) - (Number.isNaN(fb) ? Infinity : fb);
    });

    return [
      { chave: "agora", titulo: t("agenda.agora"), itens: agoraL },
      { chave: "hoje", titulo: t("agenda.hoje"), itens: hoje },
      { chave: "semana", titulo: t("agenda.semana"), itens: semana },
      { chave: "depois", titulo: t("agenda.depois"), itens: depois },
    ].filter((g) => g.itens.length > 0);
  }, [estado.itens, t]);

  const quando = (e: EventoAgenda): string => {
    if (!e.start) return "";
    const i = new Date(e.start);
    if (Number.isNaN(i.getTime())) return "";
    const dia = i.toLocaleDateString(language, { day: "2-digit", month: "short" });
    const hora = i.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
    return `${dia} · ${hora}`;
  };

  /** "até 20:00" — e "Ao vivo" so quando nao ha fim declarado. */
  const ate = (e: EventoAgenda): string => {
    if (!e.end) return t("agenda.agoraCurto");
    const f = new Date(e.end);
    if (Number.isNaN(f.getTime())) return t("agenda.agoraCurto");
    const hoje = new Date();
    const mesmoDia =
      f.getFullYear() === hoje.getFullYear() &&
      f.getMonth() === hoje.getMonth() &&
      f.getDate() === hoje.getDate();
    // Termina hoje: so a hora. Termina depois: a data, senao "até 20:00" num
    // evento que dura tres semanas mentiria sobre a urgencia.
    return t("agenda.ate", {
      quando: mesmoDia
        ? f.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })
        : f.toLocaleDateString(language, { day: "2-digit", month: "short" }),
    });
  };

  const vazio = estado.itens === null;

  return createPortal(
    <div
      ref={refFolha}
      className="tk-sheet-full"
      role="dialog"
      aria-modal="true"
      aria-label={t("agenda.title")}
      data-saindo={saindo || undefined}
    >
      <header className="tk-sheet-head">
        <button type="button" className="tk-sheet-close" onClick={fechar} aria-label={t("common.back")}>
          ‹
        </button>
      </header>
      <h1 className="tk-h1">{t("agenda.title")}</h1>

      {vazio ? (
        <section className="tk-card">
          <p className="tk-caption" style={{ lineHeight: 1.6 }}>{t("agenda.semRede")}</p>
        </section>
      ) : (
        grupos.map((g) => (
          <section key={g.chave} style={{ marginTop: 18 }}>
            <div className="tk-overline" style={{ display: "block" }}>
              {g.titulo}
            </div>
            <div className="tk-card" style={{ marginTop: 8, padding: 0 }}>
              {g.itens.map((e) => (
                <a
                  key={e.eventID}
                  className="tk-evento"
                  href={e.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-agora={g.chave === "agora" || undefined}
                >
                  <span className="tk-evento-txt">
                    {/* O `heading` da fonte e a CATEGORIA ("Pokémon Spotlight
                        Hour"), e o `name` e o caso ("Mankey Spotlight Hour").
                        A categoria vira sobrancelha porque ela se repete e o
                        nome nao — e o que muda merece o peso. */}
                    <span className="tk-evento-tipo">{semEntidades(e.heading)}</span>
                    <span className="tk-evento-nome">{semEntidades(e.name)}</span>
                  </span>
                  {/*
                    Num evento que ja comecou, o que falta saber e QUANDO ACABA.
                    Aqui dizia "Ao vivo" em todas as linhas do grupo — e o
                    cabecalho do grupo ja diz AGORA e o traco a esquerda tambem.
                    Repetir a mesma palavra dez vezes ocupa a coluna que podia
                    responder a unica pergunta que sobra.
                  */}
                  <span className="tk-evento-quando">
                    {g.chave === "agora" ? ate(e) : quando(e)}
                  </span>
                </a>
              ))}
            </div>
          </section>
        ))
      )}

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
