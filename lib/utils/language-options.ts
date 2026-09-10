export type LanguageOption = {
  id: string;
  name: string;
  nativeName?: string;
  locale?: string;
};

const LANGUAGE_OPTIONS_UNSORTED: LanguageOption[] = [
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
  { id: "af", name: "Afrikaans", nativeName: "Afrikaans", locale: "af" },
  { id: "sq", name: "Albanian", nativeName: "Shqip", locale: "sq" },
  { id: "am", name: "Amharic", nativeName: "አማርኛ", locale: "am" },
  { id: "hy", name: "Armenian", nativeName: "Հայերեն", locale: "hy" },
  { id: "as", name: "Assamese", nativeName: "অসমীয়া", locale: "as" },
  { id: "az", name: "Azerbaijani", nativeName: "Azərbaycanca", locale: "az" },
  { id: "eu", name: "Basque", nativeName: "Euskara", locale: "eu" },
  { id: "be", name: "Belarusian", nativeName: "Беларуская", locale: "be" },
  { id: "bn", name: "Bengali", nativeName: "বাংলা", locale: "bn" },
  { id: "bs", name: "Bosnian", nativeName: "Bosanski", locale: "bs" },
  { id: "bg", name: "Bulgarian", nativeName: "Български", locale: "bg" },
  { id: "my", name: "Burmese", nativeName: "မြန်မာ", locale: "my" },
  { id: "ca", name: "Catalan", nativeName: "Català", locale: "ca" },
  { id: "hr", name: "Croatian", nativeName: "Hrvatski", locale: "hr" },
  { id: "cs", name: "Czech", nativeName: "Čeština", locale: "cs" },
  { id: "da", name: "Danish", nativeName: "Dansk", locale: "da" },
  { id: "et", name: "Estonian", nativeName: "Eesti", locale: "et" },
  { id: "fi", name: "Finnish", nativeName: "Suomi", locale: "fi" },
  { id: "fy", name: "Frisian", nativeName: "Frysk", locale: "fy" },
  { id: "gl", name: "Galician", nativeName: "Galego", locale: "gl" },
  { id: "ka", name: "Georgian", nativeName: "ქართული", locale: "ka" },
  { id: "gu", name: "Gujarati", nativeName: "ગુજરાતી", locale: "gu" },
  { id: "ha", name: "Hausa", nativeName: "Hausa", locale: "ha" },
  { id: "hu", name: "Hungarian", nativeName: "Magyar", locale: "hu" },
  { id: "is", name: "Icelandic", nativeName: "Íslenska", locale: "is" },
  { id: "ig", name: "Igbo", nativeName: "Igbo", locale: "ig" },
  { id: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", locale: "id" },
  { id: "ga", name: "Irish", nativeName: "Gaeilge", locale: "ga" },
  { id: "jv", name: "Javanese", nativeName: "Basa Jawa", locale: "jv" },
  { id: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", locale: "kn" },
  { id: "kk", name: "Kazakh", nativeName: "Қазақша", locale: "kk" },
  { id: "km", name: "Khmer", nativeName: "ខ្មែរ", locale: "km" },
  { id: "rw", name: "Kinyarwanda", nativeName: "Kinyarwanda", locale: "rw" },
  { id: "ku", name: "Kurdish", nativeName: "Kurdî", locale: "ku" },
  { id: "ky", name: "Kyrgyz", nativeName: "Кыргызча", locale: "ky" },
  { id: "lo", name: "Lao", nativeName: "ລາວ", locale: "lo" },
  { id: "la", name: "Latin", nativeName: "Latina", locale: "la" },
  { id: "lv", name: "Latvian", nativeName: "Latviešu", locale: "lv" },
  { id: "lt", name: "Lithuanian", nativeName: "Lietuvių", locale: "lt" },
  { id: "lb", name: "Luxembourgish", nativeName: "Lëtzebuergesch", locale: "lb" },
  { id: "mk", name: "Macedonian", nativeName: "Македонски", locale: "mk" },
  { id: "ms", name: "Malay", nativeName: "Bahasa Melayu", locale: "ms" },
  { id: "ml", name: "Malayalam", nativeName: "മലയാളം", locale: "ml" },
  { id: "mt", name: "Maltese", nativeName: "Malti", locale: "mt" },
  { id: "mi", name: "Māori", nativeName: "Te Reo Māori", locale: "mi" },
  { id: "mr", name: "Marathi", nativeName: "मराठी", locale: "mr" },
  { id: "mn", name: "Mongolian", nativeName: "Монгол", locale: "mn" },
  { id: "ne", name: "Nepali", nativeName: "नेपाली", locale: "ne" },
  { id: "no", name: "Norwegian", nativeName: "Norsk", locale: "no" },
  { id: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", locale: "or" },
  { id: "ps", name: "Pashto", nativeName: "پښتو", locale: "ps" },
  { id: "fa", name: "Persian", nativeName: "فارسی", locale: "fa" },
  { id: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", locale: "pa" },
  { id: "ro", name: "Romanian", nativeName: "Română", locale: "ro" },
  { id: "sm", name: "Samoan", nativeName: "Gagana Samoa", locale: "sm" },
  { id: "sr", name: "Serbian", nativeName: "Српски", locale: "sr" },
  { id: "si", name: "Sinhala", nativeName: "සිංහල", locale: "si" },
  { id: "sk", name: "Slovak", nativeName: "Slovenčina", locale: "sk" },
  { id: "sl", name: "Slovenian", nativeName: "Slovenščina", locale: "sl" },
  { id: "so", name: "Somali", nativeName: "Soomaali", locale: "so" },
  { id: "su", name: "Sundanese", nativeName: "Basa Sunda", locale: "su" },
  { id: "sw", name: "Swahili", nativeName: "Kiswahili", locale: "sw" },
  { id: "tl", name: "Tagalog", nativeName: "Tagalog", locale: "tl" },
  { id: "tg", name: "Tajik", nativeName: "Тоҷикӣ", locale: "tg" },
  { id: "ta", name: "Tamil", nativeName: "தமிழ்", locale: "ta" },
  { id: "te", name: "Telugu", nativeName: "తెలుగు", locale: "te" },
  { id: "ti", name: "Tigrinya", nativeName: "ትግርኛ", locale: "ti" },
  { id: "to", name: "Tongan", nativeName: "Lea Faka-Tonga", locale: "to" },
  { id: "tk", name: "Turkmen", nativeName: "Türkmençe", locale: "tk" },
  { id: "uk", name: "Ukrainian", nativeName: "Українська", locale: "uk" },
  { id: "ur", name: "Urdu", nativeName: "اردو", locale: "ur" },
  { id: "ug", name: "Uyghur", nativeName: "ئۇيغۇرچە", locale: "ug" },
  { id: "uz", name: "Uzbek", nativeName: "Oʻzbekcha", locale: "uz" },
  { id: "cy", name: "Welsh", nativeName: "Cymraeg", locale: "cy" },
  { id: "yo", name: "Yoruba", nativeName: "Yorùbá", locale: "yo" },
  { id: "zu", name: "Zulu", nativeName: "isiZulu", locale: "zu" },
];

export const LANGUAGE_OPTIONS = [...LANGUAGE_OPTIONS_UNSORTED].sort((a, b) =>
  a.name.localeCompare(b.name),
);

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
