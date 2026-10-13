/**
 * Numérotation des OT, DI et demandes d'achat (COR-05). Module pur, testé dans `__tests__/numbering.test.ts`.
 */

/**
 * Année du numéro, dans le fuseau d'exploitation : un OT créé le 1er janvier à 0 h 30 à Paris
 * (31 décembre 23 h 30 en UTC) porte bien l'année nouvelle.
 */
export function numberingYear(date: Date, timeZone = "Europe/Paris") {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric" }).format(date));
}
