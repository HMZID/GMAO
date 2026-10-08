/**
 * Notifications par courriel (NOT-01, NOT-03, NOT-04, CDC §11.1) : événements, préférences, modèles,
 * reprises après échec et clés anti-doublon. Module pur, testé dans `__tests__/email.test.ts`.
 */
import type { Role } from "@/server/authz/permissions";

export const EMAIL_EVENTS = [
  "ASSIGNMENT",
  "APPROVAL_PENDING",
  "APPROVAL_DECISION",
  "URGENT_REQUEST",
  "DUE_DIGEST",
  "OVERDUE",
  "STOCK_ALERT",
  "DOCUMENT_EXPIRY",
] as const;
export type EmailEvent = (typeof EMAIL_EVENTS)[number];

type EventDefinition = {
  label: string;
  description: string;
  /** Alerte obligatoire : l'utilisateur ne peut pas la désactiver (§11.1). */
  mandatory: boolean;
  /** Destinataires des alertes calculées (récapitulatifs), par rôle et dans le périmètre de ce rôle. */
  roles?: Role[];
};

export const EMAIL_EVENT_DEFINITIONS: Record<EmailEvent, EventDefinition> = {
  ASSIGNMENT: { label: "Affectation à un OT", description: "Vous êtes affecté comme intervenant à un ordre de travail.", mandatory: false },
  APPROVAL_PENDING: {
    label: "Validation en attente",
    description: "Une demande attend votre décision (achat, dépense, DI, remise en service).",
    mandatory: true,
  },
  APPROVAL_DECISION: { label: "Décision sur vos demandes", description: "Votre demande a été validée ou refusée.", mandatory: false },
  URGENT_REQUEST: { label: "DI urgente (P1)", description: "Panne de priorité P1 dans votre périmètre.", mandatory: true },
  DUE_DIGEST: {
    label: "Échéances de maintenance",
    description: "Récapitulatif quotidien des échéances préventives en pré-alerte ou échues.",
    mandatory: false,
    roles: ["WORKSHOP_MANAGER", "FLEET_MANAGER"],
  },
  OVERDUE: {
    label: "Retards",
    description: "Récapitulatif quotidien des préventifs en retard et des OT en attente depuis plus de 5 jours.",
    mandatory: false,
    roles: ["WORKSHOP_MANAGER", "MAINTENANCE_MANAGER"],
  },
  STOCK_ALERT: {
    label: "Alertes de stock",
    description: "Récapitulatif quotidien des articles sous le point de commande.",
    mandatory: false,
    roles: ["STOREKEEPER", "PURCHASING_MANAGER"],
  },
  DOCUMENT_EXPIRY: {
    label: "Documents arrivant à échéance",
    description: "Certificat ou rapport de contrôle expirant dans 30 jours, 7 jours ou expiré.",
    mandatory: false,
    roles: ["FLEET_MANAGER", "PURCHASING_MANAGER"],
  },
};

/** Notifications de l'application qui partent aussi par courriel. */
const TYPE_TO_EVENT: Record<string, EmailEvent> = {
  "work_order.assigned": "ASSIGNMENT",
  "approval.pending": "APPROVAL_PENDING",
  "work_order.release_requested": "APPROVAL_PENDING",
  "approval.approved": "APPROVAL_DECISION",
  "approval.rejected": "APPROVAL_DECISION",
  "work_request.urgent": "URGENT_REQUEST",
};

export function emailEventOf(notificationType: string): EmailEvent | null {
  return TYPE_TO_EVENT[notificationType] ?? null;
}

/** Préférence de l'utilisateur ; une alerte obligatoire part toujours, une alerte sans préférence part par défaut. */
export function wantsEmail(event: EmailEvent, preferences: Partial<Record<EmailEvent, boolean>>) {
  if (EMAIL_EVENT_DEFINITIONS[event].mandatory) return true;
  return preferences[event] ?? true;
}

/* ------------------------------------------------------------------ */
/* Reprises                                                             */
/* ------------------------------------------------------------------ */

/** Nombre maximal de tentatives avant l'abandon (statut « échec », visible par l'administrateur). */
export const MAX_ATTEMPTS = 5;

/** Délai avant la tentative suivante, en minutes : 1, 5, 15, 60, puis 240. */
const RETRY_DELAYS_MINUTES = [1, 5, 15, 60, 240];

export function nextRetryAt(attempts: number, now: Date): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const minutes = RETRY_DELAYS_MINUTES[Math.min(attempts - 1, RETRY_DELAYS_MINUTES.length - 1)] ?? 1;
  return new Date(now.getTime() + minutes * 60_000);
}

