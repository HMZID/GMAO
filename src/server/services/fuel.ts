import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { tpl, tplParts } from "@/i18n/translate";
import type { AuthContext } from "@/server/authz/context";
import { db, type DbOrTx } from "@/server/db";
import { companies, equipment, equipmentCategories, equipmentFuelSettings, fuelCards, fuelEntries, meters, sites } from "@/server/db/schema";
import {
  FLUID_KINDS,
  averageConsumption,
  cardLast4,
  consumptionUnit,
  detectAnomalies,
  fillAmount,
  fullToFullSegments,
  isFuel,
  referenceConsumption,
  type FillPoint,
  type FluidKind,
} from "@/server/domain/fuel";
import type { MeterType } from "@/server/domain/meters";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/server/errors";
import { bool, clearable, date, optionalDate, optionalId, optionalNumber, optionalText, text } from "@/server/validation";
import { assertCan, assertCanOn, assertVisible, audit, offsetOf, paginationSchema, parseInput, scopeWhere } from "./_shared";
import { notifyByPermission } from "./notifications";
import { isUniqueViolation } from "./organization";

/* ------------------------------------------------------------------ */
/* Saisie d'un plein                                                    */
/* ------------------------------------------------------------------ */

/** Plein complet par défaut (champ absent de l'API ou du mobile) ; « false » explicite pour un appoint. */
const fullTankFlag = z.preprocess(
  (v) => (v === undefined || v === null || v === "" ? true : v === true || v === "true" || v === "on" || v === "1"),
  z.boolean(),
);

const positiveOrEmpty = (message: string) => optionalNumber.refine((v) => v === undefined || v >= 0, message);

export const fuelEntryInput = z.object({
  equipmentId: z.uuid("Équipement obligatoire"),
  fluid: z.enum(FLUID_KINDS, "Fluide obligatoire").default("DIESEL"),
  quantity: z.coerce.number({ error: "Quantité obligatoire" }).positive("La quantité doit être positive").max(20_000, "Quantité invraisemblable"),
  unitPrice: positiveOrEmpty("Prix positif attendu"),
  amount: positiveOrEmpty("Montant positif attendu"),
  filledAt: optionalDate,
  meterValue: positiveOrEmpty("Compteur positif attendu"),
  fullTank: fullTankFlag,
  station: optionalText(120),
  reference: optionalText(80),
  fuelCardId: optionalId,
  /** Idempotence des saisies hors connexion (MOB-08) et des imports de relevés de carte. */
  clientId: z.string().trim().min(8).max(160).optional(),
});

/** Tolérance d'horloge pour un plein daté dans le futur (terminal mobile mal réglé). */
const FUTURE_TOLERANCE_MS = 5 * 60_000;

function sourceOf(ctx: AuthContext) {
  if (ctx.channel === "MOBILE") return "MOBILE" as const;
  if (ctx.channel === "IMPORT") return "CARD_IMPORT" as const;
  if (ctx.channel === "API") return "API" as const;
  return "MANUAL" as const;
}

