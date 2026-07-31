import type { Bitmap, Rect } from "./scan.js";

/**
 * Onde estao os NUMEROS no print, e como entrega-los limpos pro reconhecedor.
 *
 * ⚠️ Este arquivo nao le digito nenhum. Ele acha a regiao, binariza e devolve um
 * bitmap preto-e-branco; quem reconhece e o `apps/web/src/scan/ocr.ts`, que
 * carrega o tesseract. A divisao e a mesma de `scan.ts` / `readImage.ts`, e ela
 * existe por dois motivos:
 *
 *   · o core e TS puro, sem DOM e sem worker — e o tesseract precisa dos dois;
 *   · a parte que decide a QUALIDADE do resultado e esta, e nao o modelo. Um
 *     recorte errado faz o melhor OCR do mundo ler o relogio do celular.
 *
 * ⚠️ E o PC e o PS sao os UNICOS campos que passam por OCR. O IV vem das barras,
 * por geometria (`scan.ts`), e o nome nunca e lido: o que aparece na tela e o
 * APELIDO, que o jogador escolhe. O print do Slaking dos testes se chama
 * "Slaking64%" — quem tentasse casar isso com a lista de especies acertaria por
 * acaso e erraria em qualquer bicho renomeado.
 */

/** Retangulo em pixels, mais o bitmap binario ja limpo daquela regiao. */
export interface RegiaoTexto {
  rect: Rect;
  /** 1 = tinta, 0 = fundo. `larg × alt` valores. */
  mascara: Uint8Array;
  larg: number;
  alt: number;
  /** Altura mediana dos glifos — serve pra escalar a imagem antes do OCR. */
  alturaGlifo: number;
}

export interface Componente {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  larg: number;
  alt: number;
  n: number;
}

/**
 * ⚠️ O PC e texto CLARO sobre foto — limiar global nao serve.
 *
 * O fundo da tela do Pokemon e a camera desfocada, e num print de dia ele fica
 * mais claro que a propria letra. Medi: com "perto do branco" (distancia
 * euclidiana < 70, que e o que o GoIV usa nos campos dele) o print do Slaking
 * devolve UM componente de 197px de altura — o bokeh inteiro virou uma mancha
 * so, com o texto dentro dela.
 *
 * O limiar adaptativo resolve porque muda a pergunta: nao e "este pixel e
 * branco?", e sim "este pixel e mais claro que a VIZINHANCA dele?". Dentro de
 * uma mancha clara grande o pixel e igual a media local e reprova; num traco
 * fino de letra ele ganha da media com folga, seja o fundo claro ou escuro.
 *
 * Feito com imagem integral: a media de qualquer janela sai em quatro somas,
 * entao o custo nao depende do tamanho da janela.
 */
function limiarAdaptativo(
  bmp: Bitmap,
  rect: Rect,
  janela: number,
  margem: number,
  claro: boolean,
): Uint8Array {
  const { x, y, width: larg, height: alt } = rect;
  const cinza = new Float64Array(larg * alt);
  for (let j = 0; j < alt; j++) {
    for (let i = 0; i < larg; i++) {
      const p = ((y + j) * bmp.width + (x + i)) * 4;
      // Luma perceptual: o mesmo peso da WCAG. Importa aqui porque o texto do
      // jogo tem contorno escuro, e converter por media simples achata a borda.
      cinza[j * larg + i] =
        0.2126 * bmp.data[p]! + 0.7152 * bmp.data[p + 1]! + 0.0722 * bmp.data[p + 2]!;
    }
  }

  // Imagem integral com uma linha e uma coluna de zeros na frente, pra dispensar
  // os casos de borda na hora de somar.
  const soma = new Float64Array((larg + 1) * (alt + 1));
  for (let j = 0; j < alt; j++) {
    let linha = 0;
    for (let i = 0; i < larg; i++) {
      linha += cinza[j * larg + i]!;
      soma[(j + 1) * (larg + 1) + (i + 1)] = soma[j * (larg + 1) + (i + 1)]! + linha;
    }
  }

  const r = Math.max(1, Math.floor(janela / 2));
  const mask = new Uint8Array(larg * alt);
  for (let j = 0; j < alt; j++) {
    const j0 = Math.max(0, j - r);
    const j1 = Math.min(alt - 1, j + r);
    for (let i = 0; i < larg; i++) {
      const i0 = Math.max(0, i - r);
      const i1 = Math.min(larg - 1, i + r);
      const area = (j1 - j0 + 1) * (i1 - i0 + 1);
      const s =
        soma[(j1 + 1) * (larg + 1) + (i1 + 1)]! -
        soma[j0 * (larg + 1) + (i1 + 1)]! -
        soma[(j1 + 1) * (larg + 1) + i0]! +
        soma[j0 * (larg + 1) + i0]!;
      const media = s / area;
      const v = cinza[j * larg + i]!;
      mask[j * larg + i] = claro ? (v > media + margem ? 1 : 0) : v < media - margem ? 1 : 0;
    }
  }
  return mask;
}

