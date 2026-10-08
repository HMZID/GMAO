import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { ROLES } from "@/server/authz/permissions";
import { db } from "@/server/db";
import { absences, account, auditLogs, companies, laborRates, roleAssignments, session, sites, technicians, user } from "@/server/db/schema";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/server/errors";
import { bool, date, optionalDate, optionalId, optionalText, text } from "@/server/validation";
import { assertCan, audit, offsetOf, paginationSchema, parseInput } from "./_shared";

/* ------------------------------------------------------------------ */
/* Utilisateurs et habilitations (CDC §2)                               */
/* ------------------------------------------------------------------ */

export async function listUsers(ctx: AuthContext) {
  assertCan(ctx, "users.manage");
  const users = await db
    .select({ id: user.id, name: user.name, email: user.email, isActive: user.isActive, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.tenantId, ctx.tenantId))
    .orderBy(asc(user.name));
  const ids = users.map((u) => u.id);
  const [assignments, companyRows, siteRows, lastSessions] = await Promise.all([
    ids.length ? db.select().from(roleAssignments).where(inArray(roleAssignments.userId, ids)) : Promise.resolve([]),
    db.select({ id: companies.id, name: companies.name }).from(companies).where(eq(companies.tenantId, ctx.tenantId)),
    db.select({ id: sites.id, name: sites.name }).from(sites).where(eq(sites.tenantId, ctx.tenantId)),
    ids.length
      ? db
          .select({ userId: session.userId, createdAt: session.createdAt })
          .from(session)
          .where(inArray(session.userId, ids))
          .orderBy(desc(session.createdAt))
      : Promise.resolve([]),
  ]);
  const scopeLabel = (a: (typeof assignments)[number]) =>
    a.scopeType === "TENANT"
      ? "Tout le groupe"
      : a.scopeType === "COMPANY"
        ? (companyRows.find((c) => c.id === a.scopeId)?.name ?? "Société ?")
        : (siteRows.find((s) => s.id === a.scopeId)?.name ?? "Site ?");
  return users.map((u) => ({
    ...u,
    lastLoginAt: lastSessions.find((s) => s.userId === u.id)?.createdAt ?? null,
    assignments: assignments
      .filter((a) => a.userId === u.id)
      .map((a) => ({
        id: a.id,
        role: a.role,
        scopeType: a.scopeType,
        scopeId: a.scopeId,
        scopeLabel: scopeLabel(a),
        validFrom: a.validFrom,
        validTo: a.validTo,
      })),
  }));
}

const assignmentFields = {
  role: z.enum(ROLES),
  scopeType: z.enum(["TENANT", "COMPANY", "SITE"]),
  scopeId: optionalId,
  validFrom: optionalDate,
  validTo: optionalDate,
};

export const assignmentInput = z
  .object(assignmentFields)
  .refine((v) => v.scopeType === "TENANT" || !!v.scopeId, { message: "Choisir la société ou le site", path: ["scopeId"] });

export const userInput = z
  .object({
    name: text(120, "Nom obligatoire"),
    email: z.email("Courriel invalide").transform((s) => s.toLowerCase()),
    password: z.string().min(10, "10 caractères minimum").max(128),
    ...assignmentFields,
  })
  .refine((v) => v.scopeType === "TENANT" || !!v.scopeId, { message: "Choisir la société ou le site", path: ["scopeId"] });

async function assertScopeInTenant(ctx: AuthContext, scopeType: "TENANT" | "COMPANY" | "SITE", scopeId?: string) {
  if (scopeType === "TENANT") return null;
  const table = scopeType === "COMPANY" ? companies : sites;
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, scopeId!), eq(table.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError(scopeType === "COMPANY" ? "Société" : "Site");
  return row.id;
}

