import { addDays, isISODate, isValidDate, makeISO, startOfWeek, type ISODate } from './dates';
import { normalize } from './quickCapture';
import type { WeekKind } from './types';

/**
 * Import manuel de semaines, une ligne par semaine ou par plage :
 *
 *   26/10/2026 école
 *   2026-11-02 entreprise
 *   21/12/2026 au 03/01/2027 congé
 *   # les lignes commençant par # sont ignorées
 */
export interface WeekImportResult {
  weeks: { weekStart: ISODate; kind: WeekKind }[];
  errors: { line: number; text: string }[];
}

const KINDS: Record<string, WeekKind> = {
  ecole: 'ecole',
  cours: 'ecole',
  e: 'ecole',
  entreprise: 'entreprise',
  ent: 'entreprise',
  travail: 'entreprise',
  conge: 'conge',
  conges: 'conge',
  vacances: 'conge',
  ferie: 'conge',
};

function parseDate(token: string): ISODate | null {
  if (isISODate(token)) return token;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(token);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return isValidDate(y, mo, d) ? makeISO(y, mo, d) : null;
}

export function parseWeekList(text: string): WeekImportResult {
  const result: WeekImportResult = { weeks: [], errors: [] };
  const byWeek = new Map<ISODate, WeekKind>();

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const tokens = line.split(/[\s,;\t]+/).map(normalize).filter(Boolean);
    const dates = tokens.map(parseDate).filter((d): d is ISODate => d !== null);
    const kind = tokens.map((t) => KINDS[t]).find((k) => k !== undefined);

    if (dates.length === 0 || dates.length > 2 || !kind) {
      result.errors.push({ line: index + 1, text: line });
      return;
    }
    const from = startOfWeek(dates[0]!);
    const to = startOfWeek(dates[1] ?? dates[0]!);
    if (to < from || to > addDays(from, 7 * 60)) {
      result.errors.push({ line: index + 1, text: line });
      return;
    }
    for (let w = from; w <= to; w = addDays(w, 7)) byWeek.set(w, kind);
  });

  result.weeks = [...byWeek].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, kind]) => ({ weekStart, kind }));
  return result;
}
