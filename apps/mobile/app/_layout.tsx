import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";

import { Idioma } from "../src/i18n";
import { Onboarding } from "../src/Onboarding";
import { ConfigInicial, useSetup } from "../src/setup";
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
  const { pronto, setup } = useSetup();

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

      {/*
        A PRIMEIRA ABERTURA COBRE O `Stack`, e nao o SUBSTITUI.

        ⚠️ Devolver `<Onboarding />` no lugar do `<Stack>` parece mais limpo e e
        armadilha: o expo-router monta a arvore de rotas a partir DESTE layout, e
        um layout raiz que nao renderiza navegador nenhum tira o roteador do ar.
        Enquanto o setup esta na tela nada navega, entao passaria — e quebraria
        no dia em que a primeira tela ganhasse um link. Sobrepor evita a
        pergunta, e ainda deixa a lista de especies carregando o dataset por
        tras enquanto a pessoa escolhe o idioma.

        `pronto` e a leitura assincrona do `kv-store`. Enquanto ela nao volta a
        cobertura fica de pe SEM conteudo: sem isso o app mostraria a lista, o
        setup chegaria um quadro depois e cobriria tudo — quem ja configurou
        veria a propria tela piscar em toda abertura.
      */}
      {(!pronto || !setup.done) && (
        <View style={StyleSheet.absoluteFill} className="bg-fundo">
          {pronto && <Onboarding />}
        </View>
      )}
    </>
  );
}

export default function Layout() {
  return (
    <Tema>
      <Idioma>
        <ConfigInicial>
          <Casca />
        </ConfigInicial>
      </Idioma>
    </Tema>
  );
}
