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

/**
 * localStorage que nao derruba o app.
 *
 * Nao e paranoia de teste: o Safari em navegacao privada LANCA ao gravar, e
 * alguns navegadores nao expoem `localStorage` quando cookies estao bloqueados.
 * Como este modulo le no import, uma excecao aqui deixaria a tela branca antes
 * do primeiro render — o pior lugar possivel para uma falha.
 */
const store = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Preferencia nao persistida vale mais que app quebrado.
    }
  },
};

/**
 * Palpite inicial pelo idioma do aparelho, caindo em ingles.
 *
 * ⚠️ LE A LISTA INTEIRA, e nao so `navigator.language`.
 *
 * `navigator.language` e a PRIMEIRA preferencia; `navigator.languages` e a fila
 * toda, que e o que o navegador manda no `Accept-Language`. Quem tem o navegador
 * em holandes e portugues em segundo (`["nl-NL", "pt-BR", "en"]`) caia direto no
 * ingles: "nl-NL" nao esta na lista de suportados, "nl" tambem nao, e a funcao
 * desistia ali sem nunca olhar o segundo item. O portugues estava declarado e
 * era ignorado.
 *
 * ⚠️ E ISTO CONTINUA SENDO UM PALPITE — por isso o setup pergunta.
 *
 * "sou do brasil e puxo ingles pra mim". E ele esta certo e a funcao tambem: o
 * navegador dele diz `en-US`, porque o Windows/Chrome dele esta em ingles, como
 * o de muita gente no Brasil. Idioma do aparelho nao e idioma da pessoa, e
 * nenhuma conta aqui dentro descobre isso — quem sabe e ele. Ver o passo
 * "idioma" no `Onboarding`, que voltou a existir por causa disto.
 */
function detect(): string {
  const fila = globalThis.navigator?.languages?.length
    ? globalThis.navigator.languages
    : [globalThis.navigator?.language ?? "en"];

  for (const wanted of fila) {
    const exact = LANGUAGES.find((l) => l.code === wanted);
    if (exact) return exact.code;
    const base = LANGUAGES.find((l) => l.code.split("-")[0] === wanted.split("-")[0]);
    if (base) return base.code;
  }
  return "en";
}

let current = store.get(KEY) ?? detect();
let showTranslation = store.get(SHOW_KEY) !== "0";
const listeners = new Set<() => void>();

/** Quem ja conhece os nomes em ingles nao precisa da segunda linha ocupando espaco. */
export function getShowTranslation(): boolean {
  return showTranslation;
}

export function setShowTranslation(value: boolean): void {
  showTranslation = value;
  store.set(SHOW_KEY, value ? "1" : "0");
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

/** Assinatura crua, para o `useT` reagir a troca de idioma sem duplicar store. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getLanguage(): string {
  return current;
}

export function setLanguage(code: string): void {
  current = code;
  store.set(KEY, code);
  if (typeof document !== "undefined") document.documentElement.lang = code;
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
