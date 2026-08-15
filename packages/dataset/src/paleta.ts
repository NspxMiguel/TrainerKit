/**
 * A paleta de cada espécie — as cores DO BICHO, geradas aqui e embutidas no
 * dataset.
 *
 * ── Por que isto existe ─────────────────────────────────────────────────────
 *
 * "quando digo a cor do pokemon, nao pegar do sprite. inclusive, mesmo sem
 * sprite, o famoso DR pra qm nao ta com os sprites ativos, tem q aparecer a cor
 * do pokemon. tipo o mewtwo n é vermelho. ele é um branco misturado com roxo."
 *
 * Duas correções numa frase só, e as duas certas:
 *
 *  1. **A cor não pode vir do TIPO.** Mewtwo é Psíquico, e a paleta de tipo
 *     pinta Psíquico de rosa-avermelhado. Mewtwo não é vermelho. Tipo é
 *     taxonomia — não diz nada sobre a aparência.
 *
 *  2. **A cor não pode depender de a imagem estar carregada.** Eu vinha lendo
 *     o sprite no canvas em tempo de execução, o que amarrava a identidade
 *     visual do app a um download opcional: com a fonte de imagens desligada
 *     (o tile "DR" de monograma), o app ficava sem cor nenhuma. A cor é um
 *     FATO da espécie, e fato se guarda em tabela.
 *
 * Então o trabalho de olhar a arte acontece **aqui**, uma vez, na máquina de
 * quem constrói — e o app recebe só uma lista de hexadecimais.
 *
 * ⚠️ Isto **não** coloca arte no pacote, e a distinção importa por causa da
 * auditoria de bundle: o que é distribuído são valores de cor, que são fato
 * mensurável, e não a obra. Nenhum pixel de arte de terceiro é redistribuído.
 * A arte é lida da rede, aqui, e descartada.
 *
 * ── Por que três cores, e não uma ───────────────────────────────────────────
 *
 * "o dragonitte, ele tem predominancia laranja, entao maior parte do app
 * laranja, mas tem barriga de tal cor, ai em alguns lugares do app tem tal cor,
 * ai a asa tem tal cor, mais uma cor pra encaixar no app."
 *
 * É a descrição exata de uma paleta extraída por área: a cor que mais ocupa a
 * arte manda no app, e as outras entram nos detalhes. Por isso a saída é
 * ordenada por área ocupada, e não por "qual é mais bonita".
 *
 * Uso: `pnpm --filter @trainerkit/dataset paleta`
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

// ---------------------------------------------------------------- PNG

interface Bitmap {
  largura: number;
  altura: number;
  /** RGBA, 4 bytes por pixel. */
  px: Uint8Array;
}

/**
 * Decodificador de PNG do tamanho do problema.
 *
 * Não é um decodificador completo, e não deve ser: ele lê o que a fonte de arte
 * realmente produz (8 bits, sem entrelace) e **falha alto** no resto. Um
 * decodificador que "dá um jeito" em formato inesperado produziria cor errada
 * em silêncio, e cor errada em silêncio é justamente o defeito que esta tabela
 * existe pra consertar.
 */