/**
 * Componentes conectados por 8 vizinhos.
 *
 * ⚠️ Pilha propria, e nao recursao. Um componente pode ter dezenas de milhares
 * de pixels (o bokeh do fundo, antes dos filtros), e recursao estoura a pilha do
 * JS bem antes disso.
 */
export function componentesConectados(
  mask: Uint8Array,
  larg: number,
  alt: number,
  minPixels: number,
): Componente[] {
  const visto = new Uint8Array(larg * alt);
  const pilha = new Int32Array(larg * alt);
  const out: Componente[] = [];

  for (let inicio = 0; inicio < larg * alt; inicio++) {
    if (!mask[inicio] || visto[inicio]) continue;
    let topo = 0;
    pilha[topo++] = inicio;
    visto[inicio] = 1;
    let x0 = larg;
    let y0 = alt;
    let x1 = -1;
    let y1 = -1;
    let n = 0;

    while (topo > 0) {
      const p = pilha[--topo]!;
      const py = (p / larg) | 0;
      const px = p - py * larg;
      n++;
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= alt) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          if (nx < 0 || nx >= larg) continue;
          const q = ny * larg + nx;
          if (mask[q] && !visto[q]) {
            visto[q] = 1;
            pilha[topo++] = q;
          }
        }
      }
    }
    if (n >= minPixels) {
      out.push({ x0, y0, x1, y1, n, larg: x1 - x0 + 1, alt: y1 - y0 + 1 });
    }
  }
  return out;
}

export interface LinhaTexto {
  y0: number;
  y1: number;
  /** Centro vertical mediano dos glifos — a "linha de base" do agrupamento. */
  centro: number;
  itens: Componente[];
}

/**
 * Agrupa componentes em linhas de texto.
 *
 * ⚠️ A distancia e medida entre CENTROS, com tolerancia derivada da altura do
 * glifo — e nao pela sobreposicao com a caixa acumulada da linha.
 *
 * A primeira versao fazia pela caixa acumulada e colapsou: bastava UM componente
 * alto no recorte (a silhueta escura do treinador, a borda do cartao) pra a
 * caixa da linha passar a cobrir a regiao inteira, e dali em diante o centro de
 * qualquer componente caia dentro dela. Nos cinco prints que eu inspecionei o
 * resultado foi identico: uma unica "linha" de y 0 a 506, com o cartao todo
 * dentro. Zero linhas utilizaveis em 20 dos 26 prints.
 *
 * Medindo entre centros, um componente alto continua sendo um item da linha
 * dele e nao contamina o agrupamento dos vizinhos.
 */
