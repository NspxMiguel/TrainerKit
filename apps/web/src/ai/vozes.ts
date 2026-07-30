import { EDGE_VOICES } from "./edgeTts.ts";
import { ELEVEN_SHARED_VOICES } from "./elevenShared.ts";
import { KOKORO_VOICES } from "./kokoro.ts";

/**
 * TODAS as vozes numa lista só, ordenadas, cada uma dizendo o que é.
 *
 * O Miguel: "app tbm meio desorganizado. voz da pokedex totalmente confuso.
 * organiza ai. tem umas 30 opcao de voz e ninguem sabe oq é de vdd."
 *
 * Ele descreveu o sintoma; a causa era de arquitetura. A tela estava organizada
 * por MOTOR — uma seção pro Kokoro, uma pra neural, uma pra ElevenLabs, uma pro
 * sistema — cada uma com o próprio interruptor e a própria lista. Quatro
 * escolhas independentes que na verdade respondiam a UMA pergunta: "qual voz lê
 * a ficha?". E o motor é detalhe de implementação: ninguém abre os Ajustes
 * querendo escolher entre "Kokoro" e "edge-tts", a pessoa quer uma voz boa.
 *
 * Então a tela passa a ter uma pergunta e uma lista. O motor vira etiqueta.
 *
 * O QUE CADA VOZ TEM QUE DIZER, e antes não dizia:
 *   · o SOTAQUE — foi o que ele pegou: "as vozes nao tao em portugues, tao em
 *     outra lingua". As vozes padrão da ElevenLabs são todas american/british.
 *     Elas falam português, mas com sotaque de quem aprendeu.
 *   · o CUSTO — "grátis" e "gasta cota do mês" são coisas muito diferentes e
 *     estavam ambas escondidas em parágrafo.
 *   · se funciona OFFLINE.
 *
 * E ordem por qualidade real, não por motor: quem abre a tela e pega a primeira
 * tem que estar pegando a melhor.
 */

export type Motor = "edge" | "kokoro" | "eleven-share" | "eleven-user" | "sistema";

export interface Voz {
  /** Único no app inteiro: `motor:id`. É o que fica salvo. */
  chave: string;
  motor: Motor;
  /** O id que o motor entende. */
  id: string;
  nome: string;
  /** Sotaque/idioma nativo, quando o motor informa. */
  sotaque: string | null;
  /** MP3 pronto pra ouvir sem gastar cota. Só a ElevenLabs fornece. */
  previa: string | null;
  /**
   * `nativa` = fala o idioma da tela como língua materna. É o corte que separa
   * "recomendada" de "outra", e é a informação que faltava na tela antiga.
   */
  nativa: boolean;
  /** Precisa de rede pra falar. */
  online: boolean;
  /** Gasta cota compartilhada — a que pode acabar pra todo mundo. */
  gastaCota: boolean;
  /** Precisa baixar modelo antes. */
  precisaBaixar: boolean;
}

/** Idioma nativo de cada voz do Edge, tirado do próprio id (`pt-BR-...`). */
function localeDoEdge(id: string): string {
  return id.split("-").slice(0, 2).join("-");
}

/**
 * As vozes da ElevenLabs compartilhada.
 *
 * ⚠️ `nativa: false` SEMPRE — e a razão mudou depois que o Miguel me corrigiu.
 *
 * Eu tinha consultado `/v2/voices` (a biblioteca PADRÃO da conta: 21 vozes,
 * todas american/british/australian) e concluído que "não existe voz brasileira
 * na ElevenLabs gratuita". Escrevi isso na tela do app. Estava errado: eu olhei
 * num lugar e afirmei sobre outro.
 *
 * Ele disse que existiam, e existem — `/v1/shared-voices?language=pt` devolve 40
 * vozes pt-BR com sotaque `brazilian`, feitas por usuários. Adriano tem 125 mil
 * usos.
 *
 * Só que usá-las pela API esbarra nisto, testado contra a chave dele:
 *
 *   402 paid_plan_required — "Free users cannot use library voices via the API."
 *
 * Então elas ficam de fora enquanto a conta for gratuita, e a tela agora diz o
 * motivo CERTO em vez da minha conclusão errada. Os ids estão no allowlist da
 * função: no dia em que a conta virar paga, é só passar a oferecê-las aqui.
 */
