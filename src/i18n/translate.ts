/**
 * Traduction par texte source : le français sert de clé (`t("Tableau de bord")`). Un texte absent du dictionnaire
 * s'affiche tel quel, en français : une chaîne oubliée ne casse jamais l'écran.
 * Module pur, testé (`__tests__/translate.test.ts`).
 */
export type Dictionary = Readonly<Record<string, string>>;
export type Params = Readonly<Record<string, string | number>>;

/** Remplace `{nom}` par la valeur du paramètre ; un paramètre absent laisse l'accolade en place. */
export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function translate(dictionary: Dictionary, source: string, params?: Params): string {
  return interpolate(dictionary[source] ?? source, params);
}
