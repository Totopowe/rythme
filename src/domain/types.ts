import type { ISODate } from './dates';
import type { OverrideKind, WeekPattern } from './rhythm';
import type { TemplateId } from './templates';

/** Contexte d'un élément (tâche, échéance). */
export type Context = 'ecole' | 'entreprise' | 'perso';
export const CONTEXTS: readonly Context[] = ['ecole', 'entreprise', 'perso'];

/** Mode d'un jour ou d'une semaine dans le calendrier d'alternance. */
export type WeekKind = 'ecole' | 'entreprise' | 'conge';
export const WEEK_KINDS: readonly WeekKind[] = ['ecole', 'entreprise', 'conge'];

export type Priority = 0 | 1 | 2 | 3;

export type DeadlineKind = 'partiel' | 'rendu' | 'memoire' | 'reunion' | 'autre';
export const DEADLINE_KINDS: readonly DeadlineKind[] = ['partiel', 'rendu', 'memoire', 'reunion', 'autre'];

export type AbsenceKind = 'conge' | 'examen' | 'maladie' | 'autre';
export const ABSENCE_KINDS: readonly AbsenceKind[] = ['conge', 'examen', 'maladie', 'autre'];

export type ThemePreference = 'system' | 'light' | 'dark';

export type ShareKind = 'tutor' | 'ics';

export interface Profile {
  id: string;
  firstName: string;
  schoolName: string;
  theme: ThemePreference;
  /** Nombre de jours avant l'école où les tâches École se réveillent. */
  wakeUpDays: number;
  onboardedAt: string | null;
  createdAt: string;
}

export interface RhythmConfig {
  /** Lundi de la première semaine du motif. */
  startDate: ISODate;
  pattern: WeekPattern[];
  template: TemplateId;
}

export interface DayOverride {
  date: ISODate;
  kind: OverrideKind;
}

export interface Absence {
  id: string;
  startDate: ISODate;
  endDate: ISODate;
  kind: AbsenceKind;
  label: string;
  visibleToTutor: boolean;
  createdAt: string;
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
  createdAt: string;
}

export interface Deadline {
  id: string;
  title: string;
  date: ISODate;
  context: Context;
  kind: DeadlineKind;
  notes: string;
  /** Visible sur la page du tuteur (non par défaut). */
  visibleToTutor: boolean;
  createdAt: string;
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

export interface ShareLink {
  id: string;
  kind: ShareKind;
  createdAt: string;
  revokedAt: string | null;
  lastViewedAt: string | null;
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

export const ABSENCE_KIND_LABELS: Record<AbsenceKind, string> = {
  conge: 'Congés',
  examen: 'Examen',
  maladie: 'Maladie',
  autre: 'Absence',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'Aucune',
  1: 'Basse',
  2: 'Moyenne',
  3: 'Haute',
};

/** Contexte par défaut associé à un mode. */
export function contextForWeek(kind: WeekKind): Context {
  return kind === 'conge' ? 'perso' : kind;
}
