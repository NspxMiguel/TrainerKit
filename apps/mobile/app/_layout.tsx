import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { Idioma } from "../src/i18n";

/**
 * A casca.
 *
 * Fundo preto de verdade desde a raiz — a mesma decisao do app web, e pelo
 * mesmo motivo: em OLED `#000` desliga o pixel, e a cor do app passa a ser a
 * da especie em vez de um azul-marinho sem dono.
 */
export default function Layout() {
  return (
    <Idioma>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#000000" },
          headerTintColor: "#f4f6fa",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#000000" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Espécies" }} />
        <Stack.Screen name="especie/[id]" options={{ title: "" }} />
        <Stack.Screen name="iv/[id]" options={{ title: "" }} />
        <Stack.Screen name="encontro/[id]" options={{ title: "" }} />
        <Stack.Screen name="raide/[id]" options={{ title: "" }} />
        <Stack.Screen name="chocadeira/index" options={{ title: "" }} />
        <Stack.Screen name="agenda/index" options={{ title: "" }} />
        <Stack.Screen name="colecao/index" options={{ title: "" }} />
      </Stack>
    </Idioma>
  );
}
