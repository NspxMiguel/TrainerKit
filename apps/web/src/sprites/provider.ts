import { getSpriteSettings, type SpriteSettings } from "./settings.ts";

/**
 * Camada de sprite — resolvida em runtime pela configuracao.
 *
 * Nenhum componente de UI monta URL por conta propria: todos pedem aqui. Isso e
 * o que permite o app ser distribuido sem arte nenhuma e ainda assim mostrar
 * imagem completa pra quem liga a fonte nos Ajustes.
 *
 * O tile de monograma nao e "o modo sem imagem": ele e o estado de carga e o
 * fallback de qualquer especie sem arquivo, em qualquer fonte.
 */

const POKEAPI = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

export interface SpriteRequest {
  /**
   * Id do sprite resolvido no ETL contra o indice do PokeAPI. Nao e a dex: as
   * formas regionais vivem na faixa 10000+ e nao seguem formula (Rattata de
   * Alola e 10091, Raichu de Alola e 10100).
   */
  spriteId: number | null;
  dex: number;
  shiny?: boolean;
}

/** URL do sprite, ou `null` quando a fonte esta desligada ou nao tem arte. */
export function spriteUrl(
  req: SpriteRequest,
  settings: SpriteSettings = getSpriteSettings(),
): string | null {
  if (settings.source === "off") return null;
  if (req.spriteId === null) return null;

  const shiny = req.shiny ? "/shiny" : "";

  switch (settings.source) {
    case "pokeapi-artwork":
      return `${POKEAPI}/other/official-artwork${shiny}/${req.spriteId}.png`;

    case "pokeapi-home":
      return `${POKEAPI}/other/home${shiny}/${req.spriteId}.png`;

    // Fontes adicionadas pelo usuario ("src:<uuid>") sao resolvidas em
    // `useSpriteUrl`, porque um .zip exige leitura assincrona do IndexedDB.
    default:
      return null;
  }
}

// ---------------------------------------------------------------- monograma

/**
 * Cor por tipo. Nao sao as cores do jogo — sao uma paleta propria, escolhida
 * para funcionar sobre fundo claro e escuro.
 *
 * ⚠️ AQUI DIZIA "e manter o contraste do texto branco por cima", e isso era
 * FALSO. Nunca tinha sido medido. Medindo as 19 cores contra branco:
 *
 *   electric 1,63   ice 1,74   flying 2,03   fairy 2,04   bug 2,07
 *   steel 2,10      normal 2,19  ground 2,20  grass 2,21   rock 2,40
 *   water 2,54      psychic 2,55 fire 2,65    fallback 2,97
 *   poison 3,43     ghost 3,65   fighting 3,71  dragon 4,19
 *
 * DEZOITO das 19 reprovam os 4,5:1 — a etiqueta "Planta" na ficha da especie
 * saia com 2,21. So `dark` (4,98) passava. O comentario afirmava a garantia que
 * o codigo nao dava, que e o pior tipo de comentario que existe: ele impede a
 * pergunta.
 *
 * A tinta agora e escolhida por luminancia (ver `typeInk`), como `ui/paleta.ts`
 * ja fazia pro botao primario. E `contraste.test.ts` cobra as 19.
 */
