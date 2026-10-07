import { addDays, diffDays, endOfWeek, type ISODate } from './dates';
import { modeAt, nextStartOf, periodAt, type Period, type Rhythm } from './rhythm';
import { contextForWeek, type Deadline, type Task, type WeekKind } from './types';

// ---------------------------------------------------------------------------
// Réveil des tâches École
// ---------------------------------------------------------------------------

export interface SchoolWakeState {
  /** Vrai si les tâches École doivent être mises en avant. */
  awake: boolean;
  /** Vrai si l'on est déjà en semaine d'école. */
  inSchool: boolean;
  /** Prochain lundi d'école (ou début de la période en cours). */
  schoolStart: ISODate | null;
  daysUntil: number | null;
}

export function schoolWakeState(rhythm: Rhythm, today: ISODate, daysBefore: number): SchoolWakeState {
  if (modeAt(rhythm, today) === 'ecole') {
    return { awake: true, inSchool: true, schoolStart: periodAt(rhythm, today).start, daysUntil: 0 };
  }
  const next = nextStartOf(rhythm, today, 'ecole');
  if (!next) return { awake: false, inSchool: false, schoolStart: null, daysUntil: null };
  return { awake: next.daysUntil <= daysBefore, inSchool: false, schoolStart: next.date, daysUntil: next.daysUntil };
}

/**
 * Une tâche École non faite est « en sommeil » pendant les périodes en entreprise,
 * sauf si elle a une date proche. Elle se réveille quand l'école approche.
 */
export function isDormant(task: Task, wake: SchoolWakeState, today: ISODate): boolean {
  if (task.context !== 'ecole' || task.done || wake.awake) return false;
  return task.dueDate === null || diffDays(today, task.dueDate) > 7;
}

// ---------------------------------------------------------------------------
// Vue Aujourd'hui
// ---------------------------------------------------------------------------

export interface TodayBuckets {
  overdue: Task[];
  today: Task[];
  /** Tâches École réveillées à l'approche de la semaine d'école. */
  wokenUp: Task[];
  /** Reste de la semaine. */
  thisWeek: Task[];
}

export function byOrder(a: Task, b: Task): number {
  return a.order - b.order || a.createdAt.localeCompare(b.createdAt);
}

function byDueThenOrder(a: Task, b: Task): number {
  return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || b.priority - a.priority || byOrder(a, b);
}

export function todayBuckets(tasks: readonly Task[], today: ISODate, wake: SchoolWakeState): TodayBuckets {
  const weekEnd = endOfWeek(today);
  const overdue: Task[] = [];
  const todayList: Task[] = [];
  const wokenUp: Task[] = [];
  const thisWeek: Task[] = [];

  for (const t of tasks) {
    const due = t.dueDate;
    if (due !== null && due === today) {
      // Les tâches faites aujourd'hui restent visibles (barrées) pour voir l'avancement.
      todayList.push(t);
      continue;
    }
    if (t.done) continue;
    if (due !== null && due < today) overdue.push(t);
    else if (due !== null && due <= weekEnd) thisWeek.push(t);
    else if (t.context === 'ecole' && wake.awake && !wake.inSchool) wokenUp.push(t);
  }

  overdue.sort(byDueThenOrder);
  todayList.sort((a, b) => Number(a.done) - Number(b.done) || b.priority - a.priority || byOrder(a, b));
  wokenUp.sort(byDueThenOrder);
  thisWeek.sort(byDueThenOrder);
  return { overdue, today: todayList, wokenUp, thisWeek };
}

export function upcomingDeadlines(deadlines: readonly Deadline[], today: ISODate, days = 30): Deadline[] {
  const limit = addDays(today, days);
  return deadlines
    .filter((d) => d.date >= today && d.date <= limit)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

// ---------------------------------------------------------------------------
// Revue de transition
// ---------------------------------------------------------------------------

export interface Transition {
  /** Période qui se termine (ou vient de se terminer). */
  period: Period;
  /** Période suivante. */
  next: Period;
  from: WeekKind;
  to: WeekKind;
}

/** Nombre de jours avant la fin d'une période où la revue est proposée (ven., sam., dim.). */
export const REVIEW_DAYS_BEFORE_END = 2;
/** Nombre de jours de rattrapage au début de la période suivante. */
export const REVIEW_DAYS_AFTER_START = 2;

export function transitionAfter(rhythm: Rhythm, period: Period): Transition {
  const next = periodAt(rhythm, addDays(period.end, 1));
  return { period, next, from: period.kind, to: next.kind };
}

/**
 * Revue à proposer aujourd'hui : en fin de période (à partir du vendredi de la dernière semaine)
 * ou en rattrapage les premiers jours de la suivante, si elle n'a pas déjà été faite.
 */
export function pendingTransition(
  rhythm: Rhythm,
  today: ISODate,
  doneReviews: readonly { periodEnd: ISODate }[],
  /** Date de début d'utilisation : les périodes terminées avant ne sont pas proposées. */
  since?: ISODate,
): Transition | null {
  const done = new Set(doneReviews.map((r) => r.periodEnd));
  const current = periodAt(rhythm, today);

  if (diffDays(today, current.end) <= REVIEW_DAYS_BEFORE_END && !done.has(current.end)) {
    return transitionAfter(rhythm, current);
  }
  if (diffDays(current.start, today) <= REVIEW_DAYS_AFTER_START) {
    const previous = periodAt(rhythm, addDays(current.start, -1));
    if (!done.has(previous.end) && (!since || previous.end >= since)) return transitionAfter(rhythm, previous);
  }
  return null;
}

export interface ReviewContent {
  /** Tâches non faites du contexte qui se termine. */
  pending: Task[];
  /** Tâches non faites du contexte suivant. */
  toPrepare: Task[];
  /** Échéances tombant pendant la période suivante. */
  deadlines: Deadline[];
}

export function reviewContent(
  transition: Transition,
  tasks: readonly Task[],
  deadlines: readonly Deadline[],
): ReviewContent {
  const fromCtx = contextForWeek(transition.from);
  const toCtx = contextForWeek(transition.to);
  const open = tasks.filter((t) => !t.done);
  return {
    pending: open.filter((t) => t.context === fromCtx).sort(byDueThenOrder),
    toPrepare: fromCtx === toCtx ? [] : open.filter((t) => t.context === toCtx).sort(byDueThenOrder),
    deadlines: deadlines
      .filter((d) => d.date >= transition.next.start && d.date <= transition.next.end)
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
