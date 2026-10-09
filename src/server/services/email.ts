import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { isActiveAssignment, type AuthContext, type Scope } from "@/server/authz/context";
import type { Role } from "@/server/authz/permissions";
import { db, type DbOrTx } from "@/server/db";
import {
  documents,
  dueItems,
  emailOutbox,
  emailPreferences,
  equipment,
  parts,
  planOperations,
  roleAssignments,
  sites,
  stockLevels,
  tenants,
  user,
  warehouses,
  workOrders,
} from "@/server/db/schema";
import {
  EMAIL_EVENT_DEFINITIONS,
  EMAIL_EVENTS,
  dayKey,
  documentExpiryStage,
  emailEventOf,
  isDigestTime,
  isPermanentError,
  nextRetryAt,
  renderEmail,
  wantsEmail,
  type EmailContent,
  type EmailEvent,
} from "@/server/domain/email";
import { NotFoundError } from "@/server/errors";
import { getEmailTransport, type EmailTransport } from "@/server/email/transport";
import { formatDate, formatNumber } from "@/lib/format";
import { publicUrl } from "@/server/public-url";
import { assertCan, audit, parseInput, scopeWhere } from "./_shared";

const baseUrl = publicUrl;

/* ------------------------------------------------------------------ */
/* Mise en file (dans la transaction de l'événement)                   */
/* ------------------------------------------------------------------ */

export type EmailRequest = {
  tenantId: string;
  userId: string;
  event: EmailEvent;
  /** Clé de l'événement pour ce destinataire : un second envoi pour la même clé est ignoré. */
  dedupKey: string;
  content: EmailContent;
};

/**
 * Met un courriel en file pour un utilisateur actif, selon ses préférences (alertes obligatoires toujours).
 * Écrit dans la transaction de l'événement (file d'envoi transactionnelle) : pas d'événement, pas de courriel.
 */
export async function enqueueEmail(tx: DbOrTx, request: EmailRequest): Promise<boolean> {
  const [recipient] = await tx
    .select({ email: user.email, name: user.name, isActive: user.isActive })
    .from(user)
    .where(and(eq(user.id, request.userId), eq(user.tenantId, request.tenantId)));
  if (!recipient?.isActive || !recipient.email) return false;
  const prefs = await tx
    .select({ event: emailPreferences.event, enabled: emailPreferences.enabled })
    .from(emailPreferences)
    .where(eq(emailPreferences.userId, request.userId));
  if (!wantsEmail(request.event, Object.fromEntries(prefs.map((p) => [p.event, p.enabled])))) return false;

  const mail = renderEmail(request.event, request.content, { baseUrl: baseUrl(), recipientName: recipient.name });
  const inserted = await tx
    .insert(emailOutbox)
    .values({
      tenantId: request.tenantId,
      userId: request.userId,
      toAddress: recipient.email,
      event: request.event,
      dedupKey: request.dedupKey.slice(0, 300),
      subject: mail.subject,
      textBody: mail.text,
      htmlBody: mail.html,
    })
    .onConflictDoNothing({ target: [emailOutbox.tenantId, emailOutbox.dedupKey] })
    .returning({ id: emailOutbox.id });
  return inserted.length > 0;
}

const ENTITY_LINKS: Record<string, (id: string) => string> = {
  work_request: (id) => `/demandes/${id}`,
  work_order: (id) => `/ordres-de-travail/${id}`,
  equipment: (id) => `/equipements/${id}`,
  purchase_request: (id) => `/demandes-achat/${id}`,
  approval: () => "/validations",
};

export function linkOf(entityType?: string | null, entityId?: string | null) {
  return entityType && entityId && ENTITY_LINKS[entityType] ? ENTITY_LINKS[entityType](entityId) : null;
}

