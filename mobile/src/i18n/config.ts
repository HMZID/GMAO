/** Langues de l'application mobile (les mêmes que le web) : le français est la langue source. */
export const LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_NAMES: Record<Locale, string> = { fr: "Français", en: "English", ar: "العربية" };

/** Étiquettes BCP 47 des formats (chiffres latins en arabe, usage tunisien). */
export const INTL_LOCALE: Record<Locale, string> = { fr: "fr-FR", en: "en-GB", ar: "ar-TN-u-nu-latn" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Langue de l'appareil si elle est proposée, sinon le français. */
export function localeFromDevice(tag: string | undefined): Locale {
  const language = (tag ?? "").slice(0, 2).toLowerCase();
  return isLocale(language) ? language : DEFAULT_LOCALE;
}
