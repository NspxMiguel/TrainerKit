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

interface Entrada {
  /** As cores, em ordem de área ocupada. */
  c: string[];
  /** A caixa justa da silhueta na arte: `[esq, topo, dir, base]`, de 0 a 1. */
  b: [number, number, number, number];
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
export function enquadrar(spriteId: number | null): { escala: number; deslocaY: number } {
  const e = spriteId == null ? undefined : CORES[String(spriteId)];
  const b = e?.b;
  if (!b) return { escala: 1, deslocaY: 0 };

  const alturaJusta = b[3] - b[1];
  const larguraJusta = b[2] - b[0];
  if (alturaJusta <= 0 || larguraJusta <= 0) return { escala: 1, deslocaY: 0 };

  // O quanto ampliar pra silhueta ocupar a caixa como se não houvesse folga.
  // Limitado pelo eixo mais apertado, senão o bicho vaza pelas laterais.
  const escala = Math.min(1.45, Math.min(1 / alturaJusta, 1 / larguraJusta));

  /*
   * ⚠️ ALINHA O TOPO DA SILHUETA, e não o centro dela.
   *
   * Centralizar deixava o rosto no meio da caixa — que é exatamente onde o nome
   * passa. E quanto mais baixo e largo o bicho, mais o rosto subia pro centro:
   * o Charizard, cuja silhueta ocupa 71% do PNG, ficava com a cara bem na
   * linha do texto, enquanto o Dragonite (91%) não.
   *
   * Alinhando o topo, o rosto fica sempre na mesma altura, seja qual for a
   * proporção do bicho, e o nome sempre cruza a metade de baixo. Os 5% são a
   * respiração entre a cabeça e a borda de cima.
   *
   * A conta vale em fração da ALTURA DO ELEMENTO porque a arte é quadrada e a
   * caixa é mais larga que alta: com `object-fit: contain` a imagem renderizada
   * ocupa exatamente a altura, então fração da imagem e fração do elemento são
   * a mesma coisa.
   */
  return { escala, deslocaY: (0.05 - b[1] * escala) * 100 };
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

/** Os dois fundos do app. A conta de contraste é sempre contra um deles. */
const FUNDO_ESCURO = "#0a0c10";
const FUNDO_CLARO = "#ffffff";

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
  for (let i = 0; i < 60 && contraste(cor, fundo) < 4.5; i++) {
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
      `${paraHex(h, sv, 0.45)} 48%`,
      `${paraHex(h, Math.max(0.4, sv - 0.04), 0.56)} 72%`,
    ].join(", "),
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
  // Claro no foco, escuro na borda: é o que dá volume ao selo. As duas paradas
  // saem da MESMA matiz pra não virar um degradê de duas cores diferentes.
  const clara = paraHex(h, sv, Math.min(0.68, Math.max(0.5, l)));
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
  if (!topo) {
    for (const k of VARIAVEIS) raiz.style.removeProperty(k);
    return;
  }
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
