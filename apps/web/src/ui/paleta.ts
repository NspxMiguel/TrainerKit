import { useEffect, useMemo } from "react";

import tabela from "../dados/paleta.json";

/**
 * A paleta do app vem da ESPÉCIE em destaque.
 *
 * "o pokemon destaque, sempre altera a palheta de cores do app."
 *
 * A tabela é gerada uma vez em `packages/dataset/src/paleta.ts` e vem embutida
 * no pacote — ver lá o porquê de cada cor. Aqui só se faz a metade que o
 * gerador não pode fazer: transformar cor VERDADEIRA em cor USÁVEL.
 *
 * ── A diferença entre as duas, que é o trabalho deste arquivo ───────────────
 *
 * A tabela é honesta: o Mewtwo sai `#d5d0d9`, quase branco, porque o Mewtwo é
 * quase branco. Mas quase-branco não serve de tinta de texto sobre fundo claro,
 * nem de fundo atrás de texto branco. Se a cor crua fosse aplicada direto, cada
 * espécie de tom extremo — Mewtwo claro, Umbreon escuro — quebraria a leitura
 * de um jeito que nenhum teste estático pega, porque a cor só existe em tempo
 * de execução.
 *
 * Então cada cor crua gera derivadas com faixa de luminosidade garantida, e a
 * MATIZ é o que se preserva. É por isso que o Mewtwo continua lavanda pálido e
 * o Dragonite continua laranja: o que muda é o quanto, nunca o qual.
 *
 * ⚠️ O QUE A PALETA **NÃO** PINTA, e por quê:
 *
 *   · o violeta Ultra do botão primário e da aba ativa. Ele é a marca de AÇÃO
 *     DO APP — se mudasse junto, "o que é toque" passaria a depender de qual
 *     bicho está em destaque, e a pessoa perderia a única pista estável de
 *     onde tocar.
 *   · as cores de veredito (verde/violeta/âmbar/cinza). Elas SÃO o significado:
 *     "Investir" verde num bicho e azul noutro não é tema, é ruído.
 *
 * A paleta entra onde a cor é decorativa. Isso é o contrário de "trocar tudo" —
 * é trocar o que pode mudar sem custar leitura.
 */

type Caixa = [number, number, number, number];

interface Entrada {
  /** As cores, em ordem de área ocupada. Sempre da arte oficial. */
  c: string[];
  /** Caixa justa da silhueta na ARTE OFICIAL: `[esq, topo, dir, base]`, 0 a 1. */
  b: Caixa;
  /** Caixa justa nos RENDERS 3D. Ausente quando a espécie só tem arte oficial. */
  h?: Caixa;
  /** Linha da barriga na arte oficial, 0,62 a 0,95. Ver `Quadro.barriga`. */
  v: number;
  /** Idem, no render 3D. */
  w?: number;
}

const CORES = tabela as unknown as Record<string, Entrada>;

/**
 * O enquadramento do sprite, calculado a partir da caixa justa.
 *
 * ⚠️ Isto existe porque a arte oficial NÃO enquadra os Pokémon de forma
 * consistente, e foi o Miguel que apontou: "olha ai, por exemplo o charizard,
 * n combino. tem q testar pokemon por pokemon, pra sempre dar certo."
 *
 * Medido nas 1.142 artes: a silhueta do Dragonite ocupa 91% da altura do PNG,
 * a do Charizard 71%. Renderizados na MESMA caixa com `object-fit: contain`, um
 * aparece 22% menor que o outro e mais alto — porque o que está sendo encaixado
 * é o arquivo, e não o bicho.
 *
 * Com a caixa justa dá pra desfazer isso: `escala` desfaz a folga da arte e
 * `deslocaY` recentra a silhueta. O resultado é que TODOS ocupam o mesmo
 * retângulo na tela, e aí uma única posição de nome serve para todos — em vez
 * de eu acertar num e quebrar noutro.
 *
 * ⚠️ A escala é limitada a 1,45. Sem teto, uma arte com silhueta minúscula
 * (Joltik, algumas formas) seria ampliada até virar borrão: o PNG tem resolução
 * fixa, e esticar 3× mostra o pixel. Melhor um bicho pequeno nítido que um
 * grande borrado.
 */
