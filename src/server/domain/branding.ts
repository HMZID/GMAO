/**
 * Identité de l'organisation : nom affiché sous « GMAO » et logo (en-tête de l'application, états imprimés).
 * Module pur, testé dans `__tests__/branding.test.ts`.
 */
import { extensionOf, FILE_FORMATS, formatSize } from "./documents";

/** Formats de logo : images matricielles affichables partout (SVG exclu : il peut contenir du script). */
export const LOGO_FORMATS = FILE_FORMATS.filter((f) => ["image/png", "image/jpeg", "image/webp"].includes(f.contentType));

/** Extensions proposées par le sélecteur de fichier du logo. */
export const LOGO_ACCEPT = LOGO_FORMATS.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(",");

/** Taille maximale d'un logo : il est stocké en base et servi sur chaque page. */
export const MAX_LOGO_BYTES = 512 * 1024;

/** Longueur maximale du nom affiché. */
export const MAX_DISPLAY_NAME = 80;

export type LogoCheck = { ok: true; contentType: string } | { ok: false; errors: string[] };

/** Contrôle du logo : extension, contenu réel (signature binaire) et taille, toutes les anomalies en une fois (DON-11). */
export function checkLogo(file: { name: string; size: number; head: Uint8Array }): LogoCheck {
  const errors: string[] = [];
  const ext = extensionOf(file.name);
  const format = LOGO_FORMATS.find((f) => f.extensions.includes(ext));
  if (file.size === 0) errors.push("Le fichier est vide.");
  if (file.size > MAX_LOGO_BYTES) errors.push(`Le logo dépasse ${formatSize(MAX_LOGO_BYTES)} (${formatSize(file.size)}).`);
  if (!format) {
    errors.push(`Format non accepté (.${ext || "?"}). Formats acceptés : ${LOGO_FORMATS.map((f) => f.label).join(", ")}.`);
  } else if (file.size > 0 && !format.matches(file.head)) {
    errors.push(`Le contenu du fichier ne correspond pas à son extension .${ext}.`);
  }
  return errors.length > 0 || !format ? { ok: false, errors } : { ok: true, contentType: format.contentType };
}

/** Nom affiché de l'organisation : le nom choisi, sinon le nom du groupe. */
export function brandLabel(tenant: { name: string; displayName?: string | null }) {
  return tenant.displayName?.trim() || tenant.name;
}
