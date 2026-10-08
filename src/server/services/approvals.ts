import "server-only";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { isActiveAssignment, type AuthContext } from "@/server/authz/context";
import { ROLES, type Role } from "@/server/authz/permissions";
import { db, type DbOrTx } from "@/server/db";
import {
  approvalDecisions,
  approvalRequests,
  approvalSteps,
  approvalSubstitutes,
  approvalWorkflows,
  companies,
  purchaseRequests,
  roleAssignments,
  user,
  workOrderCosts,
  workRequests,
} from "@/server/db/schema";
import {
  APPROVAL_OBJECTS,
  afterDecision,
  applicableSteps,
  checkDecision,
  checkStepDefinition,
  isActiveSubstitution,
  type ApprovalObject,
  type RequestStep,
} from "@/server/domain/approvals";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/server/errors";
import { date, optionalText, text } from "@/server/validation";
import { assertCan, audit, parseInput } from "./_shared";
import { releaseEquipmentIfFree } from "./equipment-status";
import { notifyUsers } from "./notifications";
import { isUniqueViolation } from "./organization";

/* ------------------------------------------------------------------ */
/* Valideurs : rôle dans le périmètre de l'objet, personne nommée, suppléant */
/* ------------------------------------------------------------------ */

type Target = { companyId: string; siteId: string | null };

type AssignmentRow = {
  userId: string;
  role: Role;
  scopeType: "TENANT" | "COMPANY" | "SITE";
  scopeId: string | null;
  validFrom: Date | null;
  validTo: Date | null;
};

/** Affectations de rôle des comptes actifs du groupe, chargées une fois par opération. */
async function loadValidators(tx: DbOrTx, tenantId: string, now: Date) {
  const rows = await tx
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
    .where(and(eq(roleAssignments.tenantId, tenantId), eq(user.isActive, true)));
  const substitutions = await tx
    .select({
      userId: approvalSubstitutes.userId,
      substituteUserId: approvalSubstitutes.substituteUserId,
      validFrom: approvalSubstitutes.validFrom,
      validTo: approvalSubstitutes.validTo,
    })
    .from(approvalSubstitutes)
    .where(eq(approvalSubstitutes.tenantId, tenantId));
  const active = (rows as AssignmentRow[]).filter((a) => isActiveAssignment(a, now));
  const activeSubstitutions = substitutions.filter((s) => isActiveSubstitution(s, now));
  const activeUsers = new Set(active.map((a) => a.userId));

  /** Valideur direct de l'étape : personne nommée, ou rôle détenu sur la société ou le site de l'objet. */
  const isDirect = (userId: string, step: RequestStep, target: Target) => {
    if (step.approverUserId) return step.approverUserId === userId && activeUsers.has(userId);
    return active.some(
      (a) =>
        a.userId === userId &&
        a.role === step.approverRole &&
        (a.scopeType === "TENANT" ||
          (a.scopeType === "COMPANY" && a.scopeId === target.companyId) ||
          (a.scopeType === "SITE" && a.scopeId === target.siteId)),
    );
  };

  /** Droit de décider : directement, ou comme suppléant d'un valideur direct (décision « pour le compte de »). */
  const eligibility = (userId: string, step: RequestStep, target: Target): { eligible: boolean; onBehalfOf: string | null } => {
    if (isDirect(userId, step, target)) return { eligible: true, onBehalfOf: null };
    const delegator = activeSubstitutions.find((s) => s.substituteUserId === userId && isDirect(s.userId, step, target));
    return delegator ? { eligible: true, onBehalfOf: delegator.userId } : { eligible: false, onBehalfOf: null };
  };

  /** Personnes à prévenir pour une étape : valideurs directs et leurs suppléants en cours. */
  const recipients = (step: RequestStep, target: Target) => {
    const direct = new Set<string>();
    if (step.approverUserId) direct.add(step.approverUserId);
    else for (const a of active) if (isDirect(a.userId, step, target)) direct.add(a.userId);
    for (const s of activeSubstitutions) if (direct.has(s.userId)) direct.add(s.substituteUserId);
    return [...direct];
  };

  return { eligibility, recipients };
}

/* ------------------------------------------------------------------ */
/* Soumission                                                           */
/* ------------------------------------------------------------------ */