/** Courriels des notifications de l'application qui en prévoient un (§11.1) : un par destinataire et par événement. */
export async function enqueueForNotification(
  tx: DbOrTx,
  tenantId: string,
  userIds: string[],
  notification: { type: string; title: string; body?: string | null; entityType?: string | null; entityId?: string | null; dedupKey?: string },
) {
  const event = emailEventOf(notification.type);
  if (!event) return 0;
  let queued = 0;
  for (const userId of userIds) {
    const ok = await enqueueEmail(tx, {
      tenantId,
      userId,
      event,
      dedupKey: `${notification.dedupKey ?? `${notification.type}:${notification.entityId ?? ""}`}:${userId}`,
      content: {
        title: notification.title,
        intro: notification.body ?? notification.title,
        link: linkOf(notification.entityType, notification.entityId),
      },
    });
    if (ok) queued++;
  }
  return queued;
}

/* ------------------------------------------------------------------ */
/* Envoi en arrière-plan, avec reprises                                 */
/* ------------------------------------------------------------------ */

/** Durée de prise en charge d'un courriel par un processus d'envoi ; au-delà, un autre peut le reprendre. */
const LOCK_MINUTES = 5;

/**
 * Envoie les courriels dus. Prise en charge par `FOR UPDATE SKIP LOCKED` : plusieurs processus d'envoi ne
 * traitent jamais le même courriel. Erreur passagère : nouvelle tentative différée ; erreur définitive ou
 * nombre maximal de tentatives atteint : « échec », visible et relançable par l'administrateur.
 */
