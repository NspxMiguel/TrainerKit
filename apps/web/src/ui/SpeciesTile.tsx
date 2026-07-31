import { useState } from "react";

import { monogram, typeGradient } from "../sprites/provider.ts";
import { useSpriteUrl } from "../sprites/useSpriteUrl.ts";
import { gradienteDaEspecie } from "./paleta.ts";

interface Props {
  spriteId: number | null;
  dex: number;
  speciesId?: string;
  name: string;
  types: readonly string[];
  /** 44 lista · 48 home · 64 galeria · 92 grade · 116 detalhe (escala do prototipo). */
  size?: number;
  shiny?: boolean;
  /**
   * Sem o selo em volta: so a arte, solta.
   *
   * Existe pro visor da Pokedex. Lá o tile com gradiente do tipo e cantos
   * arredondados brigava com o desenho — o bicho aparecia dentro de um quadrado
   * colorido em cima da tela verde, em vez de estar NA tela. O monograma
   * continua sendo o que aparece enquanto a imagem carrega; ele so perde a
   * moldura.
   */
  bare?: boolean;
}

/**
 * Selo da especie.
 *
 * O monograma nao e so fallback de erro: ele e o que aparece ENQUANTO a imagem
 * carrega, e o que fica quando a fonte de imagens esta desligada. Por isso o
 * tile nunca fica vazio nem "pula" de tamanho — o gradiente do tipo ja ocupa o
 * espaco final desde o primeiro frame.
 */
export function SpeciesTile({
  spriteId,
  dex,
  speciesId = "",
  name,
  types,
  size = 64,
  bare = false,
}: Props) {
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
      className={`tk-mono${bare ? " tk-mono--bare" : ""}`}
      style={{
        width: size,
        height: size,
        // Raio = 1/3 do lado, como o prototipo especifica.
        borderRadius: bare ? 0 : Math.round(size / 3),
        /*
         * A cor do selo vem da ESPECIE, com o tipo de reserva.
         *
         * "mesmo sem sprite, o famoso DR pra qm nao ta com os sprites ativos,
         * tem q aparecer a cor do pokemon" — e o exemplo dele era exato: o selo
         * do Mewtwo saia rosa porque Psiquico e rosa. Sai lavanda agora.
         */
        background: bare ? "none" : gradienteDaEspecie(spriteId, typeGradient(types)),
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
            // Sem moldura a arte usa o quadro inteiro: os 8% de recuo existiam
            // pra ela nao encostar na borda do selo, e sem selo nao ha borda.
            inset: bare ? 0 : "8%",
            width: bare ? "100%" : "84%",
            height: bare ? "100%" : "84%",
            objectFit: "contain",
            opacity: loaded ? 1 : 0,
            transition: "opacity .18s ease",
            filter: bare
              ? "drop-shadow(0 3px 10px rgba(0,0,0,.55))"
              : "drop-shadow(0 2px 6px rgba(0,0,0,.35))",
          }}
        />
      )}
    </div>
  );
}
