/**
 * Organisations clientes de la plateforme : abonnement actif, démonstration à durée limitée ou suspension.
 * Module pur, testé dans `__tests__/tenants.test.ts`.
 */

export const TENANT_STATUSES = ["ACTIVE", "DEMO", "SUSPENDED"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  ACTIVE: "Active",
  DEMO: "Démonstration",
  SUSPENDED: "Suspendue",
};

/** Durées de démonstration proposées, en jours. */
export const DEMO_DURATIONS = [7, 14, 30, 60] as const;

const DAY = 86_400_000;

export type TenantAccess =
  { allowed: true; demo: { endsAt: Date; daysLeft: number } | null } | { allowed: false; reason: "SUSPENDED" | "DEMO_EXPIRED" };

/** L'organisation peut-elle utiliser l'application ? Une démonstration s'arrête à sa date de fin. */
export function tenantAccess(tenant: { status: string; demoEndsAt: Date | null }, now: Date): TenantAccess {
  if (tenant.status === "SUSPENDED") return { allowed: false, reason: "SUSPENDED" };
  if (tenant.status === "DEMO") {
    if (!tenant.demoEndsAt || tenant.demoEndsAt <= now) return { allowed: false, reason: "DEMO_EXPIRED" };
    return { allowed: true, demo: { endsAt: tenant.demoEndsAt, daysLeft: Math.ceil((tenant.demoEndsAt.getTime() - now.getTime()) / DAY) } };
  }
  return { allowed: true, demo: null };
}

/** Fin de démonstration : à partir de maintenant, ou prolongation de la date de fin si elle n'est pas passée. */
export function demoEndsAt(now: Date, days: number, currentEnd: Date | null = null) {
  const from = currentEnd && currentEnd > now ? currentEnd : now;
  return new Date(from.getTime() + days * DAY);
}

/** Administrateurs de la plateforme : liste de courriels (variable PLATFORM_ADMIN_EMAILS, séparés par des virgules). */
export function platformAdmins(raw: string | undefined) {
  return new Set(
    (raw ?? "")
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Code de la première société, tiré du nom de l'organisation (lettres et chiffres, 10 au plus). */
export function companyCodeFrom(name: string) {
  const code = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 10);
  return code || "ORG";
}