export function linhasDeTexto(comps: Componente[]): LinhaTexto[] {
  if (comps.length === 0) return [];

  /*
   * ⚠️ A tolerancia sai da altura MEDIANA DO CONJUNTO, e e a mesma pra todos.
   *
   * Isto ja teve duas versoes erradas, cada uma quebrando um lado:
   *
   *   · derivada do MAIOR dos dois glifos: um componente de 50px abria uma
   *     janela de 30px em volta de si, engolia a linha 20px acima, e dali em
   *     diante ja era alto o bastante pra continuar engolindo. Vinte dos 26
   *     prints viravam uma linha unica com o cartao inteiro dentro.
   *
   *   · derivada do MENOR: o inverso. Um caco pequeno abria uma linha propria
   *     com tolerancia minuscula, e — porque a comparacao era so contra a
   *     ULTIMA linha — todos os glifos seguintes eram medidos contra o caco em
   *     vez da linha de verdade. "150 / 150 PS" saiu como "»".
   *
   * A altura de LINHA nao e propriedade de um glifo, e do conjunto. Com a
   * mediana, um caco ou uma silhueta nao mexem na regua; e comparando contra
   * TODAS as linhas abertas, um caco no meio nao interrompe a corrente.
   */
  const tolerancia = Math.max(2, 0.5 * mediana(comps.map((c) => c.alt)));

  const linhas: LinhaTexto[] = [];
  for (const c of [...comps].sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1))) {
    const centro = (c.y0 + c.y1) / 2;
    let melhor: LinhaTexto | null = null;
    let dist = Infinity;
    for (const l of linhas) {
      const d = Math.abs(centro - l.centro);
      if (d < dist) {
        dist = d;
        melhor = l;
      }
    }
    if (melhor && dist <= tolerancia) {
      melhor.itens.push(c);
      melhor.y0 = Math.min(melhor.y0, c.y0);
      melhor.y1 = Math.max(melhor.y1, c.y1);
      // Mediana, e nao media: um acento ou um caco nao arrasta a linha de base.
      melhor.centro = mediana(melhor.itens.map((i) => (i.y0 + i.y1) / 2));
    } else {
      linhas.push({ y0: c.y0, y1: c.y1, centro, itens: [c] });
    }
  }
  for (const l of linhas) l.itens.sort((a, b) => a.x0 - b.x0);
  return linhas;
}

function mediana(v: number[]): number {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/**
 * O topo do cartao branco — a divisa entre a foto e a ficha do Pokemon.
 *
 * E a unica ancora horizontal confiavel da tela: a foto acima varia com o mapa,
 * a hora e o Pokemon, e o cartao abaixo e sempre branco de ponta a ponta.
 *
 * ⚠️ A barra de PS NAO serve de ancora, embora fosse a escolha obvia. Ela e uma
 * barra de PREENCHIMENTO: o Dragonite do teste esta desmaiado (0/172 PS) e a
 * barra inteira e cinza. Ancorar no verde perderia justamente o Pokemon que
 * acabou de sair de uma raide, que e quando se escaneia.
 */
export function topoDoCartao(bmp: Bitmap): number | null {
  const x0 = Math.floor(bmp.width * 0.2);
  const x1 = Math.floor(bmp.width * 0.8);
  const passo = Math.max(1, Math.floor((x1 - x0) / 120));
  for (let y = Math.floor(bmp.height * 0.25); y < Math.floor(bmp.height * 0.7); y++) {
    let brancos = 0;
    let total = 0;
    for (let x = x0; x < x1; x += passo) {
      const p = (y * bmp.width + x) * 4;
      total++;
      if (bmp.data[p]! > 232 && bmp.data[p + 1]! > 232 && bmp.data[p + 2]! > 232) brancos++;
    }
    if (brancos / total > 0.92) return y;
  }
  return null;
}

/** Recorta a mascara de uma linha, com uma folga de um pixel em volta. */
function recortarLinha(
  mask: Uint8Array,
  larg: number,
  linha: LinhaTexto,
  itens: Componente[],
  origem: Rect,
): RegiaoTexto {
  const x0 = Math.max(0, Math.min(...itens.map((i) => i.x0)) - 2);
  const x1 = Math.min(larg - 1, Math.max(...itens.map((i) => i.x1)) + 2);
  const y0 = Math.max(0, linha.y0 - 2);
  const y1 = linha.y1 + 2;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const src = (y0 + j) * larg + (x0 + i);
      out[j * w + i] = mask[src] ?? 0;
    }
  }
  return {
    rect: { x: origem.x + x0, y: origem.y + y0, width: w, height: h },
    mascara: out,
    larg: w,
    alt: h,
    alturaGlifo: mediana(itens.map((i) => i.alt)),
  };
}