async function loadEquipment(tx: DbOrTx, ctx: AuthContext, equipmentId: string) {
  const [row] = await tx
    .select({
      id: equipment.id,
      code: equipment.code,
      name: equipment.name,
      companyId: equipment.companyId,
      siteId: equipment.siteId,
      status: equipment.status,
    })
    .from(equipment)
    .where(and(eq(equipment.id, equipmentId), eq(equipment.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Équipement");
  return row;
}

async function primaryMeter(tx: DbOrTx, equipmentId: string) {
  const [meter] = await tx
    .select({ id: meters.id, type: meters.type, unit: meters.unit, offset: meters.offset })
    .from(meters)
    .where(and(eq(meters.equipmentId, equipmentId), eq(meters.isPrimary, true)))
    .limit(1);
  return meter ?? null;
}

async function fuelSettings(tx: DbOrTx, equipmentId: string) {
  const [row] = await tx.select().from(equipmentFuelSettings).where(eq(equipmentFuelSettings.equipmentId, equipmentId));
  return {
    fuelType: (row?.fuelType ?? null) as FluidKind | null,
    tankCapacity: row?.tankCapacity ?? null,
    referenceConsumption: row?.referenceConsumption ?? null,
  };
}

/** Pleins valides d'un équipement, sous la forme attendue par le domaine. */
async function fillHistory(tx: DbOrTx, equipmentId: string, options: { before?: Date; since?: Date; limit?: number } = {}): Promise<FillPoint[]> {
  const rows = await tx
    .select({
      id: fuelEntries.id,
      filledAt: fuelEntries.filledAt,
      fluid: fuelEntries.fluid,
      quantity: fuelEntries.quantity,
      meter: fuelEntries.cumulativeMeterValue,
      fullTank: fuelEntries.fullTank,
    })
    .from(fuelEntries)
    .where(
      and(
        eq(fuelEntries.equipmentId, equipmentId),
        eq(fuelEntries.status, "VALID"),
        options.before ? lte(fuelEntries.filledAt, options.before) : undefined,
        options.since ? gte(fuelEntries.filledAt, options.since) : undefined,
      ),
    )
    .orderBy(desc(fuelEntries.filledAt))
    .limit(options.limit ?? 2000);
  return rows.reverse();
}

/**
 * Enregistre un plein ou un appoint (carburant, AdBlue, huile, liquide) : contrôles de saisie, idempotence par
 * `clientId`, compteur cumulé, anomalies détectées (toutes listées) et signalées au responsable du parc.
 * Un plein anormal est enregistré « à examiner » : il n'est jamais refusé pour une anomalie.
 */
export async function recordFuelEntry(ctx: AuthContext, raw: unknown, now: Date = new Date()) {
  const input = parseInput(fuelEntryInput, raw);
  const filledAt = input.filledAt ?? now;
  if (filledAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) throw new BusinessRuleError(["Un plein ne peut pas être daté dans le futur."]);

  return db.transaction(async (tx) => {
    if (input.clientId) {
      const [existing] = await tx
        .select()
        .from(fuelEntries)
        .where(and(eq(fuelEntries.tenantId, ctx.tenantId), eq(fuelEntries.clientId, input.clientId)));
      if (existing) return { entry: existing, anomalies: existing.anomalies, duplicate: true as const };
    }
    const eqRow = await loadEquipment(tx, ctx, input.equipmentId);
    assertCanOn(ctx, "fuel.write", eqRow);
    if (eqRow.status === "RETIRED") throw new BusinessRuleError(["Aucun plein sur un équipement réformé."]);

    let card: typeof fuelCards.$inferSelect | null = null;
    if (input.fuelCardId) {
      [card] = await tx
        .select()
        .from(fuelCards)
        .where(and(eq(fuelCards.id, input.fuelCardId), eq(fuelCards.tenantId, ctx.tenantId)));
      if (!card) throw new NotFoundError("Carte carburant");
    }
    const meter = await primaryMeter(tx, eqRow.id);
    if (input.meterValue !== undefined && !meter) throw new BusinessRuleError(["Cet équipement n'a pas de compteur : laisser le compteur vide."]);
    const cumulative = input.meterValue !== undefined && meter ? Math.round((input.meterValue + meter.offset) * 10) / 10 : null;
    const settings = await fuelSettings(tx, eqRow.id);
    const history = await fillHistory(tx, eqRow.id, { before: filledAt, limit: 60 });

    let monthLitres = 0;
    if (card) {
      const monthStart = new Date(Date.UTC(filledAt.getUTCFullYear(), filledAt.getUTCMonth(), 1));
      const [sum] = await tx
        .select({ litres: sql<number>`coalesce(sum(${fuelEntries.quantity}), 0)`.mapWith(Number) })
        .from(fuelEntries)
        .where(
          and(
            eq(fuelEntries.fuelCardId, card.id),
            eq(fuelEntries.status, "VALID"),
            gte(fuelEntries.filledAt, monthStart),
            lt(fuelEntries.filledAt, filledAt),
          ),
        );
      monthLitres = sum?.litres ?? 0;
    }

    const point: FillPoint = { id: "nouveau", filledAt, fluid: input.fluid, quantity: input.quantity, meter: cumulative, fullTank: input.fullTank };
    const anomalies = detectAnomalies({
      fill: point,
      meterType: (meter?.type ?? null) as MeterType | null,
      history,
      equipment: settings,
      equipmentId: eqRow.id,
      card: card ? { equipmentId: card.equipmentId, active: card.active, monthlyLimitLitres: card.monthlyLimitLitres, monthLitres } : null,
    });

    const [entry] = await tx
      .insert(fuelEntries)
      .values({
        tenantId: ctx.tenantId,
        companyId: eqRow.companyId,
        siteId: eqRow.siteId,
        equipmentId: eqRow.id,
        fluid: input.fluid,
        quantity: input.quantity,
        unitPrice: input.unitPrice ?? null,
        amount: fillAmount(input.quantity, input.unitPrice, input.amount),
        filledAt,
        meterId: input.meterValue !== undefined ? (meter?.id ?? null) : null,
        meterValue: input.meterValue ?? null,
        cumulativeMeterValue: cumulative,
        fullTank: input.fullTank,
        station: input.station ?? null,
        reference: input.reference ?? null,
        fuelCardId: card?.id ?? null,
        source: sourceOf(ctx),
        anomalies,
        reviewStatus: anomalies.length > 0 ? "TO_REVIEW" : "NONE",
        clientId: input.clientId ?? null,
        createdById: ctx.userId,
      })
      .returning();
    await audit(tx, ctx, { entityType: "fuel_entry", entityId: entry.id, action: "create", after: entry });
    if (anomalies.length > 0) {
      await notifyByPermission(
        tx,
        ctx.tenantId,
        "fuel.manage",
        eqRow,
        {
          type: "fuel.anomaly",
          title: tpl`Plein à examiner : ${eqRow.code}`,
          body: tplParts(anomalies.map((a) => a.message)),
          entityType: "equipment",
          entityId: eqRow.id,
          dedupKey: `fuel:${entry.id}`,
        },
        { excludeUserId: ctx.userId },
      );
    }
    return { entry, anomalies, duplicate: false as const };
  });
}

/* ------------------------------------------------------------------ */
/* Liste et examen des pleins                                           */
/* ------------------------------------------------------------------ */

export const fuelEntryFilters = paginationSchema.extend({
  equipmentId: z.uuid().optional(),
  siteId: z.uuid().optional(),
  fluid: z.enum(FLUID_KINDS).optional(),
  review: z.enum(["TO_REVIEW", "ALL"]).default("ALL"),
  includeCancelled: bool.default(false),
  from: optionalDate,
  to: optionalDate,
});

export async function listFuelEntries(ctx: AuthContext, raw: unknown = {}) {
  assertCan(ctx, "fuel.read");
  const f = parseInput(fuelEntryFilters, raw);
  const where = and(
    eq(fuelEntries.tenantId, ctx.tenantId),
    scopeWhere(ctx.scope("fuel.read"), fuelEntries.companyId, fuelEntries.siteId),
    f.equipmentId ? eq(fuelEntries.equipmentId, f.equipmentId) : undefined,
    f.siteId ? eq(fuelEntries.siteId, f.siteId) : undefined,
    f.fluid ? eq(fuelEntries.fluid, f.fluid) : undefined,
    f.review === "TO_REVIEW" ? and(eq(fuelEntries.reviewStatus, "TO_REVIEW"), eq(fuelEntries.status, "VALID")) : undefined,
    f.includeCancelled ? undefined : eq(fuelEntries.status, "VALID"),
    f.from ? gte(fuelEntries.filledAt, f.from) : undefined,
    f.to ? lt(fuelEntries.filledAt, f.to) : undefined,
  );
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: fuelEntries.id,
        filledAt: fuelEntries.filledAt,
        fluid: fuelEntries.fluid,
        quantity: fuelEntries.quantity,
        unitPrice: fuelEntries.unitPrice,
        amount: fuelEntries.amount,
        meterValue: fuelEntries.meterValue,
        meterUnit: meters.unit,
        fullTank: fuelEntries.fullTank,
        station: fuelEntries.station,
        reference: fuelEntries.reference,
        source: fuelEntries.source,
        anomalies: fuelEntries.anomalies,
        reviewStatus: fuelEntries.reviewStatus,
        reviewComment: fuelEntries.reviewComment,
        status: fuelEntries.status,
        cancelReason: fuelEntries.cancelReason,
        equipmentId: equipment.id,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        companyId: fuelEntries.companyId,
        siteId: fuelEntries.siteId,
        siteName: sites.name,
        cardProvider: fuelCards.provider,
        cardLast4: fuelCards.last4,
      })
      .from(fuelEntries)
      .innerJoin(equipment, eq(equipment.id, fuelEntries.equipmentId))
      .innerJoin(sites, eq(sites.id, fuelEntries.siteId))
      .leftJoin(meters, eq(meters.id, fuelEntries.meterId))
      .leftJoin(fuelCards, eq(fuelCards.id, fuelEntries.fuelCardId))
      .where(where)
      .orderBy(desc(fuelEntries.filledAt))
      .limit(f.pageSize)
      .offset(offsetOf(f)),
    db.select({ total: count() }).from(fuelEntries).where(where),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize };
}

