import { ivTotalOf } from "./appraisal.js";
import type { CpmTable } from "./cp.js";
import { msg, type Message } from "./message.js";
import { GREAT_LEAGUE, MASTER_LEAGUE, ULTRA_LEAGUE, rankOf, type League } from "./pvp.js";
import type { BaseStats, IVs } from "./types.js";
import { decide } from "./verdict.js";

/**
 * A faxina — "esses aqui você pode soltar".
 *
 * O `IDEIAS.md` chama isto de "o maior buraco", e a razão está lá: quem joga
 * abre um app auxiliar em três situações, e a terceira é **estar com a mochila
 * cheia**. As outras duas o app já atende (acabei de pegar → escaneia; vou
 * entrar num raide → counters). Pra terceira não havia nada, e ela é a única
 * que não se resolve uma especie por vez: ninguém abre 2.000 fichas.
 *
 * ── O que este arquivo NÃO faz ───────────────────────────────────────────────
 *
 * Ele não transfere nada. O app não fala com o jogo, não tem como falar, e o
 * disclaimer da tela Sobre promete por escrito que não fala. Quem transfere é a
 * pessoa, no jogo; o que acontece aqui é a LISTA e, depois, a remoção da
 * coleção do app. A interface tem que dizer isso com essas palavras — um app que
 * insinua que aperta o botão por você é um app que vai ser acusado de ter
 * apagado um shiny.
 *
 * ── A regra que manda em tudo ────────────────────────────────────────────────
 *
 * ⚠️ TRANSFERIR É IRREVERSÍVEL NO JOGO. Não há servidor, não há lixeira, não há
 * suporte pra desfazer. Então o critério de projeto aqui não é "achar o máximo
 * de candidatos", é **nunca sugerir algo que a pessoa vá lamentar**. Um falso
 * negativo custa um espaço de mochila; um falso positivo custa uma especie.
 *
 * É por isso que a saída tem duas classes e não uma:
 *
 *   `semDuvida`  — duplicado que perde para outro DA MESMA ESPÉCIE em todos os
 *                  critérios. Não existe argumento pra guardar o 5º melhor
 *                  Pidgey. Vem pré-marcado.
 *   `voceDecide` — o veredito diz transferir, mas não há um irmão melhor pra
 *                  provar que ele sobra. Aparece, explicado, e **nunca vem
 *                  pré-marcado**.
 *
 * A separação é o que deixa o app dizer "esses são seguros" sem mentir.
 *
 * ── E os que ele se recusa a sugerir ─────────────────────────────────────────
 *
 * `guardados` não é sobra de implementação: é metade do produto. A tela mostra
 * a lista com o motivo de cada um, e é ela que responde "cadê o meu sortudo?"
 * antes que a pergunta vire desconfiança. Um app de faxina em que a pessoa não
 * consegue auditar o que ficou de fora é um app que ela usa uma vez.
 */

/** Uma especie da coleção, no mínimo que a faxina precisa saber. */
export interface BichoFaxina {
  id: string;
  speciesId: string;
  ivs: IVs;
  level: number | null;
  lucky: boolean;
  shadow: boolean;
  /** "eu tenho esse", sem IV medido. Ver `OwnedPokemon.ivDesconhecido`. */
  ivDesconhecido: boolean;
  /**
   * A pessoa já disse que fica com este, e o app aceitou.
   *
   * ⚠️ Sem isto, a faxina desfaria a decisão dela pelas costas: o veredito
   * continua dizendo "transferir" por baixo, e uma lista em lote que só lê o
   * veredito devolveria o bicho pré-marcado numa tela onde 20 outros também
   * estão. É o único lugar do app em que ignorar esta marca custaria um
   * especie.
   */
  meuMotivo?: boolean;
}

