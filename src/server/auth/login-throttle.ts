import "server-only";
import { createHash } from "node:crypto";
import { and, count, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { loginAttempts } from "@/server/db/schema";
import { isLoginBlocked, LOGIN_LIMITS } from "@/server/domain/login-security";

/** Empreinte de l'adresse IP (jamais l'adresse en clair), propre à l'installation. */
function ipFingerprint(ip: string | null) {
  if (!ip) return null;
  return createHash("sha256")
    .update(`${process.env.BETTER_AUTH_SECRET ?? ""}:login:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

const normalize = (email: string) => email.trim().toLowerCase();

/**
 * Trop d'échecs récents pour ce compte depuis cette adresse, pour ce compte, ou depuis cette adresse ?
 * Compté de la même façon pour un compte qui n'existe pas : la réponse ne révèle pas son existence.
 */
export async function loginBlocked(email: string, ip: string | null, now = new Date()) {
  const since = new Date(now.getTime() - LOGIN_LIMITS.windowMs);
  const account = normalize(email);
  const ipHash = ipFingerprint(ip);
  const failed = and(eq(loginAttempts.succeeded, false), gte(loginAttempts.createdAt, since));
  const [[byAccount], [byAccountAndIp], [byIp]] = await Promise.all([
    db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(failed, eq(loginAttempts.email, account))),
    // Adresse inconnue (poste local, tests) : échecs du compte faits sans adresse.
    db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(failed, eq(loginAttempts.email, account), ipHash ? eq(loginAttempts.ipHash, ipHash) : isNull(loginAttempts.ipHash))),
    ipHash
      ? db
          .select({ n: count() })
          .from(loginAttempts)
          .where(and(failed, eq(loginAttempts.ipHash, ipHash)))
      : Promise.resolve([{ n: 0 }]),
  ]);
  return isLoginBlocked({ accountAndIp: byAccountAndIp?.n ?? 0, account: byAccount?.n ?? 0, ip: byIp?.n ?? 0 });
}

/** Trace d'une tentative ; les traces de plus de 30 jours sont purgées au passage (TEC-13). */
export async function recordLoginAttempt(email: string, ip: string | null, succeeded: boolean, now = new Date()) {
  await db.insert(loginAttempts).values({ email: normalize(email), ipHash: ipFingerprint(ip), succeeded, createdAt: now });
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)));
}
