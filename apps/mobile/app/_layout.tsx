import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

/**
 * A casca.
 *
 * Fundo preto de verdade desde a raiz — a mesma decisao do app web, e pelo
 * mesmo motivo: em OLED `#000` desliga o pixel, e a cor do app passa a ser a
 * da especie em vez de um azul-marinho sem dono.
 */
export default function Layout() {
  return (
    <>
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
      </Stack>
    </>
  );
}
