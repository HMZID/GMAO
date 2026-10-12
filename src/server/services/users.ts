import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { ROLES } from "@/server/authz/permissions";
import { db } from "@/server/db";
import { absences, account, auditLogs, companies, laborRates, roleAssignments, session, sites, technicians, user } from "@/server/db/schema";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { bool, date, optionalDate, optionalId, optionalText, text } from "@/server/validation";
import { assertCan, assertCanOn, assertSameTenant, audit, offsetOf, paginationSchema, parseInput, scopeWhere } from "./_shared";
import { isPlatformAdmin } from "./platform";

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

/**
 * Périmètre d'un rôle à donner : de l'organisation, et compris dans le périmètre d'administration de
 * l'utilisateur (un administrateur limité à une société ne donne jamais un rôle sur tout le groupe).
 */
/** Le rôle « Administrateur » (plateforme) n'est donné que par un administrateur de la plateforme. */
function assertCanGrantRole(ctx: AuthContext, role: string) {
  if (role === "ADMIN" && !isPlatformAdmin(ctx))
    throw new ForbiddenError("Le rôle Administrateur de la plateforme ne se donne pas depuis une organisation.");
}

async function assertScopeInTenant(ctx: AuthContext, scopeType: "TENANT" | "COMPANY" | "SITE", scopeId?: string) {
  if (scopeType === "TENANT") {
    if (!ctx.scope("users.manage").all) throw new ForbiddenError("Seul un administrateur de toute l'organisation donne un rôle sur tout le groupe.");
    return null;
  }
  if (scopeType === "COMPANY") {
    const [row] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, scopeId!), eq(companies.tenantId, ctx.tenantId)));
    if (!row) throw new NotFoundError("Société");
    assertCanOn(ctx, "users.manage", { companyId: row.id });
    return row.id;
  }
  const [row] = await db
    .select({ id: sites.id, companyId: sites.companyId })
    .from(sites)
    .where(and(eq(sites.id, scopeId!), eq(sites.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Site");
  assertCanOn(ctx, "users.manage", { companyId: row.companyId, siteId: row.id });
  return row.id;
}

/**
 * Compte géré par l'utilisateur : un administrateur limité à une société ou un site ne modifie que les
 * comptes dont tous les rôles sont dans son périmètre (jamais un compte qui a un rôle sur tout le groupe).
 */
async function assertCanManageUser(ctx: AuthContext, userId: string) {
  // Le compte d'un administrateur de la plateforme n'est géré que par un administrateur de la plateforme.
  const [platformRole] = await db
    .select({ id: roleAssignments.id })
    .from(roleAssignments)
    .where(and(eq(roleAssignments.userId, userId), eq(roleAssignments.tenantId, ctx.tenantId), eq(roleAssignments.role, "ADMIN")));
  if (platformRole && !isPlatformAdmin(ctx)) throw new ForbiddenError("Ce compte est un administrateur de la plateforme.");
  if (ctx.scope("users.manage").all) return;
  const rows = await db
    .select({ scopeType: roleAssignments.scopeType, scopeId: roleAssignments.scopeId, siteCompanyId: sites.companyId })
    .from(roleAssignments)
    .leftJoin(sites, and(eq(roleAssignments.scopeType, "SITE"), eq(sites.id, roleAssignments.scopeId)))
    .where(and(eq(roleAssignments.userId, userId), eq(roleAssignments.tenantId, ctx.tenantId)));
  const inScope =
    rows.length > 0 &&
    rows.every((r) =>
      r.scopeType === "COMPANY"
        ? !!r.scopeId && ctx.canOn("users.manage", { companyId: r.scopeId })
        : r.scopeType === "SITE"
          ? !!r.scopeId && !!r.siteCompanyId && ctx.canOn("users.manage", { companyId: r.siteCompanyId, siteId: r.scopeId })
          : false,
    );
  if (!inScope) throw new ForbiddenError("Ce compte a des rôles hors de votre périmètre d'administration.");
}

/** Création d'un compte (HAB-01) : mot de passe haché par Better Auth, premier couple rôle × périmètre. */
export async function createUser(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "users.manage");
  const input = parseInput(userInput, raw);
  assertCanGrantRole(ctx, input.role);
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
  await assertCanManageUser(ctx, userId);
  assertCanGrantRole(ctx, input.role);
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
  await assertCanManageUser(ctx, row.userId);
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
  await assertCanManageUser(ctx, userId);
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

export const userUpdateInput = z.object({
  name: text(120, "Nom obligatoire"),
  email: z.email("Courriel invalide").transform((s) => s.toLowerCase()),
});

/** Modification du nom et du courriel (identifiant de connexion) ; un courriel ne sert qu'à un compte. */
export async function updateUser(ctx: AuthContext, userId: string, raw: unknown) {
  assertCan(ctx, "users.manage");
  const input = parseInput(userUpdateInput, raw);
  const [target] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(and(eq(user.id, userId), eq(user.tenantId, ctx.tenantId)));
  if (!target) throw new NotFoundError("Utilisateur");
  await assertCanManageUser(ctx, userId);
  if (input.email !== target.email) {
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, input.email));
    if (existing) throw new ConflictError("Un compte existe déjà avec ce courriel.");
  }
  await db.transaction(async (tx) => {
    await tx.update(user).set({ name: input.name, email: input.email }).where(eq(user.id, userId));
    await audit(tx, ctx, { entityType: "user", entityId: userId, action: "update", before: target, after: { id: userId, ...input } });
  });
}