/**
 * A linha do PC — o numero grande e claro no alto da tela.
 *
 * ⚠️ A busca comeca em 4% da altura, e nao em 0: a barra de status do celular
 * tambem e texto claro no alto, e o relogio "6:44" e um numero perfeitamente
 * plausivel de PC. Comecar depois dela e mais barato e mais seguro que tentar
 * distinguir as duas coisas depois.
 *
 * ⚠️ O prefixo "PC" e DESCARTADO por altura, e nao por idioma. Ele e escrito
 * menor que os digitos em todas as localizacoes (PC, CP, WP, PS...), entao
 * "fica so o que tem altura de digito" resolve os dez idiomas de uma vez, sem
 * uma tabela de prefixos pra manter.
 */
export function acharLinhaPc(bmp: Bitmap): RegiaoTexto | null {
  const rect: Rect = {
    x: 0,
    y: Math.round(bmp.height * 0.04),
    width: bmp.width,
    height: Math.round(bmp.height * 0.11),
  };
  // A janela tem que ser maior que o traco e menor que a letra inteira; ~4% da
  // largura da imagem cobre as duas condicoes em qualquer resolucao de celular.
  const janela = Math.max(9, Math.round(bmp.width * 0.04));
  const mask = limiarAdaptativo(bmp, rect, janela, 16, true);

  const minPixels = Math.max(12, Math.round(bmp.width * bmp.height * 0.000004));
  const comps = componentesConectados(mask, rect.width, rect.height, minPixels).filter(
    (c) =>
      // Digito: mais alto que largo, e de tamanho compativel com o titulo.
      c.alt >= bmp.height * 0.012 &&
      c.alt <= bmp.height * 0.05 &&
      c.larg <= c.alt * 1.6 &&
      c.larg >= c.alt * 0.12,
  );
  if (comps.length === 0) return null;

  const candidatas = linhasDeTexto(comps)
    .map((l) => {
      // So os glifos ALTOS da linha: os baixinhos sao o prefixo "PC".
      const altoMax = Math.max(...l.itens.map((i) => i.alt));
      const digitos = l.itens.filter((i) => i.alt >= altoMax * 0.8);
      const esq = Math.min(...digitos.map((i) => i.x0));
      const dir = Math.max(...digitos.map((i) => i.x1));
      const alturas = digitos.map((i) => i.alt);
      return {
        linha: l,
        digitos,
        centro: (esq + dir) / 2 / bmp.width,
        // Quao parelhos os glifos sao entre si.
        desvio: Math.max(...alturas) / Math.max(1, Math.min(...alturas)),
      };
    })
    .filter(
      (c) =>
        /*
         * ⚠️ A REGRA E "DIGITOS PARELHOS E CENTRALIZADOS", e nao "o maior texto".
         *
         * Eu ordenava por altura de glifo, achando que o PC e a maior tipografia
         * da tela. Nao e: a arte do Pokemon e o arco passam pela faixa do topo e
         * produzem componentes bem mais altos que os digitos. No print c9 o PC
         * estava ali, perfeito — quatro glifos de 72px em 50,0% da tela — e
         * perdeu pra um pedaco de silhueta de 100px.
         *
         * O que distingue um numero dos cacos da imagem nao e tamanho, e
         * REGULARIDADE: 2 a 4 glifos, todos praticamente da mesma altura,
         * centralizados. Pedaco de arte nunca e parelho.
         */
        c.digitos.length >= 2 &&
        c.digitos.length <= 4 &&
        c.desvio <= 1.18 &&
        Math.abs(c.centro - 0.5) < 0.15,
    )
    // Entre as que sobram, a mais ALTA na tela: o PC fica acima do Pokemon, e a
    // barra de status ja ficou de fora pelo recorte.
    .sort((a, b) => a.linha.y0 - b.linha.y0);

  const escolhida = candidatas[0];
  if (!escolhida) return null;
  return recortarLinha(mask, rect.width, escolhida.linha, escolhida.digitos, rect);
}

/**
 * A linha do PS — "138 / 138 PS", logo abaixo da barra de vida.
 *
 * Aqui o fundo e o cartao branco, entao um limiar global ja separa tinta de
 * papel e o adaptativo seria trabalho a toa. O que decide e a ESCOLHA DA LINHA:
 * dentro do cartao ha o apelido (grande), o PS (pequeno) e depois peso e altura.
 *
 * A regra e "a primeira linha pequena depois da primeira linha grande". Nao usa
 * a barra de vida como referencia — ver a nota de `topoDoCartao`.
 */
