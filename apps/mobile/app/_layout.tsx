import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { Idioma } from "../src/i18n";
import { Tema, useTema } from "../src/tema";

/**
 * A casca.
 *
 * A barra e o fundo do `Stack` sao prop de JS, nao classe, entao vem da paleta
 * do `useTema` — e por isso a `Casca` e um componente separado: ela precisa
 * estar DENTRO do `<Tema>` pra ler o contexto.
 */
function Casca() {
  const { cores, escuro } = useTema();

  return (
    <>
      <StatusBar style={escuro ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.fundo },
          headerTintColor: cores.texto,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: cores.fundo },
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
        <Stack.Screen name="faxina/index" options={{ title: "" }} />
        <Stack.Screen name="ajustes/index" options={{ title: "" }} />
        <Stack.Screen name="time/index" options={{ title: "" }} />
        <Stack.Screen name="ginasio/index" options={{ title: "" }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <Tema>
      <Idioma>
        <Casca />
      </Idioma>
    </Tema>
  );
}