function decodificarPng(buf: Buffer): Bitmap {
  const assinatura = "89504e470d0a1a0a";
  if (buf.subarray(0, 8).toString("hex") !== assinatura) throw new Error("não é PNG");

  let largura = 0;
  let altura = 0;
  let profundidade = 0;
  let tipoCor = -1;
  let paleta: Buffer | null = null;
  let alfaPaleta: Buffer | null = null;
  const pedacos: Buffer[] = [];

  let i = 8;
  while (i < buf.length) {
    const tamanho = buf.readUInt32BE(i);
    const tipo = buf.subarray(i + 4, i + 8).toString("ascii");
    const dados = buf.subarray(i + 8, i + 8 + tamanho);
    i += 12 + tamanho; // 4 tamanho + 4 tipo + dados + 4 CRC

    if (tipo === "IHDR") {
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      profundidade = dados[8] ?? 0;
      tipoCor = dados[9] ?? -1;
      if (dados[12] !== 0) throw new Error("PNG entrelaçado (Adam7) não é suportado");
    } else if (tipo === "PLTE") paleta = Buffer.from(dados);
    else if (tipo === "tRNS") alfaPaleta = Buffer.from(dados);
    else if (tipo === "IDAT") pedacos.push(Buffer.from(dados));
    else if (tipo === "IEND") break;
  }

  if (profundidade !== 8 && profundidade !== 16) {
    throw new Error(`profundidade ${profundidade} não suportada`);
  }

  const canaisPorTipo: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const canais = canaisPorTipo[tipoCor];
  if (canais === undefined) throw new Error(`tipo de cor ${tipoCor} desconhecido`);

  // Índice de paleta é sempre 1 byte, mesmo com profundidade declarada.
  const bytesPorPx = tipoCor === 3 ? 1 : canais * (profundidade / 8);
  const bytesPorLinha = largura * bytesPorPx;
  const cru = inflateSync(Buffer.concat(pedacos));

  /*
   * Desfiltragem. Cada linha do PNG carrega no primeiro byte QUAL dos cinco
   * filtros foi usado, e cada filtro se desfaz olhando o pixel à esquerda (a),
   * o de cima (b) e o da diagonal (c). Sem isto a imagem sai como ruído — e um
   * ruído colorido daria uma paleta plausível e completamente falsa.
   */
  const linhas = new Uint8Array(altura * bytesPorLinha);
  let pos = 0;
  for (let y = 0; y < altura; y++) {
    const filtro = cru[pos++] ?? 0;
    const base = y * bytesPorLinha;
    for (let x = 0; x < bytesPorLinha; x++) {
      const bruto = cru[pos++] ?? 0;
      const a = x >= bytesPorPx ? (linhas[base + x - bytesPorPx] ?? 0) : 0;
      const b = y > 0 ? (linhas[base - bytesPorLinha + x] ?? 0) : 0;
      const c = y > 0 && x >= bytesPorPx ? (linhas[base - bytesPorLinha + x - bytesPorPx] ?? 0) : 0;
      let valor: number;
      switch (filtro) {
        case 0: valor = bruto; break;
        case 1: valor = bruto + a; break;
        case 2: valor = bruto + b; break;
        case 3: valor = bruto + ((a + b) >> 1); break;
        case 4: {
          // Paeth: escolhe entre a, b e c o mais perto da soma linear a+b-c.
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          valor = bruto + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`filtro ${filtro} inválido`);
      }
      linhas[base + x] = valor & 0xff;
    }
  }

  // Normaliza tudo para RGBA de 8 bits.
  const px = new Uint8Array(largura * altura * 4);
  const passo = profundidade === 16 ? 2 : 1;
  for (let p = 0; p < largura * altura; p++) {
    const s = p * bytesPorPx;
    const d = p * 4;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 255;
    if (tipoCor === 3) {
      const idx = linhas[s] ?? 0;
      r = paleta?.[idx * 3] ?? 0;
      g = paleta?.[idx * 3 + 1] ?? 0;
      b = paleta?.[idx * 3 + 2] ?? 0;
      a = alfaPaleta?.[idx] ?? 255;
    } else if (tipoCor === 0 || tipoCor === 4) {
      r = g = b = linhas[s] ?? 0;
      if (tipoCor === 4) a = linhas[s + passo] ?? 255;
    } else {
      r = linhas[s] ?? 0;
      g = linhas[s + passo] ?? 0;
      b = linhas[s + 2 * passo] ?? 0;
      if (tipoCor === 6) a = linhas[s + 3 * passo] ?? 255;
    }
    px[d] = r;
    px[d + 1] = g;
    px[d + 2] = b;
    px[d + 3] = a;
  }

  return { largura, altura, px };
}

// ---------------------------------------------------------------- cor

function paraHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rr) h = ((gg - bb) / d) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  h *= 60;
  return [h < 0 ? h + 360 : h, s, l];
}

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Distância perceptual barata: pesa verde mais que azul, como o olho. */
function distancia(a: readonly number[], b: readonly number[]): number {
  const dr = (a[0] ?? 0) - (b[0] ?? 0);
  const dg = (a[1] ?? 0) - (b[1] ?? 0);
  const db = (a[2] ?? 0) - (b[2] ?? 0);
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

interface Sub {
  n: number;
  r: number;
  g: number;
  b: number;
}

interface Familia {
  /** Pixels da família inteira, somando todas as iluminações. */
  n: number;
  /** As iluminações dentro da família, separadas por saturação e claridade. */
  subs: Map<number, Sub>;
}

/**
 * As cores da arte, por área ocupada.
 *
 * ⚠️ CONTAGEM EM DOIS NÍVEIS: família de matiz primeiro, iluminação depois. E
 * essa separação é uma correção — a versão de um nível só errava de um jeito
 * bem visível.
 *
 * Antes, a chave do balde misturava matiz, saturação e claridade num grid 3D.
 * O efeito colateral: uma superfície GRANDE e bem sombreada se dividia em até
 * cinco baldes (um por faixa de claridade), enquanto uma superfície pequena e
 * chapada ficava inteira num só. Aí o pequeno vencia o grande.
 *
 * O Venusaur denunciou isso: saía ROSA. O corpo verde-azulado se espalhava em
 * verde-claro, verde-médio, verde-sombra, teal-claro, teal-sombra — e a flor
 * rosa, chapada, ganhava de cada fatia individualmente. Blastoise dava marrom
 * pela mesma razão, e Lucario dava cinza.
 *
 * Contando por família de matiz, toda a sombra do verde soma com todo o
 * realce do verde, e a comparação passa a ser "quanto de verde" contra "quanto
 * de rosa" — que é a pergunta que o olho responde.
 *
 * A cor representativa da família sai da sub-faixa MAIS NUMEROSA dela, e não da
 * média: a média de realce com sombra dá um tom intermediário que não existe em
 * lugar nenhum da imagem. A sub-faixa mais numerosa é uma cor que está mesmo lá.
 *
 * ⚠️ O peso é CONTAGEM CRUA de pixels, e isso também é deliberado. A versão que
 * rodava em runtime pesava por saturação², e nessa regra Mewtwo dava roxo,
 * porque o corpo branco pesa quase zero. Mas o Mewtwo É branco: o roxo é o rabo.
 */
function extrairPaleta(bmp: Bitmap): string[] {
  const familias = new Map<number, Familia>();

  for (let p = 0; p < bmp.largura * bmp.altura; p++) {
    const d = p * 4;
    const a = bmp.px[d + 3] ?? 0;
    // 250 e não 200: pixel de borda tem alfa parcial e cor já misturada com o
    // fundo. Ele existe em volta da silhueta inteira, então entraria em peso.
    if (a < 250) continue;
    const r = bmp.px[d] ?? 0;
    const g = bmp.px[d + 1] ?? 0;
    const b = bmp.px[d + 2] ?? 0;
    const [h, s, l] = paraHsl(r, g, b);
    // Contorno. Não é cor do bicho, é traço de desenho — e é a cor mais
    // numerosa em quase toda arte.
    if (l < 0.08) continue;

    /*
     * Cinzas entram numa escada própria, em vez de numa família de matiz.
     *
     * Sem isto, o branco do Mewtwo se espalharia por 24 matizes conforme o
     * ruído de compressão, e cada fatia perderia pra qualquer cor sólida. A
     * escada junta tudo que é acromático pela luminosidade, que é a única
     * dimensão que ainda distingue branco de cinza de preto — e por isso ela é
     * grossa (5 degraus): mais fina, o sombreado de um corpo branco voltaria a
     * se fragmentar, que é justamente o defeito que este nível existe pra
     * evitar.
     */
    const chaveFamilia = s < 0.15 ? 1000 + Math.floor(l * 5) : Math.floor(h / 15);
    // Dentro da família, a iluminação. Isto NÃO compete por área: serve só pra
    // achar qual tom da família representa a superfície.
    const chaveSub = Math.floor(s * 4) * 10 + Math.floor(l * 6);

    const fam = familias.get(chaveFamilia) ?? { n: 0, subs: new Map<number, Sub>() };
    fam.n++;
    const sub = fam.subs.get(chaveSub) ?? { n: 0, r: 0, g: 0, b: 0 };
    sub.n++;
    sub.r += r;
    sub.g += g;
    sub.b += b;
    fam.subs.set(chaveSub, sub);
    familias.set(chaveFamilia, fam);
  }

  const ordenados = [...familias.values()]
    .filter((x) => x.n > 0)
    .map((fam) => {
      // A sub-faixa mais numerosa da família e a cor dela.
      let melhor: Sub | null = null;
      for (const sub of fam.subs.values()) {
        if (!melhor || sub.n > melhor.n) melhor = sub;
      }
      const m = melhor as Sub;
      return {
        n: fam.n,
        cor: [m.r / m.n, m.g / m.n, m.b / m.n] as const,
      };
    })
    .sort((a, b) => b.n - a.n);

  if (ordenados.length === 0) return [];

  const total = ordenados.reduce((s, x) => s + x.n, 0);
  const saida: string[] = [];
  const escolhidas: { cor: readonly number[]; h: number; s: number }[] = [];

  /*
   * A primeira cor é a mais numerosa, e ponto. As outras duas competem por
   * ÁREA × NOVIDADE DE MATIZ, e essa segunda metade não é refinamento — é
   * requisito.
   *
   * Só por área, o Dragonite dava laranja, creme e… laranja escuro: as três
   * "cores" eram a mesma superfície em três iluminações, porque o corpo ocupa
   * quase toda a arte e cada faixa de sombra dele vence qualquer detalhe. Mas
   * "ai a asa tem tal cor" pede o azul da asa, que é pequeno e é a única coisa
   * ali que o olho registra como OUTRA cor.
   *
   * Então matiz inédito vale até o triplo da área. Sombra do que já foi
   * escolhido não pontua; superfície de outra cor, sim.
   */
  for (let slot = 0; slot < 3; slot++) {
    let melhor: { n: number; cor: readonly number[] } | null = null;
    let melhorNota = 0;

    for (const cand of ordenados) {
      // Menos de 2,5% da arte é ruído de compressão, não uma cor do bicho.
      if (slot > 0 && cand.n / total < 0.025) continue;
      // Perto demais de uma já escolhida seria a mesma cor com outro nome.
      if (escolhidas.some((c) => distancia(c.cor, cand.cor) < 90)) continue;

      const [h, s] = paraHsl(cand.cor[0] ?? 0, cand.cor[1] ?? 0, cand.cor[2] ?? 0);

      /*
       * ⚠️ ÁREA PURA, sem empurrão pra cor mais viva. Eu tentei o empurrão e
       * DESFIZ, e o registro importa mais que o resultado.
       *
       * Sobram dois casos discutíveis: Blastoise sai marrom (o casco ocupa mais
       * que o corpo azul) e Lucario sai cinza (o pelo preto ocupa mais que o
       * azul). Pesar saturação em 45% conserta os dois — e quebra o Venusaur,
       * que volta a sair ROSA, porque a flor é mais saturada que o corpo
       * verde-azulado ainda que muito menor.
       *
       * Não é um bom negócio: "Venusaur é verde" é mais evidente que "Blastoise
       * é azul e não marrom". E há a diferença de natureza — marrom PARA
       * Blastoise é uma leitura defensável da arte, enquanto o rosa que ele
       * reclamou ("mewtwo n é vermelho") não vinha da arte nenhuma, vinha do
       * tipo. Errar medindo é outra categoria de erro.
       */
      let nota = cand.n;

      if (slot > 0 && s >= 0.15) {
        // Distância de matiz é circular: 350° e 10° são vizinhos, não opostos.
        const perto = escolhidas
          .filter((c) => c.s >= 0.15)
          .reduce((min, c) => {
            const d = Math.abs(h - c.h);
            return Math.min(min, d > 180 ? 360 - d : d);
          }, 180);
        nota *= 1 + 2 * Math.min(1, perto / 60);
      }
      if (nota > melhorNota) {
        melhorNota = nota;
        melhor = cand;
      }
    }

    if (!melhor) break;
    const [h, s] = paraHsl(melhor.cor[0] ?? 0, melhor.cor[1] ?? 0, melhor.cor[2] ?? 0);
    escolhidas.push({ cor: melhor.cor, h, s });
    saida.push(hex(melhor.cor[0] ?? 0, melhor.cor[1] ?? 0, melhor.cor[2] ?? 0));
  }

  return saida;
}

/**
 * A CAIXA JUSTA do bicho dentro da arte — onde o alfa deixa de ser zero.
 *
 * ⚠️ Isto existe porque a arte oficial NÃO enquadra os Pokémon de forma
 * consistente. Cada PNG tem 512×512, mas o quanto o bicho ocupa dentro desse
 * quadrado varia muito: uns encostam nas bordas, outros flutuam no meio com
 * margem enorme. Charizard e Bulbasaur, lado a lado no mesmo quadro, aparecem
 * em tamanhos e alturas completamente diferentes.
 *
 * "olha ai, por exemplo o charizard, n combino. tem q testar pokemon por
 * pokemon, pra sempre dar certo."
 *
 * Testar um por um na mão são 1.142 telas. Medir um por um são 1.142 caixas —
 * e com a caixa, o app consegue enquadrar todos no MESMO lugar, o que faz o
 * layout valer para todos de uma vez em vez de para o que eu conferi.
 *
 * Devolve as bordas normalizadas (0 a 1): `[esquerda, topo, direita, base]`.
 */
function caixaJusta(bmp: Bitmap): [number, number, number, number] {
  let x0 = bmp.largura;
  let y0 = bmp.altura;
  let x1 = -1;
  let y1 = -1;

  for (let y = 0; y < bmp.altura; y++) {
    for (let x = 0; x < bmp.largura; x++) {
      // 24 e não 0: as artes têm um halo de alfa quase-zero em volta da
      // silhueta, e contá-lo devolveria quase sempre a imagem inteira — ou
      // seja, uma caixa "justa" que não aperta nada.
      if ((bmp.px[(y * bmp.largura + x) * 4 + 3] ?? 0) < 24) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }

  if (x1 < 0) return [0, 0, 1, 1];
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return [
    r(x0 / bmp.largura),
    r(y0 / bmp.altura),
    r((x1 + 1) / bmp.largura),
    r((y1 + 1) / bmp.altura),
  ];
}

/**
 * A LINHA DA BARRIGA: onde acaba "a cara" e começam as pernas.
 *
 * ⚠️ Isto existe por causa de uma frase dele, e de duas tentativas minhas de
 * responder a ela com um número só.
 *
 * "deixa sempre a cara livre, sem nada. a cara e a parte da barriga pra cima."
 *
 * O nome do Pokémon passa por cima da silhueta no hero, e o que não pode ser
 * coberto é da barriga pra cima. Eu tentei 62% da altura — servia a bípedes e
 * encostava no queixo do Venusaur. Tentei 75% — servia ao Venusaur na home e
 * ainda cruzava a boca dele na ficha, porque lá o bicho fica maior. O erro não
 * era o valor: era supor que UMA fração serve para 1.142 formas diferentes.
 *
 * A barriga é medível, e a definição que funciona nas duas formas extremas é a
 * mesma: **subindo a partir dos pés, é onde a silhueta deixa de ser perna e
 * volta a ser corpo** — ou seja, onde a largura da linha reencontra a largura
 * do tronco.
 *
 *   · Machamp (bípede): pernas finas até ~60%, tronco largo acima. Dá ~0,60.
 *   · Venusaur (quadrúpede agachado): pés minúsculos, corpo larguíssimo logo
 *     acima. Dá ~0,88 — que é exatamente onde a boca dele termina.
 *
 * O limiar é 70% da linha mais larga. Mais alto passa a cortar dentro do corpo
 * de bichos que afinam pra cima (Gyarados); mais baixo perde a perna de quem
 * tem coxa grossa.
 *
 * Devolve a fração da ALTURA DA CAIXA JUSTA, de 0 (topo) a 1 (base), presa
 * entre 0,62 e 0,95.
 *
 * ⚠️ O PISO é 0,62 porque essa era a fração universal que eu usava antes desta
 * medição, e ela já servia a todo bípede. Assim a medida por espécie só pode
 * PROTEGER MAIS que o comportamento anterior, nunca menos — se a heurística
 * errar para baixo em alguma silhueta que eu não olhei, o pior caso é o que já
 * estava em produção.
 *
 * O teto é 0,95 porque proteger 100% é o mesmo que não deixar o bicho descer, e
 * aí acaba a profundidade pedida pelo desenho — a do relógio da Apple. 181 das
 * 1.142 chegam nele — são as formas que são corpo até o chão (Snorlax, Ditto,
 * Machamp de coxa grossa), e para essas a resposta certa é mesmo "quase tudo".
 */
function linhaDaBarriga(bmp: Bitmap, caixa: [number, number, number, number]): number {
  const y0 = Math.floor(caixa[1] * bmp.altura);
  const y1 = Math.ceil(caixa[3] * bmp.altura);
  const alt = y1 - y0;
  if (alt <= 2) return 0.75;

  const larguras: number[] = [];
  for (let y = y0; y < y1; y++) {
    let esq = -1;
    let dir = -1;
    for (let x = 0; x < bmp.largura; x++) {
      if ((bmp.px[(y * bmp.largura + x) * 4 + 3] ?? 0) < 24) continue;
      if (esq < 0) esq = x;
      dir = x;
    }
    larguras.push(dir < 0 ? 0 : dir - esq + 1);
  }

  const maior = Math.max(...larguras);
  if (maior <= 0) return 0.75;
  const limiar = maior * 0.7;

  // Subindo dos pés: a primeira linha que volta a ter largura de tronco.
  for (let i = larguras.length - 1; i >= 0; i--) {
    if ((larguras[i] ?? 0) >= limiar) {
      const fracao = (i + 1) / larguras.length;
      return Math.round(Math.min(0.95, Math.max(0.62, fracao)) * 100) / 100;
    }
  }
  return 0.75;
}

// ---------------------------------------------------------------- execução

const RAIZ = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other";

/**
 * As duas fontes de imagem que o app oferece.
 *
 * ⚠️ A caixa justa precisa ser medida NAS DUAS, e isso nao e zelo: as mesmas
 * espécies vêm enquadradas de formas diferentes em cada uma. A arte oficial é
 * ilustração, com margem generosa e variável; os renders 3D do Pokémon HOME são
 * capturas de modelo, quase sempre mais cheias no quadro.
 *
 * O enquadramento tem que ser conferido nas DUAS fontes de imagem, e tambem no
 * modo sem imagem nenhuma.
 *
 * Se o app usasse a caixa da arte oficial pra posicionar um render 3D, o
 * enquadramento sairia deslocado exatamente como estava antes — só que agora
 * por minha causa, e não pela do PokeAPI.
 */
const FONTES = {
  /** `pokeapi-artwork` no app. */
  b: "official-artwork",
  /** `pokeapi-home` no app: os renders 3D. */
  h: "home",
} as const;

async function baixar(id: number, fonte: string): Promise<Buffer | null> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const r = await fetch(`${RAIZ}/${fonte}/${id}.png`);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (tentativa === 2) {
        console.warn(`  ! ${id}: ${(e as Error).message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 500 * (tentativa + 1)));
    }
  }
  return null;
}

async function main() {
  const caminho = new URL("../../../apps/web/public/dataset/gamedata.json", import.meta.url);
  const dados = JSON.parse(await readFile(caminho, "utf8")) as {
    species: { spriteId: number | null }[];
  };

  const ids = [...new Set(dados.species.map((s) => s.spriteId).filter((x): x is number => x != null))]
    .sort((a, b) => a - b);

  console.log(`${ids.length} sprites a analisar.`);

  /** Por sprite: `c` = as cores, `b` = a caixa justa. Chaves curtas porque isto
      vai embutido no pacote e são 1.142 entradas. */
  /**
   * Por sprite: `c` = as cores, `b` = a caixa na arte oficial, `h` = a caixa nos
   * renders 3D. Chaves curtas porque isto vai embutido no pacote e são 1.142
   * entradas.
   *
   * `h` sai quando não houver render 3D pra espécie — várias formas regionais e
   * cosméticas só existem na arte oficial. Nesse caso o app cai na caixa `b`,
   * que é melhor que não enquadrar.
   */
  const paleta: Record<
    string,
    {
      c: string[];
      b: [number, number, number, number];
      h?: [number, number, number, number];
      /** Linha da barriga na arte oficial — ver `linhaDaBarriga`. */
      v: number;
      /** Idem, no render 3D. */
      w?: number;
    }
  > = {};
  let feitos = 0;
  let vazios = 0;

  // 12 de cada vez: rápido o bastante e educado com o raw.githubusercontent.
  const LOTE = 12;
  for (let i = 0; i < ids.length; i += LOTE) {
    await Promise.all(
      ids.slice(i, i + LOTE).map(async (id) => {
        const buf = await baixar(id, FONTES.b);
        if (!buf) {
          vazios++;
          return;
        }
        try {
          const bmp = decodificarPng(buf);
          // A COR sai sempre da arte oficial: ela e a referencia cromatica do
          // bicho, e o render 3D tem iluminacao de estudio que lava os tons.
          const cores = extrairPaleta(bmp);
          if (cores.length === 0) {
            vazios++;
            return;
          }
          const caixa = caixaJusta(bmp);
          const entrada: (typeof paleta)[string] = {
            c: cores,
            b: caixa,
            // A linha da barriga, por espécie e por FONTE: a arte oficial e o
            // render 3D enquadram o mesmo bicho com proporções diferentes, então
            // a mesma barriga cai em frações diferentes da caixa.
            v: linhaDaBarriga(bmp, caixa),
          };

          const buf3d = await baixar(id, FONTES.h);
          if (buf3d) {
            try {
              const bmp3d = decodificarPng(buf3d);
              const caixa3d = caixaJusta(bmp3d);
              entrada.h = caixa3d;
              entrada.w = linhaDaBarriga(bmp3d, caixa3d);
            } catch {
              // Render 3D ilegivel: o app cai na caixa da arte oficial.
            }
          }
          paleta[id] = entrada;
        } catch (e) {
          console.warn(`  ! ${id}: ${(e as Error).message}`);
          vazios++;
        }
      }),
    );
    feitos += Math.min(LOTE, ids.length - i);
    if (feitos % 120 < LOTE) console.log(`  ${feitos}/${ids.length}`);
  }

  const ordenado = Object.fromEntries(
    Object.keys(paleta)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => [k, paleta[k]]),
  );

  /*
   * Vai pro CÓDIGO, e não pro `public/dataset/`.
   *
   * A tabela é embutida no pacote em vez de buscada: são 12 kB comprimidos, e
   * em troca não existe estado de carregamento — a cor da espécie já está lá no
   * primeiro quadro, sem piscar de cinza pra laranja. Também não depende do
   * dataset escolhido: a chave é o id de sprite do PokeAPI, que uma base
   * customizada continua usando.
   */
  const saida = new URL("../../../apps/web/src/dados/paleta.json", import.meta.url);
  const json = JSON.stringify(ordenado);
  await writeFile(saida, json);

  const soma = createHash("sha256").update(json).digest("hex").slice(0, 12);
  console.log(
    `\n${Object.keys(ordenado).length} paletas · ${vazios} sem cor · ` +
      `${(json.length / 1024).toFixed(1)} kB · sha ${soma}`,
  );
}

void main();
