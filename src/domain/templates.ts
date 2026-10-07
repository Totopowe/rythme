import { fullWeek, type DayKind, type WeekPattern } from './rhythm.js';

/** Modèles de rythme proposés à l'onboarding. */
export type TemplateId = '3s1s' | '2s2s' | '4j1j' | '3j2j' | 'manuel';

export interface TemplateInfo {
  id: TemplateId;
  label: string;
  hint: string;
  /** `weeks` : alternance par semaines entières ; `days` : alternance au sein de chaque semaine. */
  unit: 'weeks' | 'days' | 'manual';
  /** Nombre de jours d'école par défaut (rythmes par jours). */
  defaultSchoolDays?: number[];
}

export const TEMPLATES: readonly TemplateInfo[] = [
  { id: '3s1s', label: '3 sem. / 1 sem.', hint: '3 semaines en entreprise, 1 à l’école', unit: 'weeks' },
  { id: '2s2s', label: '2 sem. / 2 sem.', hint: '2 semaines en entreprise, 2 à l’école', unit: 'weeks' },
  { id: '4j1j', label: '4 j / 1 j', hint: '4 jours en entreprise, 1 à l’école chaque semaine', unit: 'days', defaultSchoolDays: [4] },
  { id: '3j2j', label: '3 j / 2 j', hint: '3 jours en entreprise, 2 à l’école chaque semaine', unit: 'days', defaultSchoolDays: [3, 4] },
  { id: 'manuel', label: 'Sur mesure', hint: 'Je décris mes semaines une par une', unit: 'manual' },
];

export interface TemplateOptions {
  /** Rythmes par semaines : mode de la première semaine à la date de début. */
  startsWith?: 'entreprise' | 'ecole';
  /** Rythmes par jours : jours d'école (0 = lundi … 4 = vendredi). */
  schoolDays?: readonly number[];
  /** Sur mesure : une entrée par semaine du cycle. */
  manualWeeks?: readonly DayKind[];
}

export const WEEKDAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'] as const;

function block(first: DayKind, firstCount: number, second: DayKind, secondCount: number): WeekPattern[] {
  return [...Array<WeekPattern>(firstCount).fill(fullWeek(first)), ...Array<WeekPattern>(secondCount).fill(fullWeek(second))];
}

function weekWithSchoolDays(schoolDays: readonly number[]): WeekPattern {
  return [0, 1, 2, 3, 4].map((d) => (schoolDays.includes(d) ? 'ecole' : 'entreprise')) as unknown as WeekPattern;
}

/** Construit le motif correspondant à un modèle. */
export function buildPattern(id: TemplateId, options: TemplateOptions = {}): WeekPattern[] {
  const ecoleFirst = options.startsWith === 'ecole';
  switch (id) {
    case '3s1s':
      return ecoleFirst ? block('ecole', 1, 'entreprise', 3) : block('entreprise', 3, 'ecole', 1);
    case '2s2s':
      return ecoleFirst ? block('ecole', 2, 'entreprise', 2) : block('entreprise', 2, 'ecole', 2);
    case '4j1j':
    case '3j2j': {
      const info = TEMPLATES.find((t) => t.id === id)!;
      const days = options.schoolDays && options.schoolDays.length > 0 ? options.schoolDays : info.defaultSchoolDays!;
      return [weekWithSchoolDays(days)];
    }
    case 'manuel': {
      const weeks = options.manualWeeks && options.manualWeeks.length > 0 ? options.manualWeeks : ['entreprise' as const];
      return weeks.map(fullWeek);
    }
  }
}

/** Valide un motif lu depuis la base (JSON) ; renvoie null s'il est invalide. */
export function parsePattern(raw: unknown): WeekPattern[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 60) return null;
  const kinds = new Set(['ecole', 'entreprise', 'conge']);
  for (const week of raw) {
    if (!Array.isArray(week) || week.length !== 5 || !week.every((d) => kinds.has(d as string))) return null;
  }
  return raw as WeekPattern[];
}