export interface Quadro {
  /** Largura da silhueta, em fração da arte. */
  larg: number;
  /** Altura da silhueta, em fração da arte. */
  alt: number;
  /** Onde a silhueta começa no topo, em fração da arte. */
  topo: number;
  /** Centro horizontal da silhueta, em fração da arte. `0.5` = centrada. */
  centroX: number;
  /**
   * A LINHA DA BARRIGA: que fração da silhueta, do topo pra baixo, é "a cara".
   *
   * "a cara e a parte da barriga pra cima." Medida por espécie no gerador (ver
   * `dataset/src/paleta.ts`), porque uma fração única não serve às 1.142: num
   * Machamp a perna começa em 60% da altura, num Venusaur agachado o corpo vai
   * até 82%, e num Snorlax é corpo até o chão.
   *
   * Fica entre 0,62 e 0,95.
   */
  barriga: number;
}

/**
 * As medidas da silhueta dentro da arte. **A conta de layout fica no CSS.**
 *
 * ⚠️ Esta função já devolveu `escala` e `deslocaY` prontos, e isso estava
 * errado de um jeito que só apareceu varrendo as 1.142.
 *
 * O erro: pra calcular a escala eu precisava saber quanta largura sobrava na
 * caixa, e assumi que sobrava o mesmo que a altura — ou seja, tratei a caixa
 * como quadrada. Ela não é: no aparelho medido tem 339×237. Resultado: **527
 * espécies, 46% do total, saíam menores do que cabiam**, porque eu limitava a
 * largura contra 237px em vez de 339. Iron Hands aparecia com 158px de altura
 * quando cabiam 224.
 *
 * Não dava pra consertar assando `339/237` aqui: essa proporção muda com o
 * aparelho e com a altura que a coluna deu ao hero, e um número fixo passaria a
 * ESTOURAR a largura num iPhone mais largo.
 *
 * Então a conta mudou de lugar. Aqui saem só os fatos medidos da arte; o CSS
 * resolve a geometria com unidades de contêiner (`cqw`/`cqh`), que são a
 * largura e a altura REAIS da caixa naquele aparelho, naquele momento.
 *
 * "testo com todos os pokemons ja? procura tudo po" — era isso que faltava
 * procurar.
 */
export function enquadrar(
  spriteId: number | null,
  /**
   * A fonte muda o enquadramento: a arte oficial é ilustração com margem
   * variável, os renders 3D do Pokémon HOME são capturas mais cheias no quadro.
   * Medido, Bulbasaur ocupa 85% da altura numa e 71% na outra.
   */
  fonte: "artwork" | "3d" = "artwork",
): Quadro {
  const e = spriteId == null ? undefined : CORES[String(spriteId)];
  // Cai na caixa da arte oficial quando a espécie não tem render 3D — são 2 das
  // 1.142. Enquadrar com a caixa vizinha erra pouco; não enquadrar erra o que
  // ele apontou no Charizard.
  const b = fonte === "3d" ? (e?.h ?? e?.b) : e?.b;
  // A barriga acompanha a MESMA fonte da caixa: as duas artes enquadram
  // diferente, então a mesma barriga cai em frações diferentes do quadro.
  const barriga = (fonte === "3d" ? (e?.w ?? e?.v) : e?.v) ?? 0.75;
  if (!b) return { larg: 1, alt: 1, topo: 0, centroX: 0.5, barriga };

  const larg = b[2] - b[0];
  const alt = b[3] - b[1];
  if (larg <= 0 || alt <= 0) return { larg: 1, alt: 1, topo: 0, centroX: 0.5, barriga };

  return { larg, alt, topo: b[1], centroX: (b[0] + b[2]) / 2, barriga };
}

