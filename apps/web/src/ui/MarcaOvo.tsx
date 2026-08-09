/**
 * A MARCA DO APP — o tile com o ovo rachado.
 *
 * Ele reclamou: *"kd novos icones? os icones novos do app ainda n estao
 * aplicados corretamente"*. Metade disso era o `apple-touch-icon` (resolvido no
 * `index.html`); a outra metade e esta — DENTRO do app a marca continuava sendo
 * o desenho antigo, tres barrinhas com uma seta verde. Quem instalava via o ovo
 * na tela de inicio, abria e era recebido por outro simbolo.
 *
 * ⚠️ OS `path` SAO OS DO HANDOFF, copiados sem reinterpretar — sao os mesmos
 * tres que aparecem em `TrainerKit Redesign.dc.html`, `Mockup` e `Desktop`. O
 * gerador de PNG (`scripts/make-icons.ts`) desenha o mesmo ovo por conta
 * propria porque nao tem rasterizador de path; aqui, no navegador, nao ha esse
 * problema — entao aqui vale a fonte, e nao a aproximacao.
 *
 * A CASCA e a LUZ da racha vem de variavel (`--tk-marca-casca`,
 * `--tk-marca-luz`), porque o handoff da duas versoes: casca clara sobre tile
 * escuro no modo escuro, casca escura sobre tile branco no claro. O tile em si
 * e CSS — ver `.tk-marca-ovo` no `App.css`.
 */
export function MarcaOvo({ size = 48, className }: { size?: number; className?: string }) {
  // O interior tem ~64% do lado do tile, a mesma proporcao dos tres tamanhos do
  // handoff (72/112, 42/64, 24/34).
  const dentro = Math.round(size * 0.64);
  return (
    <span
      className={className ? `tk-marca-ovo ${className}` : "tk-marca-ovo"}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={dentro} height={dentro} viewBox="0 0 48 48" fill="none">
        {/* O halo por tras do ovo: e o que separa a casca do tile sem precisar
            de contorno. Some por completo na borda, entao nao vira mancha. */}
        <ellipse cx="24" cy="23" rx="15" ry="7" fill="url(#tk-marca-halo)" />
        <path
          d="M9.6 22.5C10.6 11.5 16.4 4 24 4s13.4 7.5 14.4 18.5L34 20l-4.5 3.5L24 19.5l-5.5 4L14 20z"
          fill="var(--tk-marca-casca)"
          transform="translate(0,-3.6)"
        />
        <path
          d="M9.4 24 14 21.5l4.5 3.5L24 21l5.5 4L34 21.5 38.6 24c.3 1 .4 1.8.4 2.5C39 37.5 31.5 44 24 44S9 37.5 9 26.5c0-.7.1-1.5.4-2.5z"
          fill="var(--tk-marca-casca)"
        />
        {/* Os tres raios da racha. No handoff eles somem no tile de 34px, que e
            pequeno demais pra tres traços de 2px — a metade de baixo vira
            borrao. Aqui a regra e a mesma: abaixo de 40px, so a casca. */}
        {size >= 40 && (
          <path
            d="M20.5 22.5l-2.5 5M27.5 22.5l2.5 5M24 21.5v6"
            stroke="var(--tk-marca-luz)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}
        <defs>
          <radialGradient id="tk-marca-halo" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="var(--tk-marca-halo)" />
            <stop offset="1" stopColor="var(--tk-marca-halo)" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </span>
  );
}
