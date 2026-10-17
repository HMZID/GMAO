/**
 * Mot de passe provisoire des comptes ouverts depuis le site : envoyé par courriel, remplacé par
 * l'utilisateur à sa première connexion. Module pur, testé dans `__tests__/credentials.test.ts`.
 */
import { randomInt } from "node:crypto";

/** Caractères sans ambiguïté à la lecture (ni 0/O, 1/l/I). */
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const ALL = UPPER + LOWER + DIGITS;

/**
 * Trois groupes de quatre caractères séparés par des tirets (« Kp7m-W3xq-9Rtd ») : 14 caractères, au moins
 * une majuscule, une minuscule et un chiffre, lisible au téléphone si le courriel n'arrive pas.
 */
export function generateProvisionalPassword(random: (max: number) => number = randomInt) {
  const pick = (set: string) => set[random(set.length)];
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), ...Array.from({ length: 9 }, () => pick(ALL))];
  // Mélange (Fisher-Yates) : les trois caractères imposés ne sont pas toujours en tête.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join("")).join("-");
}

/** Nouveau mot de passe choisi à la première connexion : 10 caractères au moins, différent du provisoire. */
export function newPasswordRefusals(input: { password: string; confirmation: string; provisionalMatches: boolean }) {
  const errors: string[] = [];
  if (input.password.length < 10) errors.push("Le mot de passe doit compter au moins 10 caractères.");
  if (input.password !== input.confirmation) errors.push("La confirmation ne correspond pas au mot de passe.");
  if (input.provisionalMatches) errors.push("Choisissez un mot de passe différent du mot de passe provisoire.");
  return errors;
}
