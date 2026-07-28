import { BAR_SEGMENTS, IV_PER_SEGMENT, MAX_BAR, isBarPerfect } from "@trainerkit/core";

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

/**
 * Barra de IV, do jeito que o jogo desenha.
 *
 * Tres segmentos, cada um valendo 5 pontos, e dentro do segmento o
 * preenchimento anda de 20% em 20% — ou seja, 1 ponto de IV por passo. O jogo
 * mostra o valor EXATO assim; o usuario so precisa reproduzir o que ve.
 *
 * Fica vermelha quando o stat e 15, igual ao jogo.
 */
export function IVBar({ label, value, onChange }: Props) {
  const perfect = isBarPerfect(value);
  const color = perfect ? "var(--tk-dang)" : "#F0A03C";

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

      {/* O range e o controle de verdade: acessivel, arrastavel e com teclado. */}
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
    </div>
  );
}
