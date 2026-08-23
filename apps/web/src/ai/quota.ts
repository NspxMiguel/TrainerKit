/**
 * O limite da chave compartilhada — e a conta que define qual ele pode ser.
 *
 * Cinco mensagens por dia era baixo demais pra um serviço que ainda é gratuito.
 * A pergunta certa é qual teto a conta aguenta, e por hora em vez de por dia.
 *
 * ANALISADO. É grátis, sim — mas não é ilimitado, e o teto não é o que parece:
 *
 *   `openai/gpt-oss-120b`, plano gratuito, medido na página de limites:
 *     30 RPM · 1.000 RPD · 12.000 TPM · **100.000 TPD**
 *
 *   E o mais importante: os limites são POR ORGANIZAÇÃO, não por usuário. A
 *   chave é uma só, então esses 100.000 tokens por dia são o balde de TODO
 *   MUNDO junto — não de cada pessoa.
 *
 * Uma pergunta da Especies custa, MEDIDO (não estimado): ~1.050 tokens de
 * entrada (dossiê 1.500 chars + regras 2.065 chars) e ~250 de saída. Uns 1.300.
 *
 *   100.000 ÷ 1.300 = **77 perguntas por dia, no mundo inteiro somado.**
 *   12.000 TPM ÷ 1.300 = **9 perguntas por minuto**, também no total.
 *
 * Por isso "30 por hora" não dá: 30/hora numa pessoa são 720 por dia — ela
 * sozinha consumiria o orçamento do dia INTEIRO nove vezes antes do almoço, e
 * todo mundo levaria 429 pelo resto do dia.
 *
 * O 5/dia anterior estava certo pela conta e errado pela sensação: 77 ÷ 5 dá 15
 * pessoas por dia, mas ninguém vê essa conta — vê um app que para na quinta
 * pergunta. Então subi pro que o orçamento aguenta com uma base pequena de
 * usuários, que é o caso real de um app pessoal:
 *
 *   **20 por dia** (77 ÷ 20 ≈ 4 pessoas simultâneas confortáveis)
 *   **8 por hora** (impede que as 20 do dia virem 20 em dois minutos, e segura
 *                   a rajada longe do teto por minuto)
 *
 * ⚠️ ISTO NÃO É SEGURANÇA, É COMBINADO. Vive no `localStorage`: limpar os dados
 * zera. Quem quiser furar, fura. Fingir o contrário num comentário seria pior
 * que não ter comentário.
 *
 * O que protege de verdade são outras três coisas, todas fora daqui:
 *   1. o limite por IP na própria função (`api/ai.ts`), que o cliente não toca;
 *   2. o filtro de assunto (`guarda.ts`), que corta o uso desviado;
 *   3. o teto da própria Groq — quando o orçamento do dia acaba, ela devolve
 *      429 e ninguém passa. Não existe fatura pra estourar.
 *
 * E é por isso que o app precisa tratar o 429 da Groq com a MESMA mensagem
 * deste limite: pode acabar aqui ou lá, e pra quem está usando é a mesma coisa.
 */

const KEY = "tk:ia-cota";

/** O combinado por dia. Ver a conta no topo. */
export const LIMITE_DIARIO = 20;

/** E por hora, pra 20 no dia não virarem 20 num minuto. */
export const LIMITE_HORA = 8;

interface Registro {
  /** Dia local, `2026-07-30`. */
  dia: string;
  usos: number;
  /** Hora local corrente, 0–23, e quantas nela. */
  hora: number;
  usosHora: number;
}

/*
 * Dia e hora LOCAIS, não UTC.
 *
 * `toISOString()` daria UTC, e no Brasil a cota viraria às 21h — a pessoa
 * perderia as perguntas do fim da noite sem nenhuma explicação visível.
 */
function agora(): { dia: string; hora: number } {
  const d = new Date();
  return { dia: d.toLocaleDateString("sv-SE"), hora: d.getHours() };
}

function ler(): Registro {
  const { dia, hora } = agora();
  const vazio: Registro = { dia, usos: 0, hora, usosHora: 0 };
  try {
    const cru = globalThis.localStorage?.getItem(KEY);
    if (!cru) return vazio;
    const r = JSON.parse(cru) as Partial<Registro>;
    if (typeof r.dia !== "string" || typeof r.usos !== "number") return vazio;
    // Virou o dia: zera tudo. Virou só a hora: zera só a hora.
    if (r.dia !== dia) return vazio;
    return {
      dia: r.dia,
      usos: r.usos,
      hora,
      usosHora: r.hora === hora && typeof r.usosHora === "number" ? r.usosHora : 0,
    };
  } catch {
    return vazio;
  }
}

function gravar(r: Registro): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(r));
  } catch {
    /* cota não persistida vale mais que app quebrado */
  }
}

const listeners = new Set<() => void>();

export function onQuotaChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Quantas ainda dão hoje. */
export function restantes(): number {
  return Math.max(0, LIMITE_DIARIO - ler().usos);
}

/** Quantas ainda dão nesta hora. */
export function restantesHora(): number {
  return Math.max(0, LIMITE_HORA - ler().usosHora);
}

/** Qual limite bateu — o dia, a hora, ou nenhum. Quem chama precisa saber pra
 *  dizer "volta amanhã" ou "volta daqui a pouco", que são coisas diferentes. */
export function bloqueio(): "dia" | "hora" | null {
  if (restantes() === 0) return "dia";
  if (restantesHora() === 0) return "hora";
  return null;
}

/**
 * Marca uma pergunta usada.
 *
 * Chamado DEPOIS de a resposta chegar, nunca antes: falha de rede não pode
 * gastar a cota de quem não recebeu nada.
 */
export function registrarUso(): void {
  const r = ler();
  gravar({ dia: r.dia, usos: r.usos + 1, hora: r.hora, usosHora: r.usosHora + 1 });
  for (const fn of listeners) fn();
}
