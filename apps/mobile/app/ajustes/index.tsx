import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { DICTS, type Key } from "@trainerkit/core";
import { useT } from "../../src/i18n";
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
const NOMES: Record<string, string> = {
  en: "English",
  "pt-BR": "Português",
  es: "Español",
  "es-419": "Español (LatAm)",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  ru: "Русский",
};

const TEMAS: { valor: Escolha; chave: Key }[] = [
  { valor: "sistema", chave: "settings.theme.system" },
  { valor: "claro", chave: "settings.theme.light" },
  { valor: "escuro", chave: "settings.theme.dark" },
];

export default function Ajustes() {
  const { t, idioma, trocar } = useT();
  const { cores, escolha, definir } = useTema();

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
        {Object.keys(DICTS).map((cod, i) => (
          <Pressable
            key={cod}
            onPress={() => trocar(cod)}
            className="flex-row items-center px-4 py-3.5"
            style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : undefined}
          >
            <Text
              className={`flex-1 text-[15px] ${cod === idioma ? "text-texto font-bold" : "text-texto2"}`}
            >
              {NOMES[cod] ?? cod}
            </Text>
            {cod === idioma && <Text className="text-texto text-base">✓</Text>}
          </Pressable>
        ))}
      </View>

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
    </ScrollView>
  );
}
