import { addDays, diffDays, startOfWeek, type ISODate } from './dates.js';

/**
 * Statistiques d'usage calculées à partir de la table `events`
 * (identifiant anonyme, type, date). Toutes les dates sont prises en UTC.
 */

export interface UsageEvent {
  subjectId: string;
  type: string;
  createdAt: string;
}

export const RETENTION_WEEKS = [1, 2, 4] as const;
export type RetentionWeek = (typeof RETENTION_WEEKS)[number];

export interface RetentionCell {
  /** Membres de la cohorte actifs pendant la semaine N après leur inscription. */
  retained: number;
  /** Faux si la fenêtre n'est pas encore terminée pour toute la cohorte. */
  measurable: boolean;
}

export interface Cohort {
  /** Lundi de la semaine d'inscription. */
  weekStart: ISODate;
  size: number;
  retention: Record<RetentionWeek, RetentionCell>;
}

export interface WeeklyActivity {
  weekStart: ISODate;
  /** Personnes ayant au moins un événement (hors inscription) cette semaine-là. */
  active: number;
  signups: number;
}

export interface UsageStats {
  signups: number;
  activeLast7Days: number;
  weekly: WeeklyActivity[];
  cohorts: Cohort[];
  /** Rétention globale, pondérée par la taille des cohortes mesurables (null si rien à mesurer). */
  overall: Record<RetentionWeek, number | null>;
  eventsByType: Record<string, number>;
}

const dayOfTimestamp = (ts: string): ISODate => ts.slice(0, 10);

export function computeUsageStats(events: readonly UsageEvent[], now: Date, weeks = 12): UsageStats {
  const today = now.toISOString().slice(0, 10);

  // Première inscription de chaque personne.
  const signupDay = new Map<string, ISODate>();
  for (const e of events) {
    if (e.type !== 'signup') continue;
    const day = dayOfTimestamp(e.createdAt);
    const prev = signupDay.get(e.subjectId);
    if (!prev || day < prev) signupDay.set(e.subjectId, day);
  }

  // Jours d'activité de chaque personne (l'inscription elle-même ne compte pas comme un retour).
  const activeDays = new Map<string, Set<ISODate>>();
  const eventsByType: Record<string, number> = {};
  for (const e of events) {
    eventsByType[e.type] = (eventsByType[e.type] ?? 0) + 1;
    if (e.type === 'signup') continue;
    const set = activeDays.get(e.subjectId) ?? new Set<ISODate>();
    set.add(dayOfTimestamp(e.createdAt));
    activeDays.set(e.subjectId, set);
  }

  const activeBetween = (subject: string, from: ISODate, toExclusive: ISODate): boolean => {
    for (const d of activeDays.get(subject) ?? []) if (d >= from && d < toExclusive) return true;
    return false;
  };

  // Activité hebdomadaire sur les `weeks` dernières semaines.
  const currentWeek = startOfWeek(today);
  const weekly: WeeklyActivity[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(currentWeek, -7 * i);
    const weekEnd = addDays(weekStart, 7);
    let active = 0;
    for (const subject of activeDays.keys()) if (activeBetween(subject, weekStart, weekEnd)) active++;
    const signups = [...signupDay.values()].filter((d) => d >= weekStart && d < weekEnd).length;
    weekly.push({ weekStart, active, signups });
  }

  // Cohortes par semaine d'inscription.
  const byCohort = new Map<ISODate, string[]>();
  for (const [subject, day] of signupDay) {
    const key = startOfWeek(day);
    byCohort.set(key, [...(byCohort.get(key) ?? []), subject]);
  }
  const cohorts: Cohort[] = [...byCohort.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekStart, subjects]) => {
      const retention = {} as Record<RetentionWeek, RetentionCell>;
      for (const k of RETENTION_WEEKS) {
        // Fenêtre de chaque personne : du jour J+7k (inclus) au jour J+7(k+1) (exclu).
        const lastSignup = subjects.map((s) => signupDay.get(s)!).sort().at(-1)!;
        const measurable = diffDays(addDays(lastSignup, 7 * (k + 1)), today) >= 0;
        const retained = subjects.filter((s) => {
          const d = signupDay.get(s)!;
          return activeBetween(s, addDays(d, 7 * k), addDays(d, 7 * (k + 1)));
        }).length;
        retention[k] = { retained, measurable };
      }
      return { weekStart, size: subjects.length, retention };
    });

  const overall = {} as Record<RetentionWeek, number | null>;
  for (const k of RETENTION_WEEKS) {
    const measurable = cohorts.filter((c) => c.retention[k].measurable);
    const size = measurable.reduce((n, c) => n + c.size, 0);
    overall[k] = size === 0 ? null : measurable.reduce((n, c) => n + c.retention[k].retained, 0) / size;
  }

  const weekAgo = addDays(today, -6);
  let activeLast7Days = 0;
  for (const subject of activeDays.keys()) if (activeBetween(subject, weekAgo, addDays(today, 1))) activeLast7Days++;

  return { signups: signupDay.size, activeLast7Days, weekly, cohorts, overall, eventsByType };
}
