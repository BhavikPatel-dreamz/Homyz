export type LanguageOption = {
  id: string;
  name: string;
  nativeName?: string;
  locale?: string;
};

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: "ar", name: "Arabic", nativeName: "العربية", locale: "ar" },
  { id: "en", name: "English", nativeName: "English", locale: "en" },
  { id: "fr", name: "French", nativeName: "Français", locale: "fr" },
  { id: "de", name: "German", nativeName: "Deutsch", locale: "de" },
  { id: "es", name: "Spanish", nativeName: "Español", locale: "es" },
  { id: "it", name: "Italian", nativeName: "Italiano", locale: "it" },
  { id: "zh", name: "Chinese", nativeName: "中文", locale: "zh" },
  { id: "ja", name: "Japanese", nativeName: "日本語", locale: "ja" },
  { id: "ru", name: "Russian", nativeName: "Русский", locale: "ru" },
  { id: "pt", name: "Portuguese", nativeName: "Português", locale: "pt" },
  { id: "tr", name: "Turkish", nativeName: "Türkçe", locale: "tr" },
  { id: "hi", name: "Hindi", nativeName: "हिन्दी", locale: "hi" },
  { id: "ko", name: "Korean", nativeName: "한국어", locale: "ko" },
  { id: "nl", name: "Dutch", nativeName: "Nederlands", locale: "nl" },
  { id: "sv", name: "Swedish", nativeName: "Svenska", locale: "sv" },
  { id: "pl", name: "Polish", nativeName: "Polski", locale: "pl" },
  { id: "el", name: "Greek", nativeName: "Ελληνικά", locale: "el" },
  { id: "he", name: "Hebrew", nativeName: "עברית", locale: "he" },
  { id: "th", name: "Thai", nativeName: "ไทย", locale: "th" },
  { id: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", locale: "vi" },
];

export const DEFAULT_LANGUAGE_IDS = ["en"];

export function getLanguageById(id: string): LanguageOption | undefined {
  return LANGUAGE_OPTIONS.find((language) => language.id === id);
}

export function getLanguageNameById(id: string): string {
  return getLanguageById(id)?.name ?? id;
}

export function getLanguageDisplayNames(ids: string[]): string[] {
  return ids
    .map((id) => getLanguageById(id))
    .filter((language): language is LanguageOption => Boolean(language))
    .map((language) => language.name);
}
