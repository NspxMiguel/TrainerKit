/**
 * Gera os icones do PWA. Arte propria, desenhada por codigo.
 *
 * A marca sao tres barras de comprimentos crescentes, e a mais longa termina em
 * ponta e vem no verde de "Investir". E o app inteiro em um simbolo: ele LE tres
 * barras num print e devolve UMA decisao. O monograma "TK" que existia antes
 * dizia so o nome — nao dizia o que o app faz.
 *
 * O desenho saiu do Stitch; o que mudou aqui foi a execucao. O PNG que ele
 * devolveu tinha o grupo encostado em cima e a esquerda, com um vazio grande
 * embaixo e a direita, e vinha num tamanho so. Redesenhado em codigo ele fica
 * opticamente centrado, sai em todos os tamanhos e usa os tokens do app em vez
 * de uma paleta paralela — o verde e o mesmo `--tk-succ` do veredito "Investir".
 *
 * Existe como script (e nao como PNG commitado) porque assim o icone e
 * reproduzivel e os tokens de cor sao a unica fonte de verdade. Rode com
 * `pnpm icons`.
 *
 * PNG e escrito na mao — nao ha canvas no Node e nao vale uma dependencia
 * nativa so pra isto.
 */
import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "public");

/*
 * ⚠️ O TILE E O GRADIENTE DO HANDOFF, e nao o preto chapado que estava aqui.
 *
 * O que este bloco dizia antes: *"Fundo solido, preto ou branco. O gradiente
 * saiu. Instalado, o icone senta ao lado dos icones do sistema — e ali um tile
 * com gradiente roxo-azul briga com tudo em volta."*
 *
 * Duas coisas erradas nisso. A primeira e que o handoff nao pede gradiente
 * roxo-azul: pede `linear-gradient(160deg,#33394A,#14171E 70%)`, que e grafite
 * indo pra quase-preto — um cinza com volume, exatamente o registro dos icones
 * do sistema. Uma coisa foi trocada por outra, com argumento contra a que nem
 * estava escrita. A segunda e que a troca contrariou o handoff sem pergunta:
 * conflito com o desenho se pergunta, nao se improvisa.
 *
 * O resultado apareceu na tela inicial: preto chapado, sem quina iluminada, o
 * ovo boiando num vazio — o icone instalado nao era o icone do desenho.
 */
type Tema = "dark" | "light";

/**
 * Como o arquivo vai ser tratado por quem o exibe. E a distincao que decide se
 * o PNG carrega a propria forma ou entrega um quadrado pro sistema recortar.
 *
 * `tile` — NINGUEM recorta. O arquivo desenha a forma inteira: o raio do
 * handoff, a borda fina de meio pixel e a quina iluminada. E o caso do favicon
 * (navegador nao mascara nada) e dos icones `purpose: "any"` do manifest.
 *
 * `cheio` — O SISTEMA recorta, e por isso o PNG precisa ser um quadrado OPACO
 * de ponta a ponta, sem raio e sem margem. Vale pro `apple-touch-icon`, que o
 * iOS mascara com o squircle dele SEMPRE (nao existe atributo pra recusar), e
 * pro icone `maskable` do Android.
 *
 * ⚠️ MANDAR UM `tile` ONDE SE ESPERA `cheio` E O DEFEITO QUE APARECEU NA TELA
 * INICIAL DO IPHONE. O iOS recorta o squircle dele por fora; entre essa mascara
 * e o desenho sobra a margem transparente que o arquivo trouxe, e o sistema
 * pinta esse vao. O que se ve e uma moldura clara em volta de um SEGUNDO canto
 * arredondado — duas bordas, uma dentro da outra, com um degrau entre elas.
 *
 * Nao da pra consertar isso do lado do CSS nem do manifest: quem escolhe a
 * mascara e o sistema. So da pra parar de mandar a forma junto.
 */
type Forma = "tile" | "cheio";

