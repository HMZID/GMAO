import { DEFAULT_LOCALE, INTL_LOCALE, isLocale, type Locale } from "@/i18n/config";
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, count, desc, eq, gte, like, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db, type DbOrTx } from "@/server/db";
import { account, demoRequests, emailOutbox, roleAssignments, session, tenants, user } from "@/server/db/schema";
import { generateProvisionalPassword } from "@/server/domain/credentials";
import { renderDemoAccessEmail, renderDemoDeclinedEmail, renderDemoRequestEmail } from "@/server/domain/email";
import {
  DEMO_REQUEST_STATUSES,
  FLEET_SIZES,
  MAX_REQUESTS_PER_HOUR,
  SECTORS,
  organizationNameFrom,
  settingNumber,
  spamSignals,
} from "@/server/domain/site";
import { DEMO_DURATIONS, demoEndsAt, platformAdmins, tenantAccess } from "@/server/domain/tenants";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/server/errors";
import { publicUrl } from "@/server/public-url";
import { bool, text } from "@/server/validation";
import { audit, parseInput } from "./_shared";
import { enqueueDirectEmail } from "./email";
import { notifyUsers } from "./notifications";
import { assertPlatformAdmin, provisionDemoTenant } from "./platform";
import { getSiteSettings } from "./site";
import { tpl } from "@/i18n/translate";

/* ------------------------------------------------------------------ */
/* Demandes de démonstration déposées sur le site commercial           */
/* ------------------------------------------------------------------ */

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const demoRequestInput = z.object({
  company: text(120, "Société obligatoire"),
  contactName: text(120, "Nom obligatoire"),
  email: z
    .email("Courriel invalide")
    .max(200)
    .transform((v) => v.toLowerCase()),
  phone: optional(40),
  jobTitle: optional(120),
  fleetSize: z.enum(FLEET_SIZES.map((f) => f.value) as [string, ...string[]]).optional(),
  sector: z.enum(SECTORS).optional(),
  message: optional(2000),
  planInterest: optional(60),
  consent: bool.refine((v) => v, "Votre accord est nécessaire pour traiter la demande"),
  /** Champ piège, invisible pour un humain. */
  website: z.string().optional(),
  /** Ouverture du formulaire (millisecondes). */
  startedAt: z.coerce.number().optional(),
});