export async function processEmailQueue(options: { limit?: number; now?: Date; transport?: EmailTransport } = {}) {
  const now = options.now ?? new Date();
  const transport = options.transport ?? getEmailTransport();
  const claimed = await db.execute<{ id: string }>(sql`
    update email_outbox set locked_until = ${new Date(now.getTime() + LOCK_MINUTES * 60_000)}
    where id in (
      select id from email_outbox
      where status = 'PENDING' and next_attempt_at <= ${now} and (locked_until is null or locked_until < ${now})
      order by next_attempt_at
      limit ${options.limit ?? 50}
      for update skip locked
    )
    returning id`);
  const ids = claimed.rows.map((r) => r.id);
  const result = { sent: 0, retried: 0, failed: 0 };
  if (ids.length === 0) return result;
  const rows = await db.select().from(emailOutbox).where(inArray(emailOutbox.id, ids));

  for (const row of rows) {
    const attempts = row.attempts + 1;
    try {
      const info = await transport.send({ to: row.toAddress, subject: row.subject, text: row.textBody, html: row.htmlBody });
      await db
        .update(emailOutbox)
        .set({
          status: "SENT",
          attempts,
          sentAt: new Date(),
          lockedUntil: null,
          transport: transport.name,
          messageId: info.messageId,
          lastError: null,
        })
        .where(eq(emailOutbox.id, row.id));
      result.sent++;
    } catch (error) {
      const e = error as { message?: string; responseCode?: number; code?: string };
      const permanent = isPermanentError(e);
      const retryAt = permanent ? null : nextRetryAt(attempts, new Date());
      const message = (e.message ?? String(error)).slice(0, 500);
      await db
        .update(emailOutbox)
        .set({
          status: retryAt ? "PENDING" : "FAILED",
          attempts,
          nextAttemptAt: retryAt ?? row.nextAttemptAt,
          lockedUntil: null,
          lastError: message,
          transport: transport.name,
          errors: [...row.errors, { at: new Date().toISOString(), message, permanent }].slice(-10),
        })
        .where(eq(emailOutbox.id, row.id));
      if (retryAt) result.retried++;
      else result.failed++;
      console.error(`[courriel] échec ${attempts} pour ${row.id} : ${message}`);
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Alertes calculées : échéances, retards, stock, documents (§11.1)     */
/* ------------------------------------------------------------------ */

/** Destinataires d'une alerte calculée : comptes actifs détenant un des rôles, avec le périmètre de ces rôles. */
async function recipientsFor(tenantId: string, roles: Role[], now: Date) {
  const rows = await db
    .select({
      userId: roleAssignments.userId,
      role: roleAssignments.role,
      scopeType: roleAssignments.scopeType,
      scopeId: roleAssignments.scopeId,
      validFrom: roleAssignments.validFrom,
      validTo: roleAssignments.validTo,
    })
    .from(roleAssignments)
    .innerJoin(user, eq(user.id, roleAssignments.userId))
    .where(and(eq(roleAssignments.tenantId, tenantId), eq(user.isActive, true), inArray(roleAssignments.role, roles)));
  const byUser = new Map<string, Scope>();
  for (const a of rows) {
    if (!isActiveAssignment(a, now)) continue;
    const current = byUser.get(a.userId) ?? { all: false, companyIds: [], siteIds: [] };
    if (current.all || a.scopeType === "TENANT") {
      byUser.set(a.userId, { all: true });
      continue;
    }
    if (a.scopeType === "COMPANY" && a.scopeId) current.companyIds.push(a.scopeId);
    if (a.scopeType === "SITE" && a.scopeId) current.siteIds.push(a.scopeId);
    byUser.set(a.userId, current);
  }
  return [...byUser.entries()];
}

/** Heure d'envoi des récapitulatifs quotidiens, dans le fuseau d'exploitation (NOT-04). */
const digestHour = () => Number(process.env.EMAIL_DIGEST_HOUR ?? 7);

/**
 * Alertes calculées de tous les groupes. Récapitulatifs une fois par jour à partir de l'heure paramétrée
 * (clé : destinataire + jour) ; documents à chaque palier J-30, J-7, échu (clé : document + palier + destinataire).
 * Rejouable sans risque : les clés empêchent tout second envoi.
 */
export async function runScheduledAlerts(now: Date = new Date()) {
  const tenantRows = await db.select({ id: tenants.id }).from(tenants);
  const day = dayKey(now);
  const digest = isDigestTime(now, digestHour());
  let queued = 0;
  for (const { id: tenantId } of tenantRows) {
    if (digest) {
      queued += await dueDigest(tenantId, now, day);
      queued += await overdueDigest(tenantId, now, day);
      queued += await stockDigest(tenantId, now, day);
    }
    queued += await documentExpiries(tenantId, now);
  }
  return { queued, digest };
}

async function queueDigest(tenantId: string, userId: string, event: EmailEvent, day: string, content: EmailContent) {
  if (!content.items?.length) return 0;
  return (await enqueueEmail(db, { tenantId, userId, event, dedupKey: `${event}:${day}:${userId}`, content })) ? 1 : 0;
}

async function dueDigest(tenantId: string, now: Date, day: string) {
  let queued = 0;
  for (const [userId, scope] of await recipientsFor(tenantId, EMAIL_EVENT_DEFINITIONS.DUE_DIGEST.roles!, now)) {
    const rows = await db
      .select({
        code: equipment.code,
        equipmentId: equipment.id,
        operation: planOperations.name,
        status: dueItems.status,
        dueDate: dueItems.dueDate,
        dueMeter: dueItems.dueMeterValue,
      })
      .from(dueItems)
      .innerJoin(equipment, eq(equipment.id, dueItems.equipmentId))
      .innerJoin(planOperations, eq(planOperations.id, dueItems.operationId))
      .where(
        and(
          eq(equipment.tenantId, tenantId),
          inArray(dueItems.status, ["PRE_ALERT", "DUE"]),
          scopeWhere(scope, equipment.companyId, equipment.siteId),
        ),
      )
      .orderBy(asc(dueItems.projectedDate))
      .limit(100);
    queued += await queueDigest(tenantId, userId, "DUE_DIGEST", day, {
      title: `${rows.length} échéance(s) de maintenance à préparer`,
      intro: "Échéances préventives en pré-alerte ou échues dans votre périmètre :",
      items: rows.map((r) => ({
        label: `${r.code} — ${r.operation}`,
        detail: `${r.status === "DUE" ? "échue" : "pré-alerte"}${r.dueDate ? `, le ${formatDate(r.dueDate)}` : ""}${r.dueMeter != null ? `, à ${formatNumber(r.dueMeter)}` : ""}`,
        link: `/equipements/${r.equipmentId}`,
      })),
      link: "/preventif/echeances",
      linkLabel: "Voir les échéances",
    });
  }
  return queued;
}

/** OT en attente depuis plus de 5 jours (§11.1). */
const HOLD_DAYS = 5;

async function overdueDigest(tenantId: string, now: Date, day: string) {
  let queued = 0;
  const holdLimit = new Date(now.getTime() - HOLD_DAYS * 86_400_000);
  for (const [userId, scope] of await recipientsFor(tenantId, EMAIL_EVENT_DEFINITIONS.OVERDUE.roles!, now)) {
    const late = await db
      .select({ code: equipment.code, equipmentId: equipment.id, operation: planOperations.name, dueDate: dueItems.dueDate })
      .from(dueItems)
      .innerJoin(equipment, eq(equipment.id, dueItems.equipmentId))
      .innerJoin(planOperations, eq(planOperations.id, dueItems.operationId))
      .where(and(eq(equipment.tenantId, tenantId), eq(dueItems.status, "OVERDUE"), scopeWhere(scope, equipment.companyId, equipment.siteId)))
      .limit(100);
    // Date de mise en attente : dernier passage « en attente » de l'historique (référence extérieure écrite en clair).
    const held = await db
      .select({ id: workOrders.id, number: workOrders.number, title: workOrders.title })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.tenantId, tenantId),
          eq(workOrders.status, "ON_HOLD"),
          scopeWhere(scope, workOrders.companyId, workOrders.siteId),
          sql`(select max(h.created_at) from work_order_status_history h where h.work_order_id = "work_orders"."id" and h.to_status = 'ON_HOLD') <= ${holdLimit}`,
        ),
      )
      .limit(100);
    queued += await queueDigest(tenantId, userId, "OVERDUE", day, {
      title: `${late.length + held.length} retard(s) à traiter`,
      intro: "Préventifs en retard au-delà de la tolérance et OT en attente depuis plus de 5 jours :",
      items: [
        ...late.map((r) => ({
          label: `${r.code} — ${r.operation}`,
          detail: `en retard${r.dueDate ? ` depuis le ${formatDate(r.dueDate)}` : ""}`,
          link: `/equipements/${r.equipmentId}`,
        })),
        ...held.map((w) => ({
          label: `${w.number} — ${w.title}`,
          detail: `en attente depuis plus de ${HOLD_DAYS} jours`,
          link: `/ordres-de-travail/${w.id}`,
        })),
      ],
      link: "/ordres-de-travail?status=ON_HOLD",
      linkLabel: "Voir les OT en attente",
    });
  }
  return queued;
}

