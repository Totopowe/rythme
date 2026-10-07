import { addDays, diffDays, startOfWeek, weekday, type ISODate } from './dates';
import type { WeekKind } from './types';

/**
 * Rythme d'alternance au jour près.
 *
 * Le motif est une suite de semaines, chacune décrivant ses 5 jours ouvrés (lundi → vendredi).
 * Il couvre les rythmes par semaines (3 sem. / 1 sem.) comme les rythmes par jours (4 j / 1 j).
 * Des corrections ponctuelles, jour par jour, priment sur le motif (férié, semaine décalée…).
 * Le week-end prend le mode du vendredi précédent.
 */

/** Mode d'un jour ouvré. */
export type DayKind = WeekKind;
/** Correction possible d'un jour : un mode, ou un jour férié (non travaillé). */
export type OverrideKind = DayKind | 'ferie';
/** Les 5 jours ouvrés d'une semaine du motif. */
export type WeekPattern = readonly [DayKind, DayKind, DayKind, DayKind, DayKind];

export interface Rhythm {
  /** Lundi de la première semaine du motif. */
  startDate: ISODate;
  pattern: readonly WeekPattern[];
  overrides: ReadonlyMap<ISODate, OverrideKind>;
}

export interface DayInfo {
  date: ISODate;
  /** Mode du jour ; le week-end reprend celui du vendredi, un jour férié compte comme congé. */
  kind: DayKind;
  weekend: boolean;
  holiday: boolean;
  isOverride: boolean;
}

export interface WeekInfo {
  weekStart: ISODate;
  /** Mode dominant de la semaine (le plus fréquent parmi les 5 jours ouvrés). */
  kind: WeekKind;
  /** Mode de chacun des 5 jours ouvrés. */
  days: DayKind[];
  /** Vrai si la semaine mélange plusieurs modes (ex. 4 jours entreprise, 1 jour école). */
  mixed: boolean;
  isOverride: boolean;
  holidays: number;
}

export interface Period {
  kind: WeekKind;
  /** Lundi de la première semaine. */
  start: ISODate;
  /** Dimanche de la dernière semaine. */
  end: ISODate;
}

export interface ModeChange {
  kind: DayKind;
  /** Premier jour ouvré du nouveau mode. */
  date: ISODate;
  daysUntil: number;
}

/** Limites de recherche pour éviter toute boucle infinie. */
const MAX_SCAN_DAYS = 3 * 366;
const MAX_SCAN_WEEKS = 156;

export function fullWeek(kind: DayKind): WeekPattern {
  return [kind, kind, kind, kind, kind];
}

export const DEFAULT_PATTERN: readonly WeekPattern[] = [
  fullWeek('entreprise'),
  fullWeek('entreprise'),
  fullWeek('entreprise'),
  fullWeek('ecole'),
];

export function createRhythm(
  startDate: ISODate,
  pattern: readonly WeekPattern[],
  overrides: Iterable<{ date: ISODate; kind: OverrideKind }> = [],
): Rhythm {
  if (pattern.length === 0) throw new Error('Le motif doit contenir au moins une semaine.');
  const map = new Map<ISODate, OverrideKind>();
  for (const o of overrides) map.set(o.date, o.kind);
  return { startDate: startOfWeek(startDate), pattern, overrides: map };
}

/** Semaine du motif correspondant à une date (le motif se prolonge aussi avant la date de début). */
export function patternWeekAt(rhythm: Rhythm, date: ISODate): WeekPattern {
  const weeks = Math.floor(diffDays(rhythm.startDate, startOfWeek(date)) / 7);
  const n = rhythm.pattern.length;
  return rhythm.pattern[((weeks % n) + n) % n]!;
}

/** Mode prévu par le motif seul (le week-end reprend le vendredi). */
export function patternKindAt(rhythm: Rhythm, date: ISODate): DayKind {
  return patternWeekAt(rhythm, date)[Math.min(weekday(date), 4)]!;
}

export function dayInfo(rhythm: Rhythm, date: ISODate): DayInfo {
  const wd = weekday(date);
  if (wd >= 5) {
    const friday = dayInfo(rhythm, addDays(date, 4 - wd));
    return { date, kind: friday.kind, weekend: true, holiday: false, isOverride: false };
  }
  const override = rhythm.overrides.get(date);
  if (override) {
    return { date, kind: override === 'ferie' ? 'conge' : override, weekend: false, holiday: override === 'ferie', isOverride: true };
  }
  return { date, kind: patternKindAt(rhythm, date), weekend: false, holiday: false, isOverride: false };
}

/** Mode actif à une date. */
export function modeAt(rhythm: Rhythm, date: ISODate): DayKind {
  return dayInfo(rhythm, date).kind;
}

/** Mode le plus fréquent ; à égalité, l'école l'emporte, puis l'entreprise. */
export function dominantKind(days: readonly DayKind[]): DayKind {
  let best: DayKind = 'entreprise';
  let bestCount = -1;
  for (const kind of ['ecole', 'entreprise', 'conge'] as const) {
    const count = days.filter((d) => d === kind).length;
    if (count > bestCount) {
      best = kind;
      bestCount = count;
    }
  }
  return best;
}