export type ApprovalSubject = {
  objectType: ApprovalObject;
  objectId: string;
  companyId: string;
  siteId: string | null;
  label: string;
  amount?: number | null;
  priority?: string | null;
  /** Demandeur : il ne pourra pas décider lui-même (ACH-02). */
  requestedById: string;
  /** Lien de l'objet dans l'application, pour les notifications. */
  entityType: string;
};

/** Circuit applicable : celui de la société s'il existe et est actif, sinon celui du groupe. */
async function findWorkflow(tx: DbOrTx, tenantId: string, objectType: ApprovalObject, companyId: string) {
  const rows = await tx
    .select()
    .from(approvalWorkflows)
    .where(
      and(
        eq(approvalWorkflows.tenantId, tenantId),
        eq(approvalWorkflows.objectType, objectType),
        eq(approvalWorkflows.active, true),
        or(eq(approvalWorkflows.companyId, companyId), isNull(approvalWorkflows.companyId)),
      ),
    );
  return rows.find((w) => w.companyId === companyId) ?? rows.find((w) => w.companyId === null) ?? null;
}

/**
 * Soumet un objet à son circuit (HAB-04). Renvoie null si aucune étape ne s'applique (pas de validation
 * requise). Les étapes applicables sont figées dans la demande ; les valideurs de la première sont notifiés.
 */
export async function startApproval(tx: DbOrTx, ctx: AuthContext, subject: ApprovalSubject, now: Date = new Date()) {
  const workflow = await findWorkflow(tx, ctx.tenantId, subject.objectType, subject.companyId);
  if (!workflow) return null;
  const steps = await tx.select().from(approvalSteps).where(eq(approvalSteps.workflowId, workflow.id)).orderBy(asc(approvalSteps.position));
  const applicable = applicableSteps(
    steps.map((s) => ({ ...s, approverRole: s.approverRole as Role | null })),
    { amount: subject.amount, priority: subject.priority },
  );
  if (applicable.length === 0) return null;

  const [request] = await tx
    .insert(approvalRequests)
    .values({
      tenantId: ctx.tenantId,
      companyId: subject.companyId,
      siteId: subject.siteId,
      objectType: subject.objectType,
      objectId: subject.objectId,
      label: subject.label,
      amount: subject.amount ?? null,
      workflowId: workflow.id,
      steps: applicable,
      currentPosition: applicable[0].position,
      requestedById: subject.requestedById,
    })
    .returning();
  await audit(tx, ctx, { entityType: "approval", entityId: request.id, action: "approval.submit", after: { ...subject, steps: applicable } });

  const validators = await loadValidators(tx, ctx.tenantId, now);
  const target = { companyId: subject.companyId, siteId: subject.siteId };
  await notifyUsers(
    tx,
    ctx.tenantId,
    validators.recipients(applicable[0], target).filter((id) => id !== subject.requestedById),
    {
      type: "approval.pending",
      dedupKey: `approval:${request.id}:${applicable[0].position}`,
      title: `À valider : ${subject.label}`,
      body: `${applicable[0].name}${subject.amount != null ? ` — ${subject.amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}` : ""}`,
      entityType: "approval",
      entityId: request.id,
    },
  );
  return request;
}

/** Annule la demande en attente d'un objet (objet annulé, rejeté ou traité par ailleurs). */
export async function cancelPendingApproval(tx: DbOrTx, ctx: AuthContext, objectType: ApprovalObject, objectId: string, reason: string) {
  const [cancelled] = await tx
    .update(approvalRequests)
    .set({ status: "CANCELLED", decidedAt: new Date(), currentPosition: null })
    .where(and(eq(approvalRequests.objectType, objectType), eq(approvalRequests.objectId, objectId), eq(approvalRequests.status, "PENDING")))
    .returning({ id: approvalRequests.id });
  if (cancelled) await audit(tx, ctx, { entityType: "approval", entityId: cancelled.id, action: "approval.cancel", after: { reason } });
}

