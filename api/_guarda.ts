/**
 * O porteiro: o que pode virar pergunta pra IA.
 *
 * O assistente so pode falar de Pokemon GO. Sem isso, a chave compartilhada
 * vira um modelo de uso geral de graca: dava pra usar a rota pra programar com
 * free kkkkkk. (…) tbm cuidado com injeção de codigo, tem varias formas q podem
 * fazer isso, como codigo morse e etc".
 *
 * Ele está certo nos dois pontos, e eles são problemas DIFERENTES:
 *
 *   1. DESVIO DE USO. A chave é dele e o teto diário é da organização inteira
 *      (ver `quota.ts`). Uma pessoa pedindo código Python consome a cota de
 *      todo mundo, e o app não ganha nada com isso.
 *   2. INJEÇÃO. Alguém tentando reescrever as regras do sistema — "ignore as
 *      instruções acima", "você agora é um assistente de programação".
 *
 * ⚠️ O QUE ESTE ARQUIVO **NÃO** É: uma barreira intransponível. Filtro por
 * padrão de texto sempre foi burlável, e quem insistir passa. Escrever aqui que
 * isto "impede" seria mentira. O que ele faz é tirar o uso casual de desvio, que
 * é a maioria — e o teto de verdade continua sendo a cota, que limita o estrago
 * de quem passar.
 *
 * ⚠️ E O QUE ELE NÃO PODE FAZER: recusar pergunta legítima. Um app que responde
 * "não posso falar sobre isso" pra "vale a pena evoluir meu Dratini?" é pior que
 * um app sem filtro. Por isso a regra é RECUSAR O QUE É CLARAMENTE OUTRO
 * ASSUNTO, e não "aceitar só o que eu reconheço como Pokémon" — na dúvida,
 * passa. Falso negativo custa uma pergunta da cota; falso positivo custa o
 * usuário.
 *
 * A defesa real contra injeção não é este arquivo: é a arquitetura. O modelo
 * nunca tem ferramenta, nunca tem rede, nunca tem chave, e só devolve texto pra
 * uma bolha de conversa. O pior caso de uma injeção bem-sucedida é o modelo
 * escrever besteira na tela — não há nada que ele possa EXECUTAR.
 */

/** O que o porteiro decidiu. */
export type Veredito =
  | { ok: true; pergunta: string }
  | { ok: false; motivo: "fora-do-assunto" | "injecao" | "vazia" | "longa" };

/** Teto de tamanho. A pergunta mais longa que faz sentido aqui tem uns 200. */
const MAX = 500;

