import { Text, View } from "react-native";

import type { Especie } from "./dados";

/**
 * O selo da especie.
 *
 * ⚠️ MONOGRAMA, e nao sprite — e isso e a mesma decisao do app web, nao uma
 * limitacao do port: o TrainerKit e distribuido SEM arte nenhuma. Quem quiser
 * imagem liga a fonte nos Ajustes e o download acontece no aparelho de quem
 * ligou. Aqui ainda nao ha essa tela, entao por ora e sempre monograma.
 *
 * A TINTA E ESCOLHIDA POR LUMINANCIA, e nao fixa em branco. Medido no web: 18
 * das 19 cores de tipo reprovam 4,5:1 com texto branco. E a mesma conta de
 * `typeInk` la — repetida aqui porque ela vive em `apps/web/src/sprites`, que
 * nao e compartilhado. Quando a paleta por especie for portada, esta funcao sai.
 */
const CORES: Record<string, string> = {
  normal: "#B4AFA3", fighting: "#D4633F", flying: "#9FB6E8", poison: "#B173C4",
  ground: "#D9A65E", rock: "#B8A583", bug: "#A9BE4A", ghost: "#8A7CC4",
  steel: "#A9B4C0", fire: "#F0813F", water: "#5BA8EE", grass: "#6FC163",
  electric: "#F0C63F", psychic: "#EE7FA6", ice: "#79D2DC", dragon: "#8274E2",
  dark: "#7C6D62", fairy: "#EE9DC6",
};
const RESERVA = "#8E96A6";
const TINTA_ESCURA = "#141920";

function luminancia(hexa: string): number {
  const n = parseInt(hexa.slice(1), 16);
  const canal = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return la > lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}

function monograma(nome: string): string {
  return nome.replace(/[^\p{L}]/gu, "").slice(0, 2).toUpperCase();
}

export function Selo({ especie, tamanho = 44 }: { especie: Especie; tamanho?: number }) {
  const fundo = CORES[especie.types[0] ?? ""] ?? RESERVA;
  const tinta = contraste("#ffffff", fundo) >= contraste(TINTA_ESCURA, fundo) ? "#ffffff" : TINTA_ESCURA;
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        // Raio = 1/3 do lado, como o prototipo especifica.
        borderRadius: Math.round(tamanho / 3),
        backgroundColor: fundo,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: tinta, fontWeight: "800", fontSize: Math.round(tamanho * 0.27) }}>
        {monograma(especie.name)}
      </Text>
    </View>
  );
}