export function acharLinhaPs(bmp: Bitmap): RegiaoTexto | null {
  const topo = topoDoCartao(bmp);
  if (topo === null) return null;

  const rect: Rect = {
    x: 0,
    y: topo,
    // Ate o peso e a altura: mais que isso so traz o painel de avaliacao pra
    // dentro da conta, e ele e branco sobre branco tambem.
    width: bmp.width,
    height: Math.min(Math.round(bmp.width * 0.42), bmp.height - topo),
  };

  const larg = rect.width;
  const alt = rect.height;
  const mask = new Uint8Array(larg * alt);
  for (let j = 0; j < alt; j++) {
    for (let i = 0; i < larg; i++) {
      const p = ((rect.y + j) * bmp.width + i) * 4;
      const r = bmp.data[p]!;
      const g = bmp.data[p + 1]!;
      const b = bmp.data[p + 2]!;
      // O texto do cartao e um azul-petroleo escuro; o cartao vai do branco ao
      // azul bem claro. A folga entre os dois e enorme, entao o limiar pode ser
      // frouxo sem custo.
      mask[j * larg + i] = r < 150 && g < 170 && b < 180 ? 1 : 0;
    }
  }

  const minPixels = Math.max(10, Math.round(bmp.width * 0.0002 * bmp.width * 0.02));
  /*
   * ⚠️ A PENEIRA DE TAMANHO VEM ANTES DO AGRUPAMENTO.
   *
   * O recorte pega o cartao inteiro, e dentro dele ha coisas escuras que nao sao
   * texto: a silhueta do treinador no canto, a borda do cartao, os icones de
   * tipo. Deixar isso chegar no agrupador foi o que produziu uma unica linha de
   * 506px de altura em 20 dos 26 prints.
   *
   * Um glifo desta tela mede entre 1,2% e 6% da LARGURA da imagem — medido nos
   * prints nativos: o PS sai em 2,0%, o apelido em 4,8%. E letra nunca e muito
   * mais larga que alta.
   */
  const comps = componentesConectados(mask, larg, alt, minPixels).filter(
    (c) =>
      c.alt >= bmp.width * 0.012 &&
      c.alt <= bmp.width * 0.06 &&
      c.larg <= c.alt * 2.2 &&
      // Descarta caixas ocas (moldura de icone): letra preenche a propria caixa.
      c.n >= c.larg * c.alt * 0.12,
  );
  /*
   * ⚠️ SO LINHAS CENTRALIZADAS E COM TEXTO DE VERDADE.
   *
   * O cartao tem, alem do apelido e do PS, coisas soltas que formam "linha" de
   * um glifo so: o simbolo de genero na borda direita, o lapis de renomear, o
   * canto do proprio cartao. Elas nao sao texto e nao ficam no meio.
   *
   * Sem esta peneira, a regra "a proxima linha depois do apelido" caia num
   * simbolo de genero a 97% da largura — e foi o que quebrou quatro prints que
   * antes acertavam, incluindo dois de celular nativo. A ordem na pagina nao
   * identifica a linha; o que identifica e ela ser um texto centralizado.
   */
  const centradas = linhasDeTexto(comps)
    .map((l) => {
      const esq = Math.min(...l.itens.map((i) => i.x0));
      const dir = Math.max(...l.itens.map((i) => i.x1));
      return {
        l,
        altura: mediana(l.itens.map((i) => i.alt)),
        centro: (esq + dir) / 2 / larg,
      };
    })
    .filter((x) => x.l.itens.length >= 3 && Math.abs(x.centro - 0.5) < 0.2)
    .sort((a, b) => a.l.y0 - b.l.y0);

  // O apelido e a maior linha do cartao; o PS e a primeira MENOR abaixo dele.
  let iNome = -1;
  let maior = 0;
  for (let i = 0; i < centradas.length; i++) {
    if (centradas[i]!.altura > maior) {
      maior = centradas[i]!.altura;
      iNome = i;
    }
  }
  const alvo = centradas
    .slice(iNome + 1)
    .find((x) => x.altura < maior * 0.9);
  if (!alvo) return null;

  /*
   * ⚠️ O SUFIXO FICA. "138 / 138 PS" vai inteiro pro reconhecedor.
   *
   * Eu tinha escrito um corte por vao — descartar tudo depois do ultimo espaco
   * largo, ja que o jogo separa o sufixo com espaco e os digitos nao. Funcionou
   * nos prints grandes e ERROU nos pequenos: num print de 688px de largura os
   * vaos medem 1 e 2 pixels, a razao entre eles vira ruido, e o corte caiu no
   * lugar errado — sobrou "174 /", sem o maximo. Perder o dado e pior que levar
   * duas letras a mais.
   *
   * E o corte era desnecessario desde o começo: quem separa numero de sufixo e a
   * expressao regular do `lerPs`, que procura "digitos / digitos" e ignora o
   * resto. Ela ja funciona nos dez idiomas (PS, HP, KP, PV) sem tabela nenhuma.
   */
  return recortarLinha(mask, larg, alvo.l, alvo.l.itens, rect);
}