export interface Paleta {
  /** As cores como elas são na arte, em ordem de área ocupada. */
  cruas: readonly string[];
  /** A cor principal, empurrada pra uma faixa que funciona como tinta. */
  base: string;
  /** A principal, clareada até passar 4,5:1 no tema escuro. */
  legivelEscuro: string;
  /** A principal, escurecida até passar 4,5:1 no tema claro. */
  legivelClaro: string;
  /** A segunda cor, usável — é ela que faz o brilho e os detalhes. */
  segunda: string;
  /**
   * A tinta que se lê EM CIMA de `base`: quase-preto ou branco, o que contrastar.
   *
   * ⚠️ Isto passou a ser obrigatório quando o botão primário virou a cor da
   * espécie. O botão sempre teve texto branco, porque o violeta Ultra é escuro
   * (`#5b3df5`, luminância 0,10) e branco sobre ele dá 7,6:1. Mas a cor da
   * espécie pode ser clara: o laranja do Dragonite é `#faa642`, luminância
   * 0,49, e branco em cima dá **1,9:1** — o botão mais importante do app viraria
   * ilegível no sol, que é exatamente onde ele é usado.
   *
   * Escolher a tinta pela luminância resolve para as 1.142 espécies de uma vez,
   * em vez de dar certo no Dragonite e quebrar no Pikachu.
   */
  tinta: string;
  /**
   * A cor do TOPO DA TELA: a primeira parada do gradiente, isolada.
   *
   * "faz a cor subir ate o topo da tela." A faixa acima do hero — onde vive a
   * saudação — passa a ser pintada com ela, e é por isso que a cor precisa sair
   * daqui em vez de o CSS tentar ler a primeira parada da lista: não há como
   * fatiar uma variável de gradiente em CSS.
   *
   * Ela é escura de propósito (claridade 0,22), e isso não é estética: é o que
   * garante que a saudação passe em contraste nas 1.142 espécies, inclusive nas
   * amarelas e brancas. O `paleta.test.ts` cobra isso espécie por espécie.
   */
  topo: string;
  /** A tinta que se lê sobre `topo`. Escolhida por luminância, como `tinta`. */
  topoTinta: string;
  /**
   * As três paradas do fundo do hero, COM POSIÇÃO — `#x 0%, #y 48%, #z 72%`.
   *
   * A posição vem junto porque o handoff a especifica, e porque o CSS não
   * conseguiria inseri-la: a variável entra numa `linear-gradient()` como lista
   * pronta, e não há como intercalar porcentagens entre itens de uma lista.
   */
  gradiente: string;
  /**
   * As mesmas três paradas, mas CLARAS — o hero do tema claro.
   *
   * ⚠️ "faz o degrade ser branco no modo claro ne...."
   *
   * O hero era escuro nos dois temas, por uma decisão minha que estava escrita
   * no CSS com todas as letras ("como capa de álbum em app de música, que
   * também não clareia junto com o tema"). O argumento não é errado em geral —
   * é errado AQUI: o hero deste app ocupa metade da tela inicial, e um painel
   * quase preto no meio de uma tela branca não lê como capa, lê como um buraco.
   *
   * Então a espécie continua mandando na cor, e o TEMA manda na claridade.
   */
  gradienteClaro: string;
  /** A cor do topo da tela no tema claro. Pálida, pra saudação escura passar. */
  topoClaro: string;
  /** A tinta que se lê sobre `topoClaro`. */
  topoClaroTinta: string;
}

// ---------------------------------------------------------------- conversão

