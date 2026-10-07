import { addDays, diffDays, startOfWeek, type ISODate } from './dates';
import type { WeekKind } from './types';

/**
 * Configuration du rythme d'alternance : un motif répété à partir d'une date,
 * corrigé semaine par semaine par des exceptions (congés, calendrier irrégulier).
 */
export interface Rhythm {
  startDate: ISODate;
  pattern: readonly WeekKind[];
  /** Exceptions indexées par lundi de semaine. */
  overrides: ReadonlyMap<ISODate, WeekKind>;
}

export interface WeekInfo {
  weekStart: ISODate;
  kind: WeekKind;
  isOverride: boolean;
}

export interface Period {
  kind: WeekKind;
  /** Lundi de la première semaine. */
  start: ISODate;
  /** Dimanche de la dernière semaine. */
  end: ISODate;
}

export interface ModeChange {
  kind: WeekKind;
  /** Lundi où le nouveau mode commence. */
  date: ISODate;
  daysUntil: number;
}

/** Limite de recherche (en semaines) pour les calculs de périodes. */
const MAX_SCAN_WEEKS = 156;

export const DEFAULT_PATTERN: readonly WeekKind[] = ['entreprise', 'entreprise', 'entreprise', 'ecole'];

export function createRhythm(
  startDate: ISODate,
  pattern: readonly WeekKind[],
  overrides: Iterable<{ weekStart: ISODate; kind: WeekKind }> = [],
): Rhythm {
  if (pattern.length === 0) throw new Error('Le motif doit contenir au moins une semaine.');
  const map = new Map<ISODate, WeekKind>();
  for (const o of overrides) map.set(startOfWeek(o.weekStart), o.kind);
  return { startDate: startOfWeek(startDate), pattern, overrides: map };
}

/** Type de semaine prévu par le motif seul (sans exception). */
export function patternKindAt(rhythm: Rhythm, date: ISODate): WeekKind {
  const weeks = Math.floor(diffDays(rhythm.startDate, startOfWeek(date)) / 7);
  const n = rhythm.pattern.length;
  const index = ((weeks % n) + n) % n;
  return rhythm.pattern[index]!;
}

export function weekInfo(rhythm: Rhythm, date: ISODate): WeekInfo {
  const weekStart = startOfWeek(date);
  const override = rhythm.overrides.get(weekStart);
  return override
    ? { weekStart, kind: override, isOverride: true }
    : { weekStart, kind: patternKindAt(rhythm, weekStart), isOverride: false };
}

/** Mode actif à une date donnée. */
export function modeAt(rhythm: Rhythm, date: ISODate): WeekKind {
  return weekInfo(rhythm, date).kind;
}

/** Période continue (suite de semaines de même type) contenant `date`. */
export function periodAt(rhythm: Rhythm, date: ISODate): Period {
  const monday = startOfWeek(date);
  const kind = modeAt(rhythm, monday);
  let start = monday;
  for (let i = 0; i < MAX_SCAN_WEEKS; i++) {
    const prev = addDays(start, -7);
    if (modeAt(rhythm, prev) !== kind) break;
    start = prev;
  }
  let lastMonday = monday;
  for (let i = 0; i < MAX_SCAN_WEEKS; i++) {
    const next = addDays(lastMonday, 7);
    if (modeAt(rhythm, next) !== kind) break;
    lastMonday = next;
  }
  return { kind, start, end: addDays(lastMonday, 6) };
}

/** Prochain changement de mode après `date` (null si le rythme ne change jamais). */
export function nextChange(rhythm: Rhythm, date: ISODate): ModeChange | null {
  const current = modeAt(rhythm, date);
  let monday = startOfWeek(date);
  for (let i = 0; i < MAX_SCAN_WEEKS; i++) {
    monday = addDays(monday, 7);
    const kind = modeAt(rhythm, monday);
    if (kind !== current) return { kind, date: monday, daysUntil: diffDays(date, monday) };
  }
  return null;
}

/**
 * Prochain début d'une semaine de type `kind` strictement après la semaine de `date`.
 * Utile pour « École dans 6 jours » même si un congé s'intercale.
 */
export function nextStartOf(rhythm: Rhythm, date: ISODate, kind: WeekKind): ModeChange | null {
  let monday = startOfWeek(date);
  let previous = modeAt(rhythm, monday);
  for (let i = 0; i < MAX_SCAN_WEEKS; i++) {
    monday = addDays(monday, 7);
    const k = modeAt(rhythm, monday);
    if (k === kind && previous !== kind) return { kind, date: monday, daysUntil: diffDays(date, monday) };
    previous = k;
  }
  return null;
}

/** Liste de `count` semaines consécutives à partir de la semaine de `from`. */
export function weeksBetween(rhythm: Rhythm, from: ISODate, count: number): WeekInfo[] {
  const first = startOfWeek(from);
  return Array.from({ length: count }, (_, i) => weekInfo(rhythm, addDays(first, i * 7)));
}

/** Liste des périodes qui recouvrent l'intervalle [from, to]. */
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
 * Exception à enregistrer pour qu'une semaine soit de type `kind`.
 * Renvoie null si le motif donne déjà ce type (l'exception devient inutile).
 */
export function overrideFor(rhythm: Rhythm, weekStart: ISODate, kind: WeekKind): WeekKind | null {
  return patternKindAt(rhythm, weekStart) === kind ? null : kind;
}

/** Cycle École → Entreprise → Congé, pour le clic rapide sur une semaine de la frise. */
export function cycleKind(kind: WeekKind): WeekKind {
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
