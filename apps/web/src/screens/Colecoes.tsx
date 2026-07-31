import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useT } from "../i18n/t.ts";
import {
  apagarColecao,
  colecaoAtiva,
  contarPorColecao,
  criarColecao,
  listarColecoes,
  renomearColecao,
  trocarColecao,
  type Colecao,
} from "../storage/collection.ts";
import { useFolha } from "../ui/folha.ts";

/**
 * Trocar de conta do jogo.
 *
 * "esse M, no caso, a conta da pessoa ... onde vc pode criar varias contas,
 * varias coleçÕes. pra pessoas q tem varias contas."
 *
 * Não é multiusuário e não tem login: é a MESMA pessoa com mais de uma conta no
 * jogo, o que é comum entre quem joga a sério. Cada coleção guarda os seus
 * Pokémon e os seus vereditos, tudo no aparelho.
 */
export function Colecoes({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { saindo, fechar } = useFolha(onClose);
  const [colecoes, setColecoes] = useState<Colecao[]>([]);
  const [contagem, setContagem] = useState<Record<string, number>>({});
  const [ativa, setAtiva] = useState(colecaoAtiva());
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [confirmando, setConfirmando] = useState<string | null>(null);
  /*
   * ⚠️ Renomear com campo PROPRIO, e nao `prompt()`.
   *
   * O `prompt` do navegador bloqueia a pagina inteira, ignora o tema, ignora o
   * idioma do app (os botoes vem no idioma do SISTEMA) e, num PWA instalado no
   * iOS, aparece com a cara do Safari no meio de uma tela que nao e o Safari.
   *
   * Achei rodando um varredor que clica em todos os botoes: ele parou aqui.
   * Um dialogo que trava um robo trava uma pessoa do mesmo jeito.
   */
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState("");

  const recarregar = async () => {
    /*
     * ⚠️ Leitura pura: nada aqui mexe na coleção ativa.
     *
     * A primeira versão contava trocando a ativa num laço e voltando no fim.
     * Em desenvolvimento o efeito roda duas vezes, os dois laços concorriam
     * pela mesma variável global, e a tela mostrava "0 Pokémon" numa coleção
     * com três — foi o que apareceu no teste.
     */
    const [lista, contas] = await Promise.all([listarColecoes(), contarPorColecao()]);
    setColecoes(lista);
    setContagem(contas);
    setAtiva(colecaoAtiva());
  };

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const escolher = async (id: string) => {
    await trocarColecao(id);
    setAtiva(id);
    fechar();
  };

  return createPortal(
    <div
      className="tk-sheet-full"
      role="dialog"
      aria-modal="true"
      aria-label={t("colecoes.title")}
      data-saindo={saindo || undefined}
    >
      <header className="tk-sheet-head">
        <button type="button" className="tk-sheet-close" onClick={fechar} aria-label={t("common.back")}>
          ‹
        </button>
      </header>

      <h1 className="tk-h1">{t("colecoes.title")}</h1>
      <p className="tk-caption" style={{ marginBottom: 20 }}>
        {t("colecoes.body")}
      </p>

      <div className="tk-card" style={{ overflow: "hidden" }}>
        {colecoes.map((c, i) => (
          <div
            key={c.id}
            className="tk-row"
            style={i > 0 ? { borderTop: "1px solid var(--tk-sep)" } : undefined}
          >
            <button
              type="button"
              className="tk-row-main"
              onClick={() => void escolher(c.id)}
              aria-current={c.id === ativa ? "true" : undefined}
            >
              <span className="tk-colecao-selo" aria-hidden="true">
                {c.nome.slice(0, 1).toUpperCase()}
              </span>
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span className="tk-row-title">{c.nome}</span>
                <span className="tk-row-meta">
                  {t("colecoes.count", { n: contagem[c.id] ?? 0 })}
                  {c.id === ativa ? ` · ${t("colecoes.active")}` : ""}
                </span>
              </span>
              {/*
                O check saiu: quem diz "em uso" e a propria linha de baixo.

                Ele ocupava ~26px SO na linha ativa, entao as duas linhas
                ficavam com larguras de texto diferentes e o nome da ativa
                truncava ("Prin…") enquanto o da outra cabia inteiro. Uma marca
                que aparece so numa linha desalinha a lista toda — e a
                informacao ja estava escrita ao lado, em palavra.
              */}
            </button>

            {renomeando === c.id ? (
              <>
                <input
                  className="tk-input tk-row-input"
                  value={nomeEdit}
                  onChange={(e) => setNomeEdit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void renomearColecao(c.id, nomeEdit).then(recarregar);
                      setRenomeando(null);
                    }
                    if (e.key === "Escape") setRenomeando(null);
                  }}
                  autoFocus
                  maxLength={24}
                  aria-label={t("colecoes.rename")}
                />
                <button
                  type="button"
                  className="tk-row-acao"
                  onClick={() => {
                    void renomearColecao(c.id, nomeEdit).then(recarregar);
                    setRenomeando(null);
                  }}
                >
                  {t("common.save")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="tk-row-acao"
                onClick={() => {
                  setNomeEdit(c.nome);
                  setRenomeando(c.id);
                }}
              >
                {t("colecoes.rename")}
              </button>
            )}

            {/*
              Apagar só aparece quando há mais de uma, e nunca sem confirmar.

              Apagar uma coleção leva os Pokémon dela junto — é a única ação
              destrutiva desta tela, e sem servidor não existe desfazer. O
              segundo toque é o que separa "quis apagar" de "encostou no botão".
            */}
            {colecoes.length > 1 && renomeando !== c.id && (
              <button
                type="button"
                className="tk-row-acao tk-row-acao--perigo"
                onClick={() => {
                  if (confirmando === c.id) {
                    void apagarColecao(c.id).then(recarregar);
                    setConfirmando(null);
                  } else {
                    setConfirmando(c.id);
                  }
                }}
              >
                {confirmando === c.id ? t("colecoes.deleteSure") : t("colecoes.delete")}
              </button>
            )}
          </div>
        ))}
      </div>

      {criando ? (
        <div className="tk-card" style={{ marginTop: 14, padding: 14 }}>
          <input
            className="tk-input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={t("colecoes.namePlaceholder")}
            autoFocus
            maxLength={24}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button
              type="button"
              className="tk-btn tk-btn--primary"
              style={{ flex: 1 }}
              onClick={() => {
                void criarColecao(nome).then(() => {
                  setNome("");
                  setCriando(false);
                  fechar();
                });
              }}
            >
              {t("colecoes.create")}
            </button>
            <button type="button" className="tk-btn tk-btn--secondary" onClick={() => setCriando(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="tk-btn tk-btn--secondary tk-btn--block"
          style={{ marginTop: 14 }}
          onClick={() => setCriando(true)}
        >
          {t("colecoes.new")}
        </button>
      )}
    </div>,
    document.body,
  );
}