/** Dernière demande de validation d'un objet (pour bloquer les étapes suivantes tant qu'elle est en attente). */
export async function latestApproval(tx: DbOrTx, objectType: ApprovalObject, objectId: string) {
  const [row] = await tx
    .select()
    .from(approvalRequests)
    .where(and(eq(approvalRequests.objectType, objectType), eq(approvalRequests.objectId, objectId)))
    .orderBy(desc(approvalRequests.createdAt))
    .limit(1);
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/* Décision                                                             */
/* ------------------------------------------------------------------ */

export const decisionInput = z.object({
  decision: z.enum(["APPROVED", "REJECTED"], "Décision attendue : APPROVED ou REJECTED"),
  comment: optionalText(1000),
});

const OBJECT_LABEL: Record<ApprovalObject, string> = {
  WORK_REQUEST: "demande d'intervention",
  PURCHASE_REQUEST: "demande d'achat",
  MAINTENANCE_EXPENSE: "dépense de maintenance",
};

/**
 * Approbation ou refus de l'étape en cours (HAB-04). Contrôles : demande en attente, valideur de l'étape
 * (ou suppléant), pas le demandeur, pas deux étapes par la même personne, commentaire en cas de refus.
 * La décision est tracée en ajout seul ; la décision finale est appliquée à l'objet dans la même transaction.
 */
export async function decideApproval(ctx: AuthContext, requestId: string, raw: unknown, now: Date = new Date()) {
  const input = parseInput(decisionInput, raw);
  if (!z.uuid().safeParse(requestId).success) throw new NotFoundError("Demande de validation");
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(approvalRequests)
      .where(and(eq(approvalRequests.id, requestId), eq(approvalRequests.tenantId, ctx.tenantId)))
      .for("update");
    if (!request) throw new NotFoundError("Demande de validation");

    const step = request.steps.find((s) => s.position === request.currentPosition) ?? null;
    const target = { companyId: request.companyId, siteId: request.siteId };
    const validators = await loadValidators(tx, ctx.tenantId, now);
    const { eligible, onBehalfOf } = step ? validators.eligibility(ctx.userId, step, target) : { eligible: false, onBehalfOf: null };
    // Ni valideur, ni demandeur : la demande n'est pas révélée (HAB-02).
    if (!eligible && request.requestedById !== ctx.userId && request.status === "PENDING") throw new NotFoundError("Demande de validation");

    const previous = await tx
      .select({ decidedById: approvalDecisions.decidedById })
      .from(approvalDecisions)
      .where(and(eq(approvalDecisions.requestId, request.id), eq(approvalDecisions.decision, "APPROVED")));
    const errors = checkDecision({
      status: request.status,
      decision: input.decision,
      comment: input.comment,
      actorId: ctx.userId,
      requesterId: request.requestedById,
      eligible,
      previousApproverIds: previous.map((p) => p.decidedById),
    });
    if (errors.length > 0) throw new BusinessRuleError(errors);

    await tx.insert(approvalDecisions).values({
      tenantId: ctx.tenantId,
      requestId: request.id,
      stepPosition: step!.position,
      stepName: step!.name,
      decision: input.decision,
      comment: input.comment ?? null,
      decidedById: ctx.userId,
      onBehalfOfId: onBehalfOf,
    });
    const next = afterDecision(request.steps, step!.position, input.decision);
    const [updated] = await tx
      .update(approvalRequests)
      .set({ status: next.status, currentPosition: next.nextPosition, decidedAt: next.status === "PENDING" ? null : now })
      .where(eq(approvalRequests.id, request.id))
      .returning();
    await audit(tx, ctx, {
      entityType: "approval",
      entityId: request.id,
      action: input.decision === "APPROVED" ? "approval.approve" : "approval.reject",
      before: { status: request.status, step: step!.name },
      after: { status: next.status, comment: input.comment ?? null, onBehalfOf },
    });

    if (next.status === "PENDING") {
      const nextStep = request.steps.find((s) => s.position === next.nextPosition)!;
      await notifyUsers(
        tx,
        ctx.tenantId,
        validators.recipients(nextStep, target).filter((id) => id !== request.requestedById && id !== ctx.userId),
        {
          type: "approval.pending",
          dedupKey: `approval:${request.id}:${nextStep.position}`,
          title: `À valider : ${request.label}`,
          body: nextStep.name,
          entityType: "approval",
          entityId: request.id,
        },
      );
    } else {
      await applyOutcome(tx, ctx, request, next.status, input.comment ?? null);
      await notifyUsers(
        tx,
        ctx.tenantId,
        [request.requestedById].filter((id) => id !== ctx.userId),
        {
          type: next.status === "APPROVED" ? "approval.approved" : "approval.rejected",
          dedupKey: `approval-decision:${request.id}`,
          title: `${next.status === "APPROVED" ? "Validée" : "Refusée"} : ${request.label}`,
          body: input.comment ?? `Votre ${OBJECT_LABEL[request.objectType]} a été ${next.status === "APPROVED" ? "validée" : "refusée"}.`,
          entityType: "approval",
          entityId: request.id,
        },
      );
    }
    return updated;
  });
}