export const passwordInput = z.object({ password: z.string().min(10, "10 caractères minimum").max(128) });

/**
 * Nouveau mot de passe fixé par l'administrateur (oubli, départ d'un mot de passe partagé) :
 * les sessions ouvertes du compte sont fermées. Le mot de passe n'est jamais journalisé.
 */
export async function setUserPassword(ctx: AuthContext, userId: string, raw: unknown) {
  assertCan(ctx, "users.manage");
  const input = parseInput(passwordInput, raw);
  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, userId), eq(user.tenantId, ctx.tenantId)));
  if (!target) throw new NotFoundError("Utilisateur");
  await assertCanManageUser(ctx, userId);
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    const [credential] = await tx
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
    if (credential) await tx.update(account).set({ password: passwordHash }).where(eq(account.id, credential.id));
    else await tx.insert(account).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: passwordHash });
    if (userId !== ctx.userId) await tx.delete(session).where(eq(session.userId, userId));
    await audit(tx, ctx, { entityType: "user", entityId: userId, action: "set_password" });
  });
}

/* ------------------------------------------------------------------ */
/* Techniciens (CDC §6)                                                 */
/* ------------------------------------------------------------------ */

export async function listTechnicians(ctx: AuthContext) {
  assertCan(ctx, "planning.read");
  // Techniciens des sites du périmètre (taux horaires et habilitations ne sortent pas du périmètre).
  const scope = ctx.scope("planning.read");
  const siteIds = scope.all
    ? null
    : (
        await db
          .select({ id: sites.id })
          .from(sites)
          .where(and(eq(sites.tenantId, ctx.tenantId), scopeWhere(scope, sites.companyId, sites.id)))
      ).map((r) => r.id);
  const rows = await db.query.technicians.findMany({
    where: and(
      eq(technicians.tenantId, ctx.tenantId),
      siteIds ? inArray(technicians.siteId, siteIds.length ? siteIds : ["00000000-0000-0000-0000-000000000000"]) : undefined,
    ),
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
  /** Matricule : unique dans l'organisation, enregistré en majuscules. */
  employeeNumber: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v.toUpperCase() || undefined)
    .optional(),
  firstName: text(80, "Prénom obligatoire"),
  lastName: text(80, "Nom obligatoire"),
  siteId: z.uuid("Site obligatoire"),
  qualification: optionalText(120),
  dailyHours: z.coerce.number().int().min(1).max(12).default(7),
  hourlyRate: z.coerce.number().min(0).optional(),
  userId: z.string().trim().optional(),
});

/** Contrôles de la création d'un technicien, sans écriture (saisie et simulation d'import). */
export async function checkTechnicianCreation(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "users.manage");
  const input = parseInput(technicianInput, raw);
  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.id, input.siteId), eq(sites.tenantId, ctx.tenantId)));
  if (!site) throw new NotFoundError("Site");
  if (input.employeeNumber) {
    const [same] = await db
      .select({ id: technicians.id })
      .from(technicians)
      .where(and(eq(technicians.tenantId, ctx.tenantId), eq(technicians.employeeNumber, input.employeeNumber)));
    if (same) throw new ConflictError(`Le matricule ${input.employeeNumber} est déjà attribué.`, { existingId: same.id });
  }
  // Compte lié : de l'organisation (sinon le technicien serait rattaché à l'utilisateur d'un autre client).
  await assertSameTenant(db, ctx, user, input.userId, "Utilisateur");
  return input;
}

export async function createTechnician(ctx: AuthContext, raw: unknown) {
  const input = await checkTechnicianCreation(ctx, raw);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(technicians)
      .values({
        tenantId: ctx.tenantId,
        employeeNumber: input.employeeNumber ?? null,
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
    .select({ id: technicians.id, siteId: sites.id, companyId: sites.companyId })
    .from(technicians)
    .innerJoin(sites, eq(sites.id, technicians.siteId))
    .where(and(eq(technicians.id, input.technicianId), eq(technicians.tenantId, ctx.tenantId)));
  if (!tech) throw new NotFoundError("Technicien");
  assertCanOn(ctx, "workorder.manage", tech);
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
      impersonatedBy: auditLogs.impersonatedById,
    })
    .from(auditLogs)
    .leftJoin(user, eq(user.id, auditLogs.userId))
    .where(
      and(
        eq(auditLogs.tenantId, ctx.tenantId),
        // Le journal n'est pas rattaché à une société : complet seulement pour un droit sur tout le groupe,
        // sinon limité aux actions de l'utilisateur lui-même.
        ctx.scope("audit.read").all ? undefined : eq(auditLogs.userId, ctx.userId),
        f.entityType ? eq(auditLogs.entityType, f.entityType) : undefined,
        f.entityId ? eq(auditLogs.entityId, f.entityId) : undefined,
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(f.pageSize)
    .offset(offsetOf(f));
}
