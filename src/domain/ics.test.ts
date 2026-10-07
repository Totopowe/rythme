import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, foldLine, rhythmBlocks } from './ics';
import { createRhythm, DEFAULT_PATTERN } from './rhythm';
import { buildPattern } from './templates';

const rhythm = createRhythm('2026-10-05', DEFAULT_PATTERN, [{ date: '2026-11-11', kind: 'ferie' }]);
const NOW = new Date('2026-10-07T08:00:00Z');

describe('rhythmBlocks', () => {
  it('regroupe 3 semaines d’entreprise en un seul bloc malgré les week-ends', () => {
    expect(rhythmBlocks(rhythm, '2026-10-05', '2026-11-01')).toEqual([
      { kind: 'entreprise', start: '2026-10-05', end: '2026-10-23' },
      { kind: 'ecole', start: '2026-10-26', end: '2026-10-30' },
    ]);
  });

  it('coupe un bloc sur un jour férié', () => {
    const blocks = rhythmBlocks(rhythm, '2026-11-09', '2026-11-13');
    expect(blocks).toEqual([
      { kind: 'entreprise', start: '2026-11-09', end: '2026-11-10' },
      { kind: 'ferie', start: '2026-11-11', end: '2026-11-11' },
      { kind: 'entreprise', start: '2026-11-12', end: '2026-11-13' },
    ]);
  });

  it('alterne au jour près pour un rythme 4 j / 1 j', () => {
    const daily = createRhythm('2026-10-05', buildPattern('4j1j'));
    expect(rhythmBlocks(daily, '2026-10-05', '2026-10-13').map((b) => `${b.kind}:${b.start}→${b.end}`)).toEqual([
      'entreprise:2026-10-05→2026-10-08',
      'ecole:2026-10-09→2026-10-09',
      'entreprise:2026-10-12→2026-10-13',
    ]);
  });
});

describe('format iCalendar', () => {
  it('échappe les caractères spéciaux', () => {
    expect(escapeText('Rendu; dossier, final\nv2')).toBe('Rendu\\; dossier\\, final\\nv2');
  });

  it('replie les lignes longues à 75 octets sans couper un caractère', () => {
    const line = 'SUMMARY:' + 'é'.repeat(80);
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(line);
  });

  it('produit un calendrier valide avec périodes, absences et échéances', () => {
    const ics = buildIcs(
      {
        calendarName: 'Alternance de Léa',
        who: 'Léa',
        rhythm,
        from: '2026-10-05',
        to: '2026-11-01',
        absences: [{ id: 'a1', startDate: '2026-12-21', endDate: '2027-01-01', kind: 'conge' }],
        deadlines: [{ id: 'd1', title: 'Compta, partie 2', date: '2026-10-28', kind: 'partiel' }],
      },
      NOW,
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261005\r\nDTEND;VALUE=DATE:20261024');
    expect(ics).toContain('SUMMARY:Léa · Entreprise');
    expect(ics).toContain('SUMMARY:Léa · Congés');
    expect(ics).toContain('DTEND;VALUE=DATE:20270102');
    expect(ics).toContain('SUMMARY:Partiel : Compta\\, partie 2');
    expect(ics).toContain('DTSTAMP:20261007T080000Z');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it('ajoute les tâches datées au flux personnel', () => {
    const ics = buildIcs(
      { calendarName: 'Rythme', rhythm: null, from: '2026-10-05', to: '2026-10-05', absences: [], deadlines: [], tasks: [{ id: 't', title: 'Relire', dueDate: '2026-10-09', done: false }] },
      NOW,
    );
    expect(ics).toContain('SUMMARY:○ Relire');
    expect(ics).toContain('UID:tache-t@rythme');
  });
});
