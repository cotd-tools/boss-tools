export const LOCALE_STORAGE_KEY = "cotd-language-pref";
export const languageOptions = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "English" },
] as const;
export type AppLocale = (typeof languageOptions)[number]["value"];
export const supportedLocales = languageOptions.map((option) => option.value);

export function resolveLocale(
  saved: string | null,
  languages: readonly string[],
): AppLocale {
  if (supportedLocales.includes(saved as AppLocale)) return saved as AppLocale;
  for (const language of languages) {
    const base = language.toLowerCase().split(/[-_]/)[0];
    if (base === "zh") return "zh-CN";
    if (base === "en") return "en";
  }
  return "zh-CN";
}
