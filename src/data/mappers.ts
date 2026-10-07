import { parsePattern, type TemplateId } from '../domain/templates';
import type { Absence, DayOverride, Deadline, Priority, Profile, Review, RhythmConfig, ShareLink, Task } from '../domain/types';
import type { CollectionName, Collections, Op } from './model';

/** Conversion entre les lignes Postgres (snake_case) et le modèle de l'app. */

type Row = Record<string, unknown>;

export const TABLES: Record<CollectionName, string> = {
  tasks: 'tasks',
  deadlines: 'deadlines',
  absences: 'absences',
  reviews: 'reviews',
  shareLinks: 'share_links',
};

export function profileFromRow(r: Row): Profile {
  return {
    id: r.id as string,
    firstName: (r.first_name as string) ?? '',
    schoolName: (r.school_name as string) ?? '',
    theme: (r.theme as Profile['theme']) ?? 'system',
    wakeUpDays: (r.wake_up_days as number) ?? 7,
    onboardedAt: (r.onboarded_at as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export function profilePatchToRow(p: Partial<Profile>): Row {
  const row: Row = {};
  if (p.firstName !== undefined) row.first_name = p.firstName;
  if (p.schoolName !== undefined) row.school_name = p.schoolName;
  if (p.theme !== undefined) row.theme = p.theme;
  if (p.wakeUpDays !== undefined) row.wake_up_days = p.wakeUpDays;
  if (p.onboardedAt !== undefined) row.onboarded_at = p.onboardedAt;
  return row;
}

export function rhythmFromRow(r: Row | null): RhythmConfig | null {
  if (!r) return null;
  const pattern = parsePattern(r.pattern);
  if (!pattern) return null;
  return { startDate: r.start_date as string, pattern, template: (r.template as TemplateId) ?? 'manuel' };
}

export function rhythmToRow(r: RhythmConfig): Row {
  return { start_date: r.startDate, pattern: r.pattern, template: r.template };
}

export function overrideFromRow(r: Row): DayOverride {
  return { date: r.date as string, kind: r.kind as DayOverride['kind'] };
}

export function taskFromRow(r: Row): Task {
  const doneAt = (r.done_at as string | null) ?? null;
  return {
    id: r.id as string,
    title: r.title as string,
    context: r.context as Task['context'],
    dueDate: (r.due_date as string | null) ?? null,
    priority: (r.priority as Priority) ?? 0,
    order: (r.position as number) ?? 0,
    done: doneAt !== null,
    doneAt,
    createdAt: r.created_at as string,
  };
}

export function deadlineFromRow(r: Row): Deadline {
  return {
    id: r.id as string,
    title: r.title as string,
    date: r.date as string,
    context: r.context as Deadline['context'],
    kind: r.kind as Deadline['kind'],
    notes: (r.notes as string) ?? '',
    visibleToTutor: Boolean(r.visible_to_tutor),
    createdAt: r.created_at as string,
  };
}

export function absenceFromRow(r: Row): Absence {
  return {
    id: r.id as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    kind: r.kind as Absence['kind'],
    label: (r.label as string) ?? '',
    visibleToTutor: Boolean(r.visible_to_tutor),
    createdAt: r.created_at as string,
  };
}

export function reviewFromRow(r: Row): Review {
  return {
    id: r.id as string,
    periodEnd: r.period_end as string,
    fromKind: r.from_kind as Review['fromKind'],
    toKind: r.to_kind as Review['toKind'],
    summary: (r.summary as string) ?? '',
    createdAt: r.created_at as string,
  };
}

export function shareLinkFromRow(r: Row): ShareLink & { token: string } {
  return {
    id: r.id as string,
    kind: r.kind as ShareLink['kind'],
    token: r.token as string,
    createdAt: r.created_at as string,
    revokedAt: (r.revoked_at as string | null) ?? null,
    lastViewedAt: (r.last_viewed_at as string | null) ?? null,
  };
}

/** Champs du modèle → colonnes, par collection. Les champs absents (dérivés) sont ignorés. */
const FIELD_MAP: { [C in CollectionName]: Partial<Record<keyof Collections[C], string>> } = {
  tasks: { id: 'id', title: 'title', context: 'context', dueDate: 'due_date', priority: 'priority', order: 'position', doneAt: 'done_at', createdAt: 'created_at' },
  deadlines: { id: 'id', title: 'title', date: 'date', context: 'context', kind: 'kind', notes: 'notes', visibleToTutor: 'visible_to_tutor', createdAt: 'created_at' },
  absences: { id: 'id', startDate: 'start_date', endDate: 'end_date', kind: 'kind', label: 'label', visibleToTutor: 'visible_to_tutor', createdAt: 'created_at' },
  reviews: { id: 'id', periodEnd: 'period_end', fromKind: 'from_kind', toKind: 'to_kind', summary: 'summary', createdAt: 'created_at' },
  // Un lien ne se modifie que pour être révoqué (droits limités côté base).
  shareLinks: { id: 'id', kind: 'kind', token: 'token', createdAt: 'created_at', revokedAt: 'revoked_at' },
};

export function toRow<C extends CollectionName>(coll: C, item: Partial<Collections[C]>): Row {
  const map = FIELD_MAP[coll] as Record<string, string | undefined>;
  const row: Row = {};
  for (const [key, value] of Object.entries(item)) {
    const column = map[key];
    if (column && value !== undefined) row[column] = value;
  }
  return row;
}

/** Les mises à jour de liens n'acceptent que la révocation. */
export function patchToRow(op: Extract<Op, { type: 'patch' }>): Row {
  const row = toRow(op.coll, op.patch as Partial<Collections[typeof op.coll]>);
  if (op.coll === 'shareLinks') return { revoked_at: row.revoked_at };
  delete row.id;
  delete row.created_at;
  return row;
}
