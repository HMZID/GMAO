import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "./config";

/** Langue d'affichage courante, lue par les fonctions de format (dates, nombres) hors de tout composant. */
let current: Locale = DEFAULT_LOCALE;

export function setFormatLocale(locale: Locale) {
  current = locale;
}

export function formatLocaleTag() {
  return INTL_LOCALE[current];
}

export function currentLocale() {
  return current;
}
