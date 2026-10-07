import { addDays, weekday, type ISODate } from './dates.js';
import { dayInfo, type Rhythm } from './rhythm.js';
import { ABSENCE_KIND_LABELS, DEADLINE_KIND_LABELS, WEEK_KIND_LABELS, type AbsenceKind, type DeadlineKind, type WeekKind } from './types.js';

/**
 * Génération d'un calendrier iCalendar (RFC 5545) : périodes école/entreprise,
 * absences, échéances et, pour le flux personnel, tâches datées.
 * Uniquement des événements « journée entière ».
 */

export interface IcsInput {
  calendarName: string;
  rhythm: Rhythm | null;
  absences: { id?: string; startDate: ISODate; endDate: ISODate; kind: AbsenceKind; label?: string }[];
  deadlines: { id?: string; title: string; date: ISODate; kind: DeadlineKind }[];
  tasks?: { id: string; title: string; dueDate: ISODate; done: boolean }[];
  /** Plage couverte par les périodes (bornes incluses). */
  from: ISODate;
  to: ISODate;
  /** Préfixe des titres de période (ex. prénom pour le tuteur). */
  who?: string;
}

export interface Block {
  kind: WeekKind | 'ferie';
  start: ISODate;
  /** Dernier jour ouvré du bloc (inclus). */
  end: ISODate;
}

/** Regroupe les jours ouvrés consécutifs de même mode (les week-ends ne coupent pas un bloc). */
export function rhythmBlocks(rhythm: Rhythm, from: ISODate, to: ISODate): Block[] {
  const blocks: Block[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (weekday(d) >= 5) continue;
    const info = dayInfo(rhythm, d);
    const kind = info.holiday ? 'ferie' : info.kind;
    const last = blocks.at(-1);
    if (last && last.kind === kind && nextWorkingDay(last.end) === d) last.end = d;
    else blocks.push({ kind, start: d, end: d });
  }
  return blocks;
}

function nextWorkingDay(d: ISODate): ISODate {
  let n = addDays(d, 1);
  while (weekday(n) >= 5) n = addDays(n, 1);
  return n;
}

/** Échappe un texte selon RFC 5545. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Replie les lignes à 75 octets (UTF-8), continuation par un espace. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const len = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + len > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += len;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const compact = (d: ISODate) => d.replace(/-/g, '');

function allDayEvent(uid: string, start: ISODate, endInclusive: ISODate, summary: string, stamp: string, extra: string[] = []): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(start)}`,
    `DTEND;VALUE=DATE:${compact(addDays(endInclusive, 1))}`,
    `SUMMARY:${escapeText(summary)}`,
    'TRANSP:TRANSPARENT',
    ...extra,
    'END:VEVENT',
  ];
}

const BLOCK_LABELS: Record<Block['kind'], string> = { ...WEEK_KIND_LABELS, ferie: 'Férié' };

export function buildIcs(input: IcsInput, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const prefix = input.who ? `${input.who} · ` : '';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rythme//Calendrier d’alternance//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(input.calendarName)}`,
    'X-WR-TIMEZONE:Europe/Paris',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];

  if (input.rhythm) {
    for (const b of rhythmBlocks(input.rhythm, input.from, input.to)) {
      lines.push(...allDayEvent(`periode-${b.kind}-${b.start}@rythme`, b.start, b.end, `${prefix}${BLOCK_LABELS[b.kind]}`, stamp));
    }
  }
  for (const a of input.absences) {
    const label = a.label ? `${ABSENCE_KIND_LABELS[a.kind]} – ${a.label}` : ABSENCE_KIND_LABELS[a.kind];
    lines.push(...allDayEvent(`absence-${a.id ?? a.startDate}@rythme`, a.startDate, a.endDate, `${prefix}${label}`, stamp));
  }
  for (const d of input.deadlines) {
    lines.push(...allDayEvent(`echeance-${d.id ?? `${d.date}-${d.title}`}@rythme`, d.date, d.date, `${DEADLINE_KIND_LABELS[d.kind]} : ${d.title}`, stamp));
  }
  for (const t of input.tasks ?? []) {
    lines.push(...allDayEvent(`tache-${t.id}@rythme`, t.dueDate, t.dueDate, `${t.done ? '✓' : '○'} ${t.title}`, stamp));
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
