"use client";

import { Children, createContext, use, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { translate, type Dictionary, type Params } from "./translate";

type I18n = { locale: Locale; dictionary: Dictionary };

const I18nContext = createContext<I18n>({ locale: DEFAULT_LOCALE, dictionary: {} });

export function I18nProvider({ locale, dictionary, children }: I18n & { children: ReactNode }) {
  return <I18nContext value={{ locale, dictionary }}>{children}</I18nContext>;
}

export function useLocale(): Locale {
  return use(I18nContext).locale;
}

/** Fonction de traduction des composants client : `const t = useT(); t("Enregistrer")`. */
export function useT() {
  const { dictionary } = use(I18nContext);
  return (source: string, params?: Params) => translate(dictionary, source, params);
}

/**
 * Traduit les textes (chaînes) d'un contenu : `<Tr>{title}</Tr>`. Les éléments React et les nombres sont laissés
 * tels quels. Sert aux composants d'interface qui reçoivent un libellé en propriété.
 */
export function Tr({ children }: { children?: ReactNode }) {
  const { dictionary } = use(I18nContext);
  if (typeof children === "string") return translate(dictionary, children);
  if (Array.isArray(children)) return Children.map(children, (child) => (typeof child === "string" ? translate(dictionary, child) : child));
  return children;
}

/**
 * Texte traduit, utilisable dans les composants serveur comme dans les composants client :
 * `<T>Tableau de bord</T>`. Le texte français est la clé du dictionnaire.
 */
export function T({ children, params }: { children: string; params?: Params }) {
  const { dictionary } = use(I18nContext);
  return translate(dictionary, children, params);
}
