import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Baixa as fontes pra `public/fontes/` e gera o `@font-face` local.
 *
 * ⚠️ POR QUE ISTO EXISTE ─────────────────────────────────────────────────────
 *
 * O `index.html` pedia as fontes ao CDN do Google em TODA abertura do app:
 *
 *     <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans…">
 *
 * E a tela de Privacidade promete, com estas palavras: "Se você deixar a IA e a
 * voz desligadas, **nada sai**". A lista de terceiros que recebem algo nomeia
 * Groq, Microsoft, ElevenLabs, Vercel e GitHub Pages — o Google não está lá.
 *
 * Só que uma requisição a `fonts.googleapis.com` entrega IP e User-Agent, com a
 * IA e a voz desligadas, antes de a pessoa tocar em nada. A promessa era falsa
 * por descuido, e num app cuja tese é "zero rastreio" essa é a frase que menos
 * pode estar errada. (É também exatamente o uso que tribunais alemães multaram
 * sob o GDPR — servir Google Fonts por CDN sem consentimento.)
 *
 * Havia duas saídas: declarar o Google na lista, ou tirar o Google. A segunda
 * deixa a frase verdadeira em vez de menor, e ainda conserta o offline — hoje,
 * sem internet, o app cai pra fonte do sistema e muda de cara.
 *
 * ⚠️ O PRECEDENTE JÁ ESTAVA NO REPOSITÓRIO. Os arquivos do leitor de texto são
 * auto-hospedados desde sempre, e o `fetch-ocr.ts` lista os três motivos:
 * offline de verdade, nada sai pra domínio de terceiro, e o app não quebra se o
 * CDN sair do ar (já aconteceu neste projeto, quando o repositório RetroJohns
 * foi deletado). Os três valem igual pra fonte. Ela só tinha passado batido.
 *
 * ── Licença ─────────────────────────────────────────────────────────────────
 *
 * As duas famílias são SIL Open Font License 1.1, que PERMITE redistribuir —
 * inclusive embutida — desde que a licença acompanhe. É por isso que este
 * script grava o `OFL.txt` junto e a tela Sobre cita as duas. Fonte proprietária
 * não poderia ser auto-hospedada, e aí a resposta certa seria outra fonte.
 *
 * ── Não é versionado ────────────────────────────────────────────────────────
 *
 * `public/fontes/` está no .gitignore, como `public/ocr/` e `public/dataset/`:
 * é binário reconstruível em segundos, e um diff de centenas de KB a cada
 * atualização não serve pra ninguém. O `build` roda este script antes.
 */

const aqui = dirname(fileURLToPath(import.meta.url));
const destino = join(aqui, "..", "public", "fontes");

/**
 * O que o CSS do app pede. Tem que casar com `--tk-font` e `--tk-mono`.
 *
 * Os pesos são os que o CSS realmente usa — pedir 100..900 baixaria o dobro
 * pra nada. Se alguém acrescentar um peso novo no CSS sem passar por aqui, o
 * navegador sintetiza (fica gordo e torto) em vez de quebrar; por isso a lista
 * fica ao lado da que o `index.html` pedia, e não escondida.
 */
const FAMILIAS = [
  { nome: "Plus Jakarta Sans", pesos: [400, 500, 600, 700, 800] },
  { nome: "IBM Plex Mono", pesos: [400, 500, 600] },
] as const;

/**
 * ⚠️ UA DE NAVEGADOR MODERNO, e isto NÃO é disfarce — é negociação de formato.
 *
 * A API do Google devolve o formato que o cliente aguenta. Sem User-Agent (ou
 * com o do Node) ela responde com `truetype`, que é 3 a 4 vezes maior que
 * `woff2` e não tem hinting variável. Pedindo como um Chrome atual, vem woff2.
 */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const OFL = "https://raw.githubusercontent.com/tokotype/PlusJakartaSans/master/OFL.txt";

function urlDoCss(): string {
  const partes = FAMILIAS.map(
    (f) => `family=${f.nome.replace(/ /g, "+")}:wght@${f.pesos.join(";")}`,
  );
  // `display=swap`: o texto aparece na hora com a fonte do sistema e troca
  // quando a nossa carrega. Sem isso a primeira tela fica em branco.
  return `https://fonts.googleapis.com/css2?${partes.join("&")}&display=swap`;
}

async function baixar(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} respondeu ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function principal(): Promise<void> {
  mkdirSync(destino, { recursive: true });

  const cssRemoto = (await baixar(urlDoCss())).toString("utf8");

  /*
   * Cada bloco `@font-face` do Google traz UM subconjunto (latin, latin-ext,
   * cyrillic, vietnamese…) com seu `unicode-range`. Guardamos todos: o app fala
   * dez idiomas, e cortar o cyrillic quebraria o russo — que é justamente o
   * idioma onde ninguém ia reparar até alguém reclamar.
   */
  const arquivos = new Map<string, string>();
  let baixados = 0;

  const cssLocal = await (async () => {
    const urls = [...cssRemoto.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)];
    for (const [, url] of urls) {
      if (arquivos.has(url!)) continue;
      // O nome do arquivo do Google já é único e estável (hash no caminho).
      const nome = url!.split("/").slice(-2).join("-").replace(/[^\w.-]/g, "_");
      const caminho = join(destino, nome);
      if (!existsSync(caminho)) {
        writeFileSync(caminho, await baixar(url!));
        baixados++;
      }
      arquivos.set(url!, nome);
    }
    let saida = cssRemoto;
    for (const [url, nome] of arquivos) saida = saida.split(url).join(`./${nome}`);
    return saida;
  })();

  const cabecalho = [
    "/*",
    " * GERADO POR `pnpm --filter @trainerkit/web fontes`. Não edite à mão.",
    " *",
    " * Fontes servidas da MESMA ORIGEM do app, e não do CDN do Google — ver a",
    " * nota longa em `scripts/fetch-fontes.ts`. A tela de Privacidade promete",
    ' * que "nada sai" com a IA e a voz desligadas, e com o CDN isso era falso.',
    " *",
    " * Plus Jakarta Sans e IBM Plex Mono — SIL Open Font License 1.1 (OFL.txt).",
    " */",
    "",
  ].join("\n");

  writeFileSync(join(destino, "fontes.css"), cabecalho + cssLocal);

  // A licença viaja junto: é a condição da OFL pra redistribuir.
  const oflPath = join(destino, "OFL.txt");
  if (!existsSync(oflPath)) writeFileSync(oflPath, await baixar(OFL));

  const total = readdirSync(destino)
    .filter((f) => f.endsWith(".woff2"))
    .reduce((soma, f) => soma + statSync(join(destino, f)).size, 0);

  console.log(
    `  fontes: ${arquivos.size} arquivos (${baixados} baixados agora), ` +
      `${(total / 1024).toFixed(0)} KB no total`,
  );
}

await principal();