/** Effet de la décision finale sur l'objet validé, dans la transaction de la décision. */
async function applyOutcome(
  tx: DbOrTx,
  ctx: AuthContext,
  request: typeof approvalRequests.$inferSelect,
  status: "APPROVED" | "REJECTED",
  comment: string | null,
) {
  if (request.objectType === "PURCHASE_REQUEST") {
    await tx
      .update(purchaseRequests)
      .set({ status })
      .where(and(eq(purchaseRequests.id, request.objectId), eq(purchaseRequests.status, "PENDING_APPROVAL")));
    return;
  }
  if (request.objectType === "MAINTENANCE_EXPENSE") {
    await tx
      .update(workOrderCosts)
      .set({ approvalStatus: status })
      .where(and(eq(workOrderCosts.id, request.objectId), eq(workOrderCosts.approvalStatus, "PENDING")));
    return;
  }
  // DI : validée, elle peut être transformée en OT ; refusée, elle est rejetée avec le commentaire.
  if (status === "REJECTED") {
    const [current] = await tx.select().from(workRequests).where(eq(workRequests.id, request.objectId));
    if (!current || !["NEW", "QUALIFIED"].includes(current.status)) return;
    await tx
      .update(workRequests)
      .set({
        status: "REJECTED",
        rejectionReason: `Refusée en validation : ${comment ?? ""}`.trim(),
        qualifiedById: ctx.userId,
        qualifiedAt: new Date(),
      })
      .where(eq(workRequests.id, current.id));
    if (current.immobilize) {
      await releaseEquipmentIfFree(tx, ctx, current.equipmentId, {
        reason: `DI ${current.number} refusée en validation`,
        excludeRequestId: current.id,
      });
    }
    await audit(tx, ctx, { entityType: "work_request", entityId: current.id, action: "reject", before: current, after: { reason: comment } });
  }
}

/* ------------------------------------------------------------------ */
/* Consultation                                                         */
/* ------------------------------------------------------------------ */

const requester = user;

