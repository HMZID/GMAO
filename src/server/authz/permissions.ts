/**
 * Matrice des droits par défaut (CDC §2.2). Les droits s'appliquent dans le périmètre
 * de chaque affectation de rôle (voir `context.ts`).
 *
 * TODO(HAB-01) : rendre la matrice paramétrable par l'administrateur (table dédiée).
 */

export const ROLES = [
  "ADMIN",
  "MAINTENANCE_MANAGER",
  "FLEET_MANAGER",
  "WORKSHOP_MANAGER",
  "TECHNICIAN",
  "OPERATOR",
  "STOREKEEPER",
  "PURCHASING_MANAGER",
  "EXECUTIVE",
  "CONTRACTOR",
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "settings.manage",
  "users.manage",
  "audit.read",
  "equipment.read",
  "equipment.write",
  "assignment.write",
  "meter.read",
  "meter.write",
  "meter.correct",
  "plan.read",
  "plan.write",
  "request.read",
  "request.create",
  "request.qualify",
  "workorder.read",
  "workorder.create",
  "workorder.manage",
  "workorder.execute",
  "workorder.release",
  "planning.read",
  "part.read",
  "part.write",
  "stock.read",
  "stock.move",
  "inventory.adjust",
  "inventory.validate",
  "supplier.read",
  "supplier.write",
  "purchase.read",
  "purchase.create",
  "kpi.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_ROLES: readonly Role[] = ROLES;

/** Rôles détenant chaque droit. */
const GRANTS: Record<Permission, readonly Role[]> = {
  "settings.manage": ["ADMIN"],
  "users.manage": ["ADMIN"],
  "audit.read": ["ADMIN", "MAINTENANCE_MANAGER", "EXECUTIVE"],
  "equipment.read": ALL_ROLES,
  "equipment.write": ["ADMIN", "MAINTENANCE_MANAGER", "FLEET_MANAGER"],
  "assignment.write": ["ADMIN", "FLEET_MANAGER"],
  "meter.read": ["ADMIN", "MAINTENANCE_MANAGER", "FLEET_MANAGER", "WORKSHOP_MANAGER", "TECHNICIAN", "OPERATOR", "EXECUTIVE", "CONTRACTOR"],
  "meter.write": ["ADMIN", "MAINTENANCE_MANAGER", "FLEET_MANAGER", "WORKSHOP_MANAGER", "TECHNICIAN", "OPERATOR", "CONTRACTOR"],
  "meter.correct": ["ADMIN", "MAINTENANCE_MANAGER", "FLEET_MANAGER"],
  "plan.read": ["ADMIN", "MAINTENANCE_MANAGER", "FLEET_MANAGER", "WORKSHOP_MANAGER", "TECHNICIAN", "STOREKEEPER", "EXECUTIVE"],
  "plan.write": ["ADMIN", "MAINTENANCE_MANAGER"],
  "request.read": ["ADMIN", "MAINTENANCE_MANAGER", "FLEET_MANAGER", "WORKSHOP_MANAGER", "TECHNICIAN", "OPERATOR", "EXECUTIVE", "CONTRACTOR"],
  "request.create": ["ADMIN", "MAINTENANCE_MANAGER", "FLEET_MANAGER", "WORKSHOP_MANAGER", "TECHNICIAN", "OPERATOR", "CONTRACTOR"],
  "request.qualify": ["ADMIN", "MAINTENANCE_MANAGER", "FLEET_MANAGER", "WORKSHOP_MANAGER"],
  "workorder.read": ALL_ROLES,
  "workorder.create": ["ADMIN", "MAINTENANCE_MANAGER", "WORKSHOP_MANAGER", "TECHNICIAN"],
  "workorder.manage": ["ADMIN", "MAINTENANCE_MANAGER", "WORKSHOP_MANAGER"],
  "workorder.execute": ["MAINTENANCE_MANAGER", "WORKSHOP_MANAGER", "TECHNICIAN", "STOREKEEPER", "CONTRACTOR"],
  "workorder.release": ["MAINTENANCE_MANAGER", "WORKSHOP_MANAGER"],
  "planning.read": ["ADMIN", "MAINTENANCE_MANAGER", "FLEET_MANAGER", "WORKSHOP_MANAGER", "TECHNICIAN", "EXECUTIVE"],
  "part.read": ["ADMIN", "MAINTENANCE_MANAGER", "WORKSHOP_MANAGER", "TECHNICIAN", "STOREKEEPER", "PURCHASING_MANAGER", "EXECUTIVE"],
  "part.write": ["ADMIN", "STOREKEEPER", "PURCHASING_MANAGER"],
  "stock.read": ["ADMIN", "MAINTENANCE_MANAGER", "WORKSHOP_MANAGER", "TECHNICIAN", "STOREKEEPER", "PURCHASING_MANAGER", "EXECUTIVE"],
  "stock.move": ["WORKSHOP_MANAGER", "TECHNICIAN", "STOREKEEPER"],
  "inventory.adjust": ["STOREKEEPER"],
  "inventory.validate": ["MAINTENANCE_MANAGER"],
  "supplier.read": ["ADMIN", "MAINTENANCE_MANAGER", "WORKSHOP_MANAGER", "STOREKEEPER", "PURCHASING_MANAGER", "EXECUTIVE"],
  "supplier.write": ["ADMIN", "PURCHASING_MANAGER"],
  // ACH-01 : demandes d'achat ; leur validation suit le circuit paramétré (HAB-04), pas un droit.
  "purchase.read": ["ADMIN", "MAINTENANCE_MANAGER", "WORKSHOP_MANAGER", "TECHNICIAN", "STOREKEEPER", "PURCHASING_MANAGER", "EXECUTIVE"],
  "purchase.create": ["MAINTENANCE_MANAGER", "WORKSHOP_MANAGER", "TECHNICIAN", "STOREKEEPER", "PURCHASING_MANAGER"],
  "kpi.read": ["ADMIN", "MAINTENANCE_MANAGER", "FLEET_MANAGER", "WORKSHOP_MANAGER", "STOREKEEPER", "PURCHASING_MANAGER", "EXECUTIVE"],
};

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = Object.fromEntries(
  ROLES.map((role) => [role, new Set(PERMISSIONS.filter((p) => GRANTS[p].includes(role)))]),
) as unknown as Record<Role, ReadonlySet<Permission>>;

export function roleHas(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role].has(permission);
}
