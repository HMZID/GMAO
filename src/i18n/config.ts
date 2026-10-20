/** Langues de l'interface : le français est la langue source, l'anglais et l'arabe (écriture de droite à gauche) sont traduits. */
export const LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Cookie de la langue choisie, lisible par le navigateur : le script de démarrage pose `lang` et `dir` avant l'affichage. */
export const LOCALE_COOKIE = "gmao-locale";

export const LOCALE_NAMES: Record<Locale, string> = { fr: "Français", en: "English", ar: "العربية" };

/** Étiquette BCP 47 pour `Intl` (dates, nombres, montants). */
export const INTL_LOCALE: Record<Locale, string> = { fr: "fr-FR", en: "en-GB", ar: "ar-TN-u-nu-latn" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * Script exécuté avant l'affichage (dans `<head>`) : applique la langue du cookie à `<html>`. La page est rendue
 * côté serveur dans cette même langue ; le script évite seulement un passage de gauche à droite avant le bon sens.
 */
export const LOCALE_BOOTSTRAP_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=(fr|en|ar)/);var l=m?m[1]:"${DEFAULT_LOCALE}";var d=document.documentElement;d.lang=l;d.dir=l==="ar"?"rtl":"ltr"}catch(e){}})()`;
