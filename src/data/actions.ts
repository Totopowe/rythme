import type { ISODate } from '../domain/dates';
import { createRhythm, dayOverrideFor, weekOverridesFor, type DayKind, type OverrideKind } from '../domain/rhythm';
import type { Absence, Context, Deadline, DeadlineKind, Priority, Profile, Review, RhythmConfig, ShareKind, Task } from '../domain/types';
import type { Op } from './model';
import { dispatch, getStoreState } from './store';

/** Écritures de l'app. Chacune est appliquée immédiatement, puis synchronisée. */

export type Restore = () => void;

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function data() {
  const d = getStoreState().data;
  if (!d) throw new Error('Données non chargées.');
  return d;
}

// ---------------------------------------------------------------------------
// Profil et rythme
// ---------------------------------------------------------------------------

export function saveProfile(patch: Partial<Omit<Profile, 'id' | 'createdAt'>>): void {
  dispatch({ type: 'profile', patch });
}

export function saveRhythm(rhythm: RhythmConfig): void {
  dispatch({ type: 'rhythm', rhythm });
}

function currentRhythm() {
  const d = data();
  if (!d.rhythm) throw new Error('Rythme non configuré.');
  return createRhythm(d.rhythm.startDate, d.rhythm.pattern);
}

/** Fixe le mode d'une semaine entière (corrections uniquement là où le motif diffère). */
export function setWeekKind(weekStart: ISODate, kind: DayKind): void {
  const ops: Op[] = weekOverridesFor(currentRhythm(), weekStart, kind).map((o) => ({ type: 'override', date: o.date, kind: o.kind }));
  dispatch(...ops);
}

/** Fixe le mode d'un jour (ou le marque férié). */
export function setDayKind(date: ISODate, kind: OverrideKind): void {
  dispatch({ type: 'override', date, kind: dayOverrideFor(currentRhythm(), date, kind) });
}

export function clearOverrides(): Restore {
  const saved = data().overrides;
  dispatch(...saved.map<Op>((o) => ({ type: 'override', date: o.date, kind: null })));
  return () => dispatch(...saved.map<Op>((o) => ({ type: 'override', date: o.date, kind: o.kind })));
}

/** Import manuel d'un calendrier de semaines. */
export function importWeeks(weeks: { weekStart: ISODate; kind: DayKind }[]): void {
  const rhythm = currentRhythm();
  dispatch(...weeks.flatMap((w) => weekOverridesFor(rhythm, w.weekStart, w.kind).map<Op>((o) => ({ type: 'override', date: o.date, kind: o.kind }))));
}

// ---------------------------------------------------------------------------
// Tâches
// ---------------------------------------------------------------------------

export interface NewTask {
  title: string;
  context: Context;
  dueDate?: ISODate | null;
  priority?: Priority;
}

export function addTask(input: NewTask): Task {
  const task: Task = {
    id: id(),
    title: input.title.trim(),
    context: input.context,
    dueDate: input.dueDate ?? null,
    priority: input.priority ?? 0,
    // Les nouvelles tâches arrivent en haut de la liste (l'ordre manuel va de 0 à n).
    order: -Date.now(),
    done: false,
    doneAt: null,
    createdAt: now(),
  };
  dispatch({ type: 'put', coll: 'tasks', item: task });
  return task;
}

export function updateTask(taskId: string, patch: Partial<Omit<Task, 'id' | 'createdAt' | 'done' | 'doneAt'>>): void {
  dispatch({ type: 'patch', coll: 'tasks', id: taskId, patch });
}

export function toggleTask(task: Task): void {
  const done = !task.done;
  dispatch({ type: 'patch', coll: 'tasks', id: task.id, patch: { done, doneAt: done ? now() : null } });
}

export function reorderTasks(orderedIds: string[]): void {
  const tasks = new Map(data().tasks.map((t) => [t.id, t]));
  const ops: Op[] = [];
  orderedIds.forEach((taskId, index) => {
    if (tasks.get(taskId)?.order !== index) ops.push({ type: 'patch', coll: 'tasks', id: taskId, patch: { order: index } });
  });
  if (ops.length) dispatch(...ops);
}

