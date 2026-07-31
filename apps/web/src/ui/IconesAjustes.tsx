/**
 * Os selos de Ajustes, portados LITERALMENTE do handoff (opção 5g).
 *
 * "kd ajustes tipo apple? ta la no claude desing po."
 *
 * Estava lá mesmo, e eu não tinha portado: cada linha de Ajustes tem um selo de
 * 30×30 com raio 8 e um gradiente próprio, e é ele que faz a tela LER como
 * Ajustes do sistema. Sem os selos, a tela é uma lista de rótulos cinza — a
 * estrutura estava certa (grupos, valor à direita, chevron) e a identidade
 * inteira faltava.
 *
 * ── Por que a cor é fixa por assunto, e não a cor da espécie ─────────────────
 *
 * Este é o único canto do app onde a cor NÃO segue o Pokémon, e é de propósito.
 * A cor aqui é um índice: o violeta é sempre Aparência, o azul é sempre Idioma.
 * É assim que se acha uma linha em Ajustes sem ler — pela posição e pela cor. Se
 * a paleta mudasse com o bicho em destaque, a única coisa que os selos fazem de
 * útil desapareceria.
 *
 * As dez cores vêm do handoff, sem retoque.
 */

export type SeloAjustes =
  | "aparencia"
  | "uso"
  | "idioma"
  | "imagens"
  | "voz"
  | "dados"
  | "ia"
  | "armazenamento"
  | "atualizacoes"
  | "sobre"
  | "privacidade"
  | "feedback"
  | "apoiar";

/** Gradiente e desenho de cada assunto. O `d` é o miolo do SVG, em 24×24. */
const SELOS: Record<SeloAjustes, { de: string; ate: string; svg: React.ReactNode }> = {
  aparencia: {
    de: "#8A6BFF",
    ate: "#6E4BFF",
    svg: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />,
  },
  uso: {
    // Fora do handoff (a tela dele não tinha "Como você usa"): mesma família de
    // violeta da Aparência, porque as duas dizem "como o app se comporta".
    de: "#A78BFA",
    ate: "#7C3AED",
    svg: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h10" />
      </>
    ),
  },
  idioma: {
    de: "#38BDF8",
    ate: "#2563EB",
    svg: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.3 4 5.5 4 9s-1.5 6.7-4 9c-2.5-2.3-4-5.5-4-9s1.5-6.7 4-9z" />
      </>
    ),
  },
  imagens: {
    de: "#34D399",
    ate: "#059669",
    svg: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="M21 16l-5-5-9 8" />
      </>
    ),
  },
  voz: {
    de: "#FB923C",
    ate: "#EA580C",
    svg: (
      <>
        <path d="M4 10v4" />
        <path d="M8 7v10" />
        <path d="M12 4v16" />
        <path d="M16 7v10" />
        <path d="M20 10v4" />
      </>
    ),
  },
  dados: {
    de: "#2DD4BF",
    ate: "#0D9488",
    svg: (
      <>
        <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
        <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13" />
        <path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
      </>
    ),
  },
  ia: {
    de: "#F472B6",
    ate: "#DB2777",
    svg: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z" />,
  },
  armazenamento: {
    de: "#94A3B8",
    ate: "#64748B",
    svg: (
      <>
        <path d="M21 8l-9-5-9 5 9 5 9-5z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </>
    ),
  },
  atualizacoes: {
    // Fora do handoff. Azul-esverdeado pra ficar perto de "Dados do jogo", que é
    // o outro assunto sobre coisas que chegam de fora.
    de: "#22D3EE",
    ate: "#0891B2",
    svg: (
      <>
        <path d="M21 12a9 9 0 1 1-2.6-6.4" />
        <path d="M21 4v5h-5" />
      </>
    ),
  },
  privacidade: {
    de: "#60A5FA",
    ate: "#2563EB",
    svg: <path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3z" />,
  },
  sobre: {
    de: "#7B8494",
    ate: "#4B5563",
    svg: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6" />
        <path d="M12 7.5v.5" />
      </>
    ),
  },
  feedback: {
    // Fora do handoff. Âmbar: é a única linha que pede algo DE VOLTA da pessoa.
    de: "#FBBF24",
    ate: "#D97706",
    svg: <path d="M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  },
  apoiar: {
    de: "#FB7185",
    ate: "#E11D48",
    svg: <path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20z" />,
  },
};

export function IconeAjuste({ selo }: { selo: SeloAjustes }) {
  const s = SELOS[selo];
  return (
    <span
      className="tk-row-selo"
      aria-hidden="true"
      style={{ background: `linear-gradient(180deg, ${s.de}, ${s.ate})` }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {s.svg}
      </svg>
    </span>
  );
}
