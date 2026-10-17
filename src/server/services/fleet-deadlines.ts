import "server-only";
import { and, asc, count, eq, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db } from "@/server/db";
import { equipment, equipmentDeadlines, sites } from "@/server/db/schema";
import { DEADLINE_KINDS } from "@/server/domain/fleet-deadlines";
import { BusinessRuleError, NotFoundError } from "@/server/errors";
import { date, optionalNumber, optionalText } from "@/server/validation";
import { assertCan, assertCanOn, assertVisible, audit, parseInput, scopeWhere } from "./_shared";

/* ------------------------------------------------------------------ */
/* Échéances administratives du parc (assurance, visite, vignette)      */
/* ------------------------------------------------------------------ */

const details = {
  label: optionalText(120),
  provider: optionalText(120),
  reference: optionalText(80),
  amount: optionalNumber.refine((v) => v === undefined || v >= 0, "Montant positif attendu"),
  notes: optionalText(1000),
};

export const deadlineInput = z.object({
  equipmentId: z.uuid("Équipement obligatoire"),
  kind: z.enum(DEADLINE_KINDS, "Type d'échéance obligatoire"),
  dueDate: date("Date d'échéance obligatoire"),
  ...details,
});

export const renewalInput = z.object({ dueDate: date("Nouvelle échéance obligatoire"), ...details });

export const cancelInput = z.object({ reason: z.string().trim().min(1, "Motif obligatoire").max(500) });

async function loadEquipment(ctx: AuthContext, equipmentId: string) {
  const [row] = await db
    .select({ id: equipment.id, code: equipment.code, companyId: equipment.companyId, siteId: equipment.siteId, status: equipment.status })
    .from(equipment)
    .where(and(eq(equipment.id, equipmentId), eq(equipment.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Équipement");
  assertVisible(ctx, "equipment.read", row, "Équipement");
  return row;
}

/** Nouvelle échéance d'un équipement (responsable du parc, maintenance, direction : droit equipment.write). */
export async function createDeadline(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "equipment.write");
  const input = parseInput(deadlineInput, raw);
  const eq_ = await loadEquipment(ctx, input.equipmentId);
  assertCanOn(ctx, "equipment.write", eq_);
  if (eq_.status === "RETIRED") throw new BusinessRuleError(["Un équipement réformé est en lecture seule."]);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(equipmentDeadlines)
      .values({ tenantId: ctx.tenantId, ...input, label: input.label ?? null, createdById: ctx.userId })
      .returning();
    await audit(tx, ctx, { entityType: "equipment_deadline", entityId: row.id, action: "create", after: row });
    return row;
  });
}