/** A espécie, no mínimo que a faxina precisa saber. */
export interface EspecieFaxina {
  id: string;
  baseStats: BaseStats;
  evolvesInto: readonly string[];
  candyToEvolve: number | null;
  legendary: boolean;
  /**
   * Faz Gigantamax.
   *
   * ⚠️ SEM ISTO AS DUAS TELAS SE CONTRADIZIAM. `decide` ja tratava o caso
   * (`dynamax.gigantamax`) e mandava guardar, mas a faxina chamava `decide`
   * sem informar o campo — entao a mesma especie recebia "guardar" na ficha e
   * podia receber "transferir" na lista. Quem le as duas conclui que o app nao
   * sabe o que esta dizendo, e tem razao.
   */
  gigantamax: boolean;
}

export interface FaxinaInput {
  bichos: readonly BichoFaxina[];
  /** Espécie por id. Quem não estiver aqui é protegido — ver `motivoDesconhecida`. */
  especies: ReadonlyMap<string, EspecieFaxina>;
  cpm: CpmTable;
  levelCap: number;
}

/**
 * O que faz uma especie ser o melhor da espécie na sua coleção.
 *
 * São quatro porque são quatro usos diferentes, e o mesmo bicho quase nunca
 * serve a todos: o melhor de Great costuma ter ataque BAIXO (ataque infla o PC
 * e obriga a parar num nível menor), e o melhor de raide é exatamente o
 * contrário. Guardar só "o de maior IV" jogaria fora o melhor de liga da pessoa
 * com a maior naturalidade do mundo.
 */
export type Coroa = "great" | "ultra" | "master" | "raide";

export type ClasseFaxina = "semDuvida" | "voceDecide";

export interface Solto {
  id: string;
  speciesId: string;
  classe: ClasseFaxina;
  motivo: Message;
  /** O irmão que fica no lugar dele. `null` quando não há duplicata. */
  perdePara: string | null;
}

export interface Guardado {
  id: string;
  speciesId: string;
  motivo: Message;
  /** Vazio quando ele está protegido por outra coisa (sortudo, sem IV…). */
  coroas: readonly Coroa[];
}

export interface Faxina {
  soltos: Solto[];
  guardados: Guardado[];
}

const LIGAS: ReadonlyArray<{ coroa: Coroa; liga: League }> = [
  { coroa: "great", liga: GREAT_LEAGUE },
  { coroa: "ultra", liga: ULTRA_LEAGUE },
  { coroa: "master", liga: MASTER_LEAGUE },
];

/**
 * Desempate estável, e não "o primeiro que aparecer".
 *
 * A coleção chega ordenada por data, e a ordem muda quando alguém escaneia
 * qualquer coisa. Sem um critério fixo, dois especie com o mesmo stat product
 * trocariam de coroa entre uma abertura da tela e a seguinte — e o que ontem
 * era "guardado" apareceria hoje pré-marcado pra transferência.
 */
function melhorEntre<T>(
  itens: readonly T[],
  nota: (item: T) => number | null,
  id: (item: T) => string,
): T | null {
  let melhor: T | null = null;
  let melhorNota = -Infinity;
  for (const item of itens) {
    const n = nota(item);
    if (n === null) continue;
    if (n > melhorNota || (n === melhorNota && melhor !== null && id(item) < id(melhor))) {
      melhor = item;
      melhorNota = n;
    }
  }
  return melhor;
}

/**
 * Quem segura qual coroa, dentro de uma espécie.
 *
 * ⚠️ A comparação é por IV, com cada um levado ao teto da liga — NÃO pelo nível
 * em que estão hoje. Nível se compra com poeira; IV não se compra com nada. Um
 * bicho no nível 40 e um irmão idêntico no nível 15 são o mesmo especie, e
 * comparar pelo estado atual sugeriria transferir o de IV melhor só porque o
 * outro já recebeu investimento.
 */
