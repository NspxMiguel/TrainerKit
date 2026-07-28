import {
  BAR_COLOR_FILLED,
  BAR_COLOR_PERFECT,
  BAR_SEGMENTS,
  IV_PER_SEGMENT,
  MAX_BAR,
  isBarPerfect,
} from "@trainerkit/core";

interface Props {
  label: string;
  value: number;
  /**
   * Quando presente, a barra vira editavel.
   *
   * So e ligado no caminho de RECUPERACAO: o print falhou e o usuario precisa
   * de uma saida. No caminho normal a barra e leitura pura, para ninguem
   * "corrigir" um valor que o scanner leu certo.
   */
  onChange?: (value: number) => void;
}

/**
 * Barra de IV, desenhada como o jogo desenha.
 *
 * Tres blocos de 5 pontos, andando de 1 em 1 dentro do bloco, e vermelha quando
 * o stat e 15. As cores sao as MEDIDAS em prints reais, nao aproximacoes.
 *
 * Somente leitura de proposito: o valor vem do print. Deixar o usuario arrastar
 * a barra abriria a porta para ele "corrigir" o que o scanner leu certo, e o
 * numero deixaria de significar o que o jogo mostra.
 */
export function IVBar({ label, value, onChange }: Props) {
  const perfect = isBarPerfect(value);
  const color = perfect ? BAR_COLOR_PERFECT : BAR_COLOR_FILLED;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ flex: 1, font: "700 13px var(--tk-font)", color }}>{label}</span>
        <span style={{ font: "700 15px var(--tk-mono)" }}>{value}</span>
        <span className="tk-caption">/ {MAX_BAR}</span>
      </div>

      <div style={{ display: "flex", gap: 4 }}>
        {Array.from({ length: BAR_SEGMENTS }, (_, seg) => {
          const filledInSegment = Math.max(
            0,
            Math.min(IV_PER_SEGMENT, value - seg * IV_PER_SEGMENT),
          );
          return (
            <div
              key={seg}
              style={{
                flex: 1,
                height: 12,
                borderRadius: 3,
                background: "var(--tk-surf3)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(filledInSegment / IV_PER_SEGMENT) * 100}%`,
                  height: "100%",
                  background: color,
                  transition: "width .12s ease",
                }}
              />
            </div>
          );
        })}
      </div>

      {onChange && (
        <input
          type="range"
          min={0}
          max={MAX_BAR}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="tk-iv-range"
        />
      )}
    </div>
  );
}
