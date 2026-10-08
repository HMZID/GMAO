import "server-only";
import { inArray, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext, Scope } from "@/server/authz/context";
import type { Permission } from "@/server/authz/permissions";
import type { DbOrTx } from "@/server/db";
import { auditLogs } from "@/server/db/schema";
import { ForbiddenError, ValidationError } from "@/server/errors";

/** Refuse l'action si le droit n'est détenu sur aucun périmètre. */
export function assertCan(ctx: AuthContext, permission: Permission) {
  if (!ctx.can(permission)) throw new ForbiddenError();
}

/** Refuse l'action si le droit n'est pas détenu sur la cible (société, site). */
export function assertCanOn(ctx: AuthContext, permission: Permission, target: { companyId: string; siteId?: string | null }) {
  if (!ctx.canOn(permission, target)) throw new ForbiddenError();
}

/**
 * Condition SQL de périmètre (HAB-02) : aucune donnée hors périmètre dans les listes,
 * recherches, exports et API. Renvoie undefined pour un périmètre « tout le groupe ».
 */
export function scopeWhere(scope: Scope, companyColumn: AnyColumn, siteColumn?: AnyColumn): SQL | undefined {
  if (scope.all) return undefined;
  const conditions: SQL[] = [];
  if (scope.companyIds.length > 0) conditions.push(inArray(companyColumn, scope.companyIds));
  if (siteColumn && scope.siteIds.length > 0) conditions.push(inArray(siteColumn, scope.siteIds));
  if (conditions.length === 0) return sql`false`;
  return conditions.length === 1 ? conditions[0] : or(...conditions);
}

/** Valide une entrée avec Zod et lève une ValidationError lisible champ par champ. */
export function parseInput<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const flat = z.flattenError(result.error);
    throw new ValidationError(flat.fieldErrors as Record<string, string[]>, flat.formErrors[0]);
  }
  return result.data;
}

export type AuditEntry = {
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
};

/** Journal d'audit en ajout seul (HAB-06) : à appeler dans la même transaction que la modification. */
export async function audit(tx: DbOrTx, ctx: AuthContext, entry: AuditEntry) {
  await tx.insert(auditLogs).values({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    before: toJson(entry.before),
    after: toJson(entry.after),
    channel: ctx.channel,
  });
}

function toJson(value: unknown) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

/** Pagination simple (page à partir de 1). */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function offsetOf(p: Pagination) {
  return (p.page - 1) * p.pageSize;
}

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
