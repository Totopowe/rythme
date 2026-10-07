import { startOfWeek, todayISO, type ISODate } from '../domain/dates';
import { DEFAULT_PATTERN, overrideFor, createRhythm } from '../domain/rhythm';
import type { Context, Course, Deadline, DeadlineKind, Note, Priority, Review, Settings, Task, WeekKind } from '../domain/types';
import { db, newId, nowStamp } from './db';

// ---------------------------------------------------------------------------
// Réglages et rythme
// ---------------------------------------------------------------------------

export function defaultSettings(): Settings {
  return {
    id: 'main',
    startDate: startOfWeek(todayISO()),
    pattern: [...DEFAULT_PATTERN],
    wakeUpDaysBefore: 7,
    theme: 'system',
    onboarded: false,
  };
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = (await db.settings.get('main')) ?? defaultSettings();
  await db.settings.put({ ...current, ...patch, id: 'main' });
}

/** Fixe le type d'une semaine ; supprime l'exception si le motif donne déjà ce type. */
export async function setWeekKind(settings: Settings, weekStart: ISODate, kind: WeekKind): Promise<void> {
  const rhythm = createRhythm(settings.startDate, settings.pattern);
  const monday = startOfWeek(weekStart);
  const override = overrideFor(rhythm, monday, kind);
  if (override === null) await db.weekOverrides.delete(monday);
  else await db.weekOverrides.put({ weekStart: monday, kind: override });
}

export async function clearWeekOverrides(): Promise<void> {
  await db.weekOverrides.clear();
}

/** Importe une liste de semaines (corrections en masse). */
export async function importWeeks(settings: Settings, weeks: { weekStart: ISODate; kind: WeekKind }[]): Promise<void> {
  await db.transaction('rw', db.weekOverrides, async () => {
    for (const w of weeks) await setWeekKind(settings, w.weekStart, w.kind);
  });
}

// ---------------------------------------------------------------------------
// Tâches
// ---------------------------------------------------------------------------

export interface NewTask {
  title: string;
  context: Context;
  dueDate?: ISODate | null;
  priority?: Priority;
  courseId?: string | null;
}

export async function addTask(input: NewTask): Promise<Task> {
  const first = await db.tasks.orderBy('order').first();
  const task: Task = {
    id: newId(),
    title: input.title.trim(),
    context: input.context,
    dueDate: input.dueDate ?? null,
    priority: input.priority ?? 0,
    // Les nouvelles tâches arrivent en haut de la liste.
    order: (first?.order ?? 0) - 1,
    done: false,
    doneAt: null,
    courseId: input.courseId ?? null,
    createdAt: nowStamp(),
  };
  await db.tasks.add(task);
  return task;
}

export async function updateTask(id: string, patch: Partial<Omit<Task, 'id'>>): Promise<void> {
  await db.tasks.update(id, patch);
}

export async function toggleTask(task: Task): Promise<void> {
  await db.tasks.update(task.id, { done: !task.done, doneAt: task.done ? null : nowStamp() });
}

/** Réécrit l'ordre des tâches selon la liste d'identifiants fournie. */
export async function reorderTasks(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    await Promise.all(orderedIds.map((id, index) => db.tasks.update(id, { order: index })));
  });
}

// ---------------------------------------------------------------------------
// Échéances, cours, notes, revues
// ---------------------------------------------------------------------------

export interface NewDeadline {
  title: string;
  date: ISODate;
  context: Context;
  kind: DeadlineKind;
  notes?: string;
}

export async function addDeadline(input: NewDeadline): Promise<Deadline> {
  const d: Deadline = { id: newId(), notes: '', ...input, title: input.title.trim(), createdAt: nowStamp() };
  await db.deadlines.add(d);
  return d;
}

export async function updateDeadline(id: string, patch: Partial<Omit<Deadline, 'id'>>): Promise<void> {
  await db.deadlines.update(id, patch);
}

export async function addCourse(name: string, context: Context): Promise<Course> {
  const c: Course = { id: newId(), name: name.trim(), context, createdAt: nowStamp() };
  await db.courses.add(c);
  return c;
}

export async function addNote(input: { context: Context; courseId?: string | null; title?: string; body?: string }): Promise<Note> {
  const now = nowStamp();
  const n: Note = {
    id: newId(),
    title: input.title ?? '',
    body: input.body ?? '',
    context: input.context,
    courseId: input.courseId ?? null,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.notes.add(n);
  return n;
}

export async function updateNote(id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>): Promise<void> {
  await db.notes.update(id, { ...patch, updatedAt: nowStamp() });
}

export async function saveReview(input: Omit<Review, 'id' | 'createdAt'>): Promise<void> {
  await db.reviews.add({ ...input, id: newId(), createdAt: nowStamp() });
}

// ---------------------------------------------------------------------------
// Suppression annulable : on supprime tout de suite et on renvoie de quoi restaurer.
// ---------------------------------------------------------------------------

export type Restore = () => Promise<void>;

export async function deleteTask(id: string): Promise<Restore> {
  const t = await db.tasks.get(id);
  await db.tasks.delete(id);
  return async () => {
    if (t) await db.tasks.put(t);
  };
}

export async function deleteDeadline(id: string): Promise<Restore> {
  const d = await db.deadlines.get(id);
  await db.deadlines.delete(id);
  return async () => {
    if (d) await db.deadlines.put(d);
  };
}

export async function deleteNote(id: string): Promise<Restore> {
  const n = await db.notes.get(id);
  await db.notes.delete(id);
  return async () => {
    if (n) await db.notes.put(n);
  };
}

/** Supprime un cours ; ses notes et tâches sont détachées (pas supprimées). */
export async function deleteCourse(id: string): Promise<Restore> {
  return db.transaction('rw', [db.courses, db.notes, db.tasks], async () => {
    const course = await db.courses.get(id);
    const notes = await db.notes.where('courseId').equals(id).toArray();
    const tasks = (await db.tasks.toArray()).filter((t) => t.courseId === id);
    await db.notes.where('courseId').equals(id).modify({ courseId: null });
    await Promise.all(tasks.map((t) => db.tasks.update(t.id, { courseId: null })));
    await db.courses.delete(id);
    return async () => {
      await db.transaction('rw', [db.courses, db.notes, db.tasks], async () => {
        if (course) await db.courses.put(course);
        await Promise.all(notes.map((n) => db.notes.update(n.id, { courseId: id })));
        await Promise.all(tasks.map((t) => db.tasks.update(t.id, { courseId: id })));
      });
    };
  });
}

export async function clearCompletedTasks(): Promise<Restore> {
  const done = await db.tasks.filter((t) => t.done).toArray();
  await db.tasks.bulkDelete(done.map((t) => t.id));
  return async () => {
    await db.tasks.bulkPut(done);
  };
}
