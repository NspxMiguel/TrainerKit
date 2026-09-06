import { Image, Text, View } from "react-native";
import { useState } from "react";

import { seloDaEspecie, spriteUrl } from "@trainerkit/core";

import type { Especie } from "./dados";
import { useImagens } from "./imagens";

/**
 * O selo da especie.
 *
 * ⚠️ MONOGRAMA POR PADRAO, e nao por limitacao: o TrainerKit e distribuido SEM
 * arte nenhuma, e quem quiser imagem liga a fonte em Ajustes › Imagens. Com ela
 * ligada, a imagem entra POR CIMA do monograma — que continua sendo o estado de
 * carga e o recurso de toda especie sem arquivo, em qualquer fonte.
 *
 * ⚠️ `onError` volta pro monograma. Sem isso, uma especie sem arte na fonte
 * escolhida (as formas regionais faltam em varias) deixaria um quadrado vazio,
 * que parece defeito do app e nao ausencia do arquivo.
 *
 * A TINTA E ESCOLHIDA POR LUMINANCIA, e nao fixa em branco. Medido no web: 18
 * das 19 cores de tipo reprovam 4,5:1 com texto branco. E a mesma conta de
 * `typeInk` la — repetida aqui porque ela vive em `apps/web/src/sprites`, que
 * nao e compartilhado. Quando a paleta por especie for portada, esta funcao sai.
 */
const CORES: Record<string, string> = {
  normal: "#B4AFA3",
  fighting: "#D4633F",
  flying: "#9FB6E8",
  poison: "#B173C4",
  ground: "#D9A65E",
  rock: "#B8A583",
  bug: "#A9BE4A",
  ghost: "#8A7CC4",
  steel: "#A9B4C0",
  fire: "#F0813F",
  water: "#5BA8EE",
  grass: "#6FC163",
  electric: "#F0C63F",
  psychic: "#EE7FA6",
  ice: "#79D2DC",
  dragon: "#8274E2",
  dark: "#7C6D62",
  fairy: "#EE9DC6",
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
  return nome
    .replace(/[^\p{L}]/gu, "")
    .slice(0, 2)
    .toUpperCase();
}

export function Selo({ especie, tamanho = 44 }: { especie: Especie; tamanho?: number }) {
  const { fonte } = useImagens();
  const [falhou, setFalhou] = useState(false);
  const url = falhou ? null : spriteUrl({ spriteId: especie.spriteId }, fonte);
  /*
   * A cor vem da ESPECIE, com o tipo de reserva — a mesma conta do web, agora
   * em `packages/core`. O selo do Mewtwo saia rosa porque Psiquico e rosa;
   * agora sai lavanda, que e a cor dele.
   */
  const { fundo, tinta } = seloDaEspecie(
    especie.spriteId,
    CORES[especie.types[0] ?? ""] ?? RESERVA,
  );
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
        overflow: "hidden",
      }}
    >
      <Text style={{ color: tinta, fontWeight: "800", fontSize: Math.round(tamanho * 0.27) }}>
        {monograma(especie.name)}
      </Text>
      {url && (
        <Image
          source={{ uri: url }}
          onError={() => setFalhou(true)}
          resizeMode="contain"
          style={{
            position: "absolute",
            width: tamanho,
            height: tamanho,
            borderRadius: Math.round(tamanho / 3),
          }}
        />
      )}
    </View>
  );
}