export const fuelReviewInput = z.object({
  decision: z.enum(["JUSTIFIED", "CANCELLED"], "Décision obligatoire"),
  comment: text(500, "Le commentaire est obligatoire"),
});

/**
 * Examen d'un plein par le responsable du parc : anomalie justifiée (le plein reste dans les calculs) ou plein
 * annulé (saisie erronée, doublon) : il sort des calculs mais reste conservé (DON-06).
 */
export async function reviewFuelEntry(ctx: AuthContext, id: string, raw: unknown, now: Date = new Date()) {
  const input = parseInput(fuelReviewInput, raw);
  if (!z.uuid().safeParse(id).success) throw new NotFoundError("Plein");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(fuelEntries)
      .where(and(eq(fuelEntries.id, id), eq(fuelEntries.tenantId, ctx.tenantId)))
      .for("update");
    if (!row) throw new NotFoundError("Plein");
    assertVisible(ctx, "fuel.read", row, "Plein");
    assertCanOn(ctx, "fuel.manage", row);
    const errors: string[] = [];
    if (row.status === "CANCELLED") errors.push("Ce plein est déjà annulé.");
    if (input.decision === "JUSTIFIED" && row.reviewStatus !== "TO_REVIEW") errors.push("Seul un plein à examiner peut être justifié.");
    if (errors.length > 0) throw new BusinessRuleError(errors);
    const patch =
      input.decision === "JUSTIFIED"
        ? { reviewStatus: "JUSTIFIED" as const, reviewComment: input.comment, reviewedById: ctx.userId, reviewedAt: now }
        : {
            status: "CANCELLED" as const,
            cancelReason: input.comment,
            reviewStatus: row.reviewStatus === "TO_REVIEW" ? ("JUSTIFIED" as const) : row.reviewStatus,
            reviewComment: row.reviewStatus === "TO_REVIEW" ? input.comment : row.reviewComment,
            reviewedById: ctx.userId,
            reviewedAt: now,
          };
    const [updated] = await tx.update(fuelEntries).set(patch).where(eq(fuelEntries.id, id)).returning();
    await audit(tx, ctx, {
      entityType: "fuel_entry",
      entityId: id,
      action: input.decision === "JUSTIFIED" ? "justify" : "cancel",
      before: { status: row.status, reviewStatus: row.reviewStatus },
      after: patch,
    });
    return updated;
  });
}

