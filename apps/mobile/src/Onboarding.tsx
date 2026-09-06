import {
  LANGUAGES,
  MAX_POWERUP_LEVEL,
  PIX_KEY,
  TRAINER_LEVELS,
  tetoDePowerUp,
  type Key,
} from "@trainerkit/core";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useT } from "./i18n";
import { useSetup } from "./setup";
import { useTema } from "./tema";

/**
 * A PRIMEIRA ABERTURA DO APP NATIVO.
 *
 * ── Por que são três telas e não seis ───────────────────────────────────────
 *
 * O setup do PWA tem seis passos, e quatro deles não têm o que fazer aqui:
 * "instalar" não existe num app que já está instalado; "IA" não existe porque o
 * assistente ainda não foi portado; "modo de uso" e "nome" não têm consumidor
 * nenhum no app nativo. Portar os seis daria quatro telas que gravam o que nada
 * lê — e um ajuste que não faz nada é pior que um ajuste ausente, porque quem
 * responde acredita que mudou alguma coisa.
 *
 * Sobram os três que fazem: o idioma (que traduz os próprios passos seguintes),
 * o nível do treinador (o único campo do setup que muda VEREDITO) e o apoio.
 *
 * ── Por que o apoio é o último passo, e não o primeiro ──────────────────────
 *
 * "vamo colocar um donate ali e dale, qm quiser doa doa, no setup msm". Ele vem
 * depois de tudo estar escolhido, com o botão de entrar sempre visível e sem
 * nada atrás dele: quem não quiser dar nada toca uma vez e está dentro. Pedir
 * antes de a pessoa ter usado o app é um pedágio, e o app não vende nada.
 *
 * A tela NÃO ROLA por passo — cada uma cabe inteira, com o botão fixo embaixo,
 * que é como app se comporta. A lista de idiomas é a exceção: dez itens não
 * cabem, e ela rola dentro do próprio cartão.
 */
/*
 * A lista vem do core, com bandeira.
 *
 * Aqui existia um `NOMES` que era copia parcial da lista do web — so os codigos
 * e os nomes, sem bandeira. "la em idioma acho legal por as bandeiras" valia
 * pros dois apps, e no iOS a ressalva do web nem existe: o emoji de bandeira
 * sempre desenha. A medicao de `bandeiras.ts` e problema de navegador.
 */
/* A mesma legenda do web, e as mesmas quatro faixas do `packages/core`. */
const FAIXA: Record<number, Key> = {
  20: "onb.level.start",
  30: "onb.level.mid",
  40: "onb.level.high",
  50: "onb.level.max",
};

/**
 * ⚠️ `MAX_POWERUP_LEVEL` do core, e não `50` escrito aqui.
 *
 * O setup roda ANTES de o dataset carregar, então não dá pra ler o
 * `version.levelCap` real — e um literal faria desta a última tela do app
 * dizendo 50 depois de o jogo subir o teto. Mesma nota que o web carrega.
 */