interface Paleta {
  /** As duas paradas do tile, do handoff. A 0% e a 70%. */
  readonly tile0: readonly [number, number, number];
  readonly tile1: readonly [number, number, number];
  /** A casca do ovo. */
  readonly casca: readonly [number, number, number];
  /** A luz que escapa pela fenda. */
  readonly luz: readonly [number, number, number];
  /**
   * Forca da quina iluminada. O handoff pede
   * `inset 0 1.5px 1px rgba(255,255,255,.22)` — luz branca no escuro; no tile
   * claro a mesma luz branca nao aparece, entao la a quina ESCURECE de leve,
   * que e o que da relevo sobre branco.
   */
  readonly quina: readonly [number, number, number];
  readonly quinaAlfa: number;
  /**
   * Onde a quina aparece. `-1` = luz na aresta de cima (tile escuro, luz do
   * ambiente batendo por cima). `+1` = sombra na de baixo — no tile claro uma
   * luz branca sobre branco nao existe, e o que da relevo e a aresta de baixo
   * escurecendo.
   */
  readonly quinaLado: -1 | 1;
}

const PALETAS: Record<Tema, Paleta> = {
  dark: {
    tile0: [0x33, 0x39, 0x4a], // #33394A
    tile1: [0x14, 0x17, 0x1e], // #14171E
    casca: [0xf4, 0xf6, 0xfa], // #F4F6FA, do handoff
    luz: [0x6e, 0x4b, 0xff], // #6E4BFF
    quina: [0xff, 0xff, 0xff],
    quinaAlfa: 0.22, // rgba(255,255,255,.22), do handoff
    quinaLado: -1,
  },
  light: {
    tile0: [0xff, 0xff, 0xff], // #FFFFFF
    tile1: [0xe3, 0xe6, 0xec], // #E3E6EC
    casca: [0x22, 0x26, 0x2f], // #22262F, a versao de fundo claro
    luz: [0x8a, 0x6b, 0xff], // #8A6BFF
    quina: [0x8f, 0x96, 0xa6],
    quinaAlfa: 0.45,
    quinaLado: 1,
  },
};

/**
 * A cor do tile naquele ponto — `linear-gradient(160deg, tile0, tile1 70%)`.
 *
 * 160deg no CSS e o ANGULO DA DIRECAO medido a partir de "pra cima", no sentido
 * horario. O vetor sai `(sen 160, -cos 160)` = `(0.342, 0.940)`, ou seja
 * levemente pra direita e bastante pra baixo. E o eixo do degrade vai de canto a
 * canto da caixa projetada nesse vetor, e nao de borda a borda — por isso a
 * normalizacao usa `|sen| + |cos|`.
 */