/** Pleins à examiner du périmètre (tableau de bord). */
export async function countFuelEntriesToReview(ctx: AuthContext) {
  if (!ctx.can("fuel.manage")) return 0;
  const [row] = await db
    .select({ n: count() })
    .from(fuelEntries)
    .where(
      and(
        eq(fuelEntries.tenantId, ctx.tenantId),
        eq(fuelEntries.status, "VALID"),
        eq(fuelEntries.reviewStatus, "TO_REVIEW"),
        scopeWhere(ctx.scope("fuel.manage"), fuelEntries.companyId, fuelEntries.siteId),
      ),
    );
  return row?.n ?? 0;
}

/* ------------------------------------------------------------------ */
/* Consommation                                                         */
/* ------------------------------------------------------------------ */

export const consumptionFilters = z.object({
  from: optionalDate,
  to: optionalDate,
  siteId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
});

/** Historique chargé avant la période pour retrouver le plein complet de départ du premier tronçon. */
const ANCHOR_DAYS = 120;

/**
 * Consommation par équipement sur la période (90 derniers jours par défaut) : litres de carburant, autres fluides,
 * montant, usage et consommation « plein à plein » (L/h ou L/100 km), référence et écart, pleins à examiner.
 */
export async function fuelConsumption(ctx: AuthContext, raw: unknown = {}, now: Date = new Date()) {
  assertCan(ctx, "fuel.read");
  const f = parseInput(consumptionFilters, raw);
  const to = f.to ?? now;
  const from = f.from ?? new Date(to.getTime() - 90 * 86_400_000);
  const since = new Date(from.getTime() - ANCHOR_DAYS * 86_400_000);

  const rows = await db
    .select({
      id: fuelEntries.id,
      equipmentId: fuelEntries.equipmentId,
      filledAt: fuelEntries.filledAt,
      fluid: fuelEntries.fluid,
      quantity: fuelEntries.quantity,
      amount: fuelEntries.amount,
      meter: fuelEntries.cumulativeMeterValue,
      fullTank: fuelEntries.fullTank,
      reviewStatus: fuelEntries.reviewStatus,
    })
    .from(fuelEntries)
    .innerJoin(equipment, eq(equipment.id, fuelEntries.equipmentId))
    .where(
      and(
        eq(fuelEntries.tenantId, ctx.tenantId),
        eq(fuelEntries.status, "VALID"),
        gte(fuelEntries.filledAt, since),
        lt(fuelEntries.filledAt, to),
        scopeWhere(ctx.scope("fuel.read"), fuelEntries.companyId, fuelEntries.siteId),
        f.siteId ? eq(fuelEntries.siteId, f.siteId) : undefined,
        f.categoryId ? eq(equipment.categoryId, f.categoryId) : undefined,
      ),
    )
    .orderBy(asc(fuelEntries.filledAt));
  const inPeriod = (d: Date) => d >= from && d < to;
  const equipmentIds = [...new Set(rows.filter((r) => inPeriod(r.filledAt)).map((r) => r.equipmentId))];
  if (equipmentIds.length === 0) return { from, to, items: [], totals: { litres: 0, amount: 0, toReview: 0 } };

  const [info, meterRows, settingRows] = await Promise.all([
    db
      .select({ id: equipment.id, code: equipment.code, name: equipment.name, siteName: sites.name, categoryName: equipmentCategories.name })
      .from(equipment)
      .innerJoin(sites, eq(sites.id, equipment.siteId))
      .innerJoin(equipmentCategories, eq(equipmentCategories.id, equipment.categoryId))
      .where(inArray(equipment.id, equipmentIds)),
    db
      .select({ equipmentId: meters.equipmentId, type: meters.type })
      .from(meters)
      .where(and(inArray(meters.equipmentId, equipmentIds), eq(meters.isPrimary, true))),
    db.select().from(equipmentFuelSettings).where(inArray(equipmentFuelSettings.equipmentId, equipmentIds)),
  ]);

  const items = info.map((e) => {
    const own = rows.filter((r) => r.equipmentId === e.id);
    const meterType = (meterRows.find((m) => m.equipmentId === e.id)?.type ?? null) as MeterType | null;
    const settings = settingRows.find((s) => s.equipmentId === e.id);
    const points: FillPoint[] = own.map((r) => ({
      id: r.id,
      filledAt: r.filledAt,
      fluid: r.fluid,
      quantity: r.quantity,
      meter: r.meter,
      fullTank: r.fullTank,
    }));
    const segments = fullToFullSegments(points, meterType);
    const closingInPeriod = new Set(own.filter((r) => inPeriod(r.filledAt)).map((r) => r.id));
    const periodSegments = segments.filter((s) => closingInPeriod.has(s.toId));
    const before = segments.filter((s) => !closingInPeriod.has(s.toId)).map((s) => s.rate);
    const average = averageConsumption(periodSegments, meterType);
    const reference = referenceConsumption(settings?.referenceConsumption ?? null, before.slice(-5));
    const period = own.filter((r) => inPeriod(r.filledAt));
    const fuelLitres = period.filter((r) => isFuel(r.fluid)).reduce((s, r) => s + r.quantity, 0);
    return {
      equipmentId: e.id,
      code: e.code,
      name: e.name,
      siteName: e.siteName,
      categoryName: e.categoryName,
      fills: period.length,
      fuelLitres: Math.round(fuelLitres * 10) / 10,
      otherLitres: Math.round(period.filter((r) => !isFuel(r.fluid)).reduce((s, r) => s + r.quantity, 0) * 10) / 10,
      amount: Math.round(period.reduce((s, r) => s + (r.amount ?? 0), 0) * 100) / 100,
      usage: average.usage,
      rate: average.rate,
      unit: consumptionUnit(meterType),
      reference,
      deviation: average.rate !== null && reference ? Math.round(((average.rate - reference) / reference) * 1000) / 10 : null,
      toReview: period.filter((r) => r.reviewStatus === "TO_REVIEW").length,
    };
  });
  items.sort((a, b) => (b.deviation ?? -Infinity) - (a.deviation ?? -Infinity) || b.amount - a.amount);
  return {
    from,
    to,
    items,
    totals: {
      litres: Math.round(items.reduce((s, i) => s + i.fuelLitres, 0) * 10) / 10,
      amount: Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100,
      toReview: items.reduce((s, i) => s + i.toReview, 0),
    },
  };
}

