import type { ISODate } from './dates';

/** Contexte d'un élément (tâche, note, échéance). */
export type Context = 'ecole' | 'entreprise' | 'perso';
export const CONTEXTS: readonly Context[] = ['ecole', 'entreprise', 'perso'];

/** Type d'une semaine dans le calendrier d'alternance. */
export type WeekKind = 'ecole' | 'entreprise' | 'conge';
export const WEEK_KINDS: readonly WeekKind[] = ['ecole', 'entreprise', 'conge'];

export type Priority = 0 | 1 | 2 | 3;

export type DeadlineKind = 'partiel' | 'rendu' | 'memoire' | 'reunion' | 'autre';
export const DEADLINE_KINDS: readonly DeadlineKind[] = ['partiel', 'rendu', 'memoire', 'reunion', 'autre'];

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  id: 'main';
  /** Lundi de la première semaine du motif. */
  startDate: ISODate;
  /** Motif répété, une entrée par semaine. */
  pattern: WeekKind[];
  /** Nombre de jours avant une semaine d'école où les tâches École se réveillent. */
  wakeUpDaysBefore: number;
  theme: ThemePreference;
  onboarded: boolean;
}

export interface WeekOverride {
  /** Lundi de la semaine concernée. */
  weekStart: ISODate;
  kind: WeekKind;
}

export interface Task {
  id: string;
  title: string;
  context: Context;
  dueDate: ISODate | null;
  priority: Priority;
  /** Position dans la liste (ordre manuel). */
  order: number;
  done: boolean;
  doneAt: string | null;
  courseId: string | null;
  createdAt: string;
}

export interface Deadline {
  id: string;
  title: string;
  date: ISODate;
  context: Context;
  kind: DeadlineKind;
  notes: string;
  createdAt: string;
}

export interface Course {
  id: string;
  name: string;
  context: Context;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  context: Context;
  courseId: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  /** Dernier jour (dimanche) de la période revue. */
  periodEnd: ISODate;
  fromKind: WeekKind;
  toKind: WeekKind;
  summary: string;
  createdAt: string;
}

export const CONTEXT_LABELS: Record<Context, string> = {
  ecole: 'École',
  entreprise: 'Entreprise',
  perso: 'Perso',
};

export const WEEK_KIND_LABELS: Record<WeekKind, string> = {
  ecole: 'École',
  entreprise: 'Entreprise',
  conge: 'Congé',
};

export const DEADLINE_KIND_LABELS: Record<DeadlineKind, string> = {
  partiel: 'Partiel',
  rendu: 'Rendu',
  memoire: 'Mémoire',
  reunion: 'Réunion',
  autre: 'Échéance',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'Aucune',
  1: 'Basse',
  2: 'Moyenne',
  3: 'Haute',
};

/** Contexte par défaut associé à un type de semaine. */
export function contextForWeek(kind: WeekKind): Context {
  return kind === 'conge' ? 'perso' : kind;
}