async function stockDigest(tenantId: string, now: Date, day: string) {
  let queued = 0;
  for (const [userId, scope] of await recipientsFor(tenantId, EMAIL_EVENT_DEFINITIONS.STOCK_ALERT.roles!, now)) {
    const rows = await db
      .select({
        sku: parts.sku,
        name: parts.name,
        unit: parts.unit,
        partId: parts.id,
        warehouse: warehouses.name,
        onHand: stockLevels.onHand,
        reserved: stockLevels.reserved,
        reorderPoint: stockLevels.reorderPoint,
      })
      .from(stockLevels)
      .innerJoin(parts, eq(parts.id, stockLevels.partId))
      .innerJoin(warehouses, eq(warehouses.id, stockLevels.warehouseId))
      .innerJoin(sites, eq(sites.id, warehouses.siteId))
      .where(
        and(
          eq(stockLevels.tenantId, tenantId),
          isNotNull(stockLevels.reorderPoint),
          sql`${stockLevels.onHand} - ${stockLevels.reserved} <= ${stockLevels.reorderPoint}`,
          scopeWhere(scope, sites.companyId, sites.id),
        ),
      )
      .orderBy(asc(parts.sku))
      .limit(200);
    queued += await queueDigest(tenantId, userId, "STOCK_ALERT", day, {
      title: `${rows.length} article(s) sous le point de commande`,
      intro: "Articles dont le stock disponible est au point de commande ou en dessous :",
      items: rows.map((r) => ({
        label: `${r.sku} — ${r.name} (${r.warehouse})`,
        detail: `disponible ${formatNumber(r.onHand - r.reserved)} ${r.unit}, point de commande ${formatNumber(r.reorderPoint ?? 0)}`,
        link: `/stock/articles/${r.partId}`,
      })),
      link: "/stock?belowReorder=true",
      linkLabel: "Voir le stock",
    });
  }
  return queued;
}

