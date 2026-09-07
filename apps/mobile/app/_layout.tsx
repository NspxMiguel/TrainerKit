import "../global.css";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Idioma, useT } from "../src/i18n";
import { Onboarding } from "../src/Onboarding";
import { IA } from "../src/ia";
import { Imagens } from "../src/imagens";
import { ConfigInicial, useSetup } from "../src/setup";
import { DUR } from "../src/movimento";
import { Tema, useTema } from "../src/tema";

/**
 * A casca.
 *
 * A barra e o fundo do `Stack` sao prop de JS, nao classe, entao vem da paleta
 * do `useTema` — e por isso a `Casca` e um componente separado: ela precisa
 * estar DENTRO do `<Tema>` pra ler o contexto.
 */
/**
 * O × que fecha uma folha.
 *
 * ⚠️ Em `headerRight` e não como `headerLeft`: o gesto de arrastar da borda
 * esquerda continua voltando, e o botão à direita é o que o desenho põe.
 */
function Fechar() {
  const { cores } = useTema();
  const router = useRouter();
  return (
    <Pressable onPress={() => router.back()} hitSlop={12}>
      <View
        className="rounded-pilula items-center justify-center"
        style={{ width: 30, height: 30, backgroundColor: cores.superficie }}
      >
        <Text style={{ color: cores.texto2, fontSize: 15, lineHeight: 18 }}>✕</Text>
      </View>
    </Pressable>
  );
}

function Casca() {
  const { cores, escuro } = useTema();
  const { pronto, setup } = useSetup();
  const { t } = useT();

  return (
    <>
      <StatusBar style={escuro ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.fundo },
          headerTintColor: cores.texto,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: cores.fundo },
          headerBackButtonDisplayMode: "minimal",
          /*
           * A TRANSIÇÃO ENTRE TELAS.
           *
           * ⚠️ O app não animava nada: as telas trocavam com o padrão do
           * `Stack`, que no iOS já empurra, mas sem a duração do pacote. Aqui a
           * folha usa `--tk-dur-sheet` (440ms) e o gesto de voltar continua
           * sendo o do sistema — reimplementar arrastar-para-voltar seria
           * trocar algo que funciona por algo pior.
           */
          animation: "slide_from_right",
          animationDuration: DUR.folha,
          gestureEnabled: true,
        }}
      >
        {/* AS ABAS SAO A RAIZ. O resto continua em pilha POR CIMA delas —
            ficha, calculadora e leitor sao destinos de leitura, nao lugares
            onde se mora, entao entram com voltar e nao com aba. */}
        {/* `headerBackButtonDisplayMode: "minimal"` e o que tira o rotulo do
            voltar: sem ele o expo-router usa o NOME DA ROTA, e a ficha abria
            com um botao escrito "(abas)". */}
        <Stack.Screen name="(abas)" options={{ headerShown: false, title: "" }} />
        {/* Cabecalho TRANSPARENTE so aqui: a faixa colorida da ficha vai ate a
            borda de cima, e uma barra opaca por cima dela cortaria a cor num
            retangulo preto. A tela paga o preco com o proprio inset. */}
        {/* A ficha SOBE, e não entra de lado: ela é o destino da grade e do
            Início, e subir é o gesto que o iOS usa para "abrir isto aqui". */}
        <Stack.Screen
          name="especie/[id]"
          options={{
            /* ⚠️ SEM barra nenhuma: a ficha desenha o próprio × sobre a faixa
               colorida. Com `headerTransparent` a barra continua existindo, e o
               voltar dela aparecia ao lado do × — dois botões de sair, um em
               cada canto. */
            headerShown: false,
            animation: "slide_from_bottom",
            animationDuration: DUR.folha,
          }}
        />
        {/*
          AS TELAS DE FERRAMENTA: título GRANDE e × à direita.

          ⚠️ Elas tinham `title: ""` e o chevron de voltar — os prints 6, 7 e 8
          mostram um título grande dentro da tela e um × no canto. E não é só
          aparência: elas são FOLHAS abertas a partir de outra tela, e folha se
          fecha, não se volta.

          `headerLargeTitle` é o comportamento nativo do iOS — o título grande
          encolhe para a barra ao rolar, de graça. Desenhar isso à mão daria o
          visual sem o movimento, que foi o erro da barra de abas.
        */}
        {(
          [
            "iv/[id]",
            "encontro/[id]",
            "raide/[id]",
            "chocadeira/index",
            "agenda/index",
            "colecao/index",
            "faxina/index",
            "time/index",
            "ginasio/index",
            "itens/index",
            "print/index",
          ] as const
        ).map((rota) => (
          <Stack.Screen
            key={rota}
            name={rota}
            options={{
              /* ⚠️ TITULO VAZIO, e o grande e desenhado DENTRO da tela pelo
                 `Titulo`. O `headerLargeTitle` do react-native-screens reserva
                 o espaco e nao pinta texto nenhum nesta versao — medido com
                 cor vermelha cravada, some do mesmo jeito. */
              title: "",
              headerShadowVisible: false,
              headerBackVisible: false,
              headerRight: () => <Fechar />,
            }}
          />
        ))}

        <Stack.Screen name="legal/index" options={{ title: "" }} />
        {/* Sem cabecalho: a camera e a tela inteira, e o fechar e o botao de
            vidro que a propria tela desenha. */}
        <Stack.Screen
          name="dex/index"
          options={{ headerShown: false, animation: "fade", animationDuration: DUR.base }}
        />
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
          <Imagens>
            <IA>
              <Casca />
            </IA>
          </Imagens>
        </ConfigInicial>
      </Idioma>
    </Tema>
  );
}