function paraHsl(hexa: string): [number, number, number] {
  const n = parseInt(hexa.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return [h < 0 ? h + 360 : h, s, l];
}

function paraHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  return `#${[r, g, b]
    .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function luminancia(hexa: string): number {
  const n = parseInt(hexa.slice(1), 16);
  const canal = (v: number) => {
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

/**
 * Os dois fundos do app. A conta de contraste é sempre contra um deles.
 *
 * ⚠️ O claro é `#f1f3f8`, e NÃO branco puro. A diferença parece irrelevante e
 * não é: o app quase nunca pinta `#fff` — as superfícies claras são
 * `--tk-surface-2` (`#f1f3f8`), e a barra de abas fica ainda um pouco mais
 * escura por causa da mistura com o acento.
 *
 * Mirar em branco deixava a conta otimista: `#3b8084` passava 4,5 contra `#fff`
 * e chegava a **4,11 contra a superfície real** — reprovado. Medi na tela, não
 * no papel.
 *
 * A margem de 4,7 (e não 4,5 cravado) cobre o resto da variação: o veu de cor
 * da espécie e o vidro da barra escurecem a superfície mais um pouco, e cada
 * espécie escurece um tanto diferente.
 */
const FUNDO_ESCURO = "#0a0c10";
const FUNDO_CLARO = "#f1f3f8";
const ALVO = 4.7;

/**
 * O teto de luminância das paradas do gradiente do hero.
 *
 * ⚠️ LUMINÂNCIA, e não claridade — e essa distinção é o defeito inteiro.
 *
 * O nome do Pokémon é branco e fica sobre o gradiente. Eu limitava as paradas
 * por claridade HSL (0,45 e 0,56), o que parece uniforme e não é: amarelo em
 * `l = 0.56` tem quase o triplo da luminância de azul na mesma claridade,
 * porque o olho (e a fórmula da WCAG) pesa verde e vermelho muito mais que
 * azul.
 *
 * Resultado da varredura: **152 espécies** com o nome reprovando — Bellsprout
 * em 1,73:1, Abra em 2,04, Pikachu em 2,73. Todas amarelas ou verde-claras.
 * Nenhuma azul ou roxa falhou, que é por que nunca apareceu nos meus testes:
 * Dragonite, Bulbasaur, Mewtwo e Venusaur passam todos.
 *
 * 0,30 é o que garante 3:1 para o nome, que é texto grande (38px/800). O texto
 * pequeno do hero não fica aqui — ele vive sobre o véu escuro da base.
 */
const TETO_LUZ_HERO = 0.3;

/**
 * As três paradas do hero CLARO, com PISO e TETO de luminância em cada uma.
 *
 * ⚠️ A versão anterior tinha só piso (0,42) e meia saturação, e o resultado foi
 * o que ele viu: **"nooooosa, fico muito paia isso no modo claro, degrade
 * sumiu, o fundo, tudo"**. Estava tudo lá — só que tão pálido que as três
 * paradas caíam praticamente na mesma cor, e um gradiente sem variação é um
 * retângulo.
 *
 * O erro de projeto foi meu, e está escrito na nota que eu mesmo deixei:
 * "pálido é o que faz ele ler como 'a tela é branca, com a cor do bicho'".
 * Isso vale pra faixa do topo, que é onde a saudação mora. Não vale pro hero
 * inteiro, que ocupa metade da tela e é o retrato do Pokémon — ali a cor é o
 * assunto.
 *
 * Por que PISO **E** TETO, e não só um dos dois:
 *
 *  · O piso protege a leitura. O nome é quase-preto (`#141920`, luminância
 *    0,0104): 3:1 pede L ≥ 0,131, e o texto pequeno do rodapé pede 0,29. Os
 *    pisos abaixo ficam acima dos dois.
 *  · O teto garante que a cor APAREÇA. Sem ele, amarelo e verde-claro sobem
 *    sozinhos: `l = 0,68` num amarelo dá luminância 0,75, quase branco. Era
 *    exatamente esse o buraco — as espécies claras perdiam o degradê inteiro, e
 *    são muitas.
 *
 * As claridades (0,93 / 0,80 / 0,68) espelham as do tema escuro; o que inverte
 * é a direção da rampa de luminância.
 */
const HERO_CLARO = [
  { l: 0.93, sat: 0.5, piso: 0.66, teto: 0.9 },
  { l: 0.74, sat: 1.25, piso: 0.36, teto: 0.52 },
  /*
   * ⚠️ O piso desta é 0,28, e não 0,22 como eu tinha posto — o teste
   * "não escurece a ponto de virar o tema escuro" reprovou na hora.
   *
   * 0,22 dá 3:1 pro nome (texto grande) e passaria nos testes de contraste,
   * mas a FRASE embaixo do nome é texto pequeno e pede 4,5:1, ou seja
   * luminância ≥ 0,29 sem contar com ajuda do véu. Como o véu do tema claro
   * também enfraqueceu nesta mesma leva, contar com ele seria trocar uma
   * garantia por uma coincidência.
   */
  { l: 0.58, sat: 1.6, piso: 0.28, teto: 0.4 },
] as const;

/*
 * ⚠️ A SATURAÇÃO SOBE ACIMA DE 1 nas paradas de baixo, e isso não é engano.
 *
 * Cor sobre fundo claro precisa de mais croma pra ler como cor. O mesmo verde
 * do Bulbasaur (`#46a280`) salta sobre preto e some sobre branco — é o fundo
 * que muda o quanto do croma o olho aproveita, não a cor.
 *
 * O `Math.min(0.95, …)` continua valendo lá embaixo, então uma espécie
 * dessaturada (Mewtwo, os cinzas) NÃO vira colorida: 1,35 × quase-nada continua
 * quase-nada. O multiplicador devolve croma a quem tem, sem inventar pra quem
 * não tem — que é a mesma regra do `sv` lá em cima.
 */

/** Sobe a claridade até a cor alcançar o piso de luminância, preservando a matiz. */
function clarearAte(h: number, s: number, l: number, piso: number): string {
  let atual = l;
  let cor = paraHex(h, s, atual);
  for (let i = 0; i < 60 && luminancia(cor) < piso; i++) {
    atual += 0.015;
    if (atual > 0.97) break;
    cor = paraHex(h, s, atual);
  }
  return cor;
}

/**
 * Encaixa a cor numa FAIXA de luminância, preservando a matiz.
 *
 * Sobe se estiver abaixo do piso, desce se estiver acima do teto, e não mexe
 * quando já cabe — que é o caso da maioria das espécies. Andar nos dois
 * sentidos é o que permite pedir "clara, mas não branca": com um limite só,
 * metade das matizes escapa pelo outro lado.
 */
function entre(h: number, s: number, l: number, piso: number, teto: number): string {
  let atual = l;
  let cor = paraHex(h, s, atual);
  for (let i = 0; i < 80; i++) {
    const luz = luminancia(cor);
    if (luz >= piso && luz <= teto) break;
    atual += luz < piso ? 0.012 : -0.012;
    if (atual > 0.99 || atual < 0.02) break;
    cor = paraHex(h, s, atual);
  }
  return cor;
}

/** Baixa a claridade até a cor caber no teto de luminância, preservando a matiz. */
function escurecerAte(h: number, s: number, l: number, teto: number): string {
  let atual = l;
  let cor = paraHex(h, s, atual);
  for (let i = 0; i < 60 && luminancia(cor) > teto; i++) {
    atual -= 0.015;
    if (atual < 0.06) break;
    cor = paraHex(h, s, atual);
  }
  return cor;
}

/**
 * Empurra uma cor até ela passar em 4,5:1 contra o fundo dado.
 *
 * ⚠️ Anda numa direção só, escolhida pelo fundo: sobre fundo escuro clareia,
 * sobre fundo claro escurece. O caminho contrário existe matematicamente — dá
 * pra escurecer uma cor até ela contrastar com o preto — mas passaria pelo meio,
 * onde nada contrasta com nada, e sairia do outro lado como uma cor que já não
 * lembra o bicho de onde veio.
 */
function ateLegivel(h: number, s: number, l: number, fundo: string): string {
  const claro = fundo === FUNDO_ESCURO;
  let atual = l;
  let cor = paraHex(h, s, atual);
  for (let i = 0; i < 60 && contraste(cor, fundo) < ALVO; i++) {
    atual += claro ? 0.02 : -0.02;
    if (atual > 0.96 || atual < 0.04) break;
    cor = paraHex(h, s, atual);
  }
  return cor;
}

const vazia: Paleta = {
  cruas: [],
  base: "#8e96a6",
  tinta: "#0a0c10",
  topo: "#171a20",
  topoTinta: "#ffffff",
  legivelEscuro: "#aab2c0",
  legivelClaro: "#4b5364",
  segunda: "#6b7280",
  gradiente: "#171a20 0%, #3a404b 48%, #5c6472 72%",
  gradienteClaro: "#f4f5f8 0%, #e2e5ea 48%, #d4d8e0 72%",
  topoClaro: "#f4f5f8",
  topoClaroTinta: "#141920",
};

export function paletaDaEspecie(spriteId: number | null): Paleta {
  const cruas = spriteId == null ? undefined : CORES[String(spriteId)]?.c;
  if (!cruas || cruas.length === 0) return vazia;

  const [h, s, l] = paraHsl(cruas[0] ?? "#888888");
  const segundaCrua = cruas[1] ?? cruas[0] ?? "#888888";
  const [h2, s2] = paraHsl(segundaCrua);

  /*
   * A saturação sobe um pouco, mas com TETO PROPORCIONAL ao que já havia.
   *
   * A arte oficial é sombreada com muito meio-tom, então a média de um balde
   * sai lavada — o laranja do Dragonite dava `#f2b771`, que como tinta de
   * interface parece bege. Um empurrão de 15% devolve o que a média comeu.
   *
   * O teto é `s * 1.15` e não um valor fixo justamente pro Mewtwo: com piso
   * fixo, o cinza-lavanda dele viraria roxo saturado, que é exatamente o erro
   * que ele apontou. Cor sem saturação continua sem saturação.
   */
  const sv = Math.min(0.95, s * 1.15);
  const s2v = Math.min(0.95, s2 * 1.15);
  /*
   * ⚠️ A COR CHEIA CEDE ATÉ A TINTA PASSAR — e não o contrário.
   *
   * Escolher entre preto e branco pelo maior contraste resolve quase tudo, mas
   * o teste varreu as 1.142 espécies e achou **11** em que nem um nem outro
   * chega a 4,5:1: tons médios como `#9a713a` (Sandshrew) ficam em 4,47, que é
   * reprovado por três centésimos.
   *
   * Sozinho eu teria dado por resolvido no Dragonite. Meia dúzia de espécies
   * com o botão principal reprovando em contraste é justamente o tipo de coisa
   * que só aparece quando alguém abre AQUELE Pokémon — ou seja, nunca em teste
   * manual, e sempre em uso real.
   *
   * A saída é empurrar a claridade da cor cheia na direção contrária à tinta até
   * passar. Isso muda o tom em alguns por cento e preserva a matiz, que é o que
   * identifica o bicho; o contrário — trocar a tinta — daria texto cinza sobre
   * cor, que é pior nos dois quesitos.
   */
  const topoCor = paraHex(h, Math.min(0.95, sv + 0.06), 0.22);
  /*
   * As três paradas do hero CLARO, na faixa de luminância de cada uma.
   *
   * A primeira também é `topoClaro`: a faixa da saudação é pintada com ela pra
   * encontrar o hero SEM EMENDA, e se as duas saíssem de contas diferentes
   * voltaria a aparecer o fio horizontal que ele já circulou duas vezes.
   */
  const paradasClaras = HERO_CLARO.map((p) =>
    entre(h, Math.min(0.95, sv * p.sat), p.l, p.piso, p.teto),
  );
  const topoClaroCor = paradasClaras[0]!;
  let base = paraHex(h, sv, Math.min(0.62, Math.max(0.38, l)));
  const tinta = contraste(base, "#0a0c10") >= contraste(base, "#ffffff") ? "#0a0c10" : "#ffffff";
  {
    const claro = tinta === "#0a0c10"; // tinta escura pede fundo mais claro
    let lb = Math.min(0.62, Math.max(0.38, l));
    for (let i = 0; i < 40 && contraste(tinta, base) < 4.5; i++) {
      lb += claro ? 0.015 : -0.015;
      if (lb > 0.9 || lb < 0.1) break;
      base = paraHex(h, sv, lb);
    }
  }

  return {
    cruas,
    base,
    tinta,
    legivelEscuro: ateLegivel(h, sv, Math.min(0.72, Math.max(0.45, l)), FUNDO_ESCURO),
    legivelClaro: ateLegivel(h, sv, Math.min(0.55, Math.max(0.22, l)), FUNDO_CLARO),
    segunda: paraHex(h2, s2v, 0.55),
    /*
     * CLARO EM CIMA, ESCURO EMBAIXO — e essa ordem é uma correção.
     *
     * A primeira versão descia do escuro pro claro, seguindo o mockup. Só que
     * no mockup o nome do Pokémon fica no TOPO do cartão; aqui ele fica na
     * base, junto dos botões, e é branco. Gradiente clareando pra baixo põe
     * texto branco exatamente onde o fundo é mais claro.
     *
     * Invertido, a luz nasce atrás da cabeça do bicho e a base afunda no escuro
     * — que é de onde o texto precisa de contraste, e de quebra é como a luz se
     * comporta de verdade.
     */
    /*
     * ⚠️ ESCURO EM CIMA, CLARO EMBAIXO — a forma do handoff, restaurada.
     *
     * "nao gostei desse novo degrade, o do claude desing ta melhor ainda."
     *
     * Eu tinha INVERTIDO o desenho dele por um motivo que parecia bom: o nome
     * do Pokémon é branco e fica na base, então clarear pra baixo põe texto
     * branco onde o fundo é mais claro.
     *
     * O erro foi tratar o gradiente como se ele trabalhasse sozinho. No handoff
     * ele nunca trabalha: vem sempre com o scrim por cima, que escurece de 78%
     * pra baixo justamente pra devolver o contraste. Invertendo, eu resolvi um
     * problema que o scrim já resolvia e paguei com a única coisa que o desenho
     * dele tinha e o meu não — a luz crescendo, que é o que faz o cartão parecer
     * iluminado em vez de esmaecido.
     *
     * As claridades espelham as paradas de tipo do handoff (Fogo:
     * #7C2D12 → #EA580C → #F97316, ou l 0,28 → 0,48 → 0,52).
     *
     * A POSIÇÃO vem junto (`0% / 48% / 72%`) porque o CSS não conseguiria
     * inseri-la: a variável entra na `linear-gradient()` como lista pronta, e
     * não há como intercalar porcentagens entre itens de uma lista.
     */
    topo: topoCor,
    topoTinta: contraste(topoCor, "#ffffff") >= contraste(topoCor, "#0a0c10") ? "#ffffff" : "#0a0c10",
    gradiente: [
      `${topoCor} 0%`,
      `${escurecerAte(h, sv, 0.45, TETO_LUZ_HERO)} 48%`,
      `${escurecerAte(h, Math.max(0.4, sv - 0.04), 0.56, TETO_LUZ_HERO)} 72%`,
    ].join(", "),
    /*
     * O MESMO desenho, espelhado pro tema claro — e agora COM COR.
     *
     * A ordem das paradas se mantém (mais claro em cima, cor crescendo pra
     * baixo): é a forma do handoff, e é a que faz a luz nascer atrás da cabeça
     * do Pokémon. O que mudou foi a AMPLITUDE — ver `HERO_CLARO`.
     */
    gradienteClaro: paradasClaras
      .map((cor, i) => `${cor} ${[0, 48, 72][i]}%`)
      .join(", "),
    topoClaro: topoClaroCor,
    topoClaroTinta:
      contraste(topoClaroCor, "#141920") >= contraste(topoClaroCor, "#ffffff")
        ? "#141920"
        : "#ffffff",
  };
}

/**
 * O gradiente do selo de monograma, na cor da ESPÉCIE.
 *
 * "inclusive, mesmo sem sprite, o famoso DR pra qm nao ta com os sprites
 * ativos, tem q aparecer a cor do pokemon."
 *
 * O selo era pintado pelo TIPO, e é justamente aí que o exemplo dele mordia: o
 * "MW" do Mewtwo saía rosa-avermelhado, porque Psíquico é rosa na paleta de
 * tipos. Agora sai lavanda pálido, que é a cor do bicho — e o modo sem imagem
 * deixa de ser o modo sem identidade.
 *
 * A geometria (radial, foco em 32%/24%) é a mesma de antes: o que mudou foi de
 * onde vêm as duas cores, não como elas são dispostas.
 *
 * ⚠️ Cai no tipo quando a espécie não tem paleta — e isso não é hipótese: são
 * as 5 entradas sem arte na tabela, mais qualquer dataset customizado cujo
 * `spriteId` não exista no índice do PokeAPI.
 */
export function gradienteDaEspecie(
  spriteId: number | null,
  reserva: string,
): string {
  const cruas = spriteId == null ? undefined : CORES[String(spriteId)]?.c;
  if (!cruas || cruas.length === 0) return reserva;

  const [h, s, l] = paraHsl(cruas[0] ?? "#888888");
  const sv = Math.min(0.95, s * 1.15);
  /*
   * ⚠️ O FOCO CEDE LUMINÂNCIA ATÉ O MONOGRAMA CABER.
   *
   * O selo leva o monograma ("BU", "CH") em branco, e o foco do radial é a
   * parte mais clara dele. A varredura achou **671 espécies de 1.142 — 59% —**
   * com esse texto reprovando: Charmander em 2,08:1, Caterpie em 2,11.
   *
   * Eu nunca tinha medido porque o monograma só aparece com a fonte de imagens
   * desligada ou enquanto o sprite carrega — some rápido, e some justamente
   * enquanto quem testa está olhando.
   *
   * 0,183 de luminância é o que dá 4,5:1 pro branco. O monograma é texto
   * PEQUENO (13px num selo de 48), então não vale o limite frouxo de 3:1 que o
   * nome grande do hero usa.
   */
  const clara = escurecerAte(h, sv, Math.min(0.68, Math.max(0.5, l)), 0.183);
  const escura = paraHex(h, Math.min(0.95, sv + 0.06), 0.26);
  return `radial-gradient(72% 72% at 32% 24%, ${clara} 0%, ${escura} 100%)`;
}

const VARIAVEIS = [
  "--tk-c1",
  "--tk-c2",
  "--tk-c3",
  "--tk-accent",
  "--tk-accent-ink",
  "--tk-accent-topo",
  "--tk-accent-topo-ink",
  "--tk-accent-2",
  "--tk-accent-fg-escuro",
  "--tk-accent-fg-claro",
  "--tk-accent-grad",
  /*
   * As versões CLARAS. Escritas SEMPRE, junto das escuras, e é o CSS que decide
   * qual vale — pelo mesmo motivo de `--tk-accent-fg-escuro`/`-claro`: só o JS
   * sabe fazer a conta de contraste, só o CSS sabe qual tema está valendo, e
   * assim não há ouvinte de `prefers-color-scheme` em JS pra dessincronizar.
   */
  "--tk-accent-grad-claro",
  "--tk-accent-topo-claro",
  "--tk-accent-topo-claro-ink",
] as const;

/**
 * ⚠️ UMA PILHA, e não cada tela escrevendo por cima da outra.
 *
 * O `<html>` é um recurso compartilhado: a home pinta o app com o Pokémon em
 * destaque, e a ficha da espécie, aberta por cima, pinta com o Pokémon aberto.
 * Com dois `useEffect` independentes isso quebra na SAÍDA, não na entrada — a
 * ficha fecha, sua limpeza apaga as variáveis, e o efeito da home não roda de
 * novo porque as dependências dela não mudaram. O app voltaria pra home sem
 * cor nenhuma, e o defeito só apareceria depois de abrir e fechar uma folha.
 *
 * A pilha desfaz isso: quem monta empilha, quem desmonta desempilha, e o topo é
 * sempre reaplicado. Fechar a ficha devolve a cor da home sozinho.
 */
const pilha: Paleta[] = [];

function aplicarTopo() {
  const raiz = document.documentElement;
  const topo = pilha[pilha.length - 1];
  /*
   * ⚠️ PILHA VAZIA MANTEM A ULTIMA COR, e nao apaga.
   *
   * "o pokemon destaque, sempre altera a palheta de cores do app."
   *
   * O hero vive na home, e a `App` remonta a tela a cada troca de aba
   * (`key={tab}`). Entao ao ir pra Pokedex ou Ajustes a pilha esvaziava, as
   * variaveis eram removidas e o app voltava pro amarelo de reserva — a aba
   * ativa aparecia LARANJA no meio de um app azul-esverdeado do Ivysaur.
   *
   * A cor e do APP, e nao daquela tela. Sem destaque nenhum ela continua sendo
   * a ultima valida, que e o que a pessoa acabou de ver.
   */
  if (!topo) return;
  const valores: Record<(typeof VARIAVEIS)[number], string> = {
    "--tk-c1": topo.cruas[0] ?? topo.base,
    "--tk-c2": topo.cruas[1] ?? topo.cruas[0] ?? topo.base,
    "--tk-c3": topo.cruas[2] ?? topo.cruas[1] ?? topo.cruas[0] ?? topo.base,
    "--tk-accent": topo.base,
    "--tk-accent-ink": topo.tinta,
    "--tk-accent-topo": topo.topo,
    "--tk-accent-topo-ink": topo.topoTinta,
    "--tk-accent-2": topo.segunda,
    "--tk-accent-fg-escuro": topo.legivelEscuro,
    "--tk-accent-fg-claro": topo.legivelClaro,
    "--tk-accent-grad": topo.gradiente,
    "--tk-accent-grad-claro": topo.gradienteClaro,
    "--tk-accent-topo-claro": topo.topoClaro,
    "--tk-accent-topo-claro-ink": topo.topoClaroTinta,
  };
  for (const k of VARIAVEIS) raiz.style.setProperty(k, valores[k]);
}

/**
 * Escreve a paleta no `<html>`.
 *
 * As variáveis vão na raiz, e não no hero — é o que faz a cor ESCAPAR do cartão
 * e alcançar o resto da interface, que é o pedido. Quem quiser usá-la escreve
 * `var(--tk-c1)` em qualquer lugar.
 */
export function usarPaleta(spriteId: number | null): Paleta {
  const paleta = useMemo(() => paletaDaEspecie(spriteId), [spriteId]);

  useEffect(() => {
    pilha.push(paleta);
    aplicarTopo();
    return () => {
      const i = pilha.lastIndexOf(paleta);
      if (i >= 0) pilha.splice(i, 1);
      aplicarTopo();
    };
  }, [paleta]);

  return paleta;
}
