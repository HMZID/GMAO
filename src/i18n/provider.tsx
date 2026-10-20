import type { ReactNode } from "react";
import { I18nProvider } from "./client";
import { dictionaryOf } from "./dictionaries";
import { getLocale } from "./server";

/** Fournit la langue et son dictionnaire aux composants client ; lit le cookie, donc sous <Suspense>. */
export async function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale} dictionary={dictionaryOf(locale)}>
      {children}
    </I18nProvider>
  );
}
