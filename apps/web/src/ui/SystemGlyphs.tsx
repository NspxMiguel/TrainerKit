/**
 * Os botoes do SISTEMA, desenhados.
 *
 * Isto e diferente de `Icons.tsx`. La sao os icones do TrainerKit; aqui sao
 * reproducoes dos controles do iOS, do Android e do Chrome, e existem por um
 * motivo so: o guia de instalacao diz "toque no botao Compartilhar" e a pessoa
 * precisa reconhecer o botao na barra do proprio aparelho.
 *
 * A versao anterior usava caracteres de texto (`\u{F0202}`, `⋮`, `⊕`). O
 * primeiro e um codepoint de area privada de uma fonte de icones que o app nao
 * carrega, entao o iPhone desenhava um retangulo qualquer — o Miguel viu tres
 * tracinhos onde devia estar a seta do Compartilhar. Glifo de fonte que nao
 * esta instalada nao e icone, e loteria.
 *
 * Desenhados em SVG eles ficam nitidos em qualquer densidade, acompanham o tema
 * e nao dependem de fonte nenhuma. O traco e mais grosso que o dos icones do
 * app (2 contra 1.75) porque estes aparecem pequenos, dentro da linha de texto.
 */
interface GlyphProps {
  size?: number;
}

function Glyph({ size = 20, children }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/**
 * Compartilhar do iOS: a caixa aberta em cima com a seta saindo dela.
 *
 * A abertura no topo da caixa e o detalhe que faz reconhecer — sem ela vira um
 * icone de "upload" generico, que o iPhone nao tem em lugar nenhum.
 */
export function GlyphIosShare({ size }: GlyphProps) {
  return (
    <Glyph {...(size === undefined ? {} : { size })}>
      <path d="M12 3v12" />
      <path d="m8 6.6 4-3.6 4 3.6" />
      <path d="M7.5 10H6a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18 10h-1.5" />
    </Glyph>
  );
}

/** "Adicionar à Tela de Início": o quadrado arredondado com o mais dentro. */
export function GlyphAddToHome({ size }: GlyphProps) {
  return (
    <Glyph {...(size === undefined ? {} : { size })}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Glyph>
  );
}

/** Menu do Chrome no Android: os tres pontos verticais. */
export function GlyphAndroidMenu({ size }: GlyphProps) {
  return (
    <Glyph {...(size === undefined ? {} : { size })}>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** O botao de instalar que aparece na barra de endereco no computador. */
export function GlyphInstallDesktop({ size }: GlyphProps) {
  return (
    <Glyph {...(size === undefined ? {} : { size })}>
      <rect x="3" y="4.5" width="18" height="12.5" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 7.5v6" />
      <path d="m9.5 11 2.5 2.5 2.5-2.5" />
    </Glyph>
  );
}
