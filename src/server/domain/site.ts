/**
 * Site commercial : blocs et réglages du contenu, demandes de démonstration (contrôles anti-robot),
 * texte enrichi simple des pages libres, prix des offres et estimation du coût des pannes.
 * Module pur, sans dépendance au serveur (utilisé aussi par le calculateur du site) ;
 * testé dans `__tests__/site.test.ts`.
 */

/* ------------------------------------------------------------------ */
/* Blocs de contenu                                                     */
/* ------------------------------------------------------------------ */

export const SITE_ITEM_KINDS = ["HIGHLIGHT", "SECTOR", "FEATURE", "STEP", "TESTIMONIAL", "FAQ"] as const;
export type SiteItemKind = (typeof SITE_ITEM_KINDS)[number];

type FieldLabels = { title: string; body?: string; meta?: string; icon?: boolean };

export const SITE_ITEM_KIND_DEFINITIONS: Record<SiteItemKind, { label: string; plural: string; description: string; fields: FieldLabels }> = {
  HIGHLIGHT: {
    label: "Chiffre clé",
    plural: "Chiffres clés",
    description: "Bandeau de chiffres sous l'accroche (valeur, unité, libellé).",
    fields: { title: "Valeur (ex. 30)", meta: "Unité (ex. jours)", body: "Libellé" },
  },
  SECTOR: {
    label: "Secteur",
    plural: "Secteurs",
    description: "Métiers cités dans la rubrique « Pour qui ».",
    fields: { title: "Secteur", icon: true },
  },
  FEATURE: {
    label: "Fonctionnalité",
    plural: "Fonctionnalités",
    description: "Cartes de la rubrique « Fonctionnalités ».",
    fields: { title: "Titre", body: "Description", meta: "Étiquette (module)", icon: true },
  },
  STEP: {
    label: "Étape",
    plural: "Étapes",
    description: "Parcours « Comment ça marche », dans l'ordre.",
    fields: { title: "Titre", body: "Description" },
  },
  TESTIMONIAL: {
    label: "Témoignage",
    plural: "Témoignages",
    description: "Citations de clients : à publier seulement avec leur accord.",
    fields: { title: "Nom", meta: "Fonction et société", body: "Citation" },
  },
  FAQ: {
    label: "Question",
    plural: "Questions fréquentes",
    description: "Foire aux questions de l'accueil et de la page des tarifs.",
    fields: { title: "Question", body: "Réponse" },
  },
};

export function isSiteItemKind(value: string): value is SiteItemKind {
  return (SITE_ITEM_KINDS as readonly string[]).includes(value);
}

/** Icônes proposées pour les blocs (noms traduits en pictogrammes par le site). */
export const SITE_ICONS = [
  "wrench",
  "truck",
  "gauge",
  "calendar",
  "clipboard",
  "package",
  "cart",
  "chart",
  "smartphone",
  "shield",
  "bell",
  "plug",
  "users",
  "file",
  "qr",
  "hardhat",
  "mountain",
  "building",
  "factory",
  "landmark",
  "container",
  "tractor",
] as const;
export type SiteIcon = (typeof SITE_ICONS)[number];

/* ------------------------------------------------------------------ */
/* Réglages (textes généraux)                                           */
/* ------------------------------------------------------------------ */

export type SiteSettingType = "text" | "textarea" | "boolean" | "number" | "email";

export const SITE_SETTING_GROUPS = [
  { id: "brand", label: "Identité et contact" },
  { id: "announcement", label: "Bandeau d'annonce (offre du moment)" },
  { id: "hero", label: "Accroche de l'accueil" },
  { id: "sections", label: "Titres des rubriques" },
  { id: "offer", label: "Essai et tarifs" },
  { id: "roi", label: "Calculateur du coût des pannes" },
  { id: "form", label: "Formulaire de demande" },
  { id: "seo", label: "Référencement" },
] as const;

type SettingDefinition = {
  key: string;
  group: (typeof SITE_SETTING_GROUPS)[number]["id"];
  label: string;
  type: SiteSettingType;
  default: string;
  hint?: string;
};