function coroas(
  membros: readonly BichoFaxina[],
  especie: EspecieFaxina,
  cpm: CpmTable,
  levelCap: number,
): Map<string, Coroa[]> {
  const mapa = new Map<string, Coroa[]>();
  const marcar = (id: string, coroa: Coroa) => {
    const atual = mapa.get(id);
    if (atual) atual.push(coroa);
    else mapa.set(id, [coroa]);
  };

  for (const { coroa, liga } of LIGAS) {
    const dono = melhorEntre(
      membros,
      (b) => rankOf(cpm, especie.baseStats, b.ivs, liga, { levelCap })?.statProduct ?? null,
      (b) => b.id,
    );
    if (dono) marcar(dono.id, coroa);
  }

  /*
   * Raide é ataque, e o desempate é o IV total.
   *
   * Não uso `rankOf` aqui de propósito: stat product é a métrica de PvP, onde
   * sobreviver vale tanto quanto bater. Em raide a especie morre e volta —
   * defesa e PS decidem quantas revidas você gasta, não quanto dano você deu.
   */
  const raide = melhorEntre(
    membros,
    (b) => b.ivs.atk * 100 + ivTotalOf(b.ivs),
    (b) => b.id,
  );
  if (raide) marcar(raide.id, "raide");

  return mapa;
}

const COROA_MOTIVO: Record<Coroa, Message> = {
  great: msg("faxina.preso.great"),
  ultra: msg("faxina.preso.ultra"),
  master: msg("faxina.preso.master"),
  raide: msg("faxina.preso.raide"),
};

export function planejarFaxina(input: FaxinaInput): Faxina {
  const soltos: Solto[] = [];
  const guardados: Guardado[] = [];

  // Agrupa por ESPÉCIE, não por família.
  //
  // Doce é por família no jogo, e a tentação de agrupar assim é real — mas a
  // comparação não sobrevive: um Machop e um Machamp não competem pela mesma
  // vaga, e dizer "este Machop perde pro seu Machamp" mandaria transferir
  // justamente o que a pessoa ia evoluir. Espécie é a unidade em que "o meu
  // melhor" quer dizer alguma coisa.
  const porEspecie = new Map<string, BichoFaxina[]>();
  for (const b of input.bichos) {
    const lista = porEspecie.get(b.speciesId);
    if (lista) lista.push(b);
    else porEspecie.set(b.speciesId, [b]);
  }

  for (const [speciesId, membros] of porEspecie) {
    const especie = input.especies.get(speciesId);

    /*
     * Espécie que o dataset não conhece: PROTEGE, não descarta.
     *
     * Acontece de verdade — dataset customizado do usuário, base antiga, forma
     * regional que saiu do índice. Sem os stats base não há veredito nem stat
     * product, e a única saída honesta é a que não custa uma especie.
     */
    if (!especie) {
      for (const b of membros) {
        guardados.push({
          id: b.id,
          speciesId,
          motivo: msg("faxina.preso.desconhecida"),
          coroas: [],
        });
      }
      continue;
    }

    /*
     * Os intocáveis saem da disputa ANTES das coroas.
     *
     * Não é só pra não sugeri-los: é pra não deixarem de coroar ninguém. Um
     * sortudo 15/15/15 que ficasse na comparação seguraria as quatro coroas
     * sozinho — e aí os irmãos normais, que são os que a pessoa realmente
     * usaria, virariam todos "duplicado sem dúvida".
     */
    const disputa: BichoFaxina[] = [];
    for (const b of membros) {
      const motivo = motivoIntocavel(b, especie);
      if (motivo) guardados.push({ id: b.id, speciesId, motivo, coroas: [] });
      else disputa.push(b);
    }
    if (disputa.length === 0) continue;

    const donas = coroas(disputa, especie, input.cpm, input.levelCap);

    /*
     * Quem substitui o duplicado, pra tela poder mostrar os dois lado a lado.
     *
     * É o que segura MAIS coroas, e não um dono qualquer do mapa: com quatro
     * coroas espalhadas por três irmãos, apontar o do raide pra justificar a
     * saída de um bicho de Great seria mostrar a comparação errada. Empate
     * desempata por id, pela mesma razão de `melhorEntre` — a lista não pode
     * mudar de resposta entre duas aberturas da tela.
     */
    const substituto =
      [...donas.entries()].sort(
        (a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1),
      )[0]?.[0] ?? null;

    for (const b of disputa) {
      const minhas = donas.get(b.id);

      if (!minhas) {
        /*
         * Não segura coroa nenhuma: existe um irmão melhor em CADA critério.
         *
         * É o único caso em que o app se permite vir pré-marcado, e a razão é
         * que a frase "perde em tudo pro seu melhor" é verificável pela própria
         * pessoa, item por item, sem confiar em nenhuma nota interna nossa.
         */
        soltos.push({
          id: b.id,
          speciesId,
          classe: "semDuvida",
          motivo: msg("faxina.solto.duplicado", { n: membros.length }),
          perdePara: substituto,
        });
        continue;
      }

      const veredito = decide({
        name: speciesId,
        baseStats: especie.baseStats,
        ivs: b.ivs,
        level: b.level ?? 20,
        cpm: input.cpm,
        levelCap: input.levelCap,
        evolvesInto: especie.evolvesInto,
        candyToEvolve: especie.candyToEvolve,
        lucky: b.lucky,
        shadow: b.shadow,
        gigantamax: especie.gigantamax,
      });

      /*
       * Segura coroa E o veredito manda transferir.
       *
       * É o último Rattata: melhor da espécie por falta de concorrência, e
       * ainda assim um Rattata. Aparece — a mochila cheia é feita disto —, mas
       * **desmarcado**, porque aqui o app não tem um irmão pra apontar e dizer
       * "este cobre o que ele fazia". Quem decide é a pessoa; o app só mostra a
       * conta.
       */
      if (veredito.action === "transferir") {
        soltos.push({
          id: b.id,
          speciesId,
          classe: "voceDecide",
          /* Sem o IV no texto: a linha da tela já mostra "3/45 · PC 1.429"
             logo acima, e repetir o número na frase de motivo faz a linha
             parecer que está dizendo duas coisas quando só diz uma. */
          motivo: msg("faxina.solto.melhorRuim"),
          perdePara: null,
        });
        continue;
      }

      guardados.push({
        id: b.id,
        speciesId,
        motivo: COROA_MOTIVO[minhas[0]!],
        coroas: minhas,
      });
    }
  }

  return { soltos, guardados };
}

