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
  /**
   * A bandeira, pedida por ele: "la em idioma acho legal por as bandeiras".
   *
   * ⚠️ ELA NAO DESENHA NO WINDOWS. Emoji de bandeira e um par de letras
   * regionais, e o Windows nao tem os glifos: la o navegador mostra "US", "BR",
   * "ES" em letra solta. Nao e hipotese, e como aquele sistema se comporta.
   *
   * Por isso a `tag` ao lado FICOU. Ela existia pra substituir a bandeira e
   * agora existe pra acompanhar: quem tem o emoji ve os dois, e quem nao tem ve
   * o codigo no lugar certo em vez de duas letras soltas onde deveria haver uma
   * imagem. E ela resolve o que a bandeira nao resolve — `es` e `es-419` sao
   * duas entradas de espanhol, e nenhuma bandeira distingue as duas (a de LatAm
   * levava o Mexico, um de vinte paises).
   */
  flag: string;
  /** O codigo BCP-47. Ver a nota da bandeira: os dois aparecem juntos. */
  tag: string;
}

export const LANGUAGES: readonly LanguageSpec[] = [
  { code: "en", label: "English", flag: "🇺🇸", tag: "EN" },
  { code: "pt-BR", label: "Português", flag: "🇧🇷", tag: "PT-BR" },
  { code: "es", label: "Español", flag: "🇪🇸", tag: "ES" },
  { code: "es-419", label: "Español (LatAm)", flag: "🇲🇽", tag: "ES-419" },
  { code: "de", label: "Deutsch", flag: "🇩🇪", tag: "DE" },
  { code: "fr", label: "Français", flag: "🇫🇷", tag: "FR" },
  { code: "it", label: "Italiano", flag: "🇮🇹", tag: "IT" },
  { code: "ja", label: "日本語", flag: "🇯🇵", tag: "JA" },
  { code: "ko", label: "한국어", flag: "🇰🇷", tag: "KO" },
  { code: "ru", label: "Русский", flag: "🇷🇺", tag: "RU" },
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

/*
 * ⚠️ O `lang` DO `<html>` VALE DESDE A PRIMEIRA PINTURA, e nao so depois de
 * alguem trocar de idioma nos Ajustes.
 *
 * O `index.html` nasce com `lang="pt-BR"` fixo, e o `setLanguage` abaixo so
 * corrige quando a pessoa TROCA. Quem abre o app em alemao — porque o aparelho
 * esta em alemao — ficava com a pagina inteira anunciada como portuguesa: o
 * leitor de tela le em portugues, o navegador oferece traduzir uma pagina que
 * ja esta no idioma certo, e a hifenizacao usa as regras erradas.
 *
 * Roda na importacao do modulo, que acontece antes do primeiro render porque o
 * `main.tsx` importa o i18n pra decidir o idioma.
 */
if (typeof document !== "undefined") document.documentElement.lang = current;

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