function tileAt(u: number, v: number, paleta: Paleta): readonly [number, number, number] {
  const rad = (160 * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const comprimento = Math.abs(dx) + Math.abs(dy);
  // Projecao do ponto no eixo, trazida de [-L/2, L/2] pra [0, 1].
  const bruto = ((u - 0.5) * dx + (v - 0.5) * dy) / comprimento + 0.5;
  // A parada final e 70%: depois dela o degrade e chapado.
  const t = Math.max(0, Math.min(1, bruto / 0.7));
  return [
    paleta.tile0[0] + (paleta.tile1[0] - paleta.tile0[0]) * t,
    paleta.tile0[1] + (paleta.tile1[1] - paleta.tile0[1]) * t,
    paleta.tile0[2] + (paleta.tile1[2] - paleta.tile0[2]) * t,
  ] as const;
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10..12 = compression, filter, interlace = 0

  // Cada scanline leva um byte de filtro (0 = None) na frente.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const src = y * width * 4;
    const dst = y * (width * 4 + 1);
    raw[dst] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + src, width * 4).copy(raw, dst + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Distancia assinada a um retangulo arredondado, para antialias de borda. */
function roundedRectSdf(
  px: number,
  py: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  radius: number,
): number {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - radius;
}

/**
 * A marca: um OVO CHOCANDO — a metade de cima levantada, borda de quebra em
 * zigue-zague e luz violeta escapando de dentro.
 *
 * Opcao 8a do documento de exploracao, e a razao dela existir esta escrita la:
 * "A Poké Ball está fora — a forma (esfera com faixa equatorial e botão
 * central) é marca registrada da Nintendo/Niantic". O ovo diz "aqui nasce um
 * Pokemon" sem tomar emprestada forma de ninguem.
 *
 * ── Por que redesenhado em SDF, e nao rasterizado do SVG ───────────────────
 *
 * O handoff entrega o ovo como SVG com paths bezier. Este gerador nao tem
 * rasterizador de path — ele escreve o PNG na mao, com CRC32 proprio e zero
 * dependencia, e `scripts/audit-bundle.ts` afirma por escrito que os icones
 * saem daqui. As alternativas eram escrever um rasterizador de bezier (algumas
 * centenas de linhas, com antialias) ou puxar `sharp`/`resvg` so pra gerar
 * icone.
 *
 * O desenho e simples o bastante pra nao precisar de nenhum dos dois: um corpo
 * de ovo, uma linha quebrada e um brilho. O que se perde e a curva exata dos
 * beziers; o que se ganha e o gerador continuar sendo a unica fonte dos PNGs,
 * que e o que o auditor promete.
 *
 * Coordenadas normalizadas em [0,1] sobre o tile, como a marca anterior.
 */

/** Centro e raios do corpo. `CY` abaixo do meio: ovo tem a barriga embaixo. */
const OVO_CX = 0.5;
const OVO_CY = 0.55;
const OVO_RX = 0.285;
const OVO_RY = 0.365;
/** Quanto a metade de cima sobe. 3,6px em 48 do handoff = 0,075. */
const LEVANTA = 0.075;
/** Altura media da quebra. */
const FENDA = 0.475;

/**
 * Meia-largura do ovo naquela altura.
 *
 * E uma elipse com o raio horizontal crescendo de cima pra baixo (`1 + 0.13 *
 * ny`): sem essa inclinacao sai um ovo simetrico, que le como bola.
 */
function meiaLargura(ny: number): number {
  if (ny < -1 || ny > 1) return 0;
  return OVO_RX * (1 + 0.13 * ny) * Math.sqrt(1 - ny * ny);
}

function dentroDoOvo(u: number, v: number): boolean {
  const ny = (v - OVO_CY) / OVO_RY;
  return Math.abs(u - OVO_CX) <= meiaLargura(ny);
}

/**
 * A altura da quebra naquele `u` — onda triangular.
 *
 * @param dentes Quantos picos. Menos dentes nos tamanhos pequenos: a 32px cada
 *   dente tem menos de um pixel de base e o zigue-zague vira uma linha borrada,
 *   que e pior que uma linha reta. Mesma logica do `simple` da marca anterior —
 *   desenhar menos mostra mais.
 */
function alturaDaFenda(u: number, dentes: number, amp: number): number {
  const t = (u - OVO_CX) / OVO_RX;
  const fase = (((t * dentes) % 2) + 2) % 2;
  const onda = Math.abs(fase - 1) * 2 - 1;
  return FENDA + amp * onda;
}

/** Distancia de um ponto a um segmento, pros raios de luz. */
function distSegmento(
  u: number,
  v: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((u - ax) * vx + (v - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(u - (ax + vx * t), v - (ay + vy * t));
}

/*
 * Os tres raios que descem da fenda, do SVG do handoff:
 * `M20.5 22.5l-2.5 5  M27.5 22.5l2.5 5  M24 21.5v6`, traco 2, ponta redonda.
 * Dividido por 48 pra virar coordenada normalizada. Eles abrem em leque —
 * e o que faz a luz parecer VINDO de dentro do ovo em vez de pousada em cima.
 */
const RAIOS = [
  [0.427, 0.469, 0.375, 0.573],
  [0.573, 0.469, 0.625, 0.573],
  [0.5, 0.448, 0.5, 0.573],
] as const;
/** Metade do traco de 2 em 48. */
const RAIO_ESPESSURA = 1 / 48;

function ovoAt(
  u: number,
  v: number,
  simples: boolean,
  paleta: Paleta,
  fundo: readonly [number, number, number],
): readonly [number, number, number] | null {
  const dentes = simples ? 2.2 : 3.4;
  const amp = simples ? 0.016 : 0.026;
  /*
   * ⚠️ A FENDA ENGROSSA NOS TAMANHOS PEQUENOS, e o handoff pede isso por
   * escrito: "nos raios pequenos (34px), engrosse os traços: a fenda tem que
   * continuar legível".
   *
   * Medido no favicon de 32px com o valor unico de 0,075: a abertura dava 2,4
   * pixels, e depois do antialias sobrava um risco violeta claro dentro de uma
   * mancha branca — o ovo lia como uma pedra. Em 0,115 sao 3,7 pixels, e a
   * fenda volta a ser a coisa que se ve primeiro.
   *
   * Nao da pra usar 0,115 em tudo: no icone de 512 a mesma proporcao abre um
   * vao largo demais e as duas metades deixam de parecer o MESMO ovo.
   */
  const levanta = simples ? 0.115 : LEVANTA;
  const fenda = alturaDaFenda(u, dentes, amp);

  // Metade de BAIXO: o ovo normal, do zigue-zague pra baixo.
  if (v >= fenda && dentroDoOvo(u, v)) {
    // Os raios sao pintados SOBRE a casca de baixo — luz batendo por dentro.
    // Nos tamanhos pequenos eles nao entram: com 2/48 de traco, a 32px cada
    // raio tem 1,3 pixel e os tres viram uma mancha roxa unica sobre a casca,
    // que le como sujeira. Mesma regra do zigue-zague.
    if (!simples) {
      for (const [ax, ay, bx, by] of RAIOS) {
        if (distSegmento(u, v, ax, ay, bx, by) <= RAIO_ESPESSURA) return paleta.luz;
      }
    }
    return paleta.casca;
  }

  // Metade de CIMA: desenhada a partir de um ponto `LEVANTA` mais abaixo, que e
  // o que a faz aparecer levantada. O teste da fenda usa o MESMO ponto de
  // origem, senao a casca de cima ficaria cortada na altura errada.
  const origem = v + levanta;
  if (origem < alturaDaFenda(u, dentes, amp) && dentroDoOvo(u, origem)) {
    return paleta.casca;
  }

  /*
   * A luz saindo pela fenda: a faixa entre a casca levantada e a de baixo.
   *
   * Ela nao e um retangulo — segue a mesma onda, entao a luz aparece exatamente
   * onde a casca abriu. A intensidade cai do centro da fenda pras bordas do
   * ovo, que e o que faz ela parecer vindo de DENTRO em vez de pintada por
   * cima.
   */
  if (v < fenda && v > fenda - levanta - 0.012) {
    const ny = (v - OVO_CY) / OVO_RY;
    const meia = meiaLargura(ny);
    if (meia <= 0) return null;
    const lateral = Math.abs(u - OVO_CX) / meia;
    if (lateral > 1) return null;
    // Perto da borda a luz apaga: 1 no centro, 0 na casca.
    const forca = Math.max(0, 1 - lateral * lateral);
    if (forca < 0.12) return null;
    return [
      fundo[0] + (paleta.luz[0] - fundo[0]) * forca,
      fundo[1] + (paleta.luz[1] - fundo[1]) * forca,
      fundo[2] + (paleta.luz[2] - fundo[2]) * forca,
    ] as const;
  }

  return null;
}

function renderIcon(
  size: number,
  forma: Forma,
  monoScale: number,
  tema: Tema,
): Uint8Array {
  const paleta = PALETAS[tema];
  const rgba = new Uint8Array(size * size * 4);
  const cheio = forma === "cheio";

  // No `cheio` o tile vai de borda a borda e a forma e um quadrado: raio zero,
  // margem zero. Quem arredonda e o sistema, e desenhar o raio aqui produz o
  // canto duplo descrito no tipo `Forma`.
  const inset = cheio ? 0 : size * 0.06;
  const half = size / 2 - inset;
  // 30/112 do handoff — o mesmo raio que ele usa no tile grande, 112/418.
  const radius = cheio ? 0 : size * (30 / 112);
  // Abaixo disto o zigue-zague nao cabe em pixel nenhum. Ver `alturaDaFenda`:
  // com 3,4 dentes a 32px cada um tem menos de um pixel de base e a quebra vira
  // uma linha borrada — pior que uma linha quase reta. Desenhar menos mostra
  // mais, e e a mesma decisao que a marca anterior tomava com a cabeca de seta.
  const simple = size <= 40;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      const d = roundedRectSdf(px, py, size / 2, size / 2, half, half, radius);
      const coverage = Math.max(0, Math.min(1, 0.5 - d));
      if (coverage <= 0) continue;

      const fundo = tileAt(px / size, py / size, paleta);
      let r: number = fundo[0];
      let g: number = fundo[1];
      let b: number = fundo[2];

      // A marca por cima, com antialias por supersampling 4x4. Quatro amostras
      // bastavam pro monograma, que era todo reto; a ponta da barra decisiva e
      // uma diagonal rasa e ficava serrilhada nos tamanhos pequenos.
      let hits = 0;
      let mr = 0;
      let mg = 0;
      let mb = 0;
      for (const oy of [-0.375, -0.125, 0.125, 0.375]) {
        for (const ox of [-0.375, -0.125, 0.125, 0.375]) {
          const u = (px + ox - size / 2) / (size * monoScale) + 0.5;
          const w = (py + oy - size / 2) / (size * monoScale) + 0.5;
          const color = ovoAt(u, w, simple, paleta, fundo);
          if (!color) continue;
          hits++;
          mr += color[0];
          mg += color[1];
          mb += color[2];
        }
      }
      if (hits > 0) {
        const a = hits / 16;
        r = r * (1 - a) + (mr / hits) * a;
        g = g * (1 - a) + (mg / hits) * a;
        b = b * (1 - a) + (mb / hits) * a;
      }

      /*
       * A QUINA ILUMINADA, que e o que separa um tile de um quadrado pintado.
       *
       * O handoff pede duas coisas: `border: .5px solid rgba(255,255,255,.14)`
       * em volta inteira, e `inset 0 1.5px 1px rgba(255,255,255,.22)` — uma luz
       * empurrada 1,5px PRA BAIXO e recortada por dentro, que por isso so
       * aparece na aresta de CIMA. E a luz do ambiente batendo na quina, o
       * mesmo truque dos icones do iOS.
       *
       * Aqui a segunda sai deslocando a forma e perguntando onde ela ja saiu:
       * amostrar 1,5px acima equivale a baixar o retangulo. Onde o deslocado ja
       * e de fora mas o real ainda e de dentro, tem luz.
       *
       * ⚠️ O SINAL AQUI ESTAVA TROCADO, e o efeito era o oposto do documentado.
       * Amostrar a SDF em `py + δ` descreve a forma subida em δ, e a faixa
       * "dentro da real, fora da deslocada" cai entao EMBAIXO. Com
       * `py - quinaLado * δ`, o tema escuro (`quinaLado: -1`) virava `py + δ` e
       * acendia a aresta de BAIXO, e o claro escurecia a de CIMA. Os dois
       * temas saiam com o relevo invertido — luz vindo do chao.
       *
       * Nao aparecia em teste porque a quina e 22% de branco numa aresta de
       * 1,5px: da pra olhar o icone e nao saber apontar o que esta errado, so
       * que ele parece chapado. Foi conferido medindo o brilho medio das duas
       * arestas, e nao no olho.
       */
      if (!cheio) {
        const escala = size / 112; // o tile do handoff mede 112
        // A borda fina: o que esta dentro da forma mas fora dela encolhida.
        const dentro = Math.max(0, Math.min(1, 0.5 - (d + 0.5 * escala)));
        const borda = coverage - dentro;
        // A luz da quina: a forma empurrada `quinaLado` * 1,5px.
        const dQuina = roundedRectSdf(
          px,
          py + paleta.quinaLado * 1.5 * escala,
          size / 2,
          size / 2,
          half,
          half,
          radius,
        );
        const faixa = Math.max(escala, 0.5);
        const quina =
          Math.max(0, Math.min(1, (dQuina + 0.5 * escala) / faixa)) * coverage;

        const a = Math.min(1, borda * 0.14 + quina * paleta.quinaAlfa);
        r = r * (1 - a) + paleta.quina[0] * a;
        g = g * (1 - a) + paleta.quina[1] * a;
        b = b * (1 - a) + paleta.quina[2] * a;
      }

      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = Math.round(coverage * 255);
    }
  }

  return rgba;
}

await mkdir(OUT_DIR, { recursive: true });

/*
 * Cada arquivo sai duas vezes: escuro e claro.
 *
 * O favicon TROCA sozinho — `<link rel="icon" media="(prefers-color-scheme:
 * dark)">` e respeitado pelos navegadores atuais. O icone instalado NAO troca:
 * o manifest nao tem como declarar variante por tema, e o sistema copia o
 * arquivo uma vez, na hora de instalar. O escuro fica como padrao porque o app
 * abre no escuro e o `background_color` do manifest e preto.
 */
/*
 * A terceira coluna e quanto do quadro a MARCA ocupa, e os dois `cheio` pedem
 * numeros diferentes porque as duas mascaras comem coisas diferentes.
 *
 * O Android recorta ate 10% de cada borda e a forma da mascara varia por
 * fabricante — pode ser circulo. A especificacao chama de zona segura o circulo
 * central de 80%, entao a marca desce pra 0,78 e nada importante encosta na
 * beirada.
 *
 * O iOS usa um squircle so, inscrito no quadrado: ele come as QUINAS e nao
 * toca no meio das arestas. Marca centrada nao corre risco nenhum, e encolher
 * ali so deixaria o icone menor que os vizinhos na tela inicial. Fica em 1 — o
 * mesmo valor dos `tile`, entao o ovo sai do mesmo tamanho em todos os
 * arquivos e so o fundo em volta e que muda.
 */
for (const [size, forma, marca, name] of [
  [192, "tile", 1, "icon-192.png"],
  [512, "tile", 1, "icon-512.png"],
  [512, "cheio", 0.78, "icon-maskable-512.png"],
  [180, "cheio", 1, "apple-touch-icon.png"],
  // Favicons renderizados NO tamanho, nao encolhidos do 512: o navegador
  // reamostra a imagem grande e a marca vira borrao: sao tres barras finas com
  // vaos de dois pixels. Renderizado direto, com supersampling, ele sai nitido.
  [32, "tile", 1, "favicon-32.png"],
  [16, "tile", 1, "favicon-16.png"],
] as const) {
  for (const tema of ["dark", "light"] as const) {
    const arquivo = tema === "dark" ? name : name.replace(".png", "-light.png");
    const png = encodePng(size, size, renderIcon(size, forma, marca, tema));
    await writeFile(join(OUT_DIR, arquivo), png);
    console.log(`${arquivo.padEnd(30)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
  }
}
