import { useState } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, Text, UIManager, View } from "react-native";

import { useTema } from "./tema";
import { Vidro } from "./Vidro";
import { DUR, MOLA } from "./movimento";

/*
 * `LayoutAnimation` precisa ser ligado a mao no Android da arquitetura antiga.
 * No iOS ja vem ligado; a chamada e inofensiva onde nao existe.
 */
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface Opcao<T extends string> {
  valor: T;
  rotulo: string;
}

/**
 * O SEGMENTED — escolher UM entre poucos.
 *
 * ⚠️ Pilula, e nao cartao. O pacote e explicito: raio 999 e reservado a
 * controle de acao e navegacao; raio de cartao e superficie de conteudo. Este e
 * controle, entao e pilula por fora e por dentro.
 *
 * ⚠️ A PASTILHA DO ATIVO E UMA CAMADA, e nao o fundo do botao. Assim ela pode
 * animar de posicao — `LayoutAnimation` interpola a mudanca de layout de graca,
 * sem estado de animacao nenhum — e o rotulo nao pisca junto.
 *
 * Rola na horizontal quando nao cabe: as ligas cabem em tres, mas o seletor de
 * contexto de golpe chega a cinco grupos em especie com muita forma.
 */
export function Segmented<T extends string>({
  opcoes,
  valor,
  onEscolher,
  rotuloAcessivel,
}: {
  opcoes: readonly Opcao<T>[];
  valor: T;
  onEscolher: (v: T) => void;
  rotuloAcessivel?: string;
}) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);

  if (opcoes.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={rotuloAcessivel}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      {/* VIDRO, porque o pacote lista "chips de filtro" entre o que flutua — e
          um segmented é exatamente isso: um controle por cima do conteúdo que
          ele filtra. */}
      <Vidro
        raio={999}
        interativo
        style={{ minWidth: largura, padding: 4 }}
      >
      <View
        className="flex-row"
        onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
      >
        {opcoes.map((o) => {
          const ativo = o.valor === valor;
          return (
            <Pressable
              key={o.valor}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativo }}
              onPress={() => {
                if (ativo) return;
                LayoutAnimation.configureNext({
                  duration: DUR.micro,
                  update: { type: "spring", springDamping: MOLA.amortecimento },
                });
                onEscolher(o.valor);
              }}
              /* 44pt de alvo minimo: o pacote chama de `--tk-alvo-min`, e abaixo
                 disso o dedo erra a opcao vizinha. */
              style={{ minHeight: 36 }}
              className="rounded-pilula px-4 justify-center"
            >
              {/* ⚠️ AZUL, e não a tinta do tema. É o que o pacote usa no
                  segmented e na ação principal — o mesmo acento em toda a
                  navegação. Branco competia com o conteúdo e sumia no tema
                  claro. */}
              {ativo && (
                <View
                  style={{ backgroundColor: cores.evoluir }}
                  className="absolute inset-0 rounded-pilula"
                />
              )}
              <Text
                className="text-legenda"
                numberOfLines={1}
                style={{ color: ativo ? "#FFFFFF" : cores.texto2 }}
              >
                {o.rotulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
      </Vidro>
    </ScrollView>
  );
}