const STAGE_LABEL = { J30: "expire dans moins de 30 jours", J7: "expire dans moins de 7 jours", J0: "est expiré" } as const;

async function documentExpiries(tenantId: string, now: Date) {
  const horizon = new Date(now.getTime() + 30 * 86_400_000);
  const docs = await db
    .select({
      id: documents.id,
      title: documents.title,
      expiresAt: documents.expiresAt,
      companyId: documents.companyId,
      siteId: documents.siteId,
      entityType: documents.entityType,
      entityId: documents.entityId,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, tenantId),
        isNull(documents.deletedAt),
        isNotNull(documents.expiresAt),
        lte(documents.expiresAt, horizon),
        gte(documents.expiresAt, new Date(now.getTime() - 30 * 86_400_000)),
      ),
    );
  if (docs.length === 0) return 0;
  const recipients = await recipientsFor(tenantId, EMAIL_EVENT_DEFINITIONS.DOCUMENT_EXPIRY.roles!, now);
  let queued = 0;
  for (const doc of docs) {
    const stage = documentExpiryStage(doc.expiresAt!, now);
    if (!stage) continue;
    for (const [userId, scope] of recipients) {
      const inScope = scope.all || scope.companyIds.includes(doc.companyId) || (!!doc.siteId && scope.siteIds.includes(doc.siteId));
      if (!inScope) continue;
      const ok = await enqueueEmail(db, {
        tenantId,
        userId,
        event: "DOCUMENT_EXPIRY",
        dedupKey: `DOCUMENT_EXPIRY:${doc.id}:${stage}:${userId}`,
        content: {
          title: `Document « ${doc.title} » : ${STAGE_LABEL[stage]}`,
          intro: `Le document « ${doc.title} » ${STAGE_LABEL[stage]} (échéance le ${formatDate(doc.expiresAt!)}). Prévoir son renouvellement.`,
          link: linkOf(doc.entityType === "EQUIPMENT" ? "equipment" : "work_order", doc.entityId),
          linkLabel: "Ouvrir la fiche",
        },
      });
      if (ok) queued++;
    }
  }
  return queued;
}

/* ------------------------------------------------------------------ */
/* Préférences                                                          */
/* ------------------------------------------------------------------ */

export async function getMyEmailPreferences(ctx: AuthContext) {
  const rows = await db.select().from(emailPreferences).where(eq(emailPreferences.userId, ctx.userId));
  const saved = new Map(rows.map((r) => [r.event, r.enabled]));
  return EMAIL_EVENTS.map((event) => ({ event, ...EMAIL_EVENT_DEFINITIONS[event], enabled: wantsEmail(event, Object.fromEntries(saved)) }));
}

export const preferencesInput = z.object({ enabled: z.array(z.enum(EMAIL_EVENTS)).default([]) });

