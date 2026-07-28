import { useSyncExternalStore } from "react";

/**
 * Idioma escolhido.
 *
 * Ingles e o PADRAO de propósito: e o idioma em que os nomes de golpe circulam
 * na comunidade, em guia e em video. Quem escolhe outro nao troca o nome — ve os
 * dois, ingles primeiro e a traducao oficial em seguida:
 *
 *     Flame Charge · Ataque de Chamas
 *
 * Isso resolve um problema real: procurar "Ataque de Chamas" no YouTube nao
 * acha nada, e procurar "Flame Charge" no jogo em portugues tambem nao. Mostrar
 * os dois deixa a pessoa transitar entre o jogo e a comunidade.
 */
export interface LanguageSpec {
  code: string;
  label: string;
  flag: string;
}

export const LANGUAGES: readonly LanguageSpec[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "pt-BR", label: "Português", flag: "🇧🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "es-419", label: "Español (LatAm)", flag: "🇲🇽" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
];

const KEY = "tk:idioma";
const SHOW_KEY = "tk:traducao";

/** Palpite inicial pelo idioma do aparelho, caindo em ingles. */
function detect(): string {
  const wanted = navigator.language;
  const exact = LANGUAGES.find((l) => l.code === wanted);
  if (exact) return exact.code;
  const base = LANGUAGES.find((l) => l.code.split("-")[0] === wanted.split("-")[0]);
  return base?.code ?? "en";
}

let current = localStorage.getItem(KEY) ?? detect();
let showTranslation = localStorage.getItem(SHOW_KEY) !== "0";
const listeners = new Set<() => void>();

/** Quem ja conhece os nomes em ingles nao precisa da segunda linha ocupando espaco. */
export function getShowTranslation(): boolean {
  return showTranslation;
}

export function setShowTranslation(value: boolean): void {
  showTranslation = value;
  localStorage.setItem(SHOW_KEY, value ? "1" : "0");
  for (const fn of listeners) fn();
}

export function useShowTranslation(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getShowTranslation,
    () => true,
  );
}

export function getLanguage(): string {
  return current;
}

export function setLanguage(code: string): void {
  current = code;
  localStorage.setItem(KEY, code);
  document.documentElement.lang = code;
  for (const fn of listeners) fn();
}

export function useLanguage(): string {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getLanguage,
    () => "en",
  );
}

/**
 * Nome do golpe para exibicao.
 *
 * Em ingles sai uma linha so. Em qualquer outro idioma saem as duas, porque
 * nenhuma das duas sozinha serve: a inglesa nao aparece no jogo traduzido, e a
 * traduzida nao aparece em nenhum guia.
 */
export function moveLabel(
  englishName: string,
  translations: Record<string, Record<string, string>> | undefined,
  moveId: string,
  language: string,
): { primary: string; secondary: string | null } {
  if (language === "en" || !showTranslation) return { primary: englishName, secondary: null };

  const translated = translations?.[language]?.[moveId];
  if (!translated || translated === englishName) {
    return { primary: englishName, secondary: null };
  }
  return { primary: englishName, secondary: translated };
}
