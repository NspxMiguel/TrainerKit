import { useEffect, useRef, useState } from "react";

import type { IVs, ScanResult } from "@trainerkit/core";

import { useT, type Key } from "../i18n/t.ts";
import { dispensarLeitor, lerNumeros, type LeituraOcr } from "../scan/ocr.ts";
import { scanFile, type ScanOutcome } from "../scan/readImage.ts";
import { IconDownload } from "./Icons.tsx";

interface Props {
  onRead: (ivs: IVs) => void;
  /** Chamado quando a leitura falha, para a tela abrir a entrada manual. */
  onFail: () => void;
  /**
   * PC e PS lidos do mesmo print, quando o leitor de texto consegue.
   *
   * Separado do `onRead` porque chega DEPOIS: as barras saem em milissegundos e
   * o texto pode levar segundos na primeira vez. Quem chama decide se aceita —
   * e deve conferir com o `solveLevel` antes, porque numero lido por OCR pode
   * sair plausivel e errado.
   */
  onNumeros?: ((numeros: LeituraOcr) => void) | undefined;
}

/**
 * Anexar print e pronto.
 *
 * Le as tres barras da tela de avaliacao por geometria — conta quantos dos 15
 * passos estao pintados. Nao e OCR, entao nao existe "quase certo": ou as
 * barras foram encontradas e o IV e exato, ou o app diz que nao conseguiu.
 *
 * Mostra sempre o que foi detectado, com o print ao lado. Ler errado em
 * silencio seria muito pior que falhar.
 */
/**
 * O scanner foi calibrado em prints tirados NO CELULAR.
 *
 * Print feito no computador — janela do navegador com um emulador ou um mockup
 * dentro — falha na pratica: a imagem fica cheia de laranja da interface e as
 * barras viram uma fracao minuscula dela. Avisar antes e melhor que deixar a
 * pessoa tentar tres vezes e achar que o app e quebrado.
 */
