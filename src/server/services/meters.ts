import "server-only";
import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db, type DbOrTx } from "@/server/db";
import { equipment, meterEvents, meterReadings, meters } from "@/server/db/schema";
import { averageDailyUsage, checkReading, offsetAfterReplacement, toCumulative } from "@/server/domain/meters";
import { BusinessRuleError, NotFoundError } from "@/server/errors";
import { optionalDate, optionalText, text } from "@/server/validation";
import { assertCanOn, audit, parseInput } from "./_shared";
import { recomputeDueItems } from "./preventive";

export const readingInput = z.object({
  value: z.coerce.number({ error: "Valeur obligatoire" }).min(0, "La valeur doit être positive"),
  readAt: optionalDate,
  source: z.enum(["MANUAL", "WORK_ORDER", "TELEMATICS", "IMPORT"]).default("MANUAL"),
  /** Identifiant généré par le client pour l'idempotence (MOB-08). */
  clientId: z.string().trim().min(8).max(100).optional(),
  workOrderId: z.uuid().optional(),
  comment: optionalText(500),
});

async function loadMeter(tx: DbOrTx, ctx: AuthContext, meterId: string) {
  const [row] = await tx
    .select({ meter: meters, companyId: equipment.companyId, siteId: equipment.siteId, equipmentStatus: equipment.status })
    .from(meters)
    .innerJoin(equipment, eq(equipment.id, meters.equipmentId))
    .where(and(eq(meters.id, meterId), eq(meters.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Compteur");
  return row;
}

/** Dernier relevé de référence du segment courant (depuis le dernier remplacement). */
async function segmentStart(tx: DbOrTx, meterId: string) {
  const [lastReplacement] = await tx
    .select({ occurredAt: meterEvents.occurredAt })
    .from(meterEvents)
    .where(and(eq(meterEvents.meterId, meterId), eq(meterEvents.type, "REPLACEMENT")))
    .orderBy(desc(meterEvents.occurredAt))
    .limit(1);
  return lastReplacement?.occurredAt ?? null;
}

/** Relevés valides qui encadrent une date, dans le segment courant (depuis le dernier remplacement). */
async function validNeighbours(tx: DbOrTx, meterId: string, readAt: Date) {
  const since = await segmentStart(tx, meterId);
  const segmentFilter = since ? gt(meterReadings.readAt, since) : undefined;
  const [previous] = await tx
    .select({ value: meterReadings.value, readAt: meterReadings.readAt })
    .from(meterReadings)
    .where(and(eq(meterReadings.meterId, meterId), eq(meterReadings.status, "VALID"), lt(meterReadings.readAt, readAt), segmentFilter))
    .orderBy(desc(meterReadings.readAt))
    .limit(1);
  const [next] = await tx
    .select({ value: meterReadings.value, readAt: meterReadings.readAt })
    .from(meterReadings)
    .where(and(eq(meterReadings.meterId, meterId), eq(meterReadings.status, "VALID"), gt(meterReadings.readAt, readAt), segmentFilter))
    .orderBy(asc(meterReadings.readAt))
    .limit(1);
  return { previous: previous ?? null, next: next ?? null };
}

/** Fait avancer le compteur (dernière valeur, usage moyen) et recalcule les échéances, si le relevé est le plus récent. */
async function advanceMeter(
  tx: DbOrTx,
  ctx: AuthContext,
  meter: typeof meters.$inferSelect,
  reading: Pick<typeof meterReadings.$inferSelect, "value" | "cumulativeValue" | "readAt">,
  now: Date,
) {
  if (meter.lastReadAt && reading.readAt < meter.lastReadAt) return;
  const recent = await tx
    .select({ cumulativeValue: meterReadings.cumulativeValue, readAt: meterReadings.readAt })
    .from(meterReadings)
    .where(and(eq(meterReadings.meterId, meter.id), eq(meterReadings.status, "VALID")))
    .orderBy(desc(meterReadings.readAt))
    .limit(60);
  await tx
    .update(meters)
    .set({
      lastValue: reading.value,
      lastCumulativeValue: reading.cumulativeValue,
      lastReadAt: reading.readAt,
      averageDailyUsage: averageDailyUsage(recent, reading.readAt) ?? meter.averageDailyUsage,
    })
    .where(eq(meters.id, meter.id));
  await recomputeDueItems(tx, ctx, meter.equipmentId, now);
}

/**
 * Enregistre un relevé de compteur (DON-01 à DON-03, MOB-04, MOB-08) :
 * contrôle de cohérence, idempotence par clientId, mise à jour du compteur et des échéances.
 */
export async function recordReading(ctx: AuthContext, meterId: string, raw: unknown, now: Date = new Date()) {
  const input = parseInput(readingInput, raw);
  return db.transaction(async (tx) => {
    if (input.clientId) {
      const [existing] = await tx
        .select()
        .from(meterReadings)
        .where(and(eq(meterReadings.tenantId, ctx.tenantId), eq(meterReadings.clientId, input.clientId)));
      if (existing) return { reading: existing, duplicate: true as const };
    }

    const { meter, companyId, siteId, equipmentStatus } = await loadMeter(tx, ctx, meterId);
    assertCanOn(ctx, "meter.write", { companyId, siteId });
    if (equipmentStatus === "RETIRED") throw new BusinessRuleError(["Aucun relevé sur un équipement réformé (DON-14)."]);

    const readAt = input.readAt ?? now;
    const { previous, next } = await validNeighbours(tx, meterId, readAt);

    const check = checkReading({ meterType: meter.type, value: input.value, readAt, source: input.source, previous, next, now });
    if (check.status === "REJECTED") throw new BusinessRuleError(check.reasons);

    const cumulativeValue = toCumulative(input.value, meter.offset);
    const [reading] = await tx
      .insert(meterReadings)
      .values({
        tenantId: ctx.tenantId,
        meterId,
        readAt,
        value: input.value,
        cumulativeValue,
        source: input.source,
        status: check.status,
        statusReasons: check.reasons,
        clientId: input.clientId ?? null,
        workOrderId: input.workOrderId ?? null,
        comment: input.comment ?? null,
        createdById: ctx.userId,
      })
      .returning();

    // Seuls les relevés valides font avancer le compteur et les échéances (« à vérifier » mis en quarantaine).
    if (check.status === "VALID") await advanceMeter(tx, ctx, meter, reading, now);

    await audit(tx, ctx, { entityType: "meter_reading", entityId: reading.id, action: "create", after: reading });
    return { reading, duplicate: false as const };
  });
}

export const reviewInput = z.object({
  decision: z.enum(["VALID", "REJECTED"], { error: "Décision obligatoire" }),
  comment: optionalText(500),
});

/**
 * Traitement d'un relevé « à vérifier » (DON-02) par une personne habilitée : validation, si le relevé
 * reste cohérent avec les relevés valides qui l'encadrent, ou rejet. Un relevé validé fait avancer le compteur.
 */
export async function reviewReading(ctx: AuthContext, readingId: string, raw: unknown, now: Date = new Date()) {
  const input = parseInput(reviewInput, raw);
  return db.transaction(async (tx) => {
    const [reading] = await tx
      .select()
      .from(meterReadings)
      .where(and(eq(meterReadings.id, readingId), eq(meterReadings.tenantId, ctx.tenantId)))
      .for("update");
    if (!reading) throw new NotFoundError("Relevé");
    const { meter, companyId, siteId } = await loadMeter(tx, ctx, reading.meterId);
    assertCanOn(ctx, "meter.correct", { companyId, siteId });
    if (reading.status !== "TO_CHECK") throw new BusinessRuleError(["Seul un relevé « à vérifier » peut être validé ou rejeté."]);

    if (input.decision === "VALID") {
      const { previous, next } = await validNeighbours(tx, meter.id, reading.readAt);
      const errors: string[] = [];
      if (previous && reading.value < previous.value) errors.push(`Valeur inférieure au relevé valide précédent (${previous.value}).`);
      if (next && reading.value > next.value) errors.push(`Valeur supérieure au relevé valide suivant (${next.value}).`);
      if (errors.length > 0) throw new BusinessRuleError(errors);
    }

    const note = input.comment ? `${input.decision === "VALID" ? "Validé" : "Rejeté"} : ${input.comment}` : null;
    const [updated] = await tx
      .update(meterReadings)
      .set({ status: input.decision, comment: [reading.comment, note].filter(Boolean).join(" — ") || null })
      .where(eq(meterReadings.id, readingId))
      .returning();
    if (input.decision === "VALID") await advanceMeter(tx, ctx, meter, updated, now);
    await audit(tx, ctx, {
      entityType: "meter_reading",
      entityId: readingId,
      action: input.decision === "VALID" ? "validate" : "reject",
      before: { status: reading.status },
      after: { status: input.decision, comment: input.comment ?? null },
    });
    return updated;
  });
}

export const replacementInput = z.object({
  oldFinalValue: z.coerce.number({ error: "Valeur finale obligatoire" }).min(0),
  newInitialValue: z.coerce.number({ error: "Valeur initiale obligatoire" }).min(0),
  occurredAt: optionalDate,
  reason: text(500, "Le motif est obligatoire"),
});

/**
 * Remplacement de compteur (DON-04) : l'usage cumulé est conservé et les échéances
 * continuent sur le compteur cumulé (scénario R-05).
 */
export async function replaceMeter(ctx: AuthContext, meterId: string, raw: unknown, now: Date = new Date()) {
  const input = parseInput(replacementInput, raw);
  return db.transaction(async (tx) => {
    const { meter, companyId, siteId } = await loadMeter(tx, ctx, meterId);
    assertCanOn(ctx, "meter.correct", { companyId, siteId });
    const occurredAt = input.occurredAt ?? now;
    const newOffset = offsetAfterReplacement(meter.offset, input.oldFinalValue, input.newInitialValue);
    const cumulative = toCumulative(input.newInitialValue, newOffset);

    const [reading] = await tx
      .insert(meterReadings)
      .values({
        tenantId: ctx.tenantId,
        meterId,
        readAt: occurredAt,
        value: input.newInitialValue,
        cumulativeValue: cumulative,
        source: "MANUAL",
        status: "VALID",
        comment: `Remplacement de compteur : ${input.reason}`,
        createdById: ctx.userId,
      })
      .returning();
    const [event] = await tx
      .insert(meterEvents)
      .values({
        tenantId: ctx.tenantId,
        meterId,
        type: "REPLACEMENT",
        occurredAt,
        oldFinalValue: input.oldFinalValue,
        newInitialValue: input.newInitialValue,
        readingId: reading.id,
        reason: input.reason,
        createdById: ctx.userId,
      })
      .returning();
    await tx
      .update(meters)
      .set({ offset: newOffset, lastValue: input.newInitialValue, lastCumulativeValue: cumulative, lastReadAt: occurredAt })
      .where(eq(meters.id, meterId));
    await audit(tx, ctx, {
      entityType: "meter",
      entityId: meterId,
      action: "replace",
      before: { offset: meter.offset, lastValue: meter.lastValue },
      after: { offset: newOffset, event },
    });
    await recomputeDueItems(tx, ctx, meter.equipmentId, now);
    return event;
  });
}

export async function listReadings(ctx: AuthContext, meterId: string, limit = 50) {
  const { companyId, siteId } = await loadMeter(db, ctx, meterId);
  assertCanOn(ctx, "meter.read", { companyId, siteId });
  return db.query.meterReadings.findMany({
    where: eq(meterReadings.meterId, meterId),
    orderBy: desc(meterReadings.readAt),
    limit,
    with: { createdBy: { columns: { name: true } } },
  });
}

export async function listMeterEvents(ctx: AuthContext, meterId: string) {
  const { companyId, siteId } = await loadMeter(db, ctx, meterId);
  assertCanOn(ctx, "meter.read", { companyId, siteId });
  return db.select().from(meterEvents).where(eq(meterEvents.meterId, meterId)).orderBy(desc(meterEvents.occurredAt));
}

export const meterInput = z.object({
  type: z.enum(["HOURS", "KM", "CYCLES", "OTHER"]),
  label: text(80, "Libellé obligatoire"),
  unit: text(20, "Unité obligatoire"),
  isPrimary: z.boolean().default(false),
  initialValue: z.coerce.number().min(0).optional(),
});

/** Ajoute un compteur à un équipement (EQP-04). */
export async function createMeter(tx: DbOrTx, ctx: AuthContext, equipmentId: string, input: z.output<typeof meterInput>) {
  if (input.isPrimary) {
    await tx.update(meters).set({ isPrimary: false }).where(eq(meters.equipmentId, equipmentId));
  }
  const [meter] = await tx
    .insert(meters)
    .values({
      tenantId: ctx.tenantId,
      equipmentId,
      type: input.type,
      label: input.label,
      unit: input.unit,
      isPrimary: input.isPrimary,
      lastValue: input.initialValue ?? null,
      lastCumulativeValue: input.initialValue ?? null,
      lastReadAt: input.initialValue !== undefined ? new Date() : null,
    })
    .returning();
  if (input.initialValue !== undefined) {
    await tx.insert(meterReadings).values({
      tenantId: ctx.tenantId,
      meterId: meter.id,
      readAt: meter.lastReadAt ?? new Date(),
      value: input.initialValue,
      cumulativeValue: input.initialValue,
      source: "MANUAL",
      status: "VALID",
      comment: "Valeur initiale",
      createdById: ctx.userId,
    });
  }
  return meter;
}
