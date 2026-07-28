import { useState } from "react";

import { monogram, typeGradient } from "../sprites/provider.ts";
import { useSpriteUrl } from "../sprites/useSpriteUrl.ts";

interface Props {
  spriteId: number | null;
  dex: number;
  speciesId?: string;
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
export function SpeciesTile({ spriteId, dex, speciesId = "", name, types, size = 64 }: Props) {
  const url = useSpriteUrl({ spriteId, dex, speciesId });

  // Guardamos QUAL url carregou, nao um booleano.
  //
  // Com booleano + efeito de reset havia uma corrida real: imagem em cache
  // dispara `onLoad` antes de o efeito rodar, e o efeito entao apagava o `true`
  // recem-gravado — o sprite ficava invisivel para sempre. Sprites pequenos
  // (Game Boy, ~700 B) caiam nisso quase sempre; a arte oficial, quase nunca.
  // Comparar url dispensa o reset: trocar de fonte ja invalida sozinho.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const loaded = url !== null && loadedUrl === url;
  const showImage = url !== null && failedUrl !== url;

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
      <span style={{ opacity: loaded ? 0 : 1, transition: "opacity .18s ease" }}>
        {monogram(name)}
      </span>

      {showImage && (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          // Imagem vinda do cache pode terminar antes de o React ligar o
          // onLoad. O ref roda na montagem e pega justamente esse caso.
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0) setLoadedUrl(url);
          }}
          onLoad={() => setLoadedUrl(url)}
          onError={() => setFailedUrl(url)}
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