export const SITE_SETTINGS = [
  { key: "brand.name", group: "brand", label: "Nom du produit", type: "text", default: "GMAO" },
  { key: "brand.baseline", group: "brand", label: "Signature", type: "text", default: "La maintenance des engins, pilotée au compteur près." },
  { key: "contact.email", group: "brand", label: "Courriel de contact", type: "email", default: "hassan.mzid@gmail.com" },
  { key: "contact.phone", group: "brand", label: "Téléphone", type: "text", default: "", hint: "Laisser vide pour ne pas l'afficher" },
  {
    key: "announcement.enabled",
    group: "announcement",
    label: "Afficher le bandeau",
    type: "boolean",
    default: "true",
  },
  {
    key: "announcement.text",
    group: "announcement",
    label: "Texte",
    type: "text",
    default: "Offre de lancement : −30 % la première année pour tout abonnement souscrit avant le 31 décembre 2026.",
  },
  { key: "announcement.linkLabel", group: "announcement", label: "Libellé du lien", type: "text", default: "Voir les tarifs" },
  { key: "announcement.linkHref", group: "announcement", label: "Adresse du lien", type: "text", default: "/tarifs" },
  { key: "hero.eyebrow", group: "hero", label: "Surtitre", type: "text", default: "GMAO engins · véhicules · équipements" },
  { key: "hero.title", group: "hero", label: "Titre", type: "text", default: "Vos engins tournent." },
  { key: "hero.highlight", group: "hero", label: "Titre — partie surlignée", type: "text", default: "Vos pannes, beaucoup moins." },
  {
    key: "hero.subtitle",
    group: "hero",
    label: "Texte d'accroche",
    type: "textarea",
    default:
      "Préventif au compteur, ordres de travail, pièces et achats, application mobile hors connexion : toute la maintenance de votre parc dans un seul outil, conçu pour l'atelier et le chantier.",
  },
  { key: "hero.ctaPrimary", group: "hero", label: "Bouton principal", type: "text", default: "Essayer gratuitement" },
  { key: "hero.ctaSecondary", group: "hero", label: "Bouton secondaire", type: "text", default: "Voir les tarifs" },
  {
    key: "hero.reassurance",
    group: "hero",
    label: "Réassurance sous les boutons",
    type: "text",
    default: "Sans carte bancaire · Votre propre espace · Données conservées",
  },
  {
    key: "features.title",
    group: "sections",
    label: "Fonctionnalités — titre",
    type: "text",
    default: "Tout le cycle de maintenance, du compteur au coût de revient.",
  },
  {
    key: "features.subtitle",
    group: "sections",
    label: "Fonctionnalités — texte",
    type: "textarea",
    default: "Chaque module parle le langage de l'atelier : engins, heures moteur, kilomètres, pièces, bons de travail.",
  },
  { key: "steps.title", group: "sections", label: "Étapes — titre", type: "text", default: "Opérationnel en une semaine, pas en six mois." },
  { key: "sectors.title", group: "sections", label: "Secteurs — titre", type: "text", default: "Pensé pour ceux qui font tourner des machines." },
  { key: "testimonials.title", group: "sections", label: "Témoignages — titre", type: "text", default: "Ils pilotent leur parc avec GMAO." },
  { key: "faq.title", group: "sections", label: "Questions — titre", type: "text", default: "Questions fréquentes" },
  { key: "cta.title", group: "sections", label: "Appel final — titre", type: "text", default: "Mettez votre parc à l'épreuve." },
  {
    key: "cta.text",
    group: "sections",
    label: "Appel final — texte",
    type: "textarea",
    default: "Ouvrez votre espace de démonstration : vos engins, vos sites, vos équipes. Si l'essai vous convainc, vous gardez tout.",
  },
  {
    key: "trial.days",
    group: "offer",
    label: "Durée d'essai proposée (jours)",
    type: "number",
    default: "30",
    hint: "Durée présélectionnée à l'acceptation d'une demande",
  },
  { key: "pricing.title", group: "offer", label: "Tarifs — titre", type: "text", default: "Un prix par équipement suivi. Rien de caché." },
  {
    key: "pricing.subtitle",
    group: "offer",
    label: "Tarifs — texte",
    type: "textarea",
    default: "Utilisateurs illimités sur toutes les offres : techniciens, conducteurs, magasiniers et direction travaillent ensemble sans surcoût.",
  },
  {
    key: "pricing.annualMonths",
    group: "offer",
    label: "Paiement annuel : mois facturés sur 12",
    type: "number",
    default: "10",
    hint: "10 = deux mois offerts",
  },
  { key: "pricing.annualLabel", group: "offer", label: "Paiement annuel — libellé de l'avantage", type: "text", default: "2 mois offerts" },
  { key: "roi.enabled", group: "roi", label: "Afficher le calculateur", type: "boolean", default: "true" },
  {
    key: "roi.reductionPct",
    group: "roi",
    label: "Réduction d'immobilisation retenue (%)",
    type: "number",
    default: "25",
    hint: "Hypothèse affichée au visiteur",
  },
  {
    key: "roi.pricePerEquipment",
    group: "roi",
    label: "Prix de référence par équipement et par mois (€ HT)",
    type: "number",
    default: "12",
  },
  { key: "form.title", group: "form", label: "Titre de la page", type: "text", default: "Votre espace de démonstration, prêt en 24 h." },
  {
    key: "form.text",
    group: "form",
    label: "Texte de la page",
    type: "textarea",
    default:
      "Nous ouvrons pour vous une organisation complète : société, site, atelier, magasin. Vous recevez par courriel votre identifiant et un mot de passe provisoire.",
  },
  { key: "form.thanksTitle", group: "form", label: "Confirmation — titre", type: "text", default: "Demande bien reçue." },
  {
    key: "form.thanksText",
    group: "form",
    label: "Confirmation — texte",
    type: "textarea",
    default:
      "Nous vérifions votre demande et ouvrons votre espace sous 24 h ouvrées. Vous recevrez un courriel avec le lien de connexion, votre identifiant et votre mot de passe provisoire.",
  },
  {
    key: "seo.title",
    group: "seo",
    label: "Titre des moteurs de recherche",
    type: "text",
    default: "GMAO — logiciel de maintenance pour engins et véhicules",
  },
  {
    key: "seo.description",
    group: "seo",
    label: "Description",
    type: "textarea",
    default:
      "Logiciel de GMAO pour flottes d'engins, véhicules et équipements : préventif au compteur, ordres de travail, stock, achats, mobile hors connexion. Essai gratuit 30 jours.",
  },
] as const satisfies readonly SettingDefinition[];

