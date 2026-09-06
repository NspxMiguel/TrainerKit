import * as Clipboard from "expo-clipboard";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  LANGUAGES,
  MAX_POWERUP_LEVEL,
  PIX_KEY,
  TRAINER_LEVELS,
  tetoDePowerUp,
  type Key,
} from "@trainerkit/core";
import { useT } from "../../src/i18n";
import { useSetup } from "../../src/setup";
import { useTema, type Escolha } from "../../src/tema";

/**
 * Ajustes.
 *
 * Hoje: tema, idioma e os atalhos que nao cabiam no topo da Especies.
 *
 * O tema comeca em "sistema" — iPhone em claro nao significa que ele quer o app
 * claro, mas e o palpite menos errado quando ninguem escolheu ainda. As tres
 * opcoes ficam salvas; ver `src/tema.tsx`.
 */
/* A mesma legenda das quatro faixas que o setup usa. */
const FAIXA: Record<number, Key> = {
  20: "onb.level.start",
  30: "onb.level.mid",
  40: "onb.level.high",
  50: "onb.level.max",
};

const TEMAS: { valor: Escolha; chave: Key }[] = [
  { valor: "sistema", chave: "settings.theme.system" },
  { valor: "claro", chave: "settings.theme.light" },
  { valor: "escuro", chave: "settings.theme.dark" },
];

export default function Ajustes() {
  const { t, idioma, trocar } = useT();
  const { cores, escolha, definir } = useTema();
  const { setup, definir: definirSetup } = useSetup();
  const [copiado, setCopiado] = useState(false);

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      <Text className="text-texto3 text-[11px] tracking-widest mb-2">
        {t("settings.appearance").toUpperCase()}
      </Text>
      <View className="bg-superficie rounded-3xl overflow-hidden mb-7">
        {TEMAS.map((op, i) => (
          <Pressable
            key={op.valor}
            onPress={() => definir(op.valor)}
            className="flex-row items-center px-4 py-3.5"
            style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : undefined}
          >
            <Text
              className={`flex-1 text-[15px] ${op.valor === escolha ? "text-texto font-bold" : "text-texto2"}`}
            >
              {t(op.chave)}
            </Text>
            {op.valor === escolha && <Text className="text-texto text-base">✓</Text>}
          </Pressable>
        ))}
      </View>

      <Text className="text-texto3 text-[11px] tracking-widest mb-2">
        {t("settings.language").toUpperCase()}
      </Text>
      <View className="bg-superficie rounded-3xl overflow-hidden">
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
      </View>

      {/*
        O NÍVEL DO TREINADOR mora aqui também, e não só no setup.

        Ele é o único ajuste do app que muda VEREDITO — quem sobe de nível no
        jogo e não tem onde corrigir isso continua recebendo resposta calculada
        com o teto antigo, sem nenhum jeito de descobrir por quê. Um setup que
        roda uma vez não pode ser o único lugar de um valor que muda com o
        tempo.
      */}
      <Text className="text-texto3 text-[11px] tracking-widest mt-7 mb-2">
        {t("onb.level.title").toUpperCase()}
      </Text>
      <View className="flex-row gap-2">
        {TRAINER_LEVELS.map((n) => (
          <Pressable
            key={n}
            onPress={() => definirSetup({ level: n })}
            className="flex-1 items-center rounded-2xl py-3"
            style={{
              backgroundColor: cores.superficie,
              borderWidth: 1,
              borderColor: n === setup.level ? cores.texto : "transparent",
            }}
          >
            <Text
              className={`text-[19px] font-extrabold ${n === setup.level ? "text-texto" : "text-texto2"}`}
            >
              {n}
            </Text>
            <Text className="text-texto3 text-[10px] tracking-widest mt-0.5">
              {t(FAIXA[n]!).toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text className="text-texto3 text-[12px] leading-5 mt-2">
        {t("onb.level.what", {
          nivel: setup.level,
          teto: tetoDePowerUp(setup.level, MAX_POWERUP_LEVEL),
        })}
      </Text>

      <Text className="text-texto3 text-[11px] tracking-widest mt-7 mb-2">
        {t("faxina.title").toUpperCase()}
      </Text>
      <Link href="/ginasio" asChild>
        <Pressable className="bg-superficie rounded-3xl px-4 py-4 mb-2">
          <Text className="text-texto text-[15px]">{t("gym.title")}</Text>
        </Pressable>
      </Link>
      <Link href="/time" asChild>
        <Pressable className="bg-superficie rounded-3xl px-4 py-4 mb-2">
          <Text className="text-texto text-[15px]">{t("team.open")}</Text>
        </Pressable>
      </Link>
      <Link href="/faxina" asChild>
        <Pressable className="bg-superficie rounded-3xl px-4 py-4">
          <Text className="text-texto text-[15px]">{t("faxina.open")}</Text>
        </Pressable>
      </Link>

      {/*
        APOIAR fica aqui também, e não só no setup.

        O setup roda uma vez, na abertura, antes de o app ter provado que serve
        pra alguma coisa. Quem decide que valeu decide no terceiro mês — e nessa
        hora precisa de um lugar pra achar a chave.
      */}
      <Text className="text-texto3 text-[11px] tracking-widest mt-7 mb-2">
        {t("support.title").toUpperCase()}
      </Text>
      <View className="bg-superficie rounded-3xl px-4 py-4">
        <Text className="text-texto2 text-[13px] leading-5 mb-3">{t("support.body")}</Text>
        <Text className="text-texto3 text-[11px] tracking-widest mb-1.5">
          {t("support.pixLabel").toUpperCase()}
        </Text>
        <Text selectable className="text-texto text-[13px] leading-5 font-mono">
          {PIX_KEY}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          Clipboard.setStringAsync(PIX_KEY)
            .then(() => {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            })
            .catch(() => {});
        }}
        className="rounded-full py-3.5 items-center mt-3"
        style={{ borderWidth: 1, borderColor: cores.linha }}
      >
        <Text className="text-texto text-[15px] font-semibold">
          {copiado ? t("support.copied") : t("support.copy")}
        </Text>
      </Pressable>
      <Text className="text-texto3 text-[12px] leading-5 mt-3">{t("support.note")}</Text>
    </ScrollView>
  );
}
