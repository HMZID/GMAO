/**
 * Règles des documents joints (EQP-07) : formats acceptés, taille maximale, contrôle du contenu réel
 * du fichier (signature binaire) et nom de fichier sûr. Module pur, testé dans `__tests__/documents.test.ts`.
 */

export const DOCUMENT_KINDS = ["MANUAL", "CERTIFICATE", "INVOICE", "PHOTO", "REPORT", "OTHER"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_ENTITIES = ["EQUIPMENT", "WORK_ORDER"] as const;
export type DocumentEntity = (typeof DOCUMENT_ENTITIES)[number];

type Signature = (bytes: Uint8Array) => boolean;

type FileFormat = {
  contentType: string;
  extensions: string[];
  label: string;
  /** Contenu affichable dans le navigateur sans risque (sinon téléchargement forcé). */
  inline: boolean;
  matches: Signature;
};

const startsWith =
  (...signature: number[]): Signature =>
  (bytes) =>
    signature.every((b, i) => bytes[i] === b);

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));

/** Conteneur ISO (MP4, MOV, HEIC) : « ftyp » à l'octet 4 suivi de la marque. */
const isoBrand =
  (...brands: string[]): Signature =>
  (bytes) =>
    ascii(bytes, 4, 8) === "ftyp" && brands.includes(ascii(bytes, 8, 12));

/** Formats acceptés : documents PDF et bureautiques, photos, vidéos courtes (EQP-07). */
export const FILE_FORMATS: FileFormat[] = [
  { contentType: "application/pdf", extensions: ["pdf"], label: "PDF", inline: true, matches: startsWith(0x25, 0x50, 0x44, 0x46, 0x2d) },
  { contentType: "image/jpeg", extensions: ["jpg", "jpeg"], label: "JPEG", inline: true, matches: startsWith(0xff, 0xd8, 0xff) },
  { contentType: "image/png", extensions: ["png"], label: "PNG", inline: true, matches: startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) },
  {
    contentType: "image/webp",
    extensions: ["webp"],
    label: "WebP",
    inline: true,
    matches: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP",
  },
  { contentType: "image/heic", extensions: ["heic", "heif"], label: "HEIC", inline: false, matches: isoBrand("heic", "heix", "mif1", "msf1") },
  {
    contentType: "video/mp4",
    extensions: ["mp4", "m4v"],
    label: "MP4",
    inline: true,
    matches: isoBrand("isom", "iso2", "mp41", "mp42", "avc1", "M4V "),
  },
  { contentType: "video/quicktime", extensions: ["mov"], label: "MOV", inline: false, matches: isoBrand("qt  ") },
  {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: ["docx"],
    label: "Word",
    inline: false,
    matches: startsWith(0x50, 0x4b, 0x03, 0x04),
  },
  {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: ["xlsx"],
    label: "Excel",
    inline: false,
    matches: startsWith(0x50, 0x4b, 0x03, 0x04),
  },
];

/** Extensions proposées par le sélecteur de fichier (attribut `accept`). */
export const ACCEPT_ATTRIBUTE = FILE_FORMATS.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(",");

/** Taille maximale par défaut, en Mo (paramétrable par DOCUMENT_MAX_SIZE_MB). */
export const DEFAULT_MAX_SIZE_MB = 20;

export function maxSizeBytes(configured: string | undefined = undefined): number {
  const mb = Number(configured);
  return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_SIZE_MB) * 1024 * 1024;
}

export function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export type FileCheck = { ok: true; format: FileFormat } | { ok: false; errors: string[] };

/**
 * Contrôle d'un fichier avant stockage : toutes les anomalies sont listées en une fois (DON-11).
 * Le format est déduit de l'extension puis vérifié sur le contenu : un exécutable renommé en « .pdf » est refusé.
 */
export function checkFile(file: { name: string; size: number; head: Uint8Array }, limitBytes: number): FileCheck {
  const errors: string[] = [];
  const ext = extensionOf(file.name);
  const format = FILE_FORMATS.find((f) => f.extensions.includes(ext));

  if (file.size === 0) errors.push("Le fichier est vide.");
  if (file.size > limitBytes) errors.push(`Le fichier dépasse la taille maximale de ${formatSize(limitBytes)} (${formatSize(file.size)}).`);
  if (!format) {
    errors.push(`Format non accepté (.${ext || "?"}). Formats acceptés : ${FILE_FORMATS.map((f) => f.label).join(", ")}.`);
  } else if (file.size > 0 && !format.matches(file.head)) {
    errors.push(`Le contenu du fichier ne correspond pas à son extension .${ext}.`);
  }

  return errors.length > 0 || !format ? { ok: false, errors } : { ok: true, format };
}

/** Nombre d'octets lus en tête de fichier pour reconnaître le format. */
export const SIGNATURE_LENGTH = 16;

/** Nom de fichier sûr pour l'en-tête Content-Disposition et le stockage. */
export function safeFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-150);
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : "document";
}

/** En-tête Content-Disposition (RFC 6266) avec repli ASCII pour les anciens clients. */
export function contentDisposition(fileName: string, inline: boolean) {
  const name = safeFileName(fileName);
  const fallback =
    name
      .normalize("NFD")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/[%\\]/g, "_") || "document";
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

/** Statuts d'OT après lesquels les pièces jointes de l'intervenant ne peuvent plus être retirées par lui-même. */
export const LOCKED_WORK_ORDER_STATUSES = ["TECH_CLOSED", "CLOSED", "CANCELLED"] as const;

/**
 * Droit de retirer un document : gestionnaire de l'objet parent, ou auteur de l'envoi tant que
 * l'OT n'est pas clôturé (une photo prise par erreur peut être retirée par le technicien).
 */
export function canDeleteDocument(input: { isManager: boolean; isUploader: boolean; entityType: DocumentEntity; workOrderStatus?: string | null }) {
  if (input.isManager) return true;
  if (!input.isUploader) return false;
  if (input.entityType !== "WORK_ORDER") return false;
  return !(LOCKED_WORK_ORDER_STATUSES as readonly string[]).includes(input.workOrderStatus ?? "");
}