/** Empreinte de l'adresse IP, salée par le secret de l'application : limite les envois sans conserver l'adresse. */
function ipFingerprint(ip: string | null | undefined) {
  if (!ip) return null;
  return createHash("sha256")
    .update(`${process.env.BETTER_AUTH_SECRET ?? ""}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Administrateurs de la plateforme destinataires des alertes : rôle « Administrateur », compte actif, et
 * courriel listé dans PLATFORM_ADMIN_EMAILS quand la variable est renseignée (comme `isPlatformAdmin`).
 */
async function platformAdminRecipients(tx: DbOrTx) {
  const rows = await tx
    .selectDistinct({ id: user.id, tenantId: user.tenantId, email: user.email, name: user.name, locale: user.locale })
    .from(user)
    .innerJoin(roleAssignments, eq(roleAssignments.userId, user.id))
    .where(and(eq(roleAssignments.role, "ADMIN"), eq(user.isActive, true)));
  const allowed = platformAdmins(process.env.PLATFORM_ADMIN_EMAILS);
  return rows.filter((r) => allowed.size === 0 || allowed.has(r.email.toLowerCase()));
}

const FLEET_LABEL = Object.fromEntries(FLEET_SIZES.map((f) => [f.value, f.label]));

/**
 * Dépôt d'une demande depuis le site (visiteur anonyme). Un envoi automatisé est ignoré sans le dire ;
 * au-delà de cinq demandes par heure depuis la même connexion, la demande est refusée. Une seconde demande
 * en attente pour le même courriel ne crée pas de doublon. Les administrateurs de la plateforme sont
 * prévenus dans l'application et par courriel.
 */
export async function submitDemoRequest(raw: unknown, meta: { ip?: string | null; now?: Date; locale?: Locale } = {}) {
  const now = meta.now ?? new Date();
  const input = parseInput(demoRequestInput, raw);
  if (spamSignals({ honeypot: input.website, startedAt: input.startedAt, now: now.getTime() }).length > 0) {
    return { status: "ignored" as const };
  }
  const ipHash = ipFingerprint(meta.ip);
  if (ipHash) {
    const [recent] = await db
      .select({ n: count() })
      .from(demoRequests)
      .where(and(eq(demoRequests.ipHash, ipHash), gte(demoRequests.createdAt, new Date(now.getTime() - 3_600_000))));
    if (recent.n >= MAX_REQUESTS_PER_HOUR) throw new BusinessRuleError(["Trop de demandes depuis cette connexion : réessayez dans une heure."]);
  }
  const [pending] = await db
    .select({ id: demoRequests.id })
    .from(demoRequests)
    .where(and(eq(demoRequests.email, input.email), eq(demoRequests.status, "PENDING")));
  if (pending) return { status: "duplicate" as const, id: pending.id };

  const settings = await getSiteSettings();
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(demoRequests)
      .values({
        company: input.company,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        jobTitle: input.jobTitle,
        fleetSize: input.fleetSize ?? null,
        sector: input.sector ?? null,
        message: input.message,
        planInterest: input.planInterest,
        locale: meta.locale ?? DEFAULT_LOCALE,
        consentAt: now,
        ipHash,
      })
      .returning({ id: demoRequests.id });

    const admins = await platformAdminRecipients(tx);
    const mailFor = (locale: Locale) =>
      renderDemoRequestEmail({
        product: settings["brand.name"],
        company: input.company,
        contactName: input.contactName,
        email: input.email,
        details: [
          { label: "Fonction", value: input.jobTitle },
          { label: "Téléphone", value: input.phone },
          { label: "Parc", value: input.fleetSize ? FLEET_LABEL[input.fleetSize] : null },
          { label: "Secteur", value: input.sector },
          { label: "Offre consultée", value: input.planInterest },
        ],
        message: input.message,
        link: `${publicUrl()}/administration/site/demandes/${created.id}`,
        locale,
      });
    for (const admin of admins) {
      await notifyUsers(tx, admin.tenantId, [admin.id], {
        type: "demo_request.created",
        title: tpl`Demande de démonstration : ${input.company}`,
        body: tpl`${input.contactName} (${input.email}) demande un compte de démonstration.`,
        entityType: "demo_request",
        entityId: created.id,
      });
      await enqueueDirectEmail(tx, {
        tenantId: admin.tenantId,
        userId: admin.id,
        toAddress: admin.email,
        event: "DEMO_REQUEST",
        dedupKey: `demo_request:${created.id}:${admin.id}`,
        mail: mailFor(isLocale(admin.locale) ? admin.locale : DEFAULT_LOCALE),
      });
    }
    return { status: "created" as const, id: created.id };
  });
}

/* ------------------------------------------------------------------ */
/* Administration                                                       */
/* ------------------------------------------------------------------ */

export const demoRequestFilters = z.object({ status: z.enum(DEMO_REQUEST_STATUSES).optional() });

export async function listDemoRequests(ctx: AuthContext, raw: unknown = {}) {
  assertPlatformAdmin(ctx);
  const f = parseInput(demoRequestFilters, raw);
  const items = await db
    .select({
      id: demoRequests.id,
      company: demoRequests.company,
      contactName: demoRequests.contactName,
      email: demoRequests.email,
      fleetSize: demoRequests.fleetSize,
      sector: demoRequests.sector,
      status: demoRequests.status,
      createdAt: demoRequests.createdAt,
      decidedAt: demoRequests.decidedAt,
      tenantId: demoRequests.tenantId,
      existingAccount: sql<boolean>`exists (select 1 from "user" u where u.email = "demo_requests"."email")`,
    })
    .from(demoRequests)
    .where(f.status ? eq(demoRequests.status, f.status) : undefined)
    .orderBy(desc(demoRequests.createdAt))
    .limit(300);
  const stats = await db.select({ status: demoRequests.status, n: count() }).from(demoRequests).groupBy(demoRequests.status);
  return { items, stats: Object.fromEntries(stats.map((s) => [s.status, s.n])) as Partial<Record<string, number>> };
}

/** Nombre de demandes en attente (pastille de l'administration). */
export async function countPendingDemoRequests(ctx: AuthContext) {
  assertPlatformAdmin(ctx);
  const [row] = await db.select({ n: count() }).from(demoRequests).where(eq(demoRequests.status, "PENDING"));
  return row.n;
}

const localeOf = (value: string): Locale => (isLocale(value) ? value : DEFAULT_LOCALE);

async function loadRequest(id: string) {
  if (!z.uuid().safeParse(id).success) throw new NotFoundError("Demande");
  const [request] = await db.select().from(demoRequests).where(eq(demoRequests.id, id));
  if (!request) throw new NotFoundError("Demande");
  return request;
}

/** Une demande : décision, organisation ouverte et état du dernier courriel d'accès. */
export async function getDemoRequest(ctx: AuthContext, id: string, now = new Date()) {
  assertPlatformAdmin(ctx);
  const request = await loadRequest(id);
  const [existing] = await db.select({ id: user.id, tenantId: user.tenantId }).from(user).where(eq(user.email, request.email));
  const [decidedBy] = request.decidedById ? await db.select({ name: user.name }).from(user).where(eq(user.id, request.decidedById)) : [undefined];
  const [tenant] = request.tenantId
    ? await db
        .select({ id: tenants.id, name: tenants.name, status: tenants.status, demoEndsAt: tenants.demoEndsAt })
        .from(tenants)
        .where(eq(tenants.id, request.tenantId))
    : [undefined];
  const [account_] = request.userId
    ? await db.select({ mustChangePassword: user.mustChangePassword }).from(user).where(eq(user.id, request.userId))
    : [undefined];
  const accessEmails = request.tenantId
    ? await db
        .select({ status: emailOutbox.status, sentAt: emailOutbox.sentAt, createdAt: emailOutbox.createdAt, lastError: emailOutbox.lastError })
        .from(emailOutbox)
        .where(and(eq(emailOutbox.tenantId, request.tenantId), like(emailOutbox.dedupKey, `demo_access:${request.id}:%`)))
        .orderBy(desc(emailOutbox.createdAt))
        .limit(1)
    : [];
  return {
    request,
    decidedBy: decidedBy?.name ?? null,
    existingAccount: !!existing && existing.tenantId !== request.tenantId,
    tenant: tenant ? { ...tenant, access: tenantAccess(tenant, now) } : null,
    passwordChanged: account_ ? !account_.mustChangePassword : null,
    lastAccessEmail: accessEmails[0] ?? null,
  };
}

export const approveInput = z.object({
  organizationName: text(120, "Nom de l'organisation obligatoire"),
  adminName: text(120, "Nom du contact obligatoire"),
  durationDays: z.coerce.number().int(),
});

/** Courriel d'accès (mot de passe provisoire) mis en file dans l'organisation du client. */
async function queueAccessEmail(
  tx: DbOrTx,
  input: {
    requestId: string;
    tenantId: string;
    userId: string;
    email: string;
    name: string;
    organization: string;
    password: string;
    endsAt: Date;
    resent: boolean;
    locale: Locale;
  },
) {
  const settings = await getSiteSettings();
  const mail = renderDemoAccessEmail({
    product: settings["brand.name"],
    recipientName: input.name,
    organization: input.organization,
    login: input.email,
    password: input.password,
    loginUrl: `${publicUrl()}/login`,
    endsOn: input.endsAt.toLocaleDateString(INTL_LOCALE[input.locale], { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" }),
    resent: input.resent,
    locale: input.locale,
  });
  await enqueueDirectEmail(tx, {
    tenantId: input.tenantId,
    userId: input.userId,
    toAddress: input.email,
    event: "DEMO_ACCESS",
    dedupKey: `demo_access:${input.requestId}:${randomUUID()}`,
    mail,
  });
}

/**
 * Acceptation : organisation de démonstration ouverte pour la durée choisie, compte de la direction du
 * client avec un mot de passe provisoire (à changer à la première connexion), courriel d'accès en file.
 * Le mot de passe est rendu une seule fois à l'administrateur, pour le dicter si le courriel n'arrive pas.
 */
export async function approveDemoRequest(ctx: AuthContext, id: string, raw: unknown, now = new Date()) {
  assertPlatformAdmin(ctx);
  const request = await loadRequest(id);
  const input = parseInput(approveInput, raw);
  const errors: string[] = [];
  if (request.status !== "PENDING") errors.push("Cette demande a déjà été traitée.");
  if (!(DEMO_DURATIONS as readonly number[]).includes(input.durationDays)) errors.push("Durée de démonstration inconnue.");
  if (errors.length) throw new BusinessRuleError(errors);
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, request.email));
  if (existing)
    throw new ConflictError(tpl`Un compte existe déjà avec le courriel ${request.email} : refuser la demande ou utiliser un autre courriel.`);

  const password = generateProvisionalPassword();
  const passwordHash = await hashPassword(password);
  const endsAt = demoEndsAt(now, input.durationDays);
  const organizationName = organizationNameFrom(input.organizationName);

  const created = await db.transaction(async (tx) => {
    // Verrou de la demande : deux acceptations simultanées n'ouvrent pas deux organisations.
    const [locked] = await tx.select({ status: demoRequests.status }).from(demoRequests).where(eq(demoRequests.id, id)).for("update");
    if (locked?.status !== "PENDING") throw new BusinessRuleError(["Cette demande a déjà été traitée."]);
    const provisioned = await provisionDemoTenant(tx, ctx, {
      organizationName,
      adminName: input.adminName,
      adminEmail: request.email,
      passwordHash,
      endsAt,
      mustChangePassword: true,
      locale: localeOf(request.locale),
    });
    await tx
      .update(demoRequests)
      .set({
        status: "APPROVED",
        durationDays: input.durationDays,
        decidedAt: now,
        decidedById: ctx.impersonator?.id ?? ctx.userId,
        tenantId: provisioned.tenantId,
        userId: provisioned.userId,
        accessSentAt: now,
      })
      .where(eq(demoRequests.id, id));
    await queueAccessEmail(tx, {
      requestId: id,
      tenantId: provisioned.tenantId,
      userId: provisioned.userId,
      email: request.email,
      name: input.adminName,
      organization: organizationName,
      password,
      endsAt,
      resent: false,
      locale: localeOf(request.locale),
    });
    await audit(tx, ctx, {
      entityType: "demo_request",
      entityId: id,
      action: "approve",
      after: { tenantId: provisioned.tenantId, organizationName, durationDays: input.durationDays, demoEndsAt: endsAt },
    });
    return provisioned;
  });
  return { tenantId: created.tenantId, email: request.email, password, endsAt };
}

/**
 * Renvoi des accès (courriel perdu, mot de passe oublié avant la première connexion) : nouveau mot de passe
 * provisoire, sessions fermées. Refusé si le client a déjà choisi son mot de passe.
 */
export async function resendDemoAccess(ctx: AuthContext, id: string, now = new Date()) {
  assertPlatformAdmin(ctx);
  const request = await loadRequest(id);
  if (request.status !== "APPROVED" || !request.userId || !request.tenantId)
    throw new BusinessRuleError(["Seule une demande acceptée a des accès à renvoyer."]);
  const [target] = await db
    .select({ id: user.id, name: user.name, email: user.email, mustChangePassword: user.mustChangePassword, isActive: user.isActive })
    .from(user)
    .where(eq(user.id, request.userId));
  const [tenant] = await db.select({ name: tenants.name, demoEndsAt: tenants.demoEndsAt }).from(tenants).where(eq(tenants.id, request.tenantId));
  const errors: string[] = [];
  if (!target) errors.push("Le compte du client n'existe plus.");
  else {
    if (!target.isActive) errors.push("Le compte du client est désactivé.");
    if (!target.mustChangePassword)
      errors.push("Le client a déjà choisi son mot de passe : il le modifie lui-même, ou l'administrateur de son organisation le remplace.");
  }
  if (errors.length || !target || !tenant) throw new BusinessRuleError(errors.length ? errors : ["Organisation introuvable."]);

  const password = generateProvisionalPassword();
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx
      .update(account)
      .set({ password: passwordHash })
      .where(and(eq(account.userId, target.id), eq(account.providerId, "credential")));
    await tx.delete(session).where(eq(session.userId, target.id));
    await tx.update(demoRequests).set({ accessSentAt: now }).where(eq(demoRequests.id, id));
    await queueAccessEmail(tx, {
      requestId: id,
      tenantId: request.tenantId!,
      userId: target.id,
      email: target.email,
      name: target.name,
      organization: tenant.name,
      password,
      endsAt: tenant.demoEndsAt ?? now,
      resent: true,
      locale: localeOf(request.locale),
    });
    await audit(tx, ctx, { entityType: "demo_request", entityId: id, action: "resend_access" });
  });
  return { email: target.email, password };
}

export const rejectInput = z.object({
  reason: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => v || null),
  notify: bool,
});

/** Refus : la demande est close ; le prospect est prévenu par courriel si l'administrateur le choisit. */
export async function rejectDemoRequest(ctx: AuthContext, id: string, raw: unknown, now = new Date()) {
  assertPlatformAdmin(ctx);
  const request = await loadRequest(id);
  const input = parseInput(rejectInput, raw);
  if (request.status !== "PENDING") throw new BusinessRuleError(["Cette demande a déjà été traitée."]);
  const settings = await getSiteSettings();
  await db.transaction(async (tx) => {
    await tx
      .update(demoRequests)
      .set({ status: "REJECTED", decidedAt: now, decidedById: ctx.impersonator?.id ?? ctx.userId, decisionNote: input.reason })
      .where(and(eq(demoRequests.id, id), eq(demoRequests.status, "PENDING")));
    if (input.notify) {
      await enqueueDirectEmail(tx, {
        tenantId: ctx.tenantId,
        toAddress: request.email,
        event: "DEMO_DECISION",
        dedupKey: `demo_declined:${id}`,
        mail: renderDemoDeclinedEmail({
          product: settings["brand.name"],
          recipientName: request.contactName,
          reason: input.reason,
          contactEmail: settings["contact.email"] || null,
          locale: localeOf(request.locale),
        }),
      });
    }
    await audit(tx, ctx, { entityType: "demo_request", entityId: id, action: "reject", after: { reason: input.reason, notified: input.notify } });
  });
}

/** Effacement d'une demande (droit à l'effacement) : l'organisation éventuellement ouverte n'est pas touchée. */
export async function deleteDemoRequest(ctx: AuthContext, id: string) {
  assertPlatformAdmin(ctx);
  const request = await loadRequest(id);
  await db.transaction(async (tx) => {
    await tx.delete(demoRequests).where(eq(demoRequests.id, id));
    await audit(tx, ctx, {
      entityType: "demo_request",
      entityId: id,
      action: "delete",
      before: { company: request.company, status: request.status },
    });
  });
}

/** Durée d'essai présélectionnée à l'acceptation : réglage du site, ramené à une durée proposée. */
export async function defaultTrialDays() {
  const settings = await getSiteSettings();
  const wanted = settingNumber(settings["trial.days"], 30);
  return (DEMO_DURATIONS as readonly number[]).includes(wanted) ? wanted : 30;
}
