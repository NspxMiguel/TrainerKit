import { useEffect, useState } from "react";

import { monogram, spriteUrl, typeGradient } from "../sprites/provider.ts";
import { useSpriteSettings } from "../sprites/settings.ts";

interface Props {
  spriteId: number | null;
  dex: number;
  name: string;
  types: readonly string[];
  /** 44 lista · 48 home · 64 galeria · 92 grade · 116 detalhe (escala do prototipo). */
  size?: number;
  shiny?: boolean;
}

/**
 * Selo da especie.
 *
 * O monograma nao e so fallback de erro: ele e o que aparece ENQUANTO a imagem
 * carrega, e o que fica quando a fonte de imagens esta desligada. Por isso o
 * tile nunca fica vazio nem "pula" de tamanho — o gradiente do tipo ja ocupa o
 * espaco final desde o primeiro frame.
 */
export function SpeciesTile({ spriteId, dex, name, types, size = 64, shiny }: Props) {
  const settings = useSpriteSettings();
  const url = spriteUrl({ spriteId, dex, ...(shiny === undefined ? {} : { shiny }) }, settings);

  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Trocar de fonte nos Ajustes precisa refazer a tentativa: sem isto, uma
  // fonte que falhou deixaria o tile preso no monograma para sempre.
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [url]);

  const showImage = url !== null && !failed;

  return (
    <div
      className="tk-mono"
      style={{
        width: size,
        height: size,
        // Raio = 1/3 do lado, como o prototipo especifica.
        borderRadius: Math.round(size / 3),
        background: typeGradient(types),
        fontSize: Math.round(size * 0.27),
        position: "relative",
      }}
      aria-hidden="true"
    >
      <span style={{ opacity: loaded && showImage ? 0 : 1, transition: "opacity .18s ease" }}>
        {monogram(name)}
      </span>

      {showImage && (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            position: "absolute",
            inset: "8%",
            width: "84%",
            height: "84%",
            objectFit: "contain",
            opacity: loaded ? 1 : 0,
            transition: "opacity .18s ease",
            filter: "drop-shadow(0 2px 6px rgba(0,0,0,.35))",
          }}
        />
      )}
    </div>
  );
}
