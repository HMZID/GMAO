/**
 * Traduction par texte source : le français sert de clé (`t("Se connecter")`). Un texte absent du dictionnaire
 * s'affiche en français. Module pur, testé (`lib/__tests__/i18n.test.ts`).
 */
export type Dictionary = Readonly<Record<string, string>>;
export type Params = Readonly<Record<string, string | number | null | undefined>>;

/** Remplace `{nom}` par la valeur du paramètre ; un paramètre absent laisse l'accolade en place. */
export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name] ?? "") : match));
}

export function translate(dictionary: Dictionary, source: string, params?: Params): string {
  return interpolate(dictionary[source] ?? source, params);
}
