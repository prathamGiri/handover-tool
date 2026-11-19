const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "just now", "5 min ago", "3 hours ago", "yesterday", "12 Mar". */
export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(iso.slice(0, 10));
}

/** Formats a date-only value (YYYY-MM-DD) like "12 Mar 2027". */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
}

/** True when a date-only value is before today (UTC). */
export function isPast(date: string | null | undefined): boolean {
  if (!date) return false;
  return date < new Date().toISOString().slice(0, 10);
}