/**
 * Carte « Carburant et fluides » de la fiche équipement : réglages, consommation des 90 derniers jours,
 * derniers pleins, cartes affectées.
 */
export async function getEquipmentFuel(ctx: AuthContext, equipmentId: string, now: Date = new Date()) {
  const eqRow = await loadEquipment(db, ctx, equipmentId);
  assertVisible(ctx, "fuel.read", eqRow, "Équipement");
  const [settings, meter, recent, cards] = await Promise.all([
    fuelSettings(db, equipmentId),
    primaryMeter(db, equipmentId),
    listFuelEntries(ctx, { equipmentId, pageSize: 10, includeCancelled: true }),
    db
      .select({ id: fuelCards.id, provider: fuelCards.provider, last4: fuelCards.last4, label: fuelCards.label, active: fuelCards.active })
      .from(fuelCards)
      .where(and(eq(fuelCards.tenantId, ctx.tenantId), eq(fuelCards.equipmentId, equipmentId))),
  ]);
  const consumption = await fuelConsumption(ctx, { from: new Date(now.getTime() - 90 * 86_400_000), to: now }, now);
  const own = consumption.items.find((i) => i.equipmentId === equipmentId) ?? null;
  return {
    equipment: eqRow,
    settings,
    meter,
    unit: consumptionUnit((meter?.type ?? null) as MeterType | null),
    consumption: own,
    recent: recent.items,
    cards,
    canWrite: ctx.canOn("fuel.write", eqRow) && eqRow.status !== "RETIRED",
    canManage: ctx.canOn("fuel.manage", eqRow),
  };
}