/** Demandes en attente que l'utilisateur peut trancher (directement ou comme suppléant). */
export async function listPendingForMe(ctx: AuthContext, now: Date = new Date()) {
  const pending = await db
    .select({ request: approvalRequests, requesterName: requester.name, companyName: companies.name })
    .from(approvalRequests)
    .innerJoin(requester, eq(requester.id, approvalRequests.requestedById))
    .innerJoin(companies, eq(companies.id, approvalRequests.companyId))
    .where(and(eq(approvalRequests.tenantId, ctx.tenantId), eq(approvalRequests.status, "PENDING")))
    .orderBy(asc(approvalRequests.createdAt))
    .limit(500);
  if (pending.length === 0) return [];
  const validators = await loadValidators(db, ctx.tenantId, now);
  const approvedBy = await db
    .select({ requestId: approvalDecisions.requestId, decidedById: approvalDecisions.decidedById })
    .from(approvalDecisions)
    .where(
      and(
        inArray(
          approvalDecisions.requestId,
          pending.map((p) => p.request.id),
        ),
        eq(approvalDecisions.decision, "APPROVED"),
      ),
    );
  return pending
    .map(({ request, requesterName, companyName }) => {
      const step = request.steps.find((s) => s.position === request.currentPosition);
      if (!step || request.requestedById === ctx.userId) return null;
      if (approvedBy.some((a) => a.requestId === request.id && a.decidedById === ctx.userId)) return null;
      const { eligible, onBehalfOf } = validators.eligibility(ctx.userId, step, request);
      if (!eligible) return null;
      return { ...request, step, requesterName, companyName, onBehalfOf, link: objectLink(request.objectType, request.objectId) };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

/** Demandes soumises par l'utilisateur. */
export async function listMyApprovalRequests(ctx: AuthContext, limit = 30) {
  return db
    .select()
    .from(approvalRequests)
    .where(and(eq(approvalRequests.tenantId, ctx.tenantId), eq(approvalRequests.requestedById, ctx.userId)))
    .orderBy(desc(approvalRequests.createdAt))
    .limit(limit);
}

/** Lien de l'objet validé dans l'application. */
export function objectLink(objectType: ApprovalObject, objectId: string, workOrderId?: string | null) {
  if (objectType === "WORK_REQUEST") return `/demandes/${objectId}`;
  if (objectType === "PURCHASE_REQUEST") return `/demandes-achat/${objectId}`;
  return workOrderId ? `/ordres-de-travail/${workOrderId}` : "/validations";
}

/**
 * Historique des validations d'un objet, à afficher sur sa fiche (l'appelant a vérifié l'accès à l'objet) :
 * étapes, décisions avec auteur et commentaire, et droit de l'utilisateur de trancher l'étape en cours.
 */
export async function approvalTimeline(ctx: AuthContext, objectType: ApprovalObject, objectIds: string[], now: Date = new Date()) {
  if (objectIds.length === 0) return [];
  const requests = await db
    .select()
    .from(approvalRequests)
    .where(
      and(eq(approvalRequests.tenantId, ctx.tenantId), eq(approvalRequests.objectType, objectType), inArray(approvalRequests.objectId, objectIds)),
    )
    .orderBy(desc(approvalRequests.createdAt));
  if (requests.length === 0) return [];
  const decisions = await db
    .select({
      requestId: approvalDecisions.requestId,
      stepPosition: approvalDecisions.stepPosition,
      stepName: approvalDecisions.stepName,
      decision: approvalDecisions.decision,
      comment: approvalDecisions.comment,
      createdAt: approvalDecisions.createdAt,
      decidedBy: user.name,
      decidedById: approvalDecisions.decidedById,
      onBehalfOfId: approvalDecisions.onBehalfOfId,
    })
    .from(approvalDecisions)
    .innerJoin(user, eq(user.id, approvalDecisions.decidedById))
    .where(
      inArray(
        approvalDecisions.requestId,
        requests.map((r) => r.id),
      ),
    )
    .orderBy(asc(approvalDecisions.createdAt));
  const names = await userNames([
    ...new Set([...requests.map((r) => r.requestedById), ...decisions.map((d) => d.onBehalfOfId).filter((v): v is string => !!v)]),
  ]);
  const validators = await loadValidators(db, ctx.tenantId, now);
  return requests.map((r) => {
    const step = r.steps.find((s) => s.position === r.currentPosition) ?? null;
    const own = decisions.filter((d) => d.requestId === r.id);
    const errors =
      r.status === "PENDING" && step
        ? checkDecision({
            status: r.status,
            decision: "APPROVED",
            actorId: ctx.userId,
            requesterId: r.requestedById,
            eligible: validators.eligibility(ctx.userId, step, r).eligible,
            previousApproverIds: own.filter((d) => d.decision === "APPROVED").map((d) => d.decidedById),
          })
        : ["closed"];
    return {
      ...r,
      requesterName: names.get(r.requestedById) ?? null,
      currentStep: step,
      decisions: own.map((d) => ({ ...d, onBehalfOf: d.onBehalfOfId ? (names.get(d.onBehalfOfId) ?? null) : null })),
      canDecide: errors.length === 0,
    };
  });
}

async function userNames(ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Fiche d'une demande de validation (API) : réservée au demandeur, aux valideurs et aux administrateurs. */
export async function getApprovalRequest(ctx: AuthContext, id: string) {
  if (!z.uuid().safeParse(id).success) throw new NotFoundError("Demande de validation");
  const [request] = await db
    .select()
    .from(approvalRequests)
    .where(and(eq(approvalRequests.id, id), eq(approvalRequests.tenantId, ctx.tenantId)));
  if (!request) throw new NotFoundError("Demande de validation");
  const [timeline] = await approvalTimeline(ctx, request.objectType, [request.objectId]).then((all) => all.filter((r) => r.id === id));
  const validators = await loadValidators(db, ctx.tenantId, new Date());
  const involved =
    request.requestedById === ctx.userId ||
    timeline.decisions.some((d) => d.decidedById === ctx.userId) ||
    request.steps.some((s) => validators.eligibility(ctx.userId, s, request).eligible) ||
    ctx.can("settings.manage");
  if (!involved) throw new NotFoundError("Demande de validation");
  return { ...timeline, link: objectLink(request.objectType, request.objectId) };
}

/* ------------------------------------------------------------------ */
/* Paramétrage des circuits (administrateur)                           */
/* ------------------------------------------------------------------ */

export async function listWorkflows(ctx: AuthContext) {
  assertCan(ctx, "settings.manage");
  const workflows = await db
    .select({ workflow: approvalWorkflows, companyName: companies.name })
    .from(approvalWorkflows)
    .leftJoin(companies, eq(companies.id, approvalWorkflows.companyId))
    .where(eq(approvalWorkflows.tenantId, ctx.tenantId))
    .orderBy(asc(approvalWorkflows.objectType), asc(approvalWorkflows.name));
  const steps =
    workflows.length === 0
      ? []
      : await db
          .select({ step: approvalSteps, approverName: user.name })
          .from(approvalSteps)
          .leftJoin(user, eq(user.id, approvalSteps.approverUserId))
          .where(
            inArray(
              approvalSteps.workflowId,
              workflows.map((w) => w.workflow.id),
            ),
          )
          .orderBy(asc(approvalSteps.position));
  return workflows.map(({ workflow, companyName }) => ({
    ...workflow,
    companyName,
    steps: steps.filter((s) => s.step.workflowId === workflow.id).map((s) => ({ ...s.step, approverName: s.approverName })),
  }));
}

export const workflowInput = z.object({
  objectType: z.enum(APPROVAL_OBJECTS, "Type d'objet obligatoire"),
  companyId: z.uuid().optional(),
  name: text(120, "Nom obligatoire"),
});

export async function createWorkflow(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "settings.manage");
  const input = parseInput(workflowInput, raw);
  if (input.companyId) {
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, input.companyId), eq(companies.tenantId, ctx.tenantId)));
    if (!company) throw new NotFoundError("Société");
  }
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(approvalWorkflows)
        .values({ tenantId: ctx.tenantId, objectType: input.objectType, companyId: input.companyId ?? null, name: input.name })
        .returning();
      await audit(tx, ctx, { entityType: "approval_workflow", entityId: row.id, action: "create", after: row });
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("Un circuit existe déjà pour ce type d'objet et cette société.");
    throw error;
  }
}

