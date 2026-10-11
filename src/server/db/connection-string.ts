/**
 * Chaîne de connexion PostgreSQL avec un mode SSL explicite.
 *
 * La bibliothèque `pg` traite aujourd'hui `sslmode=prefer`, `require` et `verify-ca` comme `verify-full`
 * (chiffrement et vérification du certificat et du nom d'hôte) et annonce que ces modes suivront la
 * sémantique libpq, moins stricte, dans sa prochaine version majeure. Les chaînes fournies par Neon portent
 * `sslmode=require` : on écrit `verify-full` pour garder la vérification complète actuelle (et faire taire
 * l'avertissement de `pg`). Une chaîne sans `sslmode` (base locale) ou en `uselibpqcompat=true` est laissée telle quelle.
 */
const IMPLICIT_FULL_VERIFICATION = new Set(["prefer", "require", "verify-ca"]);

export function withExplicitSslMode(connectionString: string | undefined): string | undefined {
  if (!connectionString) return connectionString;
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }
  const mode = url.searchParams.get("sslmode");
  if (!mode || !IMPLICIT_FULL_VERIFICATION.has(mode) || url.searchParams.get("uselibpqcompat") === "true") {
    return connectionString;
  }
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}
