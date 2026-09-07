import { useEffect, useState, type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { DUR, SAIDA } from "./movimento";

/**
 * A ENTRADA EM CASCATA.
 *
 * O conteúdo sobe 14px enquanto aparece, e irmãos entram com 28ms de atraso
 * entre si — o `--tk-stagger` do pacote de forma. Curto o bastante para não
 * virar espera, longo o bastante para o olho ler ordem.
 *
 * ⚠️ AO TERMINAR, A CAMADA ANIMADA SAI DA ÁRVORE, e isso não é limpeza: é
 * correção de um defeito real. Um `UIVisualEffectView` (o `GlassView` do
 * veredito) dentro de uma view com `opacity` animada perde a amostragem do
 * fundo e o vidro simplesmente SOME — medido aqui, comparando o cartão do
 * veredito antes e depois de embrulhar a ficha na cascata. Devolver um `View`
 * comum no fim desfaz o grupo de composição e o vidro volta.
 *
 * ⚠️ Anima UMA VEZ, na montagem. Repetir a cada re-render faria a ficha piscar
 * inteira a cada toque no botão de sombroso.
 *
 * ⚠️ O `indice` tem TETO: sem ele o vigésimo bloco entraria meio segundo depois
 * do primeiro, e quem rola rápido chega num espaço em branco que ainda não
 * decidiu aparecer.
 */
const TETO_DA_CASCATA = 6;

export function Entrada({
  children,
  indice = 0,
  style,
}: {
  children: ReactNode;
  indice?: number;
  style?: ViewStyle;
}) {
  const surgindo = useSharedValue(0);
  const [terminou, setTerminou] = useState(false);

  useEffect(() => {
    const atraso = Math.min(indice, TETO_DA_CASCATA) * DUR.cascata;
    surgindo.value = withDelay(
      atraso,
      withTiming(1, { duration: DUR.base, easing: SAIDA }, (fim) => {
        if (fim) runOnJS(setTerminou)(true);
      }),
    );
    // Só na montagem: `indice` e `surgindo` são estáveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estilo = useAnimatedStyle(() => ({
    opacity: surgindo.value,
    transform: [{ translateY: (1 - surgindo.value) * 14 }],
  }));

  if (terminou) return <View style={style}>{children}</View>;

  return <Animated.View style={[estilo, style]}>{children}</Animated.View>;
}