export const stepInput = z.object({
  name: text(120, "Nom de l'étape obligatoire"),
  approverRole: z.enum(ROLES).optional(),
  approverUserId: z.string().trim().min(1).optional(),
  minAmount: z.coerce.number().min(0, "Le seuil doit être positif").optional(),
  priorities: z.array(z.enum(["P1", "P2", "P3", "P4"])).default([]),
});

async function loadWorkflow(ctx: AuthContext, workflowId: string) {
  if (!z.uuid().safeParse(workflowId).success) throw new NotFoundError("Circuit");
  const [workflow] = await db
    .select()
    .from(approvalWorkflows)
    .where(and(eq(approvalWorkflows.id, workflowId), eq(approvalWorkflows.tenantId, ctx.tenantId)));
  if (!workflow) throw new NotFoundError("Circuit");
  return workflow;
}

/** Ajoute une étape en fin de circuit. Les demandes déjà soumises gardent leurs étapes figées. */
export async function addStep(ctx: AuthContext, workflowId: string, raw: unknown) {
  assertCan(ctx, "settings.manage");
  const input = parseInput(stepInput, raw);
  const workflow = await loadWorkflow(ctx, workflowId);
  const errors = checkStepDefinition({
    approverRole: input.approverRole ?? null,
    approverUserId: input.approverUserId ?? null,
    minAmount: input.minAmount ?? null,
  });
  if (input.approverUserId) {
    const [u] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, input.approverUserId), eq(user.tenantId, ctx.tenantId), eq(user.isActive, true)));
    if (!u) errors.push("Valideur nommé introuvable ou désactivé.");
  }
  if (errors.length > 0) throw new BusinessRuleError(errors);
  return db.transaction(async (tx) => {
    const existing = await tx.select({ position: approvalSteps.position }).from(approvalSteps).where(eq(approvalSteps.workflowId, workflow.id));
    const position = Math.max(0, ...existing.map((s) => s.position)) + 1;
    const [row] = await tx
      .insert(approvalSteps)
      .values({
        workflowId: workflow.id,
        position,
        name: input.name,
        approverRole: input.approverRole ?? null,
        approverUserId: input.approverUserId ?? null,
        minAmount: input.minAmount ?? null,
        priorities: input.priorities,
      })
      .returning();
    await audit(tx, ctx, { entityType: "approval_workflow", entityId: workflow.id, action: "add_step", after: row });
    return row;
  });
}

