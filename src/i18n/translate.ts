/**
 * Traduction par texte source : le français sert de clé (`t("Tableau de bord")`). Un texte absent du dictionnaire
 * s'affiche tel quel, en français : une chaîne oubliée ne casse jamais l'écran.
 * Module pur, testé (`__tests__/translate.test.ts`).
 */
export type Dictionary = Readonly<Record<string, string>>;
export type Params = Readonly<Record<string, string | number | null | undefined>>;

/** Remplace `{nom}` par la valeur du paramètre ; un paramètre absent laisse l'accolade en place. */
export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name] ?? "") : match));
}

/** Séparateurs invisibles (Unicode) qui encadrent les valeurs d'un gabarit `tpl` : ils survivent dans une chaîne ordinaire. */
const OPEN = "\u2063";
const CLOSE = "\u2064";
const MARKED = /\u2063([^\u2064]*)\u2064/g;

/**
 * Gabarit traduisible : `tpl\`Réformé le ${date}\``. La chaîne obtenue porte ses valeurs entre séparateurs invisibles ;
 * `translate` retrouve alors la phrase `Réformé le {1}` dans le dictionnaire et y replace les valeurs, dans l'ordre
 * des mots de la langue cible. Sans traduction, le texte français d'origine s'affiche.
 */
export function tpl(strings: TemplateStringsArray, ...values: unknown[]): string {
  let out = strings[0] ?? "";
  values.forEach((value, i) => {
    out += OPEN + String(value ?? "").replace(/[\u2063\u2064]/g, "") + CLOSE + (strings[i + 1] ?? "");
  });
  return out;
}

/** Phrase-clé d'un gabarit : valeurs remplacées par `{1}`, `{2}`… (dans l'ordre d'apparition). */
export function templateKey(source: string): { key: string; args: string[] } {
  const args: string[] = [];
  const key = source.replace(MARKED, (_match, arg: string) => {
    args.push(arg);
    return `{${args.length}}`;
  });
  return { key, args };
}

export function translate(dictionary: Dictionary, source: string, params?: Params): string {
  if (source.includes(OPEN)) {
    const { key, args } = templateKey(source);
    const text = dictionary[key];
    // Pas de traduction : texte français d'origine, sans séparateurs.
    if (text === undefined) return source.replace(/[\u2063\u2064]/g, "");
    return text.replace(/\{(\d+)\}/g, (match, n: string) => args[Number(n) - 1] ?? match);
  }
  const direct = dictionary[source];
  if (direct !== undefined) return interpolate(direct, params);
  // Texte à espaces superflus (début, fin, retours à la ligne) : retrouvé sous sa forme nettoyée,
  // en gardant les espaces d'origine autour de la traduction.
  const clean = source.replace(/\s+/g, " ").trim();
  if (clean && clean !== source) {
    const hit = dictionary[clean];
    if (hit !== undefined) {
      const lead = source.length - source.trimStart().length;
      const trail = source.length - source.trimEnd().length;
      return source.slice(0, lead) + interpolate(hit, params) + source.slice(source.length - trail);
    }
  }
  return interpolate(source, params);
}