/**
 * O que nunca entra na faxina, nem como sugestão desmarcada.
 *
 * A ordem é a ordem do motivo que a tela mostra, e ela importa: um sortudo sem
 * IV informado tem dois motivos válidos, e "não sei o IV dele" é o que a pessoa
 * precisa ouvir — é acionável (informe o IV) enquanto "é sortudo" é só um fato.
 */
function motivoIntocavel(b: BichoFaxina, especie: EspecieFaxina): Message | null {
  /*
   * ⚠️ SEM IV, O APP NÃO DECIDE.
   *
   * Quem entrou pelo "eu tenho esse" tem `ivs` zerado porque o tipo exige três
   * números, não porque alguém mediu zero. Ler esses zeros aqui produziria uma
   * lista de transferência "sem dúvida" cheia de especie que podem ser 100% —
   * e pré-marcada. É o pior defeito que este arquivo poderia ter.
   */
  /*
   * A decisão DELA vem antes de todas as minhas.
   *
   * Ela é a primeira da lista de propósito: se a pessoa já disse que fica com
   * este bicho, nenhum outro motivo precisa ser calculado nem mostrado. "É
   * sortudo" seria verdade e seria uma resposta pior — a razão de ele estar
   * fora da lista é ela, não o jogo.
   */
  if (b.meuMotivo) return msg("faxina.preso.meuMotivo");
  if (b.ivDesconhecido) return msg("faxina.preso.semIv");
  // Sortudo custa metade da poeira pra subir e não volta a ser trocado. Mesmo
  // ruim, ele é uma vaga barata de nível 50 que não se recompra.
  if (b.lucky) return msg("faxina.preso.sortudo");
  // Sombroso é +20% de ataque e só sai em Rocket. Um sombroso de IV medíocre
  // bate mais que um normal de IV alto — a regra `shadow.bonus` do veredito diz
  // o mesmo, e as duas telas não podem discordar.
  if (b.shadow) return msg("faxina.preso.sombroso");
  if (especie.legendary) return msg("faxina.preso.lendario");
  return null;
}