export async function removeStep(ctx: AuthContext, stepId: string) {
  assertCan(ctx, "settings.manage");
  if (!z.uuid().safeParse(stepId).success) throw new NotFoundError("Étape");
  const [step] = await db
    .select({ step: approvalSteps })
    .from(approvalSteps)
    .innerJoin(approvalWorkflows, eq(approvalWorkflows.id, approvalSteps.workflowId))
    .where(and(eq(approvalSteps.id, stepId), eq(approvalWorkflows.tenantId, ctx.tenantId)));
  if (!step) throw new NotFoundError("Étape");
  await db.transaction(async (tx) => {
    await tx.delete(approvalSteps).where(eq(approvalSteps.id, stepId));
    await audit(tx, ctx, { entityType: "approval_workflow", entityId: step.step.workflowId, action: "remove_step", before: step.step });
  });
}

export async function setWorkflowActive(ctx: AuthContext, workflowId: string, active: boolean) {
  assertCan(ctx, "settings.manage");
  const workflow = await loadWorkflow(ctx, workflowId);
  await db.transaction(async (tx) => {
    await tx.update(approvalWorkflows).set({ active }).where(eq(approvalWorkflows.id, workflow.id));
    await audit(tx, ctx, { entityType: "approval_workflow", entityId: workflow.id, action: active ? "activate" : "deactivate" });
  });
}

/* ------------------------------------------------------------------ */
/* Suppléances                                                          */
/* ------------------------------------------------------------------ */

export const substituteInput = z
  .object({
    substituteUserId: z.string().trim().min(1, "Suppléant obligatoire"),
    validFrom: date("Date de début obligatoire"),
    validTo: date("Date de fin obligatoire"),
  })
  .refine((v) => v.validTo >= v.validFrom, { message: "La fin doit suivre le début", path: ["validTo"] });

/** Un valideur désigne son suppléant pour une période (CDC §2.4). */
export async function addSubstitute(ctx: AuthContext, raw: unknown) {
  const input = parseInput(substituteInput, raw);
  if (input.substituteUserId === ctx.userId) throw new BusinessRuleError(["Le suppléant doit être une autre personne."]);
  const [u] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, input.substituteUserId), eq(user.tenantId, ctx.tenantId), eq(user.isActive, true)));
  if (!u) throw new NotFoundError("Suppléant");
  // La date de fin couvre toute la journée choisie.
  const validTo = new Date(input.validTo.getTime() + 86_399_999);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(approvalSubstitutes)
      .values({ tenantId: ctx.tenantId, userId: ctx.userId, substituteUserId: input.substituteUserId, validFrom: input.validFrom, validTo })
      .returning();
    await audit(tx, ctx, { entityType: "approval_substitute", entityId: row.id, action: "create", after: row });
    return row;
  });
}

export async function removeSubstitute(ctx: AuthContext, id: string) {
  if (!z.uuid().safeParse(id).success) throw new NotFoundError("Suppléance");
  const [row] = await db
    .select()
    .from(approvalSubstitutes)
    .where(and(eq(approvalSubstitutes.id, id), eq(approvalSubstitutes.tenantId, ctx.tenantId)));
  if (!row || (row.userId !== ctx.userId && !ctx.can("users.manage"))) throw new NotFoundError("Suppléance");
  await db.transaction(async (tx) => {
    await tx.delete(approvalSubstitutes).where(eq(approvalSubstitutes.id, id));
    await audit(tx, ctx, { entityType: "approval_substitute", entityId: id, action: "delete", before: row });
  });
}

/** Suppléances données et reçues par l'utilisateur. */
export async function listMySubstitutes(ctx: AuthContext) {
  const rows = await db
    .select()
    .from(approvalSubstitutes)
    .where(
      and(
        eq(approvalSubstitutes.tenantId, ctx.tenantId),
        or(eq(approvalSubstitutes.userId, ctx.userId), eq(approvalSubstitutes.substituteUserId, ctx.userId)),
      ),
    )
    .orderBy(desc(approvalSubstitutes.validFrom));
  const names = await userNames([...new Set(rows.flatMap((r) => [r.userId, r.substituteUserId]))]);
  return rows.map((r) => ({
    ...r,
    userName: names.get(r.userId) ?? "",
    substituteName: names.get(r.substituteUserId) ?? "",
    given: r.userId === ctx.userId,
  }));
}

/** Comptes actifs du groupe (choix d'un valideur nommé ou d'un suppléant). */
export async function listUserOptions(ctx: AuthContext) {
  return db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(and(eq(user.tenantId, ctx.tenantId), eq(user.isActive, true)))
    .orderBy(asc(user.name));
}
