import { describe, expect, it } from 'vitest';
import { parseWeekList } from './weekImport';

describe('parseWeekList', () => {
  it('lit une semaine par ligne, en formats français et ISO', () => {
    const r = parseWeekList('26/10/2026 école\n2026-11-04 entreprise\n');
    expect(r.errors).toEqual([]);
    expect(r.weeks).toEqual([
      { weekStart: '2026-10-26', kind: 'ecole' },
      { weekStart: '2026-11-02', kind: 'entreprise' },
    ]);
  });

  it('développe les plages', () => {
    const r = parseWeekList('21/12/2026 au 03/01/2027 congés');
    expect(r.weeks).toEqual([
      { weekStart: '2026-12-21', kind: 'conge' },
      { weekStart: '2026-12-28', kind: 'conge' },
    ]);
  });

  it('accepte le type avant la date, les séparateurs CSV et les commentaires', () => {
    const r = parseWeekList('# calendrier 2026\nVacances;19.10.26\nENTREPRISE, 2026-10-26');
    expect(r.errors).toEqual([]);
    expect(r.weeks.map((w) => w.kind)).toEqual(['conge', 'entreprise']);
  });

  it('signale les lignes illisibles avec leur numéro', () => {
    const r = parseWeekList('26/10/2026 école\nn’importe quoi\n31/02/2026 école\n03/01/2027 au 21/12/2026 congé');
    expect(r.weeks).toHaveLength(1);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4]);
  });

  it('garde la dernière valeur pour une semaine répétée', () => {
    const r = parseWeekList('26/10/2026 école\n28/10/2026 congé');
    expect(r.weeks).toEqual([{ weekStart: '2026-10-26', kind: 'conge' }]);
  });
});
