import { addDays, diffDays, isValidDate, makeISO, startOfWeek, weekday, yearOf, type ISODate } from './dates';
import type { Context, DeadlineKind, Priority } from './types';

/**
 * Parseur de capture rapide en français.
 *
 *   « rendre dossier finance #ecole vendredi !! »
 *   → { title: 'Rendre dossier finance', context: 'ecole', dueDate: <vendredi>, priority: 2 }
 *
 * Reconnaît :
 *  - contexte : #ecole #école #cours #entreprise #boulot #taf #travail #perso
 *  - priorité : ! !! !!! (ou !1 !2 !3)
 *  - échéance plutôt que tâche : @partiel @rendu @memoire @reunion @echeance
 *  - date : aujourd'hui, ce soir, demain, après-demain, lundi…dimanche,
 *    « vendredi prochain », « semaine prochaine », « dans 3 jours / 2 semaines »,
 *    12/03, 12/03/2027, 12 mars, 1er mars 2027, « fin du mois »
 */
export interface CaptureResult {
  title: string;
  context: Context | null;
  dueDate: ISODate | null;
  priority: Priority;
  /** Présent si l'utilisateur a demandé une échéance (@partiel, @rendu…). */
  deadlineKind: DeadlineKind | null;
  /** Fragments reconnus, dans l'ordre, pour l'aperçu dans l'interface. */
  matches: CaptureMatch[];
}

export interface CaptureMatch {
  type: 'context' | 'date' | 'priority' | 'deadline';
  text: string;
}

const CONTEXT_TAGS: Record<string, Context> = {
  ecole: 'ecole',
  cours: 'ecole',
  fac: 'ecole',
  entreprise: 'entreprise',
  ent: 'entreprise',
  boulot: 'entreprise',
  taf: 'entreprise',
  travail: 'entreprise',
  job: 'entreprise',
  perso: 'perso',
  maison: 'perso',
};

const DEADLINE_TAGS: Record<string, DeadlineKind> = {
  partiel: 'partiel',
  exam: 'partiel',
  examen: 'partiel',
  rendu: 'rendu',
  memoire: 'memoire',
  reunion: 'reunion',
  echeance: 'autre',
  deadline: 'autre',
};

// Pas d'abréviations ambiguës (« mer », « jeu », « sam »…) qui sont aussi des mots courants.
const WEEKDAYS: Record<string, number> = {
  lundi: 0,
  mardi: 1,
  mercredi: 2,
  jeudi: 3,
  vendredi: 4,
  samedi: 5,
  dimanche: 6,
};

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1,
  fevrier: 2, fevr: 2, fev: 2,
  mars: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7,
  aout: 8,
  septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  decembre: 12, dec: 12,
};

/** Petits mots retirés s'ils précèdent immédiatement une date (« pour vendredi »). */
const DATE_PREPOSITIONS = new Set(['pour', 'le', 'avant', 'ce', 'cette', 'dici', 'jusqua', 'au', 'des']);

interface Token {
  raw: string;
  norm: string;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[.,;:!?)(]+$/g, '');
}

function tokenize(input: string): Token[] {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalize(raw) }));
}

interface DateMatch {
  date: ISODate;
  /** Nombre de jetons consommés à partir de l'indice de départ. */
  length: number;
}

/** Prochaine occurrence d'un jour de semaine, aujourd'hui inclus. */
function upcomingWeekday(today: ISODate, target: number): ISODate {
  const delta = (target - weekday(today) + 7) % 7;
  return addDays(today, delta);
}

/** Prochaine occurrence de jour/mois, aujourd'hui inclus (le 29/02 peut attendre une année bissextile). */
function resolveYear(today: ISODate, month: number, day: number): ISODate | null {
  const y = yearOf(today);
  for (let year = y; year <= y + 8; year++) {
    if (!isValidDate(year, month, day)) continue;
    const candidate = makeISO(year, month, day);
    if (diffDays(today, candidate) >= 0) return candidate;
  }
  return null;
}

function normalizeYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