/* ------------------------------------------------------------------ */
/* Réglages carburant d'un équipement                                   */
/* ------------------------------------------------------------------ */

export const fuelSettingsInput = z.object({
  fuelType: clearable(z.enum(FLUID_KINDS)),
  tankCapacity: clearable(z.coerce.number().positive("Capacité positive attendue").max(100_000)),
  referenceConsumption: clearable(z.coerce.number().positive("Consommation positive attendue").max(10_000)),
});

export async function setEquipmentFuelSettings(ctx: AuthContext, equipmentId: string, raw: unknown) {
  const input = parseInput(fuelSettingsInput, raw);
  const eqRow = await loadEquipment(db, ctx, equipmentId);
  assertVisible(ctx, "fuel.read", eqRow, "Équipement");
  assertCanOn(ctx, "fuel.manage", eqRow);
  if (input.fuelType && !isFuel(input.fuelType)) throw new BusinessRuleError(["Le carburant de l'équipement doit être du gasoil ou de l'essence."]);
  return db.transaction(async (tx) => {
    const before = await fuelSettings(tx, equipmentId);
    const values = {
      fuelType: input.fuelType === undefined ? before.fuelType : input.fuelType,
      tankCapacity: input.tankCapacity === undefined ? before.tankCapacity : input.tankCapacity,
      referenceConsumption: input.referenceConsumption === undefined ? before.referenceConsumption : input.referenceConsumption,
    };
    const [row] = await tx
      .insert(equipmentFuelSettings)
      .values({ equipmentId, tenantId: ctx.tenantId, ...values })
      .onConflictDoUpdate({ target: equipmentFuelSettings.equipmentId, set: values })
      .returning();
    await audit(tx, ctx, { entityType: "equipment", entityId: equipmentId, action: "fuel_settings", before, after: values });
    return row;
  });
}

