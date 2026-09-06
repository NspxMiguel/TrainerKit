/// <reference types="nativewind/types" />

/**
 * O `global.css` e importado por efeito colateral no `_layout.tsx`: e assim que
 * o NativeWind injeta as classes do Tailwind. O TypeScript nao sabe o que e um
 * `.css` e recusa o import; esta declaracao diz que existe e nao exporta nada.
 */
declare module "*.css" {}