function isDesktop(): boolean {
  if (navigator.maxTouchPoints > 1) return false;
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Motivo da falha em texto, por codigo.
 *
 * O core devolve so o codigo — ele nao conhece idioma. O mapa vive aqui porque
 * e aqui que existe dicionario.
 */
const FAIL_KEY: Record<string, Key> = {
  "sem-barras": "scan.fail.noBars",
  "barra-curta-demais": "scan.fail.tooShort",
  "barras-insuficientes": "scan.fail.notEnough",
  "larguras-divergentes": "scan.fail.mismatch",
};

export function ScanDropzone({ onRead, onFail, onNumeros }: Props) {
  const { t } = useT();
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  /** O leitor de texto rodando — ele demora bem mais que as barras. */
  const [lendoTexto, setLendoTexto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // O objectURL do print segura a imagem inteira na memoria ate ser revogado.
  useEffect(() => {
    return () => {
      if (outcome) URL.revokeObjectURL(outcome.previewUrl);
    };
  }, [outcome]);

  /*
   * ⚠️ O leitor de texto morre junto com a folha.
   *
   * Ele fica de pe entre um print e o proximo — quem importa vinte de uma vez
   * pelo `<input multiple>` do iPhone nao paga a inicializacao vinte vezes. Mas
   * sao 5,9 MB de wasm e modelo carregados; segurar isso depois que a tela
   * fechou e memoria presa por tempo indeterminado num celular.
   */
  useEffect(() => {
    return () => {
      void dispensarLeitor();
    };
  }, []);

  const handle = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const next = await scanFile(file);
      setOutcome((previous) => {
        if (previous) URL.revokeObjectURL(previous.previewUrl);
        return next;
      });
      if (next.result.ok) onRead(next.result.ivs);
      else onFail();

      /*
       * ⚠️ O "lendo…" acaba AQUI, e nao no `finally` la embaixo.
       *
       * Deixei no `finally` e o efeito foi o oposto do pretendido: o cartao
       * ficava em "Lendo o print…" com o botao desativado durante o OCR inteiro
       * — varios segundos na primeira vez — enquanto o IV ja estava na tela
       * logo abaixo. A pessoa via o resultado e um "estou lendo" ao mesmo tempo.
       *
       * As barras terminaram; o que continua e outra leitura, e ela tem o
       * proprio aviso.
       */
      setBusy(false);

      /*
       * O texto vem DEPOIS, e sem segurar a tela.
       *
       * O IV ja esta na mao neste ponto; esperar o OCR pra mostrar tudo junto
       * faria a pessoa encarar um "lendo..." de varios segundos na primeira vez
       * (e a primeira vez baixa 5,9 MB) por causa de dois numeros opcionais.
       *
       * Falhar aqui nao e erro de nada: sem PC e PS o app so nao descobre o
       * nivel sozinho, e os campos continuam la pra digitar.
       */
      if (onNumeros) {
        setLendoTexto(true);
        try {
          onNumeros(await lerNumeros(next.bitmap));
        } catch (err) {
          /*
           * Leitor indisponivel ou print ilegivel — os campos ficam vazios e a
           * pessoa digita. NAO vira erro na tela: o IV, que e o que importa, ja
           * foi lido; falhar em dois numeros opcionais nao e uma falha do
           * escaneamento.
           *
           * Vai pro console porque um leitor que nunca sobe (arquivo faltando
           * em `public/ocr/`, rede caida na primeira vez) e indistinguivel de
           * "esse print nao tinha PC visivel" sem isto aqui — e foi assim que
           * eu passei um bom tempo achando que o recorte e que estava errado.
           */
          console.warn("[tk] leitor de PC/PS falhou:", err);
        } finally {
          setLendoTexto(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const result: ScanResult | null = outcome?.result ?? null;

  return (
    <section
      className={`tk-drop ${dragging ? "tk-drop--over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) void handle(file);
      }}
    >
      {outcome && (
        <img src={outcome.previewUrl} alt="" className="tk-drop-preview" />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {isDesktop() && !outcome && (
          <div className="tk-banner tk-banner--warn" style={{ marginBottom: 12 }}>
            <div className="tk-banner-text">
              <div className="tk-banner-title">{t("scan.desktopWarning.title")}</div>
              <p className="tk-banner-body">{t("scan.desktopWarning.body")}</p>
            </div>
          </div>
        )}

        {busy ? (
          <div className="tk-drop-title">{t("scan.reading")}</div>
        ) : result?.ok ? (
          <>
            <div className="tk-drop-title" style={{ color: "var(--tk-succ)" }}>
              {t("scan.readAll")}
            </div>
            <div className="tk-caption" style={{ marginTop: 2 }}>
              {t("scan.readValues", {
                atk: result.ivs.atk,
                def: result.ivs.def,
                hp: result.ivs.hp,
              })}
            </div>
            {lendoTexto && (
              <div className="tk-caption" style={{ marginTop: 4 }} role="status">
                {t("scan.readingNumbers")}
              </div>
            )}
          </>
        ) : result ? (
          <>
            <div className="tk-drop-title" style={{ color: "var(--tk-warn)" }}>
              {t("scan.failed")}
            </div>
            <div className="tk-caption" style={{ marginTop: 2, lineHeight: 1.45 }}>
              {t(FAIL_KEY[result.reason] ?? "scan.failed")}
              {t("scan.adjustByHand")}
            </div>
          </>
        ) : (
          <>
            <div className="tk-drop-title">{t("scan.prompt")}</div>
            <div className="tk-caption" style={{ marginTop: 2, lineHeight: 1.45 }}>
              {t("scan.promptDetail")}
            </div>
          </>
        )}

        {error && (
          <div className="tk-caption" style={{ marginTop: 6, color: "var(--tk-dang)" }}>
            {error}
          </div>
        )}

        <button
          type="button"
          className="tk-btn tk-btn--primary"
          style={{ height: 40, fontSize: 13, marginTop: 10, padding: "0 16px" }}
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <IconDownload size={16} />
          {outcome ? t("scan.swap") : t("scan.pick")}
        </button>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handle(file);
          e.target.value = "";
        }}
      />
    </section>
  );
}
