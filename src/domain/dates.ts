/**
 * Dates calendaires sans fuseau horaire.
 * Toutes les dates métier sont des chaînes ISO `YYYY-MM-DD` ; les calculs
 * passent par UTC pour ne jamais être affectés par les changements d'heure.
 */
export type ISODate = string;

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number) as [number, number, number, number];
  return isValidDate(y, mo, d);
}

export function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const t = new Date(Date.UTC(year, month - 1, day));
  return t.getUTCFullYear() === year && t.getUTCMonth() === month - 1 && t.getUTCDate() === day;
}

function toUTC(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  const t = new Date(ms);
  return makeISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function makeISO(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Date locale du jour (selon l'horloge de l'appareil). */
export function todayISO(now: Date = new Date()): ISODate {
  return makeISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromUTC(toUTC(iso) + days * DAY_MS);
}

/** Nombre de jours de `from` à `to` (positif si `to` est après). */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

/** Jour de la semaine, lundi = 0 … dimanche = 6. */
export function weekday(iso: ISODate): number {
  return (new Date(toUTC(iso)).getUTCDay() + 6) % 7;
}

/** Lundi de la semaine contenant `iso`. */
export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekday(iso));
}

export function endOfWeek(iso: ISODate): ISODate {
  return addDays(startOfWeek(iso), 6);
}

export function yearOf(iso: ISODate): number {
  return Number(iso.slice(0, 4));
}

export function monthOf(iso: ISODate): number {
  return Number(iso.slice(5, 7));
}

export function dayOf(iso: ISODate): number {
  return Number(iso.slice(8, 10));
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

/** Numéro de semaine ISO 8601. */
export function isoWeekNumber(iso: ISODate): number {
  const thursday = addDays(startOfWeek(iso), 3);
  const jan1 = makeISO(yearOf(thursday), 1, 1);
  return Math.floor(diffDays(jan1, thursday) / 7) + 1;
}

// ---------------------------------------------------------------------------
// Formatage en français
// ---------------------------------------------------------------------------

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' });
    fmtCache.set(key, f);
  }
  return f;
}

/** « mardi 7 octobre » */
export function formatLong(iso: ISODate): string {
  return fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(toUTC(iso));
}

/** « 7 oct. » */
export function formatShort(iso: ISODate): string {
  return fmt({ day: 'numeric', month: 'short' }).format(toUTC(iso));
}

/** « octobre 2026 » */
export function formatMonthYear(iso: ISODate): string {
  return fmt({ month: 'long', year: 'numeric' }).format(toUTC(iso));
}

/** « oct. » */
export function formatMonthShort(iso: ISODate): string {
  return fmt({ month: 'short' }).format(toUTC(iso));
}

/** « lun. » */
export function formatWeekdayShort(iso: ISODate): string {
  return fmt({ weekday: 'short' }).format(toUTC(iso));
}

/** Libellé relatif : « Aujourd'hui », « Demain », « Hier », « Vendredi », « 12 nov. », « Il y a 3 j ». */
export function formatRelative(iso: ISODate, today: ISODate): string {
  const d = diffDays(today, iso);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return 'Demain';
  if (d === -1) return 'Hier';
  if (d > 1 && d < 7) return capitalize(fmt({ weekday: 'long' }).format(toUTC(iso)));
  if (d < 0 && d > -7) return `Il y a ${-d} j`;
  const sameYear = yearOf(iso) === yearOf(today);
  return sameYear ? formatShort(iso) : fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(toUTC(iso));
}

/** « dans 6 jours », « demain », « aujourd'hui » */
export function formatCountdown(days: number): string {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  if (days <= 21) return `dans ${days} jours`;
  const weeks = Math.round(days / 7);
  return `dans ${weeks} semaines`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
