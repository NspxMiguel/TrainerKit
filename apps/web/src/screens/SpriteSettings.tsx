import { useRef, useState } from "react";

import {
  SOURCE_LABELS,
  setSpriteSettings,
  useSpriteSettings,
  type BuiltinSourceId,
} from "../sprites/settings.ts";
import { addManifestSource, addZipSource, removeSource } from "../sprites/sources.ts";
import { refreshSources, useSources } from "../sprites/useSpriteUrl.ts";

const BUILTIN: BuiltinSourceId[] = ["off", "pokeapi-artwork", "pokeapi-home"];

/**
 * Fontes de imagem — uma lista só.
 *
 * "Adicionar fonte" era um cartao separado logo abaixo das opcoes, o que fazia
 * parecer outro assunto. E o mesmo assunto: de onde vem a imagem. Entao
 * "Fonte personalizada" e so mais uma opcao da lista, e escolher ela abre o que
 * precisa — link ou .zip.
 *
 * O app nao embarca nem hospeda arte: ele aponta. Isso mantem o que se
 * distribui limpo e nao prende ninguem ao acervo que eu escolhi.
 */
export function SpriteSettings() {
  const settings = useSpriteSettings();
  const sources = useSources();

  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const usingCustom = settings.source.startsWith("src:");
  const customOpen = showCustom || usingCustom;

  const addUrl = async () => {
    setError(null);
    setBusy("Lendo manifesto…");
    try {
      const source = await addManifestSource(url);
      await refreshSources();
      setSpriteSettings({ source: `src:${source.id}` });
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const addZip = async (file: File) => {
    setError(null);
    setBusy("Descompactando…");
    try {
      const source = await addZipSource(file, (done, total) =>
        setBusy(`Importando ${done} de ${total}…`),
      );
      await refreshSources();
      setSpriteSettings({ source: `src:${source.id}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const drop = async (id: string) => {
    await removeSource(id);
    await refreshSources();
    if (settings.source === `src:${id}`) setSpriteSettings({ source: "off" });
  };

  return (
    <>
      <div className="tk-overline" style={{ display: "block", marginTop: 28 }}>
        Imagens
      </div>

      <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {BUILTIN.map((id) => {
          const active = settings.source === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setSpriteSettings({ source: id });
                setShowCustom(false);
              }}
              aria-pressed={active}
              className="tk-option"
              data-active={active || undefined}
            >
              <span className="tk-option-mark" aria-hidden="true">
                {active ? "●" : "○"}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="tk-option-title">{SOURCE_LABELS[id].title}</span>
                <span className="tk-option-detail">{SOURCE_LABELS[id].detail}</span>
              </span>
            </button>
          );
        })}

        <button
          type="button"
          className="tk-option"
          data-active={customOpen || undefined}
          aria-expanded={customOpen}
          onClick={() => setShowCustom((v) => !v)}
        >
          <span className="tk-option-mark" aria-hidden="true">
            {usingCustom ? "●" : "○"}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="tk-option-title">Fonte personalizada</span>
            <span className="tk-option-detail">
              Um link de manifesto ou um .zip com as imagens. Você aponta e tudo
              aparece.
            </span>
          </span>
        </button>

        {customOpen && (
          <div style={{ display: "grid", gap: 8, paddingLeft: 4 }}>
            {sources?.map((s) => {
              const active = settings.source === `src:${s.id}`;
              return (
                <div key={s.id} style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setSpriteSettings({ source: `src:${s.id}` })}
                    aria-pressed={active}
                    className="tk-option"
                    data-active={active || undefined}
                    style={{ flex: 1 }}
                  >
                    <span className="tk-option-mark" aria-hidden="true">
                      {active ? "●" : "○"}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="tk-option-title">{s.name}</span>
                      <span className="tk-option-detail">
                        {s.kind === "zip"
                          ? `${s.fileCount} imagens no aparelho`
                          : s.origin.replace(/^https?:\/\//, "")}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="tk-option"
                    style={{ flex: "none", width: 44, justifyContent: "center", padding: 0 }}
                    onClick={() => void drop(s.id)}
                    aria-label={`Remover ${s.name}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            <div className="tk-search" style={{ height: 44 }}>
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://exemplo.com/sprites.json"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-label="Endereço do manifesto"
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="tk-btn tk-btn--primary"
                style={{ flex: 1, height: 44, fontSize: 14 }}
                disabled={url.trim() === "" || busy !== null}
                onClick={() => void addUrl()}
              >
                Adicionar link
              </button>
              <button
                type="button"
                className="tk-btn tk-btn--secondary"
                style={{ flex: 1, height: 44, fontSize: 14 }}
                disabled={busy !== null}
                onClick={() => fileInput.current?.click()}
              >
                Importar .zip
              </button>
            </div>

            <input
              ref={fileInput}
              type="file"
              accept=".zip,application/zip"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void addZip(file);
                e.target.value = "";
              }}
            />

            {busy && <p className="tk-caption">{busy}</p>}
            {error && (
              <p className="tk-caption" style={{ color: "var(--tk-dang)" }}>
                {error}
              </p>
            )}

            <p className="tk-caption" style={{ lineHeight: 1.6 }}>
              O manifesto é um JSON com <code>name</code> e <code>template</code> — por
              exemplo <code>{'"https://…/{dex}.png"'}</code>. No .zip, o nome do arquivo é
              o que casa: <code>025.png</code> por número da Pokédex,{" "}
              <code>pikachu.png</code> por nome. Pastas são ignoradas.
            </p>
          </div>
        )}
      </section>

      <p className="tk-caption" style={{ marginTop: 10, lineHeight: 1.5 }}>
        {settings.source === "off"
          ? "Nenhuma imagem é baixada. Cada espécie aparece com a cor do tipo e as iniciais."
          : "O TrainerKit não hospeda nem redistribui nenhuma imagem — ele só aponta para a fonte que você escolheu."}
      </p>
    </>
  );
}