/** Création d'un compte (HAB-01) : mot de passe haché par Better Auth, premier couple rôle × périmètre. */
export async function createUser(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "users.manage");
  const input = parseInput(userInput, raw);
  const scopeId = await assertScopeInTenant(ctx, input.scopeType, input.scopeId);
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, input.email));
  if (existing) throw new ConflictError("Un compte existe déjà avec ce courriel.");
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const id = randomUUID();
    const [row] = await tx
      .insert(user)
      .values({ id, name: input.name, email: input.email, emailVerified: true, tenantId: ctx.tenantId, isActive: true })
      .returning({ id: user.id, name: user.name, email: user.email });
    await tx.insert(account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: passwordHash });
    await tx.insert(roleAssignments).values({
      tenantId: ctx.tenantId,
      userId: id,
      role: input.role,
      scopeType: input.scopeType,
      scopeId,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
    });
    await audit(tx, ctx, {
      entityType: "user",
      entityId: id,
      action: "create",
      after: { ...row, role: input.role, scopeType: input.scopeType, scopeId },
    });
    return row;
  });
}

export async function addRoleAssignment(ctx: AuthContext, userId: string, raw: unknown) {
  assertCan(ctx, "users.manage");
  const input = parseInput(assignmentInput, raw);
  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, userId), eq(user.tenantId, ctx.tenantId)));
  if (!target) throw new NotFoundError("Utilisateur");
  const scopeId = await assertScopeInTenant(ctx, input.scopeType, input.scopeId);
  if (input.validFrom && input.validTo && input.validTo <= input.validFrom)
    throw new BusinessRuleError(["La fin de délégation doit suivre son début."]);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(roleAssignments)
      .values({
        tenantId: ctx.tenantId,
        userId,
        role: input.role,
        scopeType: input.scopeType,
        scopeId,
        validFrom: input.validFrom ?? null,
        validTo: input.validTo ?? null,
      })
      .returning();
    await audit(tx, ctx, { entityType: "user", entityId: userId, action: "add_role", after: row });
    return row;
  });
}

export async function removeRoleAssignment(ctx: AuthContext, assignmentId: string) {
  assertCan(ctx, "users.manage");
  const [row] = await db
    .select()
    .from(roleAssignments)
    .where(and(eq(roleAssignments.id, assignmentId), eq(roleAssignments.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Affectation de rôle");
  if (row.userId === ctx.userId && row.role === "ADMIN")
    throw new BusinessRuleError(["Vous ne pouvez pas retirer votre propre rôle d'administrateur."]);
  await db.transaction(async (tx) => {
    await tx.delete(roleAssignments).where(eq(roleAssignments.id, assignmentId));
    await audit(tx, ctx, { entityType: "user", entityId: row.userId, action: "remove_role", before: row });
  });
}

/** Désactivation sans perte d'historique (HAB-08) : les sessions ouvertes sont révoquées. */
export async function setUserActive(ctx: AuthContext, userId: string, active: boolean) {
  assertCan(ctx, "users.manage");
  if (userId === ctx.userId && !active) throw new BusinessRuleError(["Vous ne pouvez pas désactiver votre propre compte."]);
  const [target] = await db
    .select()
    .from(user)
    .where(and(eq(user.id, userId), eq(user.tenantId, ctx.tenantId)));
  if (!target) throw new NotFoundError("Utilisateur");
  await db.transaction(async (tx) => {
    await tx.update(user).set({ isActive: active }).where(eq(user.id, userId));
    if (!active) await tx.delete(session).where(eq(session.userId, userId));
    await audit(tx, ctx, {
      entityType: "user",
      entityId: userId,
      action: active ? "activate" : "deactivate",
      before: { isActive: target.isActive },
      after: { isActive: active },
    });
  });
}

/* ------------------------------------------------------------------ */
/* Techniciens (CDC §6)                                                 */
/* ------------------------------------------------------------------ */

export async function listTechnicians(ctx: AuthContext) {
  assertCan(ctx, "planning.read");
  const rows = await db.query.technicians.findMany({
    where: eq(technicians.tenantId, ctx.tenantId),
    orderBy: asc(technicians.lastName),
    with: {
      site: { columns: { name: true } },
      user: { columns: { email: true } },
      laborRates: { orderBy: desc(laborRates.validFrom), limit: 1 },
      certifications: true,
    },
  });
  return rows;
}

export const technicianInput = z.object({
  firstName: text(80, "Prénom obligatoire"),
  lastName: text(80, "Nom obligatoire"),
  siteId: z.uuid("Site obligatoire"),
  qualification: optionalText(120),
  dailyHours: z.coerce.number().int().min(1).max(12).default(7),
  hourlyRate: z.coerce.number().min(0).optional(),
  userId: z.string().trim().optional(),
});

export async function createTechnician(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "users.manage");
  const input = parseInput(technicianInput, raw);
  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.id, input.siteId), eq(sites.tenantId, ctx.tenantId)));
  if (!site) throw new NotFoundError("Site");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(technicians)
      .values({
        tenantId: ctx.tenantId,
        firstName: input.firstName,
        lastName: input.lastName,
        siteId: input.siteId,
        qualification: input.qualification ?? null,
        dailyHours: input.dailyHours,
        userId: input.userId || null,
      })
      .returning();
    if (input.hourlyRate !== undefined) {
      await tx
        .insert(laborRates)
        .values({ tenantId: ctx.tenantId, technicianId: row.id, hourlyRate: input.hourlyRate, validFrom: new Date(Date.UTC(2000, 0, 1)) });
    }
    await audit(tx, ctx, { entityType: "technician", entityId: row.id, action: "create", after: row });
    return row;
  });
}

