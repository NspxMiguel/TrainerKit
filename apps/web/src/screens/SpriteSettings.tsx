import { useRef, useState } from "react";

import {
  SOURCE_KEYS,
  setSpriteSettings,
  useSpriteSettings,
  type BuiltinSourceId,
} from "../sprites/settings.ts";
import { useT, type Key } from "../i18n/t.ts";
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
  const { t } = useT();

  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const usingCustom = settings.source.startsWith("src:");
  const customOpen = showCustom || usingCustom;

  const addUrl = async () => {
    setError(null);
    setBusy(t("sprites.readingManifest"));
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
    setBusy(t("sprites.unzipping"));
    try {
      const source = await addZipSource(file, (done, total) =>
        setBusy(t("sprites.loaded", { count: `${done}/${total}` })),
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
        {t("sprites.title")}
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
                <span className="tk-option-title">{t(SOURCE_KEYS[id].title as Key)}</span>
                <span className="tk-option-detail">{t(SOURCE_KEYS[id].detail as Key)}</span>
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
            <span className="tk-option-title">{t("sprites.custom")}</span>
            <span className="tk-option-detail">
              {t("sprites.customDetail")}
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
                placeholder={t("sprites.manifestPlaceholder")}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-label={t("sprites.manifestAria")}
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
                {t("sprites.addLink")}
              </button>
              <button
                type="button"
                className="tk-btn tk-btn--secondary"
                style={{ flex: 1, height: 44, fontSize: 14 }}
                disabled={busy !== null}
                onClick={() => fileInput.current?.click()}
              >
                {t("sprites.importZip")}
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
              {t("sprites.manifestHelp", {
                nameField: "name",
                templateField: "template",
                example: '"https://…/{dex}.png"',
                byDex: "025.png",
                byName: "pikachu.png",
              })}
            </p>
          </div>
        )}
      </section>

      <p className="tk-caption" style={{ marginTop: 10, lineHeight: 1.5 }}>
        {settings.source === "off" ? t("sprites.noneActive") : t("sprites.note")}
      </p>
    </>
  );
}
