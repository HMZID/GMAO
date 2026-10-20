import { cache } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";

type Holder = { locale: Locale };

/**
 * Langue de la requête en cours, lisible de façon synchrone par les fonctions de format (dates, nombres).
 * `getLocale` la renseigne dès le début du rendu ; hors requête (tests, scripts, tâches de fond) c'est le
 * français, ou la langue fixée par `withLocale` le temps d'un traitement.
 */
const requestHolder = cache((): Holder => ({ locale: DEFAULT_LOCALE }));
const ambient: Holder = { locale: DEFAULT_LOCALE };

/** `cache` ne mémorise que pendant un rendu serveur : sinon, la valeur ambiante sert (traitements séquentiels). */
function holder(): Holder {
  const h = requestHolder();
  return h === requestHolder() ? h : ambient;
}

export function setRequestLocale(locale: Locale) {
  holder().locale = locale;
}

export function requestLocale(): Locale {
  return holder().locale;
}

/** Exécute un traitement hors rendu (courriel d'un destinataire) dans la langue voulue, puis rétablit la précédente. */
export function withLocale<T>(locale: Locale, run: () => T): T {
  const h = holder();
  const previous = h.locale;
  h.locale = locale;
  try {
    return run();
  } finally {
    h.locale = previous;
  }
}
