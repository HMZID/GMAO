/** Formats d'affichage (dates, nombres, montants) selon la langue de la requête. Fuseau par défaut : Europe/Paris (DON-16). */
import { INTL_LOCALE } from "@/i18n/config";
import { requestLocale } from "@/i18n/request-locale";

const TIME_ZONE = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "Europe/Paris";

const dateFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function dateFormat(key: string, options: Intl.DateTimeFormatOptions) {
  const tag = INTL_LOCALE[requestLocale()];
  const id = `${tag}|${key}`;
  let fmt = dateFormats.get(id);
  if (!fmt) dateFormats.set(id, (fmt = new Intl.DateTimeFormat(tag, options)));
  return fmt;
}

function numberFormat(key: string, options: Intl.NumberFormatOptions) {
  const tag = INTL_LOCALE[requestLocale()];
  const id = `${tag}|${key}`;
  let fmt = numberFormats.get(id);
  if (!fmt) numberFormats.set(id, (fmt = new Intl.NumberFormat(tag, options)));
  return fmt;
}

/** Petits libellés d'unité et d'absence de valeur, par langue (n. s. = non significatif). */
const WORDS = {
  fr: { na: "n. s.", hour: "h", minute: "min" },
  en: { na: "n/a", hour: "h", minute: "min" },
  ar: { na: "غ.م", hour: "س", minute: "د" },
} as const;

const words = () => WORDS[requestLocale()];

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateFormat("date", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TIME_ZONE }).format(
    typeof value === "string" ? new Date(value) : value,
  );
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateFormat("datetime", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatDay(value: Date) {
  return dateFormat("day", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(value);
}

const plain = () => numberFormat("n", { maximumFractionDigits: 1 });

export function formatNumber(value: number | null | undefined, unit?: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return unit ? `${plain().format(value)} ${unit}` : plain().format(value);
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return numberFormat("eur", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return words().na;
  return numberFormat("pct", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

export function formatHours(value: number | null | undefined) {
  if (value === null || value === undefined) return words().na;
  return `${plain().format(value)} ${words().hour}`;
}

export function formatMinutes(minutes: number | null | undefined) {
  const w = words();
  if (!minutes) return `0 ${w.minute}`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} ${w.hour} ${m.toString().padStart(2, "0")}` : `${m} ${w.minute}`;
}

/** Valeur pour un champ <input type="date"> (AAAA-MM-JJ). */
export function toDateInput(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

const inputPartsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Valeur pour un champ <input type="datetime-local">, dans le fuseau d'exploitation (relue par `parseLocalDateTime`). */
export function toDateTimeInput(value: Date | null | undefined) {
  if (!value) return "";
  const parts = Object.fromEntries(inputPartsFmt.formatToParts(value).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
