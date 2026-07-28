import { useState } from "react";

import {
  SOURCE_LABELS,
  setSpriteSettings,
  useSpriteSettings,
  type SpriteSourceId,
} from "../sprites/settings.ts";

const ORDER: SpriteSourceId[] = ["off", "pokeapi-artwork", "pokeapi-home", "custom"];

/**
 * Liga e desliga as imagens.
 *
 * O app e distribuido sem nenhuma arte — o que sai do repositorio e so codigo e
 * numeros. Quem quiser imagem escolhe a fonte aqui, e o download acontece no
 * proprio aparelho, sob demanda, conforme os Pokemon vao sendo vistos.
 */
export function SpriteSettings() {
  const settings = useSpriteSettings();
  const [draft, setDraft] = useState(settings.customTemplate);

  return (
    <>
      <div className="tk-overline" style={{ display: "block", marginTop: 28 }}>
        Imagens
      </div>

      <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {ORDER.map((id) => {
          const active = settings.source === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSpriteSettings({ source: id })}
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

        {settings.source === "custom" && (
          <div style={{ marginTop: 4 }}>
            <div className="tk-search" style={{ height: 44 }}>
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://exemplo.com/{id}.png"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => setSpriteSettings({ customTemplate: draft })}
                aria-label="Endereço da fonte de imagens"
              />
            </div>
            <p className="tk-caption" style={{ marginTop: 8, lineHeight: 1.5 }}>
              <code>{"{id}"}</code> vira o número do sprite e <code>{"{dex}"}</code> o
              número da Pokédex. Formas regionais usam ids acima de 10000.
            </p>
          </div>
        )}
      </section>

      <p className="tk-caption" style={{ marginTop: 10, lineHeight: 1.5 }}>
        {settings.source === "off"
          ? "Nenhuma imagem é baixada. Cada espécie aparece com a cor do tipo e as iniciais."
          : "As imagens são buscadas conforme você navega e ficam guardadas no aparelho para funcionar offline. O TrainerKit não hospeda nem redistribui nenhuma delas."}
      </p>
    </>
  );
}