/**
 * Erreur définitive (adresse refusée, authentification impossible : réponse SMTP 5xx) ou passagère
 * (serveur indisponible, délai dépassé, réponse 4xx) : seule une erreur passagère est retentée.
 */
export function isPermanentError(error: { responseCode?: number; code?: string }) {
  if (error.code === "EENVELOPE" || error.code === "EAUTH") return true;
  return typeof error.responseCode === "number" && error.responseCode >= 500 && error.responseCode < 600;
}

/* ------------------------------------------------------------------ */
/* Dates et clés anti-doublon                                           */
/* ------------------------------------------------------------------ */

/** Jour calendaire dans le fuseau d'exploitation (clé des récapitulatifs quotidiens). */
export function dayKey(now: Date, timeZone = "Europe/Paris") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Les récapitulatifs partent à partir de l'heure paramétrée (NOT-04), une fois par jour. */
export function isDigestTime(now: Date, hour: number, timeZone = "Europe/Paris") {
  const local = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now));
  return local >= hour;
}

/** Palier d'alerte d'un document : 30 jours avant, 7 jours avant, expiré (CDC §11.1). */
export function documentExpiryStage(expiresAt: Date, now: Date): "J30" | "J7" | "J0" | null {
  const days = (expiresAt.getTime() - now.getTime()) / 86_400_000;
  if (days <= 0) return "J0";
  if (days <= 7) return "J7";
  if (days <= 30) return "J30";
  return null;
}

/* ------------------------------------------------------------------ */
/* Modèles                                                              */
/* ------------------------------------------------------------------ */

export type EmailContent = {
  /** Objet du message (sans préfixe). */
  title: string;
  /** Paragraphe d'introduction. */
  intro?: string | null;
  /** Lignes d'un récapitulatif. */
  items?: { label: string; detail?: string | null; link?: string | null }[];
  /** Lien principal vers l'application. */
  link?: string | null;
  linkLabel?: string;
};

export type RenderedEmail = { subject: string; text: string; html: string };

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Adresse absolue d'un lien de l'application ; un lien externe n'est jamais repris tel quel. */
export function absoluteLink(baseUrl: string, path: string | null | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

/**
 * Courriel en texte et en HTML. Toutes les valeurs sont échappées ; le lien de désinscription renvoie
 * vers les préférences (sauf alertes obligatoires, rappelées comme telles).
 */
export function renderEmail(
  event: EmailEvent,
  content: EmailContent,
  options: { appName?: string; baseUrl: string; recipientName?: string | null },
): RenderedEmail {
  const app = options.appName ?? "GMAO";
  const definition = EMAIL_EVENT_DEFINITIONS[event];
  const link = absoluteLink(options.baseUrl, content.link);
  const preferences = absoluteLink(options.baseUrl, "/notifications");
  const footer = definition.mandatory
    ? "Alerte obligatoire : elle ne peut pas être désactivée."
    : `Vous recevez ce message selon vos préférences de notification${preferences ? ` : ${preferences}` : "."}`;
  const items = (content.items ?? []).map((i) => ({ ...i, href: absoluteLink(options.baseUrl, i.link) }));

  const text = [
    options.recipientName ? `Bonjour ${options.recipientName},` : "Bonjour,",
    "",
    content.intro ?? content.title,
    ...(items.length > 0 ? ["", ...items.map((i) => `- ${i.label}${i.detail ? ` : ${i.detail}` : ""}${i.href ? ` (${i.href})` : ""}`)] : []),
    ...(link ? ["", `${content.linkLabel ?? "Ouvrir dans la GMAO"} : ${link}`] : []),
    "",
    "--",
    `${app} — ${definition.label}`,
    footer,
  ].join("\n");

  const html = `<!doctype html><html lang="fr"><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5">
<p>${escapeHtml(options.recipientName ? `Bonjour ${options.recipientName},` : "Bonjour,")}</p>
<p>${escapeHtml(content.intro ?? content.title)}</p>
${
  items.length > 0
    ? `<ul>${items
        .map(
          (i) =>
            `<li>${i.href ? `<a href="${escapeHtml(i.href)}">${escapeHtml(i.label)}</a>` : escapeHtml(i.label)}${i.detail ? ` : ${escapeHtml(i.detail)}` : ""}</li>`,
        )
        .join("")}</ul>`
    : ""
}
${link ? `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0f766e;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">${escapeHtml(content.linkLabel ?? "Ouvrir dans la GMAO")}</a></p>` : ""}
<p style="color:#64748b;font-size:12px">${escapeHtml(`${app} — ${definition.label}`)}<br>${escapeHtml(footer)}</p>
</body></html>`;

  return { subject: `[${app}] ${content.title}`.slice(0, 250), text, html };
}
