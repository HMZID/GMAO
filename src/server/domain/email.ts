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
  "DEMO_REQUEST",
  "DEMO_ACCESS",
  "DEMO_DECISION",
  "FLEET_DEADLINE",
] as const;
export type EmailEvent = (typeof EMAIL_EVENTS)[number];

type EventDefinition = {
  label: string;
  description: string;
  /** Alerte obligatoire : l'utilisateur ne peut pas la désactiver (§11.1). */
  mandatory: boolean;
  /** Destinataires des alertes calculées (récapitulatifs), par rôle et dans le périmètre de ce rôle. */
  roles?: Role[];
  /** Courriel de compte ou de la plateforme, absent des préférences de notification. */
  hidden?: boolean;
};

export const EMAIL_EVENT_DEFINITIONS: Record<EmailEvent, EventDefinition> = {
  ASSIGNMENT: {
    label: "Affectation à une intervention",
    description: "Vous êtes affecté à une intervention à réaliser.",
    mandatory: false,
  },
  APPROVAL_PENDING: {
    label: "Validation en attente",
    description: "Une demande attend votre décision (achat, dépense, demande d'intervention, remise en service).",
    mandatory: true,
  },
  APPROVAL_DECISION: { label: "Décision sur vos demandes", description: "Votre demande a été validée ou refusée.", mandatory: false },
  URGENT_REQUEST: { label: "Demande d'intervention urgente (P1)", description: "Panne de priorité P1 dans votre périmètre.", mandatory: true },
  DUE_DIGEST: {
    label: "Échéances de maintenance",
    description: "Récapitulatif quotidien des échéances préventives en pré-alerte ou échues.",
    mandatory: false,
    roles: ["WORKSHOP_MANAGER", "FLEET_MANAGER"],
  },
  OVERDUE: {
    label: "Retards",
    description: "Récapitulatif quotidien des préventifs en retard et des interventions en attente depuis plus de 5 jours.",
    mandatory: false,
    roles: ["WORKSHOP_MANAGER", "MAINTENANCE_MANAGER", "FLEET_MANAGER"],
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
  FLEET_DEADLINE: {
    label: "Échéances administratives du parc",
    description: "Assurance, visite technique ou vignette à renouveler : à 30 jours, 7 jours, le jour même, puis chaque semaine de retard.",
    mandatory: false,
    roles: ["FLEET_MANAGER", "MAINTENANCE_MANAGER"],
  },
  DEMO_REQUEST: {
    label: "Demande de démonstration (site)",
    description: "Un prospect a demandé un compte de démonstration sur le site.",
    mandatory: true,
    hidden: true,
  },
  DEMO_ACCESS: {
    label: "Accès de démonstration",
    description: "Lien de connexion, identifiant et mot de passe provisoire d'un compte ouvert depuis le site.",
    mandatory: true,
    hidden: true,
  },
  DEMO_DECISION: {
    label: "Réponse à une demande de démonstration",
    description: "Réponse au prospect dont la demande n'est pas retenue.",
    mandatory: true,
    hidden: true,
  },
};

/** Événements proposés dans les préférences de notification de l'utilisateur. */
export const PREFERENCE_EVENTS = EMAIL_EVENTS.filter((e) => !EMAIL_EVENT_DEFINITIONS[e].hidden);

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

/* ------------------------------------------------------------------ */
/* Courriels du site commercial (comptes de démonstration)              */
/* ------------------------------------------------------------------ */

/** Mise en page commune : bandeau sombre à liseré jaune, comme le site. */
function brandedHtml(product: string, body: string, footer: string) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f3f0e8;font-family:Arial,Helvetica,sans-serif;color:#15171a;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0e8;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #d9d4c7">
<tr><td style="background:#15171a;border-bottom:4px solid #ffb800;padding:18px 28px;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:.5px">${escapeHtml(product)}</td></tr>
<tr><td style="padding:28px">${body}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #ece7da;color:#6b6659;font-size:12px">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#ffb800;color:#15171a;padding:12px 22px;font-weight:bold;text-decoration:none">${escapeHtml(label)}</a></p>`;
}

export type DemoAccessEmailInput = {
  product: string;
  recipientName: string;
  organization: string;
  login: string;
  password: string;
  loginUrl: string;
  /** Date de fin de la démonstration, déjà mise en forme. */
  endsOn: string;
  /** Renvoi des accès : nouveau mot de passe provisoire, l'ancien ne fonctionne plus. */
  resent?: boolean;
};

