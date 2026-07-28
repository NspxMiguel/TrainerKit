import { useEffect, useRef, useState } from "react";

import type { IVs, ScanResult } from "@trainerkit/core";

import { scanFile, type ScanOutcome } from "../scan/readImage.ts";
import { IconDownload } from "./Icons.tsx";

interface Props {
  onRead: (ivs: IVs) => void;
  /** Chamado quando a leitura falha, para a tela abrir a entrada manual. */
  onFail: () => void;
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

export function ScanDropzone({ onRead, onFail }: Props) {
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // O objectURL do print segura a imagem inteira na memoria ate ser revogado.
  useEffect(() => {
    return () => {
      if (outcome) URL.revokeObjectURL(outcome.previewUrl);
    };
  }, [outcome]);

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
              <div className="tk-banner-title">Você está no computador</div>
              <p className="tk-banner-body">
                A leitura foi testada em print tirado no celular. Print de tela de
                computador quase sempre falha — a interface em volta atrapalha. Se der
                errado, dá pra preencher à mão.
              </p>
            </div>
          </div>
        )}

        {busy ? (
          <div className="tk-drop-title">Lendo o print…</div>
        ) : result?.ok ? (
          <>
            <div className="tk-drop-title" style={{ color: "var(--tk-succ)" }}>
              Li as três barras
            </div>
            <div className="tk-caption" style={{ marginTop: 2 }}>
              Ataque {result.ivs.atk} · Defesa {result.ivs.def} · PS {result.ivs.hp}
            </div>
          </>
        ) : result ? (
          <>
            <div className="tk-drop-title" style={{ color: "var(--tk-warn)" }}>
              Não consegui ler
            </div>
            <div className="tk-caption" style={{ marginTop: 2, lineHeight: 1.45 }}>
              {result.detail} Ajuste as barras à mão abaixo.
            </div>
          </>
        ) : (
          <>
            <div className="tk-drop-title">Anexe o print da avaliação</div>
            <div className="tk-caption" style={{ marginTop: 2, lineHeight: 1.45 }}>
              Aquela tela com as três barras. Ele lê o IV exato e preenche tudo.
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
          {outcome ? "Trocar print" : "Escolher print"}
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
