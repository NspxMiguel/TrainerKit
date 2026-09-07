import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Vidro } from "./Vidro";

/**
 * A FAIXA DE VIDRO SOB A BARRA DE STATUS.
 *
 * ⚠️ Sem ela o conteúdo rolava POR BAIXO do relógio e da bateria e batia neles
 * — quatro dos prints que ele mandou mostram uma linha de Ajustes atravessada
 * pelo horário. As abas do `NativeTabs` não têm barra de navegação, então não
 * há nada ali para proteger o texto: é preciso desenhar.
 *
 * Vidro, e não uma faixa opaca: opaca cria uma emenda visível quando o topo da
 * tela tem cor (o herói), e é justamente o que o iOS faz numa barra de
 * navegação de verdade — o conteúdo passa por baixo e fica fosco.
 */
export function TopoDeVidro() {
  const { top } = useSafeAreaInsets();
  if (top === 0) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: top, zIndex: 10 }}
    >
      {/* `raio: 0` porque ela encosta nas três bordas: um canto arredondado
          aqui deixaria dois triângulos da cor do conteúdo aparecendo. */}
      <Vidro raio={0} style={{ flex: 1 }}>
        <View style={{ flex: 1 }} />
      </Vidro>
    </View>
  );
}
