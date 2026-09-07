import { Text } from "react-native";

/**
 * O TITULO GRANDE DE UMA FOLHA.
 *
 * ⚠️ Desenhado no conteudo, e nao pelo `headerLargeTitle` do
 * react-native-screens: naquele caminho a barra reserva o espaco e NAO pinta
 * texto nenhum nesta versao — medido cravando `headerLargeTitleStyle` em
 * vermelho, some do mesmo jeito. Aqui ele rola junto com a tela, que e o que
 * os prints 6, 7 e 8 do pacote de desenho mostram.
 */
export function Titulo({ children }: { children: string }) {
  return (
    <Text className="text-texto text-[28px] font-extrabold leading-9 mb-1">{children}</Text>
  );
}
