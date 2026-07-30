/**
 * As cinco perguntas por dia da chave compartilhada.
 *
 * "5 vezes pode usar por dia free". A chave e do Miguel e o plano gratuito da
 * Groq e por minuto, nao por dia — sem um teto diario, uma pessoa sozinha
 * consome a cota de todo mundo antes do almoço.
 *
 * ⚠️ ISTO NAO E SEGURANÇA, E COMBINADO. O contador vive no `localStorage` de quem
 * usa: limpar os dados do navegador zera. Quem quiser furar, fura em dez
 * segundos, e nao adianta eu fingir o contrario num comentario.
 *
 * O que protege de verdade sao duas outras coisas, e as duas ficam FORA daqui:
 *
 *   1. O limite por IP na propria funcao (`api/ai.ts`), que quem chama nao
 *      controla.
 *   2. O teto da Groq: plano gratuito, 8.000 tokens por minuto. Quando estoura,
 *      ela recusa. Nao existe fatura pra estourar.
 *
 * Entao o papel deste arquivo e ser HONESTO com quem usa direito: mostrar quantas
 * sobraram antes de acabar, em vez de deixar a pessoa levar um 429 no meio de uma
 * pergunta sem entender por que.
 */

const KEY = "tk:ia-cota";

/** O combinado. */
export const LIMITE_DIARIO = 5;

interface Registro {
  /** Dia local no formato `2026-07-30`. */
  dia: string;
  usos: number;
}

/*
 * Dia LOCAL, nao UTC.
 *
 * `toISOString()` daria UTC, e no Brasil isso viraria a cota as 21h — a pessoa
 * perderia as perguntas do fim da noite sem nenhuma explicacao visivel.
 * `sv-SE` porque e o locale que formata como `2026-07-30` sem eu montar a string
 * na mao.
 */
function hoje(): string {
  return new Date().toLocaleDateString("sv-SE");
}

function ler(): Registro {
  const vazio = { dia: hoje(), usos: 0 };
  try {
    const cru = globalThis.localStorage?.getItem(KEY);
    if (!cru) return vazio;
    const r = JSON.parse(cru) as Partial<Registro>;
    if (typeof r.dia !== "string" || typeof r.usos !== "number") return vazio;
    // Virou o dia: zera. Sem isto o contador seria um teto pra vida inteira.
    return r.dia === vazio.dia ? { dia: r.dia, usos: r.usos } : vazio;
  } catch {
    return vazio;
  }
}

function gravar(r: Registro): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(r));
  } catch {
    /* cota nao persistida vale mais que app quebrado */
  }
}

const listeners = new Set<() => void>();

export function onQuotaChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Quantas ainda dao pra usar hoje. */
export function restantes(): number {
  return Math.max(0, LIMITE_DIARIO - ler().usos);
}

export function esgotou(): boolean {
  return restantes() === 0;
}

/**
 * Marca uma pergunta usada.
 *
 * Chamado DEPOIS de a resposta chegar, nunca antes: uma falha de rede nao pode
 * gastar a cota de quem nao recebeu nada.
 */
export function registrarUso(): void {
  const r = ler();
  gravar({ dia: r.dia, usos: r.usos + 1 });
  for (const fn of listeners) fn();
}