const TYPE_COLORS: Record<string, readonly [string, string]> = {
  normal: ["#B4AFA3", "#6E6A61"],
  fighting: ["#D4633F", "#7A2B1B"],
  flying: ["#9FB6E8", "#4E5F8C"],
  poison: ["#B173C4", "#5C2E70"],
  ground: ["#D9A65E", "#7E5A22"],
  rock: ["#B8A583", "#6B5C3E"],
  bug: ["#A9BE4A", "#57661D"],
  ghost: ["#8A7CC4", "#443A73"],
  steel: ["#A9B4C0", "#5A646F"],
  fire: ["#F0813F", "#8C3A10"],
  water: ["#5BA8EE", "#1E568C"],
  grass: ["#6FC163", "#2A6B29"],
  electric: ["#F0C63F", "#8A6A0B"],
  psychic: ["#EE7FA6", "#8C2A50"],
  ice: ["#79D2DC", "#2A6E77"],
  /*
   * ⚠️ Clareado de `#7A6BE0`, e por medicao.
   *
   * Era a UNICA cor em que nenhuma das duas tintas alcancava 4,5:1 — branco
   * dava 4,19 e a tinta escura 4,21, as duas logo abaixo do minimo.
   *
   * 6% de branco por cima levam a tinta escura a 4,66. Parei em 6 e nao em 4
   * (que dava 4,4996 e reprovava por arredondamento) porque um limiar sem folga
   * quebra na proxima vez que alguem mexer num digito da cor.
   */
  dragon: ["#8274E2", "#362B84"],
  dark: ["#7C6D62", "#3B322C"],
  fairy: ["#EE9DC6", "#8C3F68"],
};

const FALLBACK_COLORS = ["#8E96A6", "#454C5A"] as const;

/** Gradiente do tile de reserva, na cor do tipo primario. */
export function typeGradient(types: readonly string[]): string {
  const [from, to] = TYPE_COLORS[types[0] ?? ""] ?? FALLBACK_COLORS;
  return `radial-gradient(72% 72% at 32% 24%, ${from} 0%, ${to} 100%)`;
}

/** Cor solida do tipo, para chips e etiquetas. */
export function typeColor(type: string): string {
  return (TYPE_COLORS[type] ?? FALLBACK_COLORS)[0];
}

/**
 * A tinta que fica LEGIVEL sobre a cor do tipo.
 *
 * ⚠️ Escolhida por LUMINANCIA, e nao fixa em branco. Dezoito das 19 cores de
 * tipo reprovam 4,5:1 com texto branco — ver a nota da tabela.
 *
 * A luminancia da WCAG pesa verde e vermelho muito mais que azul, entao "parece
 * escura" nao serve de criterio: o amarelo de Eletrico tem quase o triplo da
 * luminancia de um azul da mesma claridade. Foi exatamente esse engano que
 * produziu 823 reprovacoes na paleta por especie, e o conserto la foi este
 * mesmo — medir em vez de olhar.
 *
 * A tinta escura vence em 18 das 19; `dark` (`#7C6D62`) e a unica em que o
 * branco ganha.
 */
const TINTA_ESCURA = "#141920";

function luminancia(hexa: string): number {
  const n = parseInt(hexa.slice(1), 16);
  const canal = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * canal((n >> 16) & 255) +
    0.7152 * canal((n >> 8) & 255) +
    0.0722 * canal(n & 255)
  );
}

function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return la > lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}

export function typeInk(type: string): string {
  const fundo = typeColor(type);
  return contraste("#ffffff", fundo) >= contraste(TINTA_ESCURA, fundo)
    ? "#ffffff"
    : TINTA_ESCURA;
}

/** Todos os tipos que a tabela conhece — o teste de contraste varre por aqui. */
export const TYPE_NAMES: readonly string[] = Object.keys(TYPE_COLORS);


/**
 * Chave de traducao do tipo.
 *
 * Os nomes viviam num mapa em portugues aqui dentro, e por isso o app em
 * ingles mostrava "Lutador" e "Voador" — apareceu no site publicado, nao no
 * dev. Agora e chave, e o texto mora no dicionario como todo o resto.
 */
export function typeKey(type: string): string {
  return `type.${type}`;
}

/**
 * Monograma de duas letras.
 *
 * Usa o nome de exibicao, entao "Rattata (Alola)" vira "RA" e nao "RA(" — o
 * corte ignora tudo que nao for letra.
 */
export function monogram(name: string): string {
  const letters = name.replace(/[^\p{L}]/gu, "");
  return letters.slice(0, 2).toUpperCase();
}
