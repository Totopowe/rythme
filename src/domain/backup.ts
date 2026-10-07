import { isISODate } from './dates';
import {
  CONTEXTS,
  DEADLINE_KINDS,
  WEEK_KINDS,
  type Course,
  type Deadline,
  type Note,
  type Review,
  type Settings,
  type Task,
  type WeekOverride,
} from './types';

export const BACKUP_FORMAT = 'rythme-backup';
export const BACKUP_VERSION = 1;

export interface BackupData {
  settings: Settings | null;
  weekOverrides: WeekOverride[];
  tasks: Task[];
  deadlines: Deadline[];
  courses: Course[];
  notes: Note[];
  reviews: Review[];
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: BackupData;
}

export class BackupError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNullableStr = (v: unknown): v is string | null => v === null || isStr(v);
const oneOf = <T extends string>(list: readonly T[]) => (v: unknown): v is T => isStr(v) && (list as readonly string[]).includes(v);
const isContext = oneOf(CONTEXTS);
const isWeekKind = oneOf(WEEK_KINDS);
const isDeadlineKind = oneOf(DEADLINE_KINDS);

function list<T>(data: Obj, key: string, check: (v: Obj) => T): T[] {
  const value = data[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new BackupError(`« ${key} » doit être une liste.`);
  return value.map((item, i) => {
    if (!isObj(item)) throw new BackupError(`Élément ${i + 1} de « ${key} » invalide.`);
    try {
      return check(item);
    } catch (e) {
      throw new BackupError(`Élément ${i + 1} de « ${key} » : ${(e as Error).message}`);
    }
  });
}

function need(cond: boolean, field: string): void {
  if (!cond) throw new BackupError(`champ « ${field} » invalide`);
}

function checkTask(o: Obj): Task {
  need(isStr(o.id), 'id');
  need(isStr(o.title), 'title');
  need(isContext(o.context), 'context');
  need(o.dueDate === null || o.dueDate === undefined || isISODate(o.dueDate), 'dueDate');
  need(o.priority === undefined || [0, 1, 2, 3].includes(o.priority as number), 'priority');
  return {
    id: o.id as string,
    title: o.title as string,
    context: o.context as Task['context'],
    dueDate: (o.dueDate as string | undefined) ?? null,
    priority: (o.priority as Task['priority'] | undefined) ?? 0,
    order: typeof o.order === 'number' ? o.order : 0,
    done: o.done === true,
    doneAt: isNullableStr(o.doneAt) ? o.doneAt : null,
    courseId: isNullableStr(o.courseId) ? o.courseId : null,
    createdAt: isStr(o.createdAt) ? o.createdAt : new Date().toISOString(),
  };
}

function checkDeadline(o: Obj): Deadline {
  need(isStr(o.id), 'id');
  need(isStr(o.title), 'title');
  need(isISODate(o.date), 'date');
  need(isContext(o.context), 'context');
  need(isDeadlineKind(o.kind), 'kind');
  return {
    id: o.id as string,
    title: o.title as string,
    date: o.date as string,
    context: o.context as Deadline['context'],
    kind: o.kind as Deadline['kind'],
    notes: isStr(o.notes) ? o.notes : '',
    createdAt: isStr(o.createdAt) ? o.createdAt : new Date().toISOString(),
  };
}

function checkCourse(o: Obj): Course {
  need(isStr(o.id), 'id');
  need(isStr(o.name), 'name');
  need(isContext(o.context), 'context');
  return { id: o.id as string, name: o.name as string, context: o.context as Course['context'], createdAt: isStr(o.createdAt) ? o.createdAt : '' };
}

function checkNote(o: Obj): Note {
  need(isStr(o.id), 'id');
  need(isStr(o.body) || o.body === undefined, 'body');
  need(isContext(o.context), 'context');
  const now = new Date().toISOString();
  return {
    id: o.id as string,
    title: isStr(o.title) ? o.title : '',
    body: (o.body as string | undefined) ?? '',
    context: o.context as Note['context'],
    courseId: isNullableStr(o.courseId) ? o.courseId : null,
    pinned: o.pinned === true,
    createdAt: isStr(o.createdAt) ? o.createdAt : now,
    updatedAt: isStr(o.updatedAt) ? o.updatedAt : now,
  };
}

function checkReview(o: Obj): Review {
  need(isStr(o.id), 'id');
  need(isISODate(o.periodEnd), 'periodEnd');
  need(isWeekKind(o.fromKind), 'fromKind');
  need(isWeekKind(o.toKind), 'toKind');
  return {
    id: o.id as string,
    periodEnd: o.periodEnd as string,
    fromKind: o.fromKind as Review['fromKind'],
    toKind: o.toKind as Review['toKind'],
    summary: isStr(o.summary) ? o.summary : '',
    createdAt: isStr(o.createdAt) ? o.createdAt : '',
  };
}

function checkOverride(o: Obj): WeekOverride {
  need(isISODate(o.weekStart), 'weekStart');
  need(isWeekKind(o.kind), 'kind');
  return { weekStart: o.weekStart as string, kind: o.kind as WeekOverride['kind'] };
}

function checkSettings(o: unknown): Settings | null {
  if (o === null || o === undefined) return null;
  if (!isObj(o)) throw new BackupError('Réglages invalides.');
  need(isISODate(o.startDate), 'settings.startDate');
  need(Array.isArray(o.pattern) && o.pattern.length > 0 && o.pattern.every(isWeekKind), 'settings.pattern');
  return {
    id: 'main',
    startDate: o.startDate as string,
    pattern: o.pattern as Settings['pattern'],
    wakeUpDaysBefore: typeof o.wakeUpDaysBefore === 'number' ? o.wakeUpDaysBefore : 7,
    theme: o.theme === 'light' || o.theme === 'dark' ? o.theme : 'system',
    onboarded: true,
    ...(isISODate(o.setupDate) ? { setupDate: o.setupDate } : {}),
  };
}

/** Valide un fichier de sauvegarde (déjà parsé en JSON) et le normalise. */
export function parseBackup(raw: unknown): Backup {
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) {
    throw new BackupError("Ce fichier n'est pas une sauvegarde Rythme.");
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    throw new BackupError('Cette sauvegarde vient d’une version plus récente de Rythme.');
  }
  if (!isObj(raw.data)) throw new BackupError('Sauvegarde vide ou corrompue.');
  const d = raw.data;
  return {
    format: BACKUP_FORMAT,
    version: raw.version,
    exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : '',
    data: {
      settings: checkSettings(d.settings),
      weekOverrides: list(d, 'weekOverrides', checkOverride),
      tasks: list(d, 'tasks', checkTask),
      deadlines: list(d, 'deadlines', checkDeadline),
      courses: list(d, 'courses', checkCourse),
      notes: list(d, 'notes', checkNote),
      reviews: list(d, 'reviews', checkReview),
    },
  };
}

export function makeBackup(data: BackupData, now: Date = new Date()): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

export function backupSummary(b: Backup): string {
  const { tasks, notes, deadlines } = b.data;
  return `${tasks.length} tâche${tasks.length > 1 ? 's' : ''}, ${notes.length} note${notes.length > 1 ? 's' : ''}, ${deadlines.length} échéance${deadlines.length > 1 ? 's' : ''}`;
}