/**
 * A mascara de uma linha, ampliada e com margem, pronta pro reconhecedor.
 *
 * ⚠️ Ampliar IMPORTA. O tesseract foi treinado em digitalizacao de papel e
 * trabalha melhor com letra alta; a linha do PS num print de iPhone tem 25px de
 * altura de glifo, e nessa escala ele confunde 8 com B e 1 com l. Levar pra ~48
 * resolve sem custo perceptivel, porque a area e minuscula.
 *
 * A margem branca em volta tambem nao e enfeite: sem ela o tesseract trata a
 * borda da imagem como parte do glifo e come o primeiro e o ultimo digito.
 */
export function ampliarParaOcr(
  regiao: RegiaoTexto,
  alturaAlvo = 48,
  margem = 10,
): { larg: number; alt: number; cinza: Uint8Array } {
  const escala = Math.max(1, Math.round(alturaAlvo / Math.max(1, regiao.alturaGlifo)));
  const w = regiao.larg * escala + margem * 2;
  const h = regiao.alt * escala + margem * 2;
  const out = new Uint8Array(w * h).fill(255);
  for (let j = 0; j < regiao.alt * escala; j++) {
    const sj = (j / escala) | 0;
    for (let i = 0; i < regiao.larg * escala; i++) {
      const si = (i / escala) | 0;
      if (regiao.mascara[sj * regiao.larg + si]) {
        out[(j + margem) * w + (i + margem)] = 0;
      }
    }
  }
  return { larg: w, alt: h, cinza: out };
}

/**
 * O que o OCR devolveu, ja peneirado.
 *
 * ⚠️ A peneira nao e opcional. O `tessedit_char_whitelist` NAO e confiavel com o
 * motor LSTM — ha bugs abertos no upstream em que a palavra some inteira — entao
 * a garantia de que so entra digito tem que estar aqui, depois.
 */
export function lerPc(texto: string): number | null {
  const limpo = texto.replace(/[Oo]/g, "0").replace(/[lI|]/g, "1").replace(/[^0-9]/g, "");
  if (limpo.length === 0 || limpo.length > 5) return null;
  const n = Number(limpo);
  // O PC vai de 10 (Magikarp nivel 1) a pouco mais de 5.000. Fora disso o que
  // foi lido nao e PC, e chutar seria pior que admitir que nao deu.
  return n >= 10 && n <= 6000 ? n : null;
}

export function lerPs(texto: string): { atual: number; max: number } | null {
  const limpo = texto.replace(/[Oo]/g, "0").replace(/[lI|]/g, "1");
  const m = limpo.match(/(\d{1,4})\s*[/\\]\s*(\d{1,4})/);
  if (!m) return null;
  const atual = Number(m[1]);
  const max = Number(m[2]);
  // O PS atual nunca passa do maximo, e o maximo comeca em 10. As duas regras
  // pegam a troca de digito mais comum ("138/138" lido como "138/188").
  if (max < 10 || max > 600 || atual > max) return null;
  return { atual, max };
}
