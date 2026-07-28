/**
 * Traducoes OFICIAIS do jogo.
 *
 * Nao sao traducoes nossas nem automaticas: sao os textos que a propria Niantic
 * (hoje Scopely) publica no cliente. Isso importa porque o nome traduzido quase
 * nunca e literal — "Flame Charge" e "Ataque de Chamas", nao "Carga de Chama".
 * Um jogador procurando o golpe no jogo em portugues nao encontraria o nome
 * literal, entao traduzir por conta propria seria pior que nao traduzir.
 *
 * Chaves relevantes, ambas com o numero em quatro digitos:
 *   move_name_0101     -> nome do golpe (0101 e o numero do templateId)
 *   pokemon_name_0068  -> nome da especie (0068 e a dex)
 *
 * Nomes de especie sao iguais em quase todos os idiomas ocidentais — Machamp e
 * Machamp em pt, en e de. Por isso o app mostra duas linhas so nos GOLPES.
 */

export interface LanguageSpec {
  /** Codigo BCP-47, usado no `lang` do documento e no Intl. */
  code: string;
  /** Nome do arquivo em pogo_assets/Texts/Latest APK/JSON. */
  file: string;
  /** Como o idioma se escreve nele mesmo. */
  label: string;
  /** Bandeira, para a lista do setup. */
  flag: string;
}

/**
 * Idiomas oferecidos.
 *
 * Ingles primeiro porque e o padrao do app: e o idioma em que os nomes de golpe
 * circulam na comunidade, em guias e em video. Quem escolhe outro ve os dois.
 */
export const LANGUAGES: readonly LanguageSpec[] = [
  { code: "en", file: "english", label: "English", flag: "🇺🇸" },
  { code: "pt-BR", file: "brazilianportuguese", label: "Português", flag: "🇧🇷" },
  { code: "es", file: "spanish", label: "Español", flag: "🇪🇸" },
  { code: "es-419", file: "latinamericanspanish", label: "Español (LatAm)", flag: "🇲🇽" },
  { code: "de", file: "german", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", file: "french", label: "Français", flag: "🇫🇷" },
  { code: "it", file: "italian", label: "Italiano", flag: "🇮🇹" },
  { code: "ja", file: "japanese", label: "日本語", flag: "🇯🇵" },
  { code: "ko", file: "korean", label: "한국어", flag: "🇰🇷" },
  { code: "ru", file: "russian", label: "Русский", flag: "🇷🇺" },
];

const BASE =
  "https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON";

export function urlFor(spec: LanguageSpec): string {
  return `${BASE}/i18n_${spec.file}.json`;
}

/**
 * O arquivo e um array PLANO de chave e valor alternados, nao um objeto.
 * Converter para mapa aqui evita espalhar essa peculiaridade pelo resto do ETL.
 */
export function toMap(raw: unknown): Record<string, string> {
  const data = (raw as { data?: unknown })?.data;
  if (!Array.isArray(data)) {
    throw new Error('arquivo de traducao sem o campo "data" em formato de array');
  }

  const map: Record<string, string> = {};
  for (let i = 0; i + 1 < data.length; i += 2) {
    const key = data[i];
    const value = data[i + 1];
    if (typeof key === "string" && typeof value === "string") map[key] = value;
  }
  return map;
}

/** `V0101_MOVE_FLAME_CHARGE` -> `move_name_0101` */
export function moveKeyFor(templateId: string): string | null {
  const m = /^(?:COMBAT_)?V(\d{4})_MOVE_/.exec(templateId);
  return m ? `move_name_${m[1]}` : null;
}
