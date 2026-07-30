/**
 * O porteiro: o que pode virar pergunta pra IA.
 *
 * O Miguel: "coloca um filtro no assistente de ia tbm. pra tipo, nao poder falar
 * nada alem de pokemon go. imagina, os cara usando isso pra programar com api
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
 * Assuntos que claramente não são Pokémon GO.
 *
 * Programação em primeiro lugar porque foi o exemplo dele, e porque é o desvio
 * de uso mais provável numa chave gratuita.
 */
const FORA = [
  // Programação — o caso que ele citou.
  /\b(codigo|code|script|funcao|function|programa)\b.*\b(python|javascript|java|c\+\+|sql|html|css|php|rust|go|typescript)\b/,
  /\b(python|javascript|typescript|sql|html|css|php|rust|kotlin|swift)\b.*\b(codigo|code|script|escreva|write|faca|crie|create)\b/,
  /\b(escreva|crie|faca|gere|write|create|generate|implemente|debug\w*|corrija)\b.*\b(codigo|code|script|funcao|function|classe|class|programa|app|site|api|regex)\b/,
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
  const ehMorse = /^[.‐-―/ ]{12,}$/.test(cru) || /[.-]{6,}/.test(cru.replace(/ /g, ""));
  const ehBinario = /^[01\s]{16,}$/.test(cru);
  const ehHex = /^(0x)?[0-9a-f\s]{24,}$/i.test(cru);
  const ehBase64 = /^[A-Za-z0-9+/]{24,}={0,2}$/.test(cru.replace(/\s/g, ""));
  if (ehMorse || ehBinario || ehHex || ehBase64) return { ok: false, motivo: "injecao" };

  for (const p of INJECAO) if (p.test(n)) return { ok: false, motivo: "injecao" };

  // O salvo-conduto vem ANTES da lista de fora: falar do jogo ganha da suspeita.
  if (DO_JOGO.test(n)) return { ok: true, pergunta };

  for (const p of FORA) if (p.test(n)) return { ok: false, motivo: "fora-do-assunto" };

  // Não reconheci nem como do jogo nem como fora: passa. Ver a nota do topo —
  // na dúvida o custo de recusar é maior que o de responder.
  return { ok: true, pergunta };
}
