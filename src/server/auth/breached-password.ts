import "server-only";
import { createHash } from "node:crypto";
import { breachCountInRange } from "@/server/domain/login-security";
import { BusinessRuleError } from "@/server/errors";

/**
 * Refus des mots de passe déjà divulgués (TEC-04, recommandation ANSSI / NIST SP 800-63B) : Have I Been Pwned,
 * méthode k-anonymity (seuls les 5 premiers caractères de l'empreinte SHA-1 quittent le serveur).
 * Actif sur Vercel (recette et production) ou avec PASSWORD_BREACH_CHECK=true ; inactif en local et en CI
 * (PASSWORD_BREACH_CHECK=false pour le couper). Service injoignable : le mot de passe est accepté (journalisé).
 */
function enabled() {
  const flag = process.env.PASSWORD_BREACH_CHECK;
  return flag ? flag === "true" : !!process.env.VERCEL_ENV;
}

export async function assertPasswordNotBreached(password: string) {
  if (!enabled() || !password) return;
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  let count = 0;
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true", "User-Agent": "GMAO" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    count = breachCountInRange(await response.text(), hash.slice(5));
  } catch (error) {
    console.warn("[mot de passe] contrôle des fuites impossible :", (error as Error).message);
    return;
  }
  if (count > 0) {
    throw new BusinessRuleError(["Ce mot de passe figure dans des fuites de données connues : en choisir un autre."]);
  }
}
