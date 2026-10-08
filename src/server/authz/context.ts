/**
 * Contexte d'autorisation : rôle × périmètre (CDC §2.3, HAB-02, HAB-03).
 * Module pur, testé dans `__tests__/context.test.ts`.
 */
import { roleHas, type Permission, type Role } from "./permissions";

export type ScopeType = "TENANT" | "COMPANY" | "SITE";

export type RoleAssignment = {
  role: Role;
  scopeType: ScopeType;
  scopeId: string | null;
  validFrom?: Date | null;
  validTo?: Date | null;
};

/** Périmètre effectif d'un droit : tout le groupe, ou une liste de sociétés et de sites. */
export type Scope = { all: true } | { all: false; companyIds: string[]; siteIds: string[] };

export type Channel = "WEB" | "API" | "MOBILE" | "IMPORT" | "SYSTEM";

export type AuthContext = {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  /** Technicien lié au compte, pour l'exécution des OT. */
  technicianId: string | null;
  channel: Channel;
  roles: Role[];
  assignments: RoleAssignment[];
  /** Le droit est-il détenu sur au moins un périmètre ? */
  can(permission: Permission): boolean;
  /** Périmètre sur lequel le droit est détenu. */
  scope(permission: Permission): Scope;
  /** Le droit est-il détenu sur la cible (société, site) ? */
  canOn(permission: Permission, target: { companyId: string; siteId?: string | null }): boolean;
};

export type ContextUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  technicianId?: string | null;
};

const NO_SCOPE: Scope = { all: false, companyIds: [], siteIds: [] };

/** Une affectation est active si la date courante est dans sa période de validité (délégations). */
export function isActiveAssignment(a: RoleAssignment, now: Date) {
  if (a.validFrom && a.validFrom > now) return false;
  if (a.validTo && a.validTo < now) return false;
  return true;
}

export function buildAuthContext(user: ContextUser, allAssignments: RoleAssignment[], options: { now?: Date; channel?: Channel } = {}): AuthContext {
  const now = options.now ?? new Date();
  const assignments = allAssignments.filter((a) => isActiveAssignment(a, now));
  const roles = [...new Set(assignments.map((a) => a.role))];
  const cache = new Map<Permission, Scope>();

  const scope = (permission: Permission): Scope => {
    const cached = cache.get(permission);
    if (cached) return cached;
    const granting = assignments.filter((a) => roleHas(a.role, permission));
    let result: Scope = NO_SCOPE;
    if (granting.some((a) => a.scopeType === "TENANT")) {
      result = { all: true };
    } else if (granting.length > 0) {
      result = {
        all: false,
        companyIds: unique(granting.filter((a) => a.scopeType === "COMPANY").map((a) => a.scopeId)),
        siteIds: unique(granting.filter((a) => a.scopeType === "SITE").map((a) => a.scopeId)),
      };
    }
    cache.set(permission, result);
    return result;
  };

  return {
    userId: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    technicianId: user.technicianId ?? null,
    channel: options.channel ?? "WEB",
    roles,
    assignments,
    scope,
    can: (permission) => {
      const s = scope(permission);
      return s.all || s.companyIds.length > 0 || s.siteIds.length > 0;
    },
    canOn: (permission, target) => isInScope(scope(permission), target),
  };
}

export function isInScope(scope: Scope, target: { companyId: string; siteId?: string | null }) {
  if (scope.all) return true;
  if (scope.companyIds.includes(target.companyId)) return true;
  return !!target.siteId && scope.siteIds.includes(target.siteId);
}

function unique(values: (string | null)[]) {
  return [...new Set(values.filter((v): v is string => !!v))];
}
