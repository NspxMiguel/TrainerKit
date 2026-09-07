import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";

import { useTema } from "./tema";

/**
 * VIDRO — `GlassView`, e não `.glassEffect()` num `UIHostingController`.
 *
 * É a regra do projeto, e ela existe porque o caminho SwiftUI falha de dois
 * jeitos que só aparecem rodando: o controlador morre antes de desenhar se
 * ficar em variável local, e `Color.clear.glassEffect()` não produz material
 * nenhum — `glassEffect` desenha ATRÁS do conteúdo, e `Color.clear` não tem
 * conteúdo. `GlassView` é um `UIVisualEffectView` por baixo: sem hospedeiro,
 * sem ciclo de vida pra acertar.
 *
 * ── O fallback não é gambiarra, é a segunda metade do trabalho ──────────────
 *
 * ⚠️ Antes do iOS 26 não existe Liquid Glass, e o caminho `false` é **sólido de
 * verdade** com o mesmo raio — nunca um blur falso tentando parecer vidro. Tela
 * sem isso é tela que só existe bonita no simulador mais novo.
 *
 * ── `overflow: hidden` é o que recorta ──────────────────────────────────────
 *
 * Sem ele o material vaza retangular por baixo da forma arredondada.
 */
export function Vidro({
  children,
  raio,
  interativo = false,
  ativo = false,
  style,
}: {
  children: ReactNode;
  raio: number;
  /** Reage ao toque como os controles do próprio iOS 26. */
  interativo?: boolean;
  /** Estado ligado — tinge com alfa BAIXO de branco, nunca com a cor cheia. */
  ativo?: boolean;
  style?: ViewStyle;
}) {
  const { cores } = useTema();

  if (!isLiquidGlassAvailable()) {
    return (
      <View
        style={[
          { borderRadius: raio, overflow: "hidden", backgroundColor: cores.superficie },
          ativo ? { borderWidth: 1, borderColor: cores.texto } : undefined,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <GlassView
      glassEffectStyle="regular"
      isInteractive={interativo}
      /* ⚠️ Alfa baixo de BRANCO, não a cor cheia: seleção em vidro é diferença
         de LUZ atravessando o material. Cor sólida por cima devolve uma pílula
         opaca com o texto ilegível em cima dela. */
      {...(ativo ? { tintColor: "rgba(255,255,255,0.20)" } : {})}
      style={[{ borderRadius: raio, overflow: "hidden" }, style]}
    >
      {children}
    </GlassView>
  );
}
