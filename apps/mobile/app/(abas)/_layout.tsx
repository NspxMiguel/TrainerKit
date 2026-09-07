import { Tabs } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "../../src/i18n";
import { useTema } from "../../src/tema";
import { Vidro } from "../../src/Vidro";
import type { Key } from "@trainerkit/core";

/**
 * A BARRA DE ABAS DE VIDRO.
 *
 * ⚠️ Barra desenhada a mao, e nao a do `Tabs` — de proposito, e o motivo e o
 * contrario do que parece. Uma `UITabBar` de verdade GANHA o Liquid Glass do
 * proprio iOS 26 e nao deveria ser reimplementada (regra do projeto). Mas a
 * barra deste desenho nao e uma tab bar de sistema: ela FLUTUA sobre o
 * conteudo, tem margem lateral, canto de pilula e uma bolha que transborda o
 * item ativo. Isso a `UITabBar` nao faz, e forcar a mesma forma nela custaria
 * mais briga do que desenhar — entao aqui o vidro vem do `GlassView`, que e o
 * mesmo `UIVisualEffectView` por baixo.
 *
 * ⚠️ A BOLHA DO ATIVO NAO USA `--tk-evoluir`. O pacote de forma pinta a bolha
 * com o azul de "Evoluir", que neste app e a COR DE UM VEREDITO. Usa-la como
 * acento de navegacao faria a barra dizer "evoluir" o tempo todo, em toda tela.
 * Fica a forma (a bolha, o peso maior do ativo, a mola) e sai a tinta: o ativo
 * e neutro, e a cor continua reservada pro que decide.
 */
const ABAS: { nome: string; icone: SFSymbol; rotulo: Key }[] = [
  { nome: "index", icone: "house.fill", rotulo: "tabs.home" },
  { nome: "pokedex", icone: "square.grid.2x2.fill", rotulo: "tabs.pokedex" },
  { nome: "ajustes", icone: "gearshape.fill", rotulo: "tabs.settings" },
];

export default function Abas() {
  const { cores } = useTema();
  const { t } = useT();
  const baixo = useSafeAreaInsets().bottom;

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: cores.fundo } }}
      tabBar={({ state, navigation }) => (
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(baixo, 10) }}
          className="items-center"
        >
          <Vidro raio={999} interativo style={{ paddingHorizontal: 6, paddingVertical: 6 }}>
            <View className="flex-row items-center">
              {ABAS.map((aba, i) => {
                const ativo = state.index === i;
                return (
                  <Pressable
                    key={aba.nome}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: ativo }}
                    accessibilityLabel={t(aba.rotulo)}
                    onPress={() => {
                      if (!ativo) navigation.navigate(state.routes[i]!.name);
                    }}
                    /* 44pt e o alvo minimo de toque do pacote (--tk-alvo-min);
                       abaixo disso o dedo erra e a barra parece "dura". */
                    style={{ minWidth: 84, minHeight: 44 }}
                    className="items-center justify-center rounded-full px-4 py-1.5"
                  >
                    {/* A bolha do ativo e uma camada ATRAS, nao um fundo do
                        Pressable: assim ela pode ser mais larga que o rotulo e
                        transbordar, que e o que da a sensacao de pastilha. */}
                    {ativo && (
                      <View
                        style={{ backgroundColor: cores.superficie }}
                        className="absolute inset-0 rounded-full"
                      />
                    )}
                    <SymbolView
                      name={aba.icone}
                      size={19}
                      tintColor={ativo ? cores.texto : cores.texto3}
                      resizeMode="scaleAspectFit"
                      fallback={
                        <Text style={{ color: ativo ? cores.texto : cores.texto3 }}>■</Text>
                      }
                    />
                    <Text
                      className="text-legenda mt-1"
                      style={{ color: ativo ? cores.texto : cores.texto3 }}
                    >
                      {t(aba.rotulo)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Vidro>
        </View>
      )}
    >
      {ABAS.map((a) => (
        <Tabs.Screen key={a.nome} name={a.nome} />
      ))}
    </Tabs>
  );
}
