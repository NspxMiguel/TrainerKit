import { chat } from "./provider.ts";

/**
 * A IA explicando um veredito que o app ja calculou.
 *
 * DESENHO CENTRAL, e ele nao muda com o provedor: o modelo NAO analisa especie.
 * Ele recebe o veredito pronto com o rastro de regras e so escolhe as palavras.
 * Um modelo que recebesse so "Machamp 96%" inventaria a analise, e inventar e
 * exatamente o que este app nao faz.
 *
 * Isto vivia dentro de `groq.ts`, o que era um erro de lugar: o texto do
 * `system` e a mesma coisa quando o modelo roda na GPU do telefone. Aqui ele
 * serve os dois.
 */

const SYSTEM = `Você é o assistente do TrainerKit, um app de o jogo.

Você NÃO analisa especie. O app já calculou tudo e vai te entregar o veredito
pronto com as regras que levaram a ele. Seu único trabalho é transformar esses
dados em duas ou três frases naturais, no idioma pedido.

Regras rígidas:
- Nunca contradiga os números que receber. Se o veredito diz "transferir", você
  explica por que transferir.
- Nunca invente números, posições, movesets ou mecânicas que não vieram nos
  dados.
- Não gere, descreva nem ofereça imagens.
- NUNCA cite o nome interno de uma regra nem o peso dela. "iv.ataque (peso
  0.61)" é anotação minha, não linguagem de gente: diga o que a regra significa
  ("o ataque dele é dos altos"), nunca o rótulo.
- A confiança é o quanto as regras concordaram entre si, não a chance de o
  veredito estar certo. Não a apresente como probabilidade de acerto.
- Seja direto. Nada de saudação, nada de "espero ter ajudado".
- No máximo 3 frases curtas.`;

export interface ExplainInput {
  language: string;
  species: string;
  action: string;
  confidence: number;
  reason: string;
  signals: Array<{ rule: string; weight: number; because: string }>;
  ivTotal: number;
  cp: number | null;
}

export async function explainVerdict(
  input: ExplainInput,
  signal?: AbortSignal,
): Promise<string> {
  return chat(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          `Idioma da resposta: ${input.language}`,
          `especie: ${input.species}`,
          `IV: ${input.ivTotal} de 45${input.cp === null ? "" : ` · PC ${input.cp}`}`,
          `Veredito: ${input.action} (confiança ${Math.round(input.confidence * 100)}%)`,
          `Motivo principal: ${input.reason}`,
          "Regras que pesaram:",
          ...input.signals.map((s) => `- ${s.rule} (peso ${s.weight.toFixed(2)}): ${s.because}`),
        ].join("\n"),
      },
    ],
    { temperature: 0.4, maxTokens: 220, ...(signal ? { signal } : {}) },
  );
}