export type SiteSettingKey = (typeof SITE_SETTINGS)[number]["key"];
export type SiteSettings = Record<SiteSettingKey, string>;

export function isSiteSettingKey(key: string): key is SiteSettingKey {
  return SITE_SETTINGS.some((s) => s.key === key);
}

/** Réglages enregistrés complétés par les valeurs par défaut ; les clés inconnues sont ignorées. */
export function resolveSettings(rows: { key: string; value: string }[]): SiteSettings {
  const saved = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(SITE_SETTINGS.map((s) => [s.key, saved.get(s.key) ?? s.default])) as SiteSettings;
}

export function settingEnabled(value: string | undefined) {
  return value === "true";
}

export function settingNumber(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/* ------------------------------------------------------------------ */
/* Demandes de démonstration                                            */
/* ------------------------------------------------------------------ */

export const DEMO_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type DemoRequestStatus = (typeof DEMO_REQUEST_STATUSES)[number];

export const FLEET_SIZES = [
  { value: "1-20", label: "Moins de 20 équipements" },
  { value: "20-50", label: "20 à 50 équipements" },
  { value: "50-200", label: "50 à 200 équipements" },
  { value: "200+", label: "Plus de 200 équipements" },
] as const;

export const SECTORS = [
  "Travaux publics",
  "Bâtiment",
  "Carrières et granulats",
  "Transport et logistique",
  "Location de matériel",
  "Collectivité",
  "Industrie",
  "Autre",
] as const;

/** Délai minimal de saisie du formulaire : en dessous, c'est un robot. */
export const MIN_FILL_MS = 3_000;

/** Demandes acceptées par heure depuis une même adresse IP. */
export const MAX_REQUESTS_PER_HOUR = 5;

/**
 * Signes d'un envoi automatisé : champ piège rempli (invisible pour un humain), formulaire rempli en moins
 * de trois secondes ou horodatage d'ouverture absent ou incohérent.
 */
export function spamSignals(input: { honeypot?: string | null; startedAt?: number | null; now: number }) {
  const signals: string[] = [];
  if (input.honeypot && input.honeypot.trim() !== "") signals.push("honeypot");
  const started = input.startedAt;
  if (!started || !Number.isFinite(started) || started > input.now) signals.push("timestamp");
  else if (input.now - started < MIN_FILL_MS) signals.push("too_fast");
  return signals;
}

/** Nom d'organisation proposé à l'acceptation : la société, sans espaces superflus. */
export function organizationNameFrom(company: string) {
  return company.replace(/\s+/g, " ").trim().slice(0, 120);
}

/* ------------------------------------------------------------------ */
/* Pages libres                                                         */
/* ------------------------------------------------------------------ */

/** Adresse d'une page : minuscules sans accents, mots séparés par des tirets. */
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type RichInline = { text: string; strong?: boolean; href?: string };
export type RichBlock = { type: "h2" | "h3" | "p"; content: RichInline[] } | { type: "ul"; items: RichInline[][] };

/** Lien accepté : adresse web, courriel ou chemin du site ; tout autre schéma (javascript:…) est rendu en texte. */
export function safeHref(href: string) {
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  return null;
}

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(line: string): RichInline[] {
  const out: RichInline[] = [];
  let last = 0;
  for (const m of line.matchAll(INLINE)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ text: m[1], strong: true });
    else {
      const href = safeHref(m[3]);
      out.push(href ? { text: m[2], href } : { text: m[2] });
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}

/**
 * Texte simple des pages libres : « ## » et « ### » pour les titres, « - » pour les listes, une ligne vide
 * entre deux paragraphes, **gras** et [lien](adresse). Le résultat est rendu en éléments React, jamais en HTML brut.
 */
export function parseRichText(source: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: string[] = [];
  let list: RichInline[][] | null = null;
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "p", content: parseInline(paragraph.join(" ")) });
    paragraph = [];
    if (list) blocks.push({ type: "ul", items: list });
    list = null;
  };
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (line === "") {
      flush();
      continue;
    }
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: heading[1].length === 2 ? "h2" : "h3", content: parseInline(heading[2]) });
      continue;
    }
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) {
      if (paragraph.length) {
        blocks.push({ type: "p", content: parseInline(paragraph.join(" ")) });
        paragraph = [];
      }
      list = list ?? [];
      list.push(parseInline(item[1]));
      continue;
    }
    if (list) flush();
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/* ------------------------------------------------------------------ */
/* Offres et calculateur                                                */
/* ------------------------------------------------------------------ */

