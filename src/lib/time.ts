/**
 * Gym-local date/time helpers. Everything the member sees ("today", "this
 * week", class times) is in the gym's time zone, regardless of where the
 * server runs. Dates are plain `YYYY-MM-DD` strings.
 */

export type DateKey = string; // YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar parts of an instant in a time zone. */
export function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

export function dateKeyIn(instant: Date, timeZone: string): DateKey {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function todayKey(timeZone: string, now = new Date()): DateKey {
  return dateKeyIn(now, timeZone);
}

/** Pure calendar arithmetic on date keys (UTC under the hood, no DST issues). */
export function addDays(key: DateKey, days: number): DateKey {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(key: DateKey): number {
  const d = new Date(`${key}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function mondayOf(key: DateKey): DateKey {
  return addDays(key, 1 - isoWeekday(key));
}

export function isDateKey(v: unknown): v is DateKey {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

/**
 * Converts a wall-clock time in `timeZone` to a UTC instant.
 * Handles DST by correcting with the zone offset at the guessed instant.
 */
export function zonedToUtc(key: DateKey, time: string, timeZone: string): Date {
  const [h, m] = time.split(":").map(Number);
  const [y, mo, d] = key.split("-").map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, m);
  let guess = asUtc;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const diff = shown - asUtc;
    if (diff === 0) break;
    guess -= diff;
  }
  return new Date(guess);
}

export function formatTime(instant: Date | string, timeZone: string) {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const s = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  const [time, ampm] = s.split(" ");
  return { time, ampm: ampm ?? "", label: s };
}

export function formatDateKey(key: DateKey, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(new Date(`${key}T12:00:00Z`));
}

export function localTimeOf(instant: Date | string, timeZone: string): string {
  const p = zonedParts(typeof instant === "string" ? new Date(instant) : instant, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