/* ------------------------------------------------------------------ */
/* Cartes carburant                                                     */
/* ------------------------------------------------------------------ */

export async function listFuelCards(ctx: AuthContext) {
  assertCan(ctx, "fuel.read");
  return db
    .select({
      id: fuelCards.id,
      provider: fuelCards.provider,
      last4: fuelCards.last4,
      label: fuelCards.label,
      holderName: fuelCards.holderName,
      validTo: fuelCards.validTo,
      monthlyLimitLitres: fuelCards.monthlyLimitLitres,
      active: fuelCards.active,
      companyId: fuelCards.companyId,
      companyName: companies.name,
      equipmentId: fuelCards.equipmentId,
      equipmentCode: equipment.code,
      equipmentName: equipment.name,
    })
    .from(fuelCards)
    .innerJoin(companies, eq(companies.id, fuelCards.companyId))
    .leftJoin(equipment, eq(equipment.id, fuelCards.equipmentId))
    .where(and(eq(fuelCards.tenantId, ctx.tenantId), scopeWhere(ctx.scope("fuel.read"), fuelCards.companyId)))
    .orderBy(desc(fuelCards.active), asc(fuelCards.provider), asc(fuelCards.last4));
}

export const fuelCardInput = z.object({
  companyId: z.uuid("Société obligatoire"),
  provider: text(60, "Fournisseur obligatoire"),
  cardNumber: text(40, "Numéro de carte obligatoire"),
  label: optionalText(80),
  equipmentId: optionalId,
  holderName: optionalText(120),
  validTo: optionalDate,
  monthlyLimitLitres: positiveOrEmpty("Plafond positif attendu"),
});

/** Équipement auquel affecter une carte : de l'organisation et de la société de la carte. */
async function assertCardEquipment(ctx: AuthContext, equipmentId: string, companyId: string) {
  const eqRow = await loadEquipment(db, ctx, equipmentId);
  assertVisible(ctx, "fuel.read", eqRow, "Équipement");
  if (eqRow.companyId !== companyId) throw new BusinessRuleError(["L'équipement doit appartenir à la société de la carte."]);
}

