import { forwardRef, useRef } from "react";
import { Animated, Pressable, type PressableProps, type View, type ViewStyle } from "react-native";

/**
 * O TOQUE COM MOLA.
 *
 * Todo controle do app respondia com o realce cinza padrão do `Pressable`, que
 * some em superfície escura — na prática o app não reagia ao dedo.
 *
 * ⚠️ Encolhe 3%, e não 10%. O pacote pede mola DISCRETA: o botão tem que ceder,
 * não afundar.
 *
 * ⚠️ O `Animated` AQUI É O DO REACT NATIVE, e não o Reanimated que o resto do
 * app usa. Não é preferência: `createAnimatedComponent(Pressable)` do
 * Reanimated **não entrega o toque** nesta versão — a grade inteira da Pokédex
 * ficou muda, sem erro e sem aviso no console, e o segmented ao lado (um
 * `Pressable` cru, na mesma tela) respondia normalmente. Medido três vezes,
 * inclusive com bundle limpo.
 *
 * Uma mola de escala é exatamente o caso em que o `Animated` da plataforma
 * basta: um valor, `useNativeDriver`, sem worklet nenhum. O Reanimated continua
 * sendo o certo para a entrada em cascata, que interpola layout.
 */
export const Toque = forwardRef<
  View,
  PressableProps & {
    /**
     * O que precisa ficar na camada de FORA.
     *
     * ⚠️ Existe por causa da grade: quem divide a linha é o filho direto do
     * `columnWrapperStyle`, e aqui esse filho é a view animada — `flex-1` no
     * `Pressable` de dentro não divide coluna nenhuma. Então o layout que a
     * lista mede vem por aqui, e a aparência continua no `style`.
     */
    estiloExterno?: ViewStyle;
  }
>(function Toque({ children, style, estiloExterno, ...resto }, ref) {
  const escala = useRef(new Animated.Value(1)).current;

  const mola = (para: number) =>
    Animated.spring(escala, {
      toValue: para,
      damping: 18,
      stiffness: 220,
      mass: 1,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={[estiloExterno, { transform: [{ scale: escala }] }]}>
      <Pressable
        ref={ref}
        {...resto}
        style={style}
        onPressIn={(e) => {
          mola(0.97);
          resto.onPressIn?.(e);
        }}
        onPressOut={(e) => {
          mola(1);
          resto.onPressOut?.(e);
        }}
      >
        {children as never}
      </Pressable>
    </Animated.View>
  );
});