function matchDateAt(tokens: Token[], i: number, today: ISODate): DateMatch | null {
  const t0 = tokens[i]?.norm ?? '';
  const t1 = tokens[i + 1]?.norm ?? '';
  const t2 = tokens[i + 2]?.norm ?? '';

  // aujourd'hui (le jeton « aujourd'hui » devient « aujourdhui »), auj, ce soir
  if (t0 === 'aujourdhui' || t0 === 'auj' || t0 === 'ajd') return { date: today, length: 1 };
  if (t0 === 'soir' && i > 0 && tokens[i - 1]?.norm === 'ce') return { date: today, length: 1 };
  if (t0 === 'demain') return { date: addDays(today, 1), length: 1 };
  if (t0 === 'apres-demain' || t0 === 'apresdemain') return { date: addDays(today, 2), length: 1 };
  if (t0 === 'apres' && t1 === 'demain') return { date: addDays(today, 2), length: 2 };

  // semaine prochaine → lundi suivant
  if (t0 === 'semaine' && t1 === 'prochaine') return { date: addDays(startOfWeek(today), 7), length: 2 };

  // fin du mois / fin de mois
  if (t0 === 'fin' && (t1 === 'du' || t1 === 'de') && t2 === 'mois') {
    const y = yearOf(today);
    const m = Number(today.slice(5, 7));
    const firstNext = m === 12 ? makeISO(y + 1, 1, 1) : makeISO(y, m + 1, 1);
    return { date: addDays(firstNext, -1), length: 3 };
  }

  // jour de semaine, éventuellement suivi de « prochain »
  const wd = WEEKDAYS[t0];
  if (wd !== undefined) {
    if (t1 === 'prochain') {
      // Le jour en question dans la semaine calendaire suivante.
      return { date: addDays(startOfWeek(today), 7 + wd), length: 2 };
    }
    return { date: upcomingWeekday(today, wd), length: 1 };
  }

  // dans N jours / semaines / mois
  if (t0 === 'dans') {
    const n = t1 === 'un' || t1 === 'une' ? 1 : /^\d{1,3}$/.test(t1) ? Number(t1) : NaN;
    if (!Number.isNaN(n)) {
      if (/^(j|jour|jours)$/.test(t2)) return { date: addDays(today, n), length: 3 };
      if (/^(sem|semaine|semaines)$/.test(t2)) return { date: addDays(today, 7 * n), length: 3 };
    }
    // « dans 3j », « dans 2sem »
    const compact = /^(\d{1,3})(j|sem)$/.exec(t1);
    if (compact) {
      const k = Number(compact[1]);
      return { date: addDays(today, compact[2] === 'j' ? k : 7 * k), length: 2 };
    }
  }

  // 12/03, 12/03/2027, 12-03-27
  const numeric = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/.exec(t0);
  if (numeric) {
    const d = Number(numeric[1]);
    const m = Number(numeric[2]);
    if (numeric[3]) {
      const y = normalizeYear(Number(numeric[3]));
      return isValidDate(y, m, d) ? { date: makeISO(y, m, d), length: 1 } : null;
    }
    const date = resolveYear(today, m, d);
    return date ? { date, length: 1 } : null;
  }

  // 12 mars, 1er mars 2027
  const dayMatch = /^(\d{1,2})(er)?$/.exec(t0);
  const month = MONTHS[t1];
  if (dayMatch && month !== undefined) {
    const d = Number(dayMatch[1]);
    if (/^\d{4}$/.test(t2)) {
      const y = Number(t2);
      return isValidDate(y, month, d) ? { date: makeISO(y, month, d), length: 3 } : null;
    }
    const date = resolveYear(today, month, d);
    return date ? { date, length: 2 } : null;
  }

  return null;
}

export function parseCapture(input: string, today: ISODate): CaptureResult {
  const tokens = tokenize(input);
  const consumed = new Array<boolean>(tokens.length).fill(false);
  const result: CaptureResult = {
    title: '',
    context: null,
    dueDate: null,
    priority: 0,
    deadlineKind: null,
    matches: [],
  };

  tokens.forEach((tok, i) => {
    // #contexte
    if (tok.raw.startsWith('#')) {
      const ctx = CONTEXT_TAGS[tok.norm.slice(1)];
      if (ctx && result.context === null) {
        result.context = ctx;
        consumed[i] = true;
        result.matches.push({ type: 'context', text: tok.raw });
      }
      return;
    }
    // @échéance
    if (tok.raw.startsWith('@')) {
      const kind = DEADLINE_TAGS[tok.norm.slice(1)];
      if (kind && result.deadlineKind === null) {
        result.deadlineKind = kind;
        consumed[i] = true;
        result.matches.push({ type: 'deadline', text: tok.raw });
      }
      return;
    }
    // priorité
    const prio = /^(?:(!{1,3})|!([1-3]))$/.exec(tok.raw);
    if (prio) {
      result.priority = (prio[1] ? prio[1].length : Number(prio[2])) as Priority;
      consumed[i] = true;
      result.matches.push({ type: 'priority', text: tok.raw });
    }
  });

  // Première expression de date trouvée.
  for (let i = 0; i < tokens.length && result.dueDate === null; i++) {
    if (consumed[i]) continue;
    const m = matchDateAt(tokens, i, today);
    if (!m) continue;
    let start = i;
    // « ce soir » : le « ce » fait partie de l'expression.
    if (tokens[i]?.norm === 'soir') start = i - 1;
    else if (i > 0 && !consumed[i - 1] && DATE_PREPOSITIONS.has(tokens[i - 1]!.norm)) start = i - 1;
    const end = i + m.length;
    for (let k = start; k < end; k++) consumed[k] = true;
    result.dueDate = m.date;
    result.matches.push({ type: 'date', text: tokens.slice(start, end).map((t) => t.raw).join(' ') });
  }

  const title = tokens
    .filter((_, i) => !consumed[i])
    .map((t) => t.raw)
    .join(' ')
    .trim();
  result.title = title.charAt(0).toUpperCase() + title.slice(1);
  return result;
}