function dasEleven(): Voz[] {
  return ELEVEN_SHARED_VOICES.map((v) => ({
    chave: `eleven-share:${v.id}`,
    motor: "eleven-share" as const,
    id: v.id,
    nome: v.label,
    sotaque: null,
    previa: null,
    nativa: false,
    online: true,
    gastaCota: true,
    precisaBaixar: false,
  }));
}

/**
 * Monta a lista pro idioma da tela.
 *
 * `sistema` vem de fora (`speechSynthesis`) porque só o navegador sabe quais
 * vozes o aparelho tem — e elas mudam de telefone pra telefone.
 */
export function listarVozes(
  idioma: string,
  sistema: ReadonlyArray<{ voiceURI: string; name: string; lang: string }>,
): Voz[] {
  const vozes: Voz[] = [];

  // Neural (Edge): a melhor combinação de qualidade, custo e zero configuração.
  for (const v of EDGE_VOICES[idioma] ?? []) {
    vozes.push({
      chave: `edge:${v.id}`,
      motor: "edge",
      id: v.id,
      nome: v.label,
      sotaque: localeDoEdge(v.id),
      previa: null,
      nativa: localeDoEdge(v.id) === idioma || v.id.startsWith(idioma.split("-")[0]!),
      online: true,
      gastaCota: false,
      precisaBaixar: false,
    });
  }

  // Kokoro: roda no aparelho, offline, mas só existe em inglês.
  for (const v of KOKORO_VOICES[idioma] ?? []) {
    vozes.push({
      chave: `kokoro:${v.id}`,
      motor: "kokoro",
      id: v.id,
      nome: v.label,
      sotaque: idioma,
      previa: null,
      nativa: true,
      online: false,
      gastaCota: false,
      precisaBaixar: true,
    });
  }

  vozes.push(...dasEleven());

  /*
   * Vozes do sistema.
   *
   * Só as do idioma da tela, e o `voiceURI` é o identificador de verdade —
   * dois aparelhos podem ter vozes de nome igual.
   */
  const base = idioma.split("-")[0]!;
  for (const v of sistema.filter((s) => s.lang.replace("_", "-").startsWith(base))) {
    const loc = v.lang.replace("_", "-");
    vozes.push({
      chave: `sistema:${v.voiceURI}`,
      motor: "sistema",
      id: v.voiceURI,
      nome: v.name,
      sotaque: loc,
      previa: null,
      /*
       * ⚠️ Locale COMPLETO, não só o prefixo.
       *
       * Com `startsWith("pt")` a Joana (pt-PT) aparecia debaixo de "falam o seu
       * idioma" pra quem usa o app em pt-BR — e português de Portugal foi
       * exatamente a queixa dele sobre a Francisca. Prefixo igual não é idioma
       * igual.
       *
       * Idioma sem região (en, fr, ja) continua aceitando qualquer região: aí o
       * prefixo É a resposta, e exigir `en === en-US` esvaziaria a lista.
       */
      nativa: idioma.includes("-") ? loc === idioma : loc.startsWith(base),
      online: false,
      gastaCota: false,
      precisaBaixar: false,
    });
  }

  return vozes;
}

/**
 * A ordem da lista: nativa primeiro, depois o que não custa, depois o resto.
 *
 * Quem abre a tela e pega a primeira tem que estar pegando a melhor pro idioma
 * dele. Sotaque errado é o defeito mais audível de todos, então `nativa` pesa
 * mais que qualquer outra coisa — inclusive mais que a ElevenLabs, que é a de
 * melhor timbre e a que ele pediu pelo nome.
 */
export function ordenar(vozes: Voz[]): Voz[] {
  const peso = (v: Voz) =>
    (v.nativa ? 0 : 100) +
    (v.motor === "edge" ? 0 : v.motor === "kokoro" ? 10 : v.motor === "sistema" ? 30 : 20) +
    (v.gastaCota ? 5 : 0) +
    (v.precisaBaixar ? 3 : 0);
  return [...vozes].sort((a, b) => peso(a) - peso(b));
}

/** As que valem recomendar: falam o idioma da tela como língua materna. */
export function recomendadas(vozes: Voz[]): Voz[] {
  return ordenar(vozes).filter((v) => v.nativa);
}

export function outras(vozes: Voz[]): Voz[] {
  return ordenar(vozes).filter((v) => !v.nativa);
}