export const absenceInput = z
  .object({
    technicianId: z.uuid("Technicien obligatoire"),
    type: z.enum(["LEAVE", "TRAINING", "SICK", "OTHER"]).default("LEAVE"),
    startAt: date("Début obligatoire"),
    endAt: date("Fin obligatoire"),
    comment: optionalText(300),
  })
  .refine((v) => v.endAt > v.startAt, { message: "La fin doit suivre le début", path: ["endAt"] });

/** Absences (PLA-02) — saisie manuelle ; TODO(INT-04) : import depuis le SIRH. */
export async function addAbsence(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "workorder.manage");
  const input = parseInput(absenceInput, raw);
  const [tech] = await db
    .select({ id: technicians.id })
    .from(technicians)
    .where(and(eq(technicians.id, input.technicianId), eq(technicians.tenantId, ctx.tenantId)));
  if (!tech) throw new NotFoundError("Technicien");
  const [row] = await db
    .insert(absences)
    .values({ tenantId: ctx.tenantId, ...input })
    .returning();
  return row;
}

/* ------------------------------------------------------------------ */
/* Journal d'audit (HAB-06)                                             */
/* ------------------------------------------------------------------ */

export const auditFilters = paginationSchema.extend({
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(60).optional(),
  showAll: bool.default(false),
});

/** Lecture seule : aucune API ne permet de modifier une ligne du journal (TEC-05). */
export async function listAuditLogs(ctx: AuthContext, raw: unknown = {}) {
  assertCan(ctx, "audit.read");
  const f = parseInput(auditFilters, raw);
  return db
    .select({
      id: auditLogs.id,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      action: auditLogs.action,
      channel: auditLogs.channel,
      before: auditLogs.before,
      after: auditLogs.after,
      createdAt: auditLogs.createdAt,
      userName: user.name,
    })
    .from(auditLogs)
    .leftJoin(user, eq(user.id, auditLogs.userId))
    .where(
      and(
        eq(auditLogs.tenantId, ctx.tenantId),
        f.entityType ? eq(auditLogs.entityType, f.entityType) : undefined,
        f.entityId ? eq(auditLogs.entityId, f.entityId) : undefined,
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(f.pageSize)
    .offset(offsetOf(f));
}