/** Les alertes cochées sont envoyées ; les alertes obligatoires restent actives quoi qu'il arrive. */
export async function updateMyEmailPreferences(ctx: AuthContext, raw: unknown) {
  const input = parseInput(preferencesInput, raw);
  const enabled = new Set(input.enabled);
  await db.transaction(async (tx) => {
    for (const event of EMAIL_EVENTS) {
      const value = EMAIL_EVENT_DEFINITIONS[event].mandatory || enabled.has(event);
      await tx
        .insert(emailPreferences)
        .values({ userId: ctx.userId, event, enabled: value })
        .onConflictDoUpdate({ target: [emailPreferences.userId, emailPreferences.event], set: { enabled: value, updatedAt: new Date() } });
    }
    await audit(tx, ctx, { entityType: "user", entityId: ctx.userId, action: "email_preferences", after: { enabled: [...enabled] } });
  });
}

/* ------------------------------------------------------------------ */
/* Suivi des envois (administrateur)                                    */
/* ------------------------------------------------------------------ */

export const outboxFilters = z.object({ status: z.enum(["PENDING", "SENT", "FAILED", "CANCELLED"]).optional() });

export async function listOutbox(ctx: AuthContext, raw: unknown = {}) {
  assertCan(ctx, "settings.manage");
  const f = parseInput(outboxFilters, raw);
  const where = and(eq(emailOutbox.tenantId, ctx.tenantId), f.status ? eq(emailOutbox.status, f.status) : undefined);
  const [items, stats] = await Promise.all([
    db
      .select({
        id: emailOutbox.id,
        toAddress: emailOutbox.toAddress,
        event: emailOutbox.event,
        subject: emailOutbox.subject,
        status: emailOutbox.status,
        attempts: emailOutbox.attempts,
        lastError: emailOutbox.lastError,
        errors: emailOutbox.errors,
        nextAttemptAt: emailOutbox.nextAttemptAt,
        createdAt: emailOutbox.createdAt,
        sentAt: emailOutbox.sentAt,
        transport: emailOutbox.transport,
      })
      .from(emailOutbox)
      .where(where)
      .orderBy(desc(emailOutbox.createdAt))
      .limit(200),
    db.select({ status: emailOutbox.status, n: count() }).from(emailOutbox).where(eq(emailOutbox.tenantId, ctx.tenantId)).groupBy(emailOutbox.status),
  ]);
  return { items, stats: Object.fromEntries(stats.map((s) => [s.status, s.n])) as Partial<Record<string, number>> };
}

async function loadEmail(ctx: AuthContext, id: string) {
  assertCan(ctx, "settings.manage");
  if (!z.uuid().safeParse(id).success) throw new NotFoundError("Courriel");
  const [row] = await db
    .select()
    .from(emailOutbox)
    .where(and(eq(emailOutbox.id, id), eq(emailOutbox.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Courriel");
  return row;
}

/** Relance d'un courriel en échec (après correction de l'adresse ou du serveur) : nouvelles tentatives. */
export async function retryEmail(ctx: AuthContext, id: string) {
  const row = await loadEmail(ctx, id);
  await db.transaction(async (tx) => {
    await tx
      .update(emailOutbox)
      .set({ status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lockedUntil: null })
      .where(eq(emailOutbox.id, row.id));
    await audit(tx, ctx, { entityType: "email", entityId: row.id, action: "retry", before: { status: row.status, lastError: row.lastError } });
  });
}

export async function cancelEmail(ctx: AuthContext, id: string) {
  const row = await loadEmail(ctx, id);
  await db.transaction(async (tx) => {
    await tx
      .update(emailOutbox)
      .set({ status: "CANCELLED", lockedUntil: null })
      .where(and(eq(emailOutbox.id, row.id), eq(emailOutbox.status, "PENDING")));
    await audit(tx, ctx, { entityType: "email", entityId: row.id, action: "cancel" });
  });
}

/** Traitement immédiat (écran d'administration, tâche planifiée externe) : alertes calculées puis file d'envoi. */
export async function runEmailJobsNow(ctx: AuthContext) {
  assertCan(ctx, "settings.manage");
  const alerts = await runScheduledAlerts();
  const queue = await processEmailQueue();
  return { ...alerts, ...queue };
}
