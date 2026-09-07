import { Pressable, type PressableProps } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { MOLA } from "./movimento";

const Animado = Animated.createAnimatedComponent(Pressable);

/**
 * O TOQUE COM MOLA.
 *
 * Todo controle do app respondia com o realce cinza padrão do `Pressable`, que
 * some em superfície escura — na prática o app não reagia ao dedo.
 *
 * ⚠️ Encolhe 3%, e não 10%. O pacote pede mola DISCRETA: o botão tem que ceder,
 * não afundar. Amortecimento alto para não balançar na volta.
 *
 * ⚠️ `Animated.createAnimatedComponent(Pressable)` e não uma `View` animada por
 * dentro: assim o alvo de toque continua sendo o próprio botão, e o
 * `accessibilityRole` do Pressable não se perde numa camada extra.
 */
export function Toque({ children, style, ...resto }: PressableProps) {
  const escala = useSharedValue(1);
  const animado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  return (
    <Animado
      {...resto}
      onPressIn={(e) => {
        escala.value = withSpring(0.97, { damping: 18, stiffness: MOLA.rigidez });
        resto.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        escala.value = withSpring(1, { damping: 18, stiffness: MOLA.rigidez });
        resto.onPressOut?.(e);
      }}
      style={[animado, style as never]}
    >
      {children as never}
    </Animado>
  );
}
