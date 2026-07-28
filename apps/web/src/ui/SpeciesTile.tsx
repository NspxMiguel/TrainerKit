import { useState } from "react";

import { isPixelArt, monogram, needsScreen, spriteUrl, typeGradient } from "../sprites/provider.ts";
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
  const pixel = isPixelArt(settings.source);
  const screen = needsScreen(settings.source);

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
            // A telinha ocupa mais do tile e ganha cantos proprios; sem ela o
            // sprite respira dentro do gradiente do tipo.
            inset: screen ? "10%" : "8%",
            width: screen ? "80%" : "84%",
            height: screen ? "80%" : "84%",
            objectFit: "contain",
            background: screen ? "#F6F7F2" : "none",
            borderRadius: screen ? Math.round(size / 9) : 0,
            padding: screen ? "4%" : 0,
            opacity: loaded ? 1 : 0,
            transition: "opacity .18s ease",
            // Sprite de 96px ampliado pra 116 vira borrao com a interpolacao
            // padrao do navegador. `pixelated` mantem o pixel quadrado, que e o
            // ponto inteiro de escolher arte de Game Boy.
            imageRendering: pixel ? "pixelated" : "auto",
            filter: pixel
              ? "drop-shadow(0 1px 2px rgba(0,0,0,.4))"
              : "drop-shadow(0 2px 6px rgba(0,0,0,.35))",
          }}
        />
      )}
    </div>
  );
}