export function deleteTask(taskId: string): Restore {
  const task = data().tasks.find((t) => t.id === taskId);
  dispatch({ type: 'delete', coll: 'tasks', id: taskId });
  return () => task && dispatch({ type: 'put', coll: 'tasks', item: task });
}

export function clearCompletedTasks(): Restore {
  const done = data().tasks.filter((t) => t.done);
  dispatch(...done.map<Op>((t) => ({ type: 'delete', coll: 'tasks', id: t.id })));
  return () => dispatch(...done.map<Op>((t) => ({ type: 'put', coll: 'tasks', item: t })));
}

// ---------------------------------------------------------------------------
// Échéances et absences
// ---------------------------------------------------------------------------

export interface NewDeadline {
  title: string;
  date: ISODate;
  context: Context;
  kind: DeadlineKind;
  notes?: string;
  visibleToTutor?: boolean;
}

export function addDeadline(input: NewDeadline): Deadline {
  const deadline: Deadline = {
    id: id(),
    notes: '',
    visibleToTutor: false,
    ...input,
    title: input.title.trim(),
    createdAt: now(),
  };
  dispatch({ type: 'put', coll: 'deadlines', item: deadline });
  return deadline;
}

export function updateDeadline(deadlineId: string, patch: Partial<Omit<Deadline, 'id' | 'createdAt'>>): void {
  dispatch({ type: 'patch', coll: 'deadlines', id: deadlineId, patch });
}

export function deleteDeadline(deadlineId: string): Restore {
  const d = data().deadlines.find((x) => x.id === deadlineId);
  dispatch({ type: 'delete', coll: 'deadlines', id: deadlineId });
  return () => d && dispatch({ type: 'put', coll: 'deadlines', item: d });
}

export function addAbsence(input: Omit<Absence, 'id' | 'createdAt'>): Absence {
  const absence: Absence = { ...input, id: id(), createdAt: now() };
  dispatch({ type: 'put', coll: 'absences', item: absence });
  return absence;
}

export function updateAbsence(absenceId: string, patch: Partial<Omit<Absence, 'id' | 'createdAt'>>): void {
  dispatch({ type: 'patch', coll: 'absences', id: absenceId, patch });
}

export function deleteAbsence(absenceId: string): Restore {
  const a = data().absences.find((x) => x.id === absenceId);
  dispatch({ type: 'delete', coll: 'absences', id: absenceId });
  return () => a && dispatch({ type: 'put', coll: 'absences', item: a });
}

// ---------------------------------------------------------------------------
// Revues
// ---------------------------------------------------------------------------

export function saveReview(input: Omit<Review, 'id' | 'createdAt'>): void {
  // Une seule revue par période : refaire la revue met à jour la précédente.
  const existing = data().reviews.find((r) => r.periodEnd === input.periodEnd);
  dispatch({ type: 'put', coll: 'reviews', item: { ...input, id: existing?.id ?? id(), createdAt: existing?.createdAt ?? now() } });
}

// ---------------------------------------------------------------------------
// Liens de partage
// ---------------------------------------------------------------------------

/** Jeton aléatoire de 32 caractères (192 bits), utilisable dans une URL. */
export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function activeLink(kind: ShareKind) {
  return data().shareLinks.find((l) => l.kind === kind && !l.revokedAt);
}

/** Crée (ou régénère) le lien d'un type : l'ancien est révoqué. */
export function createShareLink(kind: ShareKind): string {
  const ops: Op[] = [];
  const previous = activeLink(kind);
  if (previous) ops.push({ type: 'patch', coll: 'shareLinks', id: previous.id, patch: { revokedAt: now() } });
  const token = newShareToken();
  ops.push({ type: 'put', coll: 'shareLinks', item: { id: id(), kind, token, createdAt: now(), revokedAt: null, lastViewedAt: null } });
  dispatch(...ops);
  return token;
}

export function revokeShareLink(kind: ShareKind): void {
  const link = activeLink(kind);
  if (link) dispatch({ type: 'patch', coll: 'shareLinks', id: link.id, patch: { revokedAt: now() } });
}
