/**
 * OS DEZ IDIOMAS, escritos uma vez.
 *
 * A lista morava em `apps/web/src/i18n/language.ts`, e o app nativo tinha uma
 * cópia parcial do mesmo mapa em DOIS arquivos (Ajustes e a primeira abertura) —
 * sem bandeira, porque quem copiou copiou só os nomes. Três listas do mesmo
 * dado é como um idioma novo entra em uma tela e falta nas outras duas.
 *
 * ⚠️ A bandeira não é decoração: é o que faz a lista ser varrida com o olho em
 * vez de lida. Ela sai APENAS onde não desenha — Windows sem a ligadura de
 * indicador regional, onde 🇧🇷 vira "BR" em letra solta e parece defeito. Isso é
 * medido em `apps/web/src/i18n/bandeiras.ts`, não farejado do user-agent, e no
 * iOS a pergunta não existe: o emoji sempre desenha.
 *
 * O `label` é o nome do idioma NO PRÓPRIO idioma, e é ele que resolve o
 * ovo-e-galinha de rotular a tela de escolher idioma num idioma que ainda não
 * foi escolhido: "Português", "日本語" e "Русский" se identificam sozinhos.
 */
export interface LanguageSpec {
  /** A etiqueta BCP-47, que é a chave do dicionário. */
  code: string;
  /** O nome do idioma, escrito nele mesmo. */
  label: string;
  /** A bandeira do idioma. */
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
