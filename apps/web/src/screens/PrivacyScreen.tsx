import { useT } from "../i18n/t.ts";

/**
 * A política de privacidade — exigida mesmo num app que não coleta nada.
 *
 * O Miguel: "o app ja ta publico no github, entao temos q se preocupar com as
 * leis.... lgpd, leis do paises q tem o idioma e etc."
 *
 * Ele está certo, e a boa notícia é que o app já estava do lado fácil: sem
 * conta, sem servidor de dados, sem analytics, sem cookie de rastreamento. O que
 * faltava não era mudar o app — era ESCREVER isso. A LGPD exige transparência
 * (art. 6º, VI) independentemente de haver coleta, e o art. 41 exige um contato.
 *
 * O QUE TORNA ESTE TEXTO VERDADEIRO, e é o único jeito de ele valer alguma
 * coisa: cada linha aqui corresponde a código que existe.
 *
 *   "nada sai do aparelho"        → coleção em IndexedDB, ver `storage/`
 *   "você pode apagar tudo"       → `storage/wipe.ts`, botão nos Ajustes
 *   "você pode exportar"          → export/import JSON na Coleção
 *   "a IA recebe X"               → `ai/dossier.ts` e `ai/ask.ts` montam o X
 *   "o limite usa o seu IP"       → `api/ai.ts`, `excedeu(ip)`
 *
 * ⚠️ Se alguém mudar um desses arquivos, ESTE TEXTO PRECISA MUDAR JUNTO. Política
 * de privacidade que descreve um app que não existe mais é pior que nenhuma:
 * deixa de ser transparência e vira declaração falsa.
 *
 * ⚠️ A FOTO. Quase passou batido: identificar Pokémon por foto MANDA A IMAGEM
 * pra Groq. É o único caminho do app em que um arquivo do usuário sai do
 * aparelho, e por isso está dito com todas as letras em vez de coberto por um
 * "dados de uso" genérico.
 */

/** Última revisão. Muda junto com o texto, nunca sozinha. */
const ATUALIZADA = "2026-07-30";

/**
 * Contato do controlador (LGPD art. 41).
 *
 * Trocar aqui troca nos dez idiomas de uma vez.
 *
 * ⚠️ O e-mail antigo (`miguel.r.moretti.00@gmail.com`) saiu daqui E do histórico
 * do Git: ele era o autor dos 74 commits de um repositório PÚBLICO, ou seja,
 * estava exposto em `git log` pra qualquer um. O histórico foi reescrito e a
 * config local do repo aponta pro novo.
 */
const CONTATO = "spxmiguel@icloud.com";

export function PrivacyScreen() {
  const { t } = useT();

  const bloco = (titulo: string, corpo: string[]) => (
    <section className="tk-card" style={{ marginBottom: 10 }}>
      <div className="tk-overline" style={{ display: "block", marginBottom: 8 }}>
        {titulo}
      </div>
      {corpo.map((p) => (
        <p key={p} className="tk-caption" style={{ lineHeight: 1.6, marginBottom: 6 }}>
          {p}
        </p>
      ))}
    </section>
  );

  return (
    <>
      <p className="tk-caption" style={{ margin: "0 2px 14px" }}>
        {t("privacy.updated", { date: ATUALIZADA })}
      </p>

      {bloco(t("privacy.summary.title"), [t("privacy.summary.body")])}
      {bloco(t("privacy.local.title"), [t("privacy.local.body"), t("privacy.local.rights")])}
      {bloco(t("privacy.cookies.title"), [t("privacy.cookies.body")])}

      {/* Os terceiros, um por um, com o que CADA UM recebe. Uma lista genérica
          de "parceiros" não informa nada — o que informa é o dado concreto. */}
      {bloco(t("privacy.third.title"), [
        t("privacy.third.intro"),
        t("privacy.third.groq"),
        t("privacy.third.photo"),
        t("privacy.third.ms"),
        t("privacy.third.eleven"),
        /*
          ⚠️ AS IMAGENS FALTAVAM NESTA LISTA, e a frase de cima dizia "só a IA e
          a voz". Os sprites são buscados do GitHub enquanto a pessoa navega,
          com a IA e a voz desligadas — então a promessa estava errada por
          omissão. É o mesmo descuido das fontes, que vinham do CDN do Google e
          agora são auto-hospedadas; aqui não dá pra auto-hospedar (são milhares
          de imagens), então a saída certa é DECLARAR e apontar as duas formas
          de desligar: baixar pro aparelho, ou "Sem imagens".
        */
        t("privacy.third.img"),
        t("privacy.third.host"),
        t("privacy.third.none"),
      ])}

      {bloco(t("privacy.transfer.title"), [t("privacy.transfer.body")])}
      {bloco(t("privacy.rights.title"), [t("privacy.rights.body")])}
      {bloco(t("privacy.minors.title"), [t("privacy.minors.body")])}

      {bloco(t("privacy.controller.title"), [
        t("privacy.controller.body", { contact: CONTATO }),
      ])}
    </>
  );
}
