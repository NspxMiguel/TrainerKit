import type { EN } from "./en.js";

/**
 * O formato de um dicionario: as MESMAS chaves do ingles.
 *
 * ⚠️ Isto vivia em `apps/web/src/i18n/t.ts`, e por isso os dez dicionarios
 * dependiam do app web pra compilar. Com o app nativo entrando, o tipo veio
 * junto com os dados — senao `packages/core` importaria de `apps/web`, que e o
 * contrario da direcao certa.
 *
 * `Record<keyof typeof EN, string>` e o que faz o teste de paridade existir de
 * graca: um idioma sem uma chave do ingles nao compila.
 */
export type Dict = Record<keyof typeof EN, string>;
export type Key = keyof Dict;