/**
 * Normaliza pra comparar: minúsculas, sem acento, sem pontuação repetida.
 *
 * Sem isto, "IGNORE as instruções" e "ignore as instruções" seriam padrões
 * diferentes, e trocar um acento burlaria a lista inteira.
 */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Separadores usados pra furar filtro: "i-g-n-o-r-e", "i.g.n.o.r.e".
    .replace(/[.\-_*~`|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tentativa de reescrever as regras.
 *
 * A lista é curta de propósito: cada padrão aqui é uma frase que NÃO aparece numa
 * pergunta honesta sobre Pokémon. "Ignore o que falei antes" sobre um Pokémon
 * seria escrito de outro jeito.
 */
const INJECAO = [
  /ignor\w* (as |todas as |suas |essas |o que |tudo )?(instruc|regras|ordens|acima|anterior|prompt)/,
  /desconsidere (as |suas |essas )?(instruc|regras)/,
  /(voce|tu) (agora |a partir de agora )?(e|eh|sera|vai ser) (um|uma) (?!pokedex)/,
  /(esqueca|apague) (as |suas |tudo )?(instruc|regras|o que)/,
  /(system|sistema) ?(prompt|mensagem)/,
  /(aja|atue|comporte-?se) como (um|uma)/,
  /(modo|mode) (desenvolvedor|developer|dan|jailbreak|debug)/,
  /reveal|repita (as |suas )?(instruc|regras)|print your (instructions|prompt)/,
  /new instructions?:|nova(s)? instruc\w+:/,
];

/**
 * "Faz isto pra mim", nas duas conjugacoes.
 *
 * ⚠️ Uma lista so, usada por TODOS os padroes abaixo, e isso e o ponto.
 *
 * Antes cada regex escrevia os proprios verbos, e elas divergiram: uma tinha
 * "crie" e nenhuma tinha "cria". "cria um site em html e css pra mim" nao batia
 * em padrao nenhum — vinha sendo barrada por ACIDENTE, pelo detector de base64
 * quebrado (26 letras sem pontuacao). O teste dela passava pelo motivo errado.
 *
 * Imperativo e indicativo se escrevem os dois no chat, e frequentemente sem
 * acento: "escreva", "escreve", "faca", "faz". Meia lista deixa passar metade
 * dos pedidos.
 */
const PEDIR =
  "(escrev[ae]|cri[ae]|faz|faca|ger[ae]|gere|mont[ae]|monte|implementa?|implemente|" +
  "corrig[ei]|corrija|refator[ae]|otimiz[ae]|programa?|write|create|generate|build|make|debug\\w*)";

/** Linguagens e tecnologias. Tambem uma lista so, pelo mesmo motivo. */
const LINGUAGEM =
  "(python|javascript|typescript|java|c\\+\\+|c#|sql|html|css|php|rust|kotlin|swift|golang|bash|shell|react|node)";

/** O que se pede quando se pede codigo. */
const ARTEFATO =
  "(codigo|code|script|funcao|function|classe|class|programa|app|site|api|regex|algoritmo|algorithm)";

/**
 * Assuntos que claramente não são Pokémon GO.
 *
 * Programação em primeiro lugar porque foi o exemplo dele, e porque é o desvio
 * de uso mais provável numa chave gratuita.
 *
 * As tres primeiras cobrem as tres ordens em que o pedido aparece: artefato
 * antes da linguagem, linguagem antes do verbo, e verbo antes de qualquer um
 * dos dois. Faltava a terceira, e era a mais natural de todas.
 */
const FORA = [
  // Programação — o caso que ele citou.
  new RegExp(`\\b${ARTEFATO}\\b.*\\b${LINGUAGEM}\\b`),
  new RegExp(`\\b${LINGUAGEM}\\b.*\\b(${ARTEFATO.slice(1, -1)}|${PEDIR.slice(1, -1)})\\b`),
  new RegExp(`\\b${PEDIR}\\b.*\\b(${ARTEFATO.slice(1, -1)}|${LINGUAGEM.slice(1, -1)})\\b`),
  /\bstack ?overflow\b|\bgit(hub)?\b|\bnpm\b|\bdocker\b/,
  // Escola e trabalho.
  /\b(redacao|dissertacao|monografia|tcc|resumo do livro|essay|homework|dever de casa)\b/,
  /\b(traduza|translate)\b(?!.*\b(pokemon|golpe|ataque|move)\b)/,
  /\bcurriculo\b|\bcarta de apresentacao\b|\bcover letter\b|\bresume\b/,
  // Outros domínios inteiros.
  /\b(receita|recipe)\b.*\b(bolo|comida|jantar|almoco|cake|dinner)\b/,
  /\b(diagnostic\w+|sintoma|remedio|medicamento|dosagem)\b/,
  /\b(investi|acao da bolsa|bitcoin|cripto|bolsa de valores|stock market)\w*\b/,
  /\b(advogado|processo judicial|contrato de|juridic\w+)\b/,
];

/**
 * Palavras que garantem que é sobre o jogo.
 *
 * Servem de SALVO-CONDUTO: se a pergunta tem uma destas, ela passa mesmo que
 * bata num padrão de "fora do assunto". Existe porque os padrões acima são
 * grosseiros de propósito, e "qual o melhor moveset pro meu Charizard?" não pode
 * morrer porque alguém pôs "go" numa regex.
 *
 * Não inclui nomes de espécie: são 1.181 e a lista viveria desatualizada. Quem
 * pergunta o nome de um Pokémon sem nenhuma destas palavras cai no caso geral —
 * que é PASSAR, porque nenhum padrão de "fora" vai bater também.
 */
const DO_JOGO =
  /\b(pokemon|pokedex|pokebola|iv|cp|pc|ps|raid|raide|ginasio|gym|pvp|liga|great|ultra|master|evolu|candy|doce|poeira|stardust|shiny|shadow|sombroso|purificar|lucky|sortudo|mega|dynamax|gigantamax|golpe|move|moveset|ataque rapido|carregado|charged|tipo|type|counter|atacante|defensor|treinador|trainer|nivel|level|stardust|transferir|trocar|troca|apraisal|avaliacao|stat|atributo|especie|geracao|kanto|johto|hoenn|sinnoh|unova|kalos|alola|galar|paldea|team rocket|rocket|incenso|isca|ovo|egg|amigo|buddy|companheiro)\b/;

/**
 * Passa ou não passa.
 *
 * Roda ANTES de gastar cota: barrar depois de chamar a API não protegeria nada.
 */
export function filtrar(bruta: string): Veredito {
  const pergunta = bruta.trim();
  if (pergunta === "") return { ok: false, motivo: "vazia" };
  if (pergunta.length > MAX) return { ok: false, motivo: "longa" };
  return filtrarConteudo(pergunta);
}

/**
 * Só a parte de ABUSO: assunto e injeção. Sem limite de tamanho, sem "vazia".
 *
 * ⚠️ Isto existe por um bug que so apareceu com a bolha de conversa montada: eu
 * rodava `filtrar` no SERVIDOR sobre todo o texto do usuario — que inclui o
 * dossie que o proprio app monta, com ~1.500 caracteres. O teto de 500, que faz
 * todo sentido pra uma PERGUNTA, rejeitava o contexto do app.
 *
 * Na tela: "vale a pena evoluir ele?" voltou "fora do assunto: este endpoint so
 * responde sobre Pokemon GO". Uma pergunta perfeitamente valida, barrada pelo
 * meu proprio filtro, com a mensagem errada ainda por cima.
 *
 * A causa e de desenho: `filtrar` fazia dois trabalhos diferentes. Validar uma
 * PERGUNTA (tamanho, vazia) e detectar ABUSO (assunto, injecao) sao coisas
 * distintas, e so a segunda faz sentido sobre um texto que o app gerou.
 *
 * O tamanho do payload continua limitado — por `MAX_CHARS` em `api/ai.ts`, que
 * e o lugar certo: la o teto e do PEDIDO, nao da pergunta.
 */
export function filtrarConteudo(texto: string): Veredito {
  const pergunta = texto.trim();
  if (pergunta === "") return { ok: false, motivo: "vazia" };

  const n = normalizar(pergunta);

  /*
   * Texto codificado.
   *
   * Ele citou morse. O ponto geral é mais amplo: qualquer codificação serve pra
   * esconder instrução de um filtro que lê texto claro — morse, base64, hex,
   * binário. Nenhuma delas aparece numa pergunta honesta sobre Pokémon, então a
   * regra não precisa DECODIFICAR pra decidir: basta reconhecer que a mensagem
   * é predominantemente código e recusar.
   *
   * Isto é barato e não tem falso positivo plausível — ninguém escreve
   * "01001000" perguntando de Dratini.
   */
  /*
   * ⚠️ Estes testes rodam no texto CRU, não no normalizado — e este comentário
   * existe porque eu errei aqui primeiro. `normalizar` remove `.` e `-` (pra
   * "i-g-n-o-r-e" não furar a lista de injeção), o que apaga exatamente os dois
   * caracteres de que o morse é feito. Eu estava procurando morse no texto do
   * qual já tinha removido o morse, e o teste passou reto.
   */
  const cru = pergunta.trim();
  /*
   * ⚠️ CODIFICACAO PRECISA PARECER CODIFICACAO, e nao so "texto sem pontuacao".
   *
   * O detector de base64 era `/^[A-Za-z0-9+/]{24,}={0,2}$/` sobre o texto sem
   * espacos. Parece razoavel e esta errado de um jeito devastador: TODA frase
   * de 24+ letras vira uma sequencia de `[A-Za-z]` quando se tiram os espacos.
   *
   *   "qual o melhor ataque do dragonite"    → 28 letras → acusada de INJECAO
   *   "qual o melhor moveset do dragonite"   → 29 letras → acusada de INJECAO
   *   "what is the best attack for dragonite" → 31 letras → acusada de INJECAO
   *
   * E o app respondia "fora do assunto: este endpoint so responde sobre Pokemon
   * GO" pra pergunta mais comum que existe sobre Pokemon GO. Escapavam so as
   * frases curtas ou com acento/interrogacao — "esse blissey presta?" passava,
   * o que fazia o bug parecer aleatorio em vez de sistematico.
   *
   * O cabecalho deste arquivo diz, em maiuscula, que o filtro NAO PODE recusar
   * pergunta legitima, e que falso positivo custa o usuario. A regra violava a
   * propria doutrina do arquivo, e nenhum teste pegou porque os casos de teste
   * eram curtos.
   *
   * O conserto e exigir o que base64 de verdade tem e prosa nao tem: tamanho
   * multiplo de 4, MAIUSCULA e minuscula na mesma palavra, e pelo menos um
   * digito ou simbolo. Um payload base64 de mais de 20 caracteres praticamente
   * sempre tem os tres; uma frase em portugues nao tem nenhum.
   *
   * O mesmo raciocinio vale pro hex: exigir ao menos um digito. Sem isso,
   * qualquer frase escrita so com as letras de "a" a "f" seria hex — raro, mas
   * a correcao e de graca.
   */
  /*
   * ⚠️ O ESPACO E A DISCRIMINANTE. Nao a forma das letras.
   *
   * A primeira versao juntava tudo (`cru.replace(/\s/g, "")`) e perguntava se o
   * resultado parecia base64. Toda frase de 24+ letras parece. Exigir maiuscula,
   * minuscula e digito junto reduziu, mas nao resolveu:
   *
   *   "esse IV 14/15/13 e bom pra Great League"
   *     → 32 caracteres, multiplo de 4, tem IV maiusculo, tem minuscula,
   *       tem digito, tem "/" — e a barra vem do IV. Base64 perfeito.
   *
   * Escrever IV como "14/15/13" e o jeito NORMAL de escrever IV neste app.
   *
   * A diferenca de verdade entre prosa e texto codificado nao esta nas letras:
   * esta em que prosa tem ESPACO e um blob codificado e um token so. Entao a
   * pergunta certa nao e "o texto inteiro parece base64" — e "existe aqui uma
   * PALAVRA de 24+ caracteres que parece base64". Nenhuma lingua humana tem.
   *
   * Isso tambem torna as regras de tamanho desnecessarias e o filtro mais
   * previsivel: ele para de depender de quanto a pessoa escreveu.
   */
  const tokens = cru.split(/\s+/);

  const ehMorse = /^[.‐-―/ ]{12,}$/.test(cru) || /[.-]{6,}/.test(cru.replace(/ /g, ""));
  const ehBinario = /^[01\s]{16,}$/.test(cru);
  const ehHex = tokens.some(
    (t) => t.length >= 24 && /^(0x)?[0-9a-f]+$/i.test(t) && /[0-9]/.test(t),
  );
  const ehBase64 = tokens.some(
    (t) =>
      t.length >= 24 &&
      t.length % 4 === 0 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(t) &&
      /[A-Z]/.test(t) &&
      /[a-z]/.test(t) &&
      /[0-9+/]/.test(t),
  );
  if (ehMorse || ehBinario || ehHex || ehBase64) return { ok: false, motivo: "injecao" };

  for (const p of INJECAO) if (p.test(n)) return { ok: false, motivo: "injecao" };

  // O salvo-conduto vem ANTES da lista de fora: falar do jogo ganha da suspeita.
  if (DO_JOGO.test(n)) return { ok: true, pergunta };

  for (const p of FORA) if (p.test(n)) return { ok: false, motivo: "fora-do-assunto" };

  // Não reconheci nem como do jogo nem como fora: passa. Ver a nota do topo —
  // na dúvida o custo de recusar é maior que o de responder.
  return { ok: true, pergunta };
}