export async function createFuelCard(ctx: AuthContext, raw: unknown) {
  const input = parseInput(fuelCardInput, raw);
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, input.companyId), eq(companies.tenantId, ctx.tenantId)));
  if (!company) throw new NotFoundError("Société");
  assertCanOn(ctx, "fuel.manage", { companyId: company.id });
  const last4 = cardLast4(input.cardNumber);
  if (!last4) throw new BusinessRuleError(["Numéro de carte : au moins 4 chiffres attendus."]);
  if (input.equipmentId) await assertCardEquipment(ctx, input.equipmentId, company.id);
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(fuelCards)
        .values({
          tenantId: ctx.tenantId,
          companyId: company.id,
          provider: input.provider,
          last4,
          label: input.label ?? null,
          equipmentId: input.equipmentId ?? null,
          holderName: input.holderName ?? null,
          validTo: input.validTo ?? null,
          monthlyLimitLitres: input.monthlyLimitLitres ?? null,
          createdById: ctx.userId,
        })
        .returning();
      await audit(tx, ctx, { entityType: "fuel_card", entityId: row.id, action: "create", after: row });
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError(tpl`Une carte ${input.provider} se terminant par ${last4} existe déjà.`);
    throw error;
  }
}

export const fuelCardUpdateInput = z.object({
  label: clearable(z.string().trim().max(80)),
  equipmentId: clearable(z.uuid()),
  holderName: clearable(z.string().trim().max(120)),
  validTo: clearable(date()),
  monthlyLimitLitres: clearable(z.coerce.number().positive("Plafond positif attendu")),
  active: bool.optional(),
});

export async function updateFuelCard(ctx: AuthContext, id: string, raw: unknown) {
  const input = parseInput(fuelCardUpdateInput, raw);
  if (!z.uuid().safeParse(id).success) throw new NotFoundError("Carte carburant");
  const [card] = await db
    .select()
    .from(fuelCards)
    .where(and(eq(fuelCards.id, id), eq(fuelCards.tenantId, ctx.tenantId)));
  if (!card) throw new NotFoundError("Carte carburant");
  assertVisible(ctx, "fuel.read", { companyId: card.companyId }, "Carte carburant");
  assertCanOn(ctx, "fuel.manage", { companyId: card.companyId });
  if (input.equipmentId) await assertCardEquipment(ctx, input.equipmentId, card.companyId);
  const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  return db.transaction(async (tx) => {
    const [row] = await tx.update(fuelCards).set(patch).where(eq(fuelCards.id, id)).returning();
    await audit(tx, ctx, { entityType: "fuel_card", entityId: id, action: "update", before: card, after: patch });
    return row;
  });
}

/** Cartes actives proposées à la saisie d'un plein sur un équipement (celles de sa société). */
export async function listFuelCardOptions(ctx: AuthContext, companyId?: string) {
  if (!ctx.can("fuel.write")) return [];
  return db
    .select({ id: fuelCards.id, provider: fuelCards.provider, last4: fuelCards.last4, label: fuelCards.label, equipmentId: fuelCards.equipmentId })
    .from(fuelCards)
    .where(and(eq(fuelCards.tenantId, ctx.tenantId), eq(fuelCards.active, true), companyId ? eq(fuelCards.companyId, companyId) : undefined))
    .orderBy(asc(fuelCards.provider), asc(fuelCards.last4));
}

/** Équipements sur lesquels l'utilisateur peut saisir un plein (sélecteur de la page Carburant). */
export async function listFuelEquipmentOptions(ctx: AuthContext) {
  if (!ctx.can("fuel.write")) return [];
  return db
    .select({ id: equipment.id, code: equipment.code, name: equipment.name })
    .from(equipment)
    .where(
      and(
        eq(equipment.tenantId, ctx.tenantId),
        ne(equipment.status, "RETIRED"),
        scopeWhere(ctx.scope("fuel.write"), equipment.companyId, equipment.siteId),
      ),
    )
    .orderBy(asc(equipment.code));
}
