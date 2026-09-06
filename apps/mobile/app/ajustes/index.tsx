import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { DICTS } from "@trainerkit/core";
import { useT } from "../../src/i18n";

/**
 * Ajustes.
 *
 * Hoje: idioma e os atalhos que nao cabiam no topo da Especies. O tema segue o
 * sistema (`userInterfaceStyle: automatic` no `app.json`) — a escolha manual
 * entra quando houver tema claro pra escolher.
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

export default function Ajustes() {
  const { t, idioma, trocar } = useT();

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      <Text className="text-texto3 text-[11px] tracking-widest mb-2">
        {t("settings.language").toUpperCase()}
      </Text>
      <View className="bg-superficie rounded-3xl overflow-hidden">
        {Object.keys(DICTS).map((cod, i) => (
          <Pressable
            key={cod}
            onPress={() => trocar(cod)}
            className="flex-row items-center px-4 py-3.5"
            style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.08)" } : undefined}
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
      <Link href="/faxina" asChild>
        <Pressable className="bg-superficie rounded-3xl px-4 py-4">
          <Text className="text-texto text-[15px]">{t("faxina.open")}</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}