export type Billing = "monthly" | "yearly";

/** Prix mensuel affiché : en paiement annuel, `annualMonths` mois facturés sur 12, ramenés au mois. */
export function displayedPrice(monthly: number | null, billing: Billing, annualMonths: number) {
  if (monthly === null) return null;
  if (billing === "monthly") return monthly;
  const months = Math.min(12, Math.max(1, annualMonths));
  return Math.round(((monthly * months) / 12) * 100) / 100;
}

/** Avantages d'une offre : une ligne par avantage, lignes vides ignorées. */
export function planFeatures(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

export type RoiInput = {
  equipmentCount: number;
  breakdownsPerMonth: number;
  daysPerBreakdown: number;
  dailyCost: number;
  reductionPct: number;
  pricePerEquipment: number;
};

/**
 * Estimation indicative, à partir des hypothèses du visiteur : coût annuel des immobilisations, économie si
 * elles baissent du pourcentage retenu, coût de l'abonnement et délai de retour sur investissement.
 */
export function estimateRoi(input: RoiInput) {
  const clamp = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
  const downtimeCost = clamp(input.breakdownsPerMonth) * 12 * clamp(input.daysPerBreakdown) * clamp(input.dailyCost);
  const savings = Math.round((downtimeCost * Math.min(100, clamp(input.reductionPct))) / 100);
  const subscription = Math.round(clamp(input.equipmentCount) * clamp(input.pricePerEquipment) * 12);
  const net = savings - subscription;
  const paybackMonths = savings > 0 ? Math.max(0.1, Math.round((subscription / (savings / 12)) * 10) / 10) : null;
  return { downtimeCost: Math.round(downtimeCost), savings, subscription, net, paybackMonths };
}