export function Onboarding() {
  const { t, idioma, trocar } = useT();
  const { cores } = useTema();
  const { setup, definir } = useSetup();
  const [passo, setPasso] = useState(0);
  const [copiado, setCopiado] = useState(false);

  const ultimo = passo === 2;

  const copiar = () => {
    Clipboard.setStringAsync(PIX_KEY)
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => {
        /* A chave continua na tela e é selecionável; falhar calado ainda deixa
           um caminho. */
      });
  };

  return (
    <View className="flex-1 bg-fundo px-5 pt-16 pb-8">
      {/* Os pontos de progresso: o app diz quantas telas faltam antes de alguém
          precisar perguntar. O de agora é mais largo — a barra cresce junto com
          o avanço em vez de só trocar de cor. */}
      <View className="flex-row justify-center gap-1.5 mb-10">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              width: i === passo ? 22 : 8,
              height: 3,
              borderRadius: 999,
              backgroundColor: i <= passo ? cores.texto : cores.linha,
            }}
          />
        ))}
      </View>

      {/*
        Os passos curtos ficam CENTRADOS na vertical; o do idioma, não.

        Tirar peso de uma tela não é o mesmo que deixá-la vazia: o passo do
        nível tem título, quatro botões e uma linha, e encostado no teto ele
        deixa dois terços de preto embaixo — que lê como página que não
        carregou. O do idioma é o contrário: a lista de dez preenche e rola
        sozinha, e centrar ali só empurraria o primeiro idioma pra fora.

        É a mesma decisão que o `.tk-onb-body` do web resolve com
        `justify-content: safe center`; aqui o `safe` não existe, então a
        exceção é escrita à mão.
      */}
      <View className={passo === 0 ? "flex-1" : "flex-1 justify-center"}>
        {passo === 0 && (
          <>
            {/* `settings.language` e não uma chave nova: é a mesma palavra, já
                existe nos dez dicionários, e o título aqui é quase decorativo —
                quem não lê o idioma atual reconhece a própria língua na lista. */}
            <Text className="text-texto text-[34px] font-extrabold mb-5">
              {t("settings.language")}
            </Text>
            <ScrollView className="bg-superficie rounded-3xl" showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((l, i) => (
                <Pressable
                  key={l.code}
                  onPress={() => trocar(l.code)}
                  className="flex-row items-center px-4 py-3.5"
                  style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : undefined}
                >
                  <Text className="text-[17px] mr-3">{l.flag}</Text>
                  <Text
                    className={`flex-1 text-[15px] ${l.code === idioma ? "text-texto font-bold" : "text-texto2"}`}
                  >
                    {l.label}
                  </Text>
                  {l.code === idioma && <Text className="text-texto text-base">✓</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {passo === 1 && (
          <>
            <Text className="text-texto text-[34px] font-extrabold mb-2">
              {t("onb.level.title")}
            </Text>
            <Text className="text-texto2 text-[15px] leading-6 mb-6">{t("onb.tagline")}</Text>

            <View className="flex-row gap-2">
              {TRAINER_LEVELS.map((n) => (
                <Pressable
                  key={n}
                  onPress={() => definir({ level: n })}
                  className="flex-1 items-center rounded-2xl py-4"
                  style={{
                    backgroundColor: cores.superficie,
                    borderWidth: 1,
                    borderColor: n === setup.level ? cores.texto : "transparent",
                  }}
                >
                  <Text
                    className={`text-[22px] font-extrabold ${n === setup.level ? "text-texto" : "text-texto2"}`}
                  >
                    {n}
                  </Text>
                  <Text className="text-texto3 text-[10px] tracking-widest mt-0.5">
                    {t(FAIXA[n]!).toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* A conta, e não um elogio: é a única coisa desta tela que dá pra
                conferir depois dentro do jogo. */}
            <Text className="text-texto2 text-[13px] leading-5 mt-5">
              {t("onb.level.what", {
                nivel: setup.level,
                teto: tetoDePowerUp(setup.level, MAX_POWERUP_LEVEL),
              })}
            </Text>
          </>
        )}

        {passo === 2 && (
          <>
            <Text className="text-texto text-[34px] font-extrabold mb-2">{t("support.title")}</Text>
            <Text className="text-texto2 text-[15px] leading-6 mb-6">{t("support.body")}</Text>

            <View className="bg-superficie rounded-3xl px-4 py-4">
              <Text className="text-texto3 text-[11px] tracking-widest mb-1.5">
                {t("support.pixLabel").toUpperCase()}
              </Text>
              {/* `selectable`: mesmo se o botão de copiar falhar, dá pra
                  segurar e copiar do jeito do sistema. */}
              <Text selectable className="text-texto text-[13px] leading-5 font-mono">
                {PIX_KEY}
              </Text>
            </View>

            <Pressable
              onPress={copiar}
              className="rounded-full py-3.5 items-center mt-3"
              style={{ borderWidth: 1, borderColor: cores.linha }}
            >
              <Text className="text-texto text-[15px] font-semibold">
                {copiado ? t("support.copied") : t("support.copy")}
              </Text>
            </Pressable>

            {/* Não é enfeite: é o que mantém a doação sendo doação. Nada é
                vendido, nada é destravado, nada do app fica atrás disto. */}
            <Text className="text-texto3 text-[13px] leading-5 mt-4">{t("support.note")}</Text>
          </>
        )}
      </View>

      {/* Rodapé fixo: o botão de avançar fica sempre no mesmo lugar, em todas as
          telas, e nunca depende de rolagem pra aparecer. */}
      <Pressable
        onPress={() => (ultimo ? definir({ done: true }) : setPasso((p) => p + 1))}
        className="rounded-full py-4 items-center"
        style={{ backgroundColor: cores.texto }}
      >
        <Text className="text-[17px] font-bold" style={{ color: cores.fundo }}>
          {ultimo ? t("onb.open") : t("onb.continue")}
        </Text>
      </Pressable>
    </View>
  );
}