async function loadOpenDeadline(ctx: AuthContext, id: string) {
  const [row] = await db
    .select({ deadline: equipmentDeadlines, companyId: equipment.companyId, siteId: equipment.siteId })
    .from(equipmentDeadlines)
    .innerJoin(equipment, eq(equipment.id, equipmentDeadlines.equipmentId))
    .where(and(eq(equipmentDeadlines.id, id), eq(equipmentDeadlines.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Échéance");
  assertVisible(ctx, "equipment.read", row, "Échéance");
  assertCanOn(ctx, "equipment.write", row);
  if (row.deadline.status !== "OPEN") throw new BusinessRuleError(["Cette échéance est déjà renouvelée ou annulée."]);
  return row.deadline;
}

/** Renouvellement : l'échéance est soldée et la suivante créée (nouvelle date, nouvelle référence). */
export async function renewDeadline(ctx: AuthContext, id: string, raw: unknown, now: Date = new Date()) {
  assertCan(ctx, "equipment.write");
  const input = parseInput(renewalInput, raw);
  const current = await loadOpenDeadline(ctx, id);
  if (input.dueDate.getTime() <= current.dueDate.getTime()) {
    throw new BusinessRuleError(["La nouvelle échéance doit être postérieure à l'échéance renouvelée."]);
  }
  return db.transaction(async (tx) => {
    await tx.update(equipmentDeadlines).set({ status: "DONE", doneAt: now, doneById: ctx.userId }).where(eq(equipmentDeadlines.id, current.id));
    const [next] = await tx
      .insert(equipmentDeadlines)
      .values({
        tenantId: ctx.tenantId,
        equipmentId: current.equipmentId,
        kind: current.kind,
        label: input.label ?? current.label,
        provider: input.provider ?? current.provider,
        reference: input.reference ?? null,
        dueDate: input.dueDate,
        amount: input.amount ?? null,
        notes: input.notes ?? null,
        renewalOfId: current.id,
        createdById: ctx.userId,
      })
      .returning();
    await audit(tx, ctx, { entityType: "equipment_deadline", entityId: current.id, action: "renew", before: current, after: next });
    return next;
  });
}

/** Annulation d'une échéance saisie par erreur ou devenue sans objet (véhicule vendu…), motif obligatoire. */
export async function cancelDeadline(ctx: AuthContext, id: string, raw: unknown) {
  assertCan(ctx, "equipment.write");
  const { reason } = parseInput(cancelInput, raw);
  const current = await loadOpenDeadline(ctx, id);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(equipmentDeadlines)
      .set({ status: "CANCELLED", notes: [current.notes, `Annulée : ${reason}`].filter(Boolean).join("\n") })
      .where(eq(equipmentDeadlines.id, current.id))
      .returning();
    await audit(tx, ctx, { entityType: "equipment_deadline", entityId: current.id, action: "cancel", before: current, after: row });
    return row;
  });
}

export const deadlineFilters = z.object({
  equipmentId: z.uuid().optional(),
  kind: z.enum(DEADLINE_KINDS).optional(),
  /** Échéances ouvertes : en retard, à 30 jours, ou toutes ; « history » : renouvelées et annulées comprises. */
  horizon: z.enum(["overdue", "30", "open", "history"]).default("open"),
});

/** Échéances du périmètre, de la plus proche à la plus lointaine. */
export async function listDeadlines(ctx: AuthContext, raw: unknown = {}, now: Date = new Date()) {
  assertCan(ctx, "equipment.read");
  const f = parseInput(deadlineFilters, raw);
  const limit =
    f.horizon === "overdue"
      ? lte(equipmentDeadlines.dueDate, now)
      : f.horizon === "30"
        ? lte(equipmentDeadlines.dueDate, new Date(now.getTime() + 30 * 86_400_000))
        : undefined;
  return db
    .select({
      id: equipmentDeadlines.id,
      kind: equipmentDeadlines.kind,
      label: equipmentDeadlines.label,
      provider: equipmentDeadlines.provider,
      reference: equipmentDeadlines.reference,
      dueDate: equipmentDeadlines.dueDate,
      amount: equipmentDeadlines.amount,
      notes: equipmentDeadlines.notes,
      status: equipmentDeadlines.status,
      doneAt: equipmentDeadlines.doneAt,
      equipmentId: equipment.id,
      equipmentCode: equipment.code,
      equipmentName: equipment.name,
      companyId: equipment.companyId,
      siteId: equipment.siteId,
      siteName: sites.name,
    })
    .from(equipmentDeadlines)
    .innerJoin(equipment, eq(equipment.id, equipmentDeadlines.equipmentId))
    .innerJoin(sites, eq(sites.id, equipment.siteId))
    .where(
      and(
        eq(equipmentDeadlines.tenantId, ctx.tenantId),
        scopeWhere(ctx.scope("equipment.read"), equipment.companyId, equipment.siteId),
        f.horizon === "history" ? undefined : eq(equipmentDeadlines.status, "OPEN"),
        f.equipmentId ? eq(equipmentDeadlines.equipmentId, f.equipmentId) : undefined,
        f.kind ? eq(equipmentDeadlines.kind, f.kind) : undefined,
        limit,
      ),
    )
    .orderBy(asc(equipmentDeadlines.dueDate))
    .limit(500);
}

/** Tableau de bord : échéances ouvertes en retard et à 30 jours, dans le périmètre. */
export async function countDeadlineAlerts(ctx: AuthContext, now: Date = new Date()) {
  if (!ctx.can("equipment.read")) return { overdue: 0, soon: 0 };
  const scope = scopeWhere(ctx.scope("equipment.read"), equipment.companyId, equipment.siteId);
  const base = and(eq(equipmentDeadlines.tenantId, ctx.tenantId), inArray(equipmentDeadlines.status, ["OPEN"]), scope);
  const [overdue] = await db
    .select({ n: count() })
    .from(equipmentDeadlines)
    .innerJoin(equipment, eq(equipment.id, equipmentDeadlines.equipmentId))
    .where(and(base, lte(equipmentDeadlines.dueDate, now)));
  const [soon] = await db
    .select({ n: count() })
    .from(equipmentDeadlines)
    .innerJoin(equipment, eq(equipment.id, equipmentDeadlines.equipmentId))
    .where(and(base, lte(equipmentDeadlines.dueDate, new Date(now.getTime() + 30 * 86_400_000))));
  return { overdue: overdue?.n ?? 0, soon: Math.max(0, (soon?.n ?? 0) - (overdue?.n ?? 0)) };
}