/** Accès de démonstration : lien de connexion, identifiant et mot de passe provisoire (à changer à la première connexion). */
export function renderDemoAccessEmail(input: DemoAccessEmailInput): RenderedEmail {
  const intro = input.resent
    ? `Voici de nouveaux accès à votre espace « ${input.organization} ». Le mot de passe provisoire précédent ne fonctionne plus.`
    : `Votre espace de démonstration « ${input.organization} » est ouvert jusqu'au ${input.endsOn}.`;
  const steps = [
    "Connectez-vous avec l'identifiant et le mot de passe provisoire ci-dessous.",
    "Choisissez votre propre mot de passe (demandé à la première connexion).",
    "Importez vos engins depuis Excel (menu Imports) et invitez vos équipes (Administration).",
  ];
  const text = [
    `Bonjour ${input.recipientName},`,
    "",
    intro,
    "",
    `Adresse de connexion : ${input.loginUrl}`,
    `Identifiant : ${input.login}`,
    `Mot de passe provisoire : ${input.password}`,
    "",
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    "Ce mot de passe est personnel : ne le transférez pas.",
    "",
    "--",
    `${input.product} — accès de démonstration`,
  ].join("\n");
  const row = (label: string, value: string, mono = false) =>
    `<tr><td style="padding:8px 12px;color:#6b6659;font-size:13px;border-bottom:1px solid #ece7da;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #ece7da;${mono ? "font-family:Consolas,Menlo,monospace;font-size:16px;font-weight:bold;letter-spacing:1px" : "font-weight:bold"}">${escapeHtml(value)}</td></tr>`;
  const body = `<p style="margin-top:0">${escapeHtml(`Bonjour ${input.recipientName},`)}</p>
<p>${escapeHtml(intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #d9d4c7;background:#faf8f3;margin:20px 0">
${row("Adresse de connexion", input.loginUrl)}${row("Identifiant", input.login)}${row("Mot de passe provisoire", input.password, true)}
</table>
${button(input.loginUrl, "Me connecter")}
<ol style="padding-left:20px;margin:0">${steps.map((s) => `<li style="margin-bottom:6px">${escapeHtml(s)}</li>`).join("")}</ol>
<p style="color:#6b6659;font-size:13px">Ce mot de passe est personnel : ne le transférez pas.</p>`;
  return {
    subject: `[${input.product}] ${input.resent ? "Vos nouveaux accès de démonstration" : "Votre espace de démonstration est prêt"}`,
    text,
    html: brandedHtml(input.product, body, `${input.product} — vous recevez ce message à la suite de votre demande de démonstration.`),
  };
}

export type DemoRequestEmailInput = {
  product: string;
  company: string;
  contactName: string;
  email: string;
  details: { label: string; value: string | null | undefined }[];
  message?: string | null;
  link: string;
};

/** Nouvelle demande de démonstration, pour les administrateurs de la plateforme. */
export function renderDemoRequestEmail(input: DemoRequestEmailInput): RenderedEmail {
  const details = input.details.filter((d) => d.value);
  const text = [
    "Bonjour,",
    "",
    `Nouvelle demande de démonstration : ${input.company} (${input.contactName}, ${input.email}).`,
    ...details.map((d) => `- ${d.label} : ${d.value}`),
    ...(input.message ? ["", `Message : ${input.message}`] : []),
    "",
    `Accepter ou refuser : ${input.link}`,
    "",
    "--",
    `${input.product} — administration du site`,
  ].join("\n");
  const body = `<p style="margin-top:0">Bonjour,</p>
<p>Nouvelle demande de démonstration : <strong>${escapeHtml(input.company)}</strong> (${escapeHtml(input.contactName)}, ${escapeHtml(input.email)}).</p>
${details.length ? `<ul>${details.map((d) => `<li>${escapeHtml(d.label)} : ${escapeHtml(String(d.value))}</li>`).join("")}</ul>` : ""}
${input.message ? `<blockquote style="margin:16px 0;padding:8px 14px;border-left:4px solid #ffb800;background:#faf8f3">${escapeHtml(input.message)}</blockquote>` : ""}
${button(input.link, "Examiner la demande")}`;
  return {
    subject: `[${input.product}] Demande de démonstration : ${input.company}`.slice(0, 250),
    text,
    html: brandedHtml(input.product, body, `${input.product} — administration du site commercial.`),
  };
}

/** Réponse au prospect dont la demande n'est pas retenue (motif facultatif). */
export function renderDemoDeclinedEmail(input: {
  product: string;
  recipientName: string;
  reason?: string | null;
  contactEmail?: string | null;
}): RenderedEmail {
  const lines = [
    `Merci pour l'intérêt que vous portez à ${input.product}. Nous ne pouvons pas donner suite à votre demande de démonstration pour le moment.`,
    ...(input.reason ? [input.reason] : []),
    ...(input.contactEmail ? [`Pour toute question : ${input.contactEmail}.`] : []),
  ];
  const text = [`Bonjour ${input.recipientName},`, "", ...lines, "", "--", input.product].join("\n");
  const body = `<p style="margin-top:0">${escapeHtml(`Bonjour ${input.recipientName},`)}</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}`;
  return {
    subject: `[${input.product}] Votre demande de démonstration`,
    text,
    html: brandedHtml(input.product, body, `${input.product} — réponse à votre demande de démonstration.`),
  };
}
