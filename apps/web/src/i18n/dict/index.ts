import type { Dict } from "../t.ts";
import { EN } from "./en.ts";
import { PT_BR } from "./pt-BR.ts";
import { ES } from "./es.ts";
import { ES_419 } from "./es-419.ts";
import { DE } from "./de.ts";
import { FR } from "./fr.ts";
import { IT } from "./it.ts";
import { JA } from "./ja.ts";
import { KO } from "./ko.ts";
import { RU } from "./ru.ts";

/**
 * Todos os idiomas, carregados juntos.
 *
 * Sao ~9 KB comprimidos no total — menos que uma imagem — entao dividir em
 * chunks por idioma custaria uma ida a rede na hora de trocar de lingua, que e
 * exatamente o momento em que o app precisa responder na hora. Se um dia
 * passarem de trinta idiomas, ai vale reavaliar.
 *
 * As chaves batem com `LANGUAGES` em `language.ts`. Um idioma listado la sem
 * dicionario aqui cairia no ingles em silencio, entao o teste de i18n confere
 * os dois lados.
 */
export const DICTS: Record<string, Dict> = {
  en: EN,
  "pt-BR": PT_BR,
  es: ES,
  "es-419": ES_419,
  de: DE,
  fr: FR,
  it: IT,
  ja: JA,
  ko: KO,
  ru: RU,
};
