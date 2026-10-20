import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { dictionaryOf } from "./dictionaries";
import { setRequestLocale } from "./request-locale";
import { translate, type Params } from "./translate";

/** Langue de la requête (cookie), le français par défaut. Donnée de requête : à appeler sous une frontière <Suspense>. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(value) ? value : DEFAULT_LOCALE;
  setRequestLocale(locale);
  return locale;
});

/** Fonction de traduction pour les composants et actions serveur : `const t = await getT(); t("Enregistrer")`. */
export const getT = cache(async () => {
  const dictionary = dictionaryOf(await getLocale());
  return (source: string, params?: Params) => translate(dictionary, source, params);
});
