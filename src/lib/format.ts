/** Formats français (dates, nombres, montants). Fuseau d'affichage par défaut : Europe/Paris (DON-16). */

const TIME_ZONE = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "Europe/Paris";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TIME_ZONE });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const shortDayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const numberFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const currencyFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const percentFmt = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateFmt.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateTimeFmt.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDay(value: Date) {
  return shortDayFmt.format(value);
}

export function formatNumber(value: number | null | undefined, unit?: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return unit ? `${numberFmt.format(value)} ${unit}` : numberFmt.format(value);
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return currencyFmt.format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "n. s.";
  return percentFmt.format(value);
}

export function formatHours(value: number | null | undefined) {
  if (value === null || value === undefined) return "n. s.";
  return `${numberFmt.format(value)} h`;
}

export function formatMinutes(minutes: number | null | undefined) {
  if (!minutes) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} h ${m.toString().padStart(2, "0")}` : `${m} min`;
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
