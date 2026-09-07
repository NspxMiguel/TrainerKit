import { useEffect, type ReactNode } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type AnimatedStyle,
} from "react-native-reanimated";
import type { ViewStyle } from "react-native";

import { DUR, SAIDA } from "./movimento";

/**
 * A ENTRADA EM CASCATA.
 *
 * ⚠️ O app não animava nada. O pacote de forma tem `TrainerKit Animações` e a
 * regra dele é simples: o conteúdo SOBE 14px enquanto aparece, e irmãos entram
 * com 28ms de atraso entre si — o suficiente para o olho ler ordem, e curto
 * demais para virar espera.
 *
 * ⚠️ Anima UMA VEZ, na montagem, e não a cada re-render. Repetir a entrada a
 * cada mudança de estado faria a ficha piscar inteira quando alguém tocasse no
 * botão de sombroso.
 *
 * ⚠️ O `indice` tem TETO. Sem ele, o vigésimo bloco de uma ficha longa entraria
 * meio segundo depois do primeiro, e quem rolar rápido chega num espaço branco
 * que ainda não decidiu aparecer.
 */
const TETO_DA_CASCATA = 6;

export function Entrada({
  children,
  indice = 0,
  style,
}: {
  children: ReactNode;
  indice?: number;
  style?: AnimatedStyle<ViewStyle>;
}) {
  const surgindo = useSharedValue(0);

  useEffect(() => {
    const atraso = Math.min(indice, TETO_DA_CASCATA) * DUR.cascata;
    surgindo.value = withDelay(atraso, withTiming(1, { duration: DUR.base, easing: SAIDA }));
    // Só na montagem: `indice` e `surgindo` são estáveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estilo = useAnimatedStyle(() => ({
    opacity: surgindo.value,
    transform: [{ translateY: (1 - surgindo.value) * 14 }],
  }));

  return <Animated.View style={[estilo, style]}>{children}</Animated.View>;
}