export function weekInfo(rhythm: Rhythm, date: ISODate): WeekInfo {
  const weekStart = startOfWeek(date);
  const infos = [0, 1, 2, 3, 4].map((i) => dayInfo(rhythm, addDays(weekStart, i)));
  const days = infos.map((d) => d.kind);
  return {
    weekStart,
    kind: dominantKind(days),
    days,
    mixed: new Set(days).size > 1,
    isOverride: infos.some((d) => d.isOverride),
    holidays: infos.filter((d) => d.holiday).length,
  };
}

/** Prochain jour ouvré (après `date`) dont le mode diffère du mode actuel. */
export function nextChange(rhythm: Rhythm, date: ISODate): ModeChange | null {
  const current = modeAt(rhythm, date);
  for (let i = 1; i <= MAX_SCAN_DAYS; i++) {
    const d = addDays(date, i);
    if (weekday(d) >= 5) continue;
    const kind = modeAt(rhythm, d);
    if (kind !== current) return { kind, date: d, daysUntil: i };
  }
  return null;
}

/**
 * Prochain jour ouvré qui ouvre une nouvelle séquence de mode `kind`
 * (en ignorant la séquence en cours). Ex. « École dans 6 jours ».
 */
export function nextStartOf(rhythm: Rhythm, date: ISODate, kind: DayKind): ModeChange | null {
  let previous = modeAt(rhythm, date);
  for (let i = 1; i <= MAX_SCAN_DAYS; i++) {
    const d = addDays(date, i);
    if (weekday(d) >= 5) continue;
    const k = modeAt(rhythm, d);
    if (k === kind && previous !== kind) return { kind, date: d, daysUntil: i };
    previous = k;
  }
  return null;
}

/** Vrai si le rythme alterne au sein des semaines (4 j / 1 j, 3 j / 2 j). */
export function isDailyRhythm(rhythm: Rhythm): boolean {
  return rhythm.pattern.some((w) => new Set(w).size > 1);
}

/** Période continue de semaines de même mode dominant contenant `date`. */
export function periodAt(rhythm: Rhythm, date: ISODate): Period {
  const monday = startOfWeek(date);
  const kind = weekInfo(rhythm, monday).kind;
  let start = monday;
  for (let i = 0; i < MAX_SCAN_WEEKS; i++) {
    const prev = addDays(start, -7);
    if (weekInfo(rhythm, prev).kind !== kind) break;
    start = prev;
  }
  let lastMonday = monday;
  for (let i = 0; i < MAX_SCAN_WEEKS; i++) {
    const next = addDays(lastMonday, 7);
    if (weekInfo(rhythm, next).kind !== kind) break;
    lastMonday = next;
  }
  return { kind, start, end: addDays(lastMonday, 6) };
}

export function weeksBetween(rhythm: Rhythm, from: ISODate, count: number): WeekInfo[] {
  const first = startOfWeek(from);
  return Array.from({ length: count }, (_, i) => weekInfo(rhythm, addDays(first, i * 7)));
}

export function periodsBetween(rhythm: Rhythm, from: ISODate, to: ISODate): Period[] {
  const periods: Period[] = [];
  let cursor = from;
  while (cursor <= to) {
    const p = periodAt(rhythm, cursor);
    periods.push(p);
    cursor = addDays(p.end, 1);
  }
  return periods;
}

/**
 * Corrections à enregistrer pour qu'une semaine entière soit de mode `kind`.
 * `kind: null` = retirer la correction (le motif donne déjà ce mode ce jour-là).
 */
export function weekOverridesFor(rhythm: Rhythm, weekStart: ISODate, kind: DayKind): { date: ISODate; kind: OverrideKind | null }[] {
  const monday = startOfWeek(weekStart);
  return [0, 1, 2, 3, 4].map((i) => {
    const date = addDays(monday, i);
    return { date, kind: patternKindAt(rhythm, date) === kind ? null : kind };
  });
}

/** Correction d'un jour ; `null` si le motif donne déjà ce mode. */
export function dayOverrideFor(rhythm: Rhythm, date: ISODate, kind: OverrideKind): OverrideKind | null {
  return kind !== 'ferie' && patternKindAt(rhythm, date) === kind ? null : kind;
}

/** Cycle École → Entreprise → Congé, pour le clic rapide. */
export function cycleKind(kind: DayKind): DayKind {
  return kind === 'ecole' ? 'entreprise' : kind === 'entreprise' ? 'conge' : 'ecole';
}

/** Année scolaire (septembre → août) contenant `date` ; août appartient déjà à l'année suivante. */
export function academicYearStart(date: ISODate): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month >= 8 ? year : year - 1;
}

/**
 * Semaines de l'année scolaire `year`/`year+1`, de septembre à août.
 * Une semaine appartient au mois de son jeudi (convention ISO).
 */
export function academicYearWeeks(rhythm: Rhythm, year: number): WeekInfo[] {
  let monday = startOfWeek(`${year}-09-01`);
  if (addDays(monday, 3) < `${year}-09-01`) monday = addDays(monday, 7);
  const last = `${year + 1}-08-31`;
  const weeks: WeekInfo[] = [];
  for (; addDays(monday, 3) <= last; monday = addDays(monday, 7)) weeks.push(weekInfo(rhythm, monday));
  return weeks;
}
