import { useSyncExternalStore } from "react";

import type { Message } from "@trainerkit/core";

import { getLanguage, subscribe } from "./language.ts";
import { EN } from "./dict/en.ts";
import { DICTS } from "./dict/index.ts";

/**
 * Traducao da interface.
 *
 * O ingles e a FONTE, nao mais uma traducao: `EN` define as chaves e o tipo
 * `Dict` sai dele. Qualquer idioma que esqueca uma chave nao compila, e qualquer
 * chave que ninguem mais use aparece como erro de tipo no dicionario. Foi de
 * proposito — a alternativa, um `Record<string, string>` solto, deixa o app
 * mostrar `home.greeting.evening` na cara do usuario em producao.
 *
 * Parametros usam `{nome}`. Numeros ja chegam formatados por quem chama, porque
 * a formatacao depende do idioma (1.500 em pt, 1,500 em en) e o `toLocaleString`
 * precisa do codigo.
 */
/**
 * As MESMAS chaves do ingles, com valor string qualquer.
 *
 * `typeof EN` sozinho nao serve: o `as const` do dicionario ingles congela cada
 * valor no seu literal, e ai "Sammlung" nao seria atribuivel a "Collection".
 * O que precisa ser igual entre idiomas e o conjunto de chaves, nao o texto.
 */
export type Dict = Record<keyof typeof EN, string>;
export type Key = keyof Dict;

/** Interpolacao. `{nome}` sem valor correspondente fica como esta, visivel. */
function fill(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

export function translate(
  language: string,
  key: Key,
  params?: Record<string, string | number>,
): string {
  // Cai no ingles quando o idioma nao tem a chave. Nunca cai na CHAVE: um
  // rotulo em ingles no meio do app portugues e um defeito; `nav.pokedex` na
  // tela e um defeito que parece bug de programador.
  const dict = DICTS[language];
  const value = (dict?.[key] as string | undefined) ?? EN[key];
  return fill(value, params);
}

export type TFunction = (key: Key, params?: Record<string, string | number>) => string;

/** Rende uma `Message` do core. */
export type TMessage = (message: Message) => string;

/**
 * Traduz uma mensagem vinda do core.
 *
 * Todo parametro NUMERICO passa por `toLocaleString` do idioma. Isso importa
 * mais do que parece: o core devolve `4096` cru, e o separador de milhar muda
 * de idioma pra idioma — 4.096 em portugues, 4,096 em ingles, 4 096 em frances.
 * Antes o core formatava em pt-BR e o numero saia errado em todo o resto.
 */
export function translateMessage(language: string, message: Message): string {
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(message.params ?? {})) {
    params[name] = typeof value === "number" ? value.toLocaleString(language) : value;
  }
  return translate(language, message.key as Key, params);
}

/**
 * O tradutor, reagindo a troca de idioma.
 *
 * Devolve tambem `language` porque quase toda tela que traduz texto tambem
 * formata numero ou data, e essas precisam do codigo do idioma.
 */
export function useT(): { t: TFunction; tm: TMessage; language: string } {
  const language = useSyncExternalStore(subscribe, getLanguage, () => "en");
  return {
    t: (key, params) => translate(language, key, params),
    tm: (message) => translateMessage(language, message),
    language,
  };
}

/**
 * Formata numero no idioma atual.
 *
 * Existe para nao espalhar `toLocaleString("pt-BR")` pelo app, que foi
 * exatamente o que aconteceu antes: os PC apareciam com ponto de milhar
 * brasileiro mesmo com o app em ingles.
 */
export function formatNumber(value: number, language: string): string {
  return value.toLocaleString(language);
}
