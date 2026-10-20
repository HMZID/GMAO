import { headers } from "next/headers";
import type { ReactNode } from "react";
import { I18nProvider } from "./client";
import { dictionaryOf } from "./dictionaries";
import { getLocale } from "./server";

/**
 * Fournit la langue et son dictionnaire aux composants client ; lit le cookie, donc sous <Suspense>.
 * Le dictionnaire (plusieurs centaines de Ko) part avec le document seulement : les navigations et rafraîchissements
 * (requêtes RSC) ne le répètent pas, le navigateur garde celui qu'il a reçu.
 */
export async function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const isRscRequest = (await headers()).get("rsc") === "1";
  return (
    <I18nProvider locale={locale} dictionary={isRscRequest ? undefined : dictionaryOf(locale)}>
      {children}
    </I18nProvider>
  );
}
