/**
 * Icones no padrao Lucide: traco 1.75 sobre grade de 24, cantos e juntas
 * arredondados. Desenhados aqui em vez de virem por dependencia porque sao
 * poucos e assim nao entra biblioteca inteira no bundle.
 *
 * Regra do prototipo: na navegacao, icone NUNCA aparece sem rotulo.
 */
interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ size = 24, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconPencil(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M17 3.5a2.1 2.1 0 0 1 3 3L7.5 19 3 20.5 4.5 16Z" />
    </Svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v12" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4 20h16" />
    </Svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 4.5h8L17.5 7h2A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z" />
      <circle cx="12" cy="13" r="3.5" />
    </Svg>
  );
}

export function IconSwords(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 15.5 20 21" />
      <path d="M4 3h3l10.5 10.5-3.5 3.5L3 6.5V3Z" />
      <path d="M9.5 15.5 4 21" />
      <path d="M20 3h-3L6.5 13.5l3.5 3.5L21 6.5V3Z" />
    </Svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6Z" />
    </Svg>
  );
}

/**
 * Calendario. Desenhado, e nao emprestado de biblioteca.
 *
 * Os traços internos são DOIS, e não uma grade de seis quadradinhos: o ícone
 * aparece a 19px, e a grade vira ruído nesse tamanho. Um calendário se
 * reconhece pelas duas argolas em cima e pela linha do cabeçalho.
 */
export function IconCalendar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </Svg>
  );
}

/** Ovo: uma forma só, porque a silhueta do ovo já é o significado inteiro. */
export function IconEgg(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3c3.6 0 6.5 5 6.5 9.2A6.5 6.5 0 0 1 12 21a6.5 6.5 0 0 1-6.5-8.8C5.5 8 8.4 3 12 3Z" />
    </Svg>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="m5.6 5.6 2.8 2.8" />
      <path d="m15.6 15.6 2.8 2.8" />
      <path d="m18.4 5.6-2.8 2.8" />
      <path d="m8.4 15.6-2.8 2.8" />
    </Svg>
  );
}

/**
 * Filtro: os tres cursores, o MESMO desenho do icone de Ajustes.
 *
 * Deliberadamente nao e um funil. O funil e o simbolo mais comum pra filtro, mas
 * neste app ele apareceria a dois toques de um icone de cursores que faz a mesma
 * coisa conceitual — escolher como a lista se comporta. Dois simbolos pra uma
 * ideia e o tipo de coisa que faz uma interface parecer costurada de pedacos, que
 * e exatamente a reclamacao que este trabalho veio atender.
 */
export function IconFilter(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </Svg>
  );
}

/**
 * Lista: o par do `IconGrid`, pro alternador de vista da Colecao.
 *
 * Os dois icones tem que ler como UM controle que troca de estado, e nao como
 * dois botoes diferentes — por isso mesma grade, mesmo traco, e a diferenca e
 * so a arrumacao dos elementos.
 */
export function IconList(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </Svg>
  );
}

/*
 * ─── Icones da barra de abas: PREENCHIDOS ────────────────────────────────────
 *
 * Os `path` sao os do handoff do Claude Design, copiados literalmente. Nao sao
 * desenho meu e nao valia redesenhar: o preenchido (estilo SF Symbols `.fill`)
 * e o que faz a barra parecer do sistema, e traco de 2px na mesma barra parece
 * um app web tentando imitar um nativo.
 *
 * `currentColor` em vez das cores fixas do mockup, pra que ativo e inativo
 * saiam do CSS e nao de duas copias do mesmo icone.
 */

export function IconHomeFill(props: IconProps) {
  const s = props.size ?? 20;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11.33 3.53a1 1 0 0 1 1.34 0l7.5 6.7a1 1 0 0 1 .33.74v8.83c0 .66-.54 1.2-1.2 1.2h-4.05v-5.9a1 1 0 0 0-1-1h-4.5a1 1 0 0 0-1 1V21H4.7c-.66 0-1.2-.54-1.2-1.2V10.97a1 1 0 0 1 .33-.74l7.5-6.7z"
      />
    </svg>
  );
}

export function IconGridFill(props: IconProps) {
  const s = props.size ?? 20;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2.4" fill="currentColor" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="2.4" fill="currentColor" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="2.4" fill="currentColor" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="2.4" fill="currentColor" />
    </svg>
  );
}

export function IconGearFill(props: IconProps) {
  const s = props.size ?? 20;
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"
      />
    </svg>
  );
}
