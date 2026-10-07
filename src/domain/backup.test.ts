import { describe, expect, it } from 'vitest';
import { BackupError, makeBackup, parseBackup, type BackupData } from './backup';

const data: BackupData = {
  settings: {
    id: 'main',
    startDate: '2026-10-05',
    pattern: ['entreprise', 'entreprise', 'entreprise', 'ecole'],
    wakeUpDaysBefore: 7,
    theme: 'dark',
    onboarded: true,
  },
  weekOverrides: [{ weekStart: '2026-12-21', kind: 'conge' }],
  tasks: [
    {
      id: 't1',
      title: 'Rendre dossier',
      context: 'ecole',
      dueDate: '2026-10-09',
      priority: 2,
      order: 0,
      done: false,
      doneAt: null,
      courseId: null,
      createdAt: '2026-10-07T10:00:00.000Z',
    },
  ],
  deadlines: [{ id: 'd1', title: 'Partiel compta', date: '2026-10-30', context: 'ecole', kind: 'partiel', notes: '', createdAt: '' }],
  courses: [{ id: 'c1', name: 'Finance', context: 'ecole', createdAt: '' }],
  notes: [
    { id: 'n1', title: 'Cours 1', body: '# Titre', context: 'ecole', courseId: 'c1', pinned: false, createdAt: 'a', updatedAt: 'b' },
  ],
  reviews: [{ id: 'r1', periodEnd: '2026-10-25', fromKind: 'entreprise', toKind: 'ecole', summary: 'ok', createdAt: '' }],
};

describe('sauvegarde', () => {
  it('fait un aller-retour sans perte', () => {
    const backup = makeBackup(data, new Date('2026-10-07T12:00:00Z'));
    const roundTrip = parseBackup(JSON.parse(JSON.stringify(backup)));
    expect(roundTrip).toEqual(backup);
  });

  it('refuse un fichier étranger', () => {
    expect(() => parseBackup({ hello: 'world' })).toThrow(BackupError);
    expect(() => parseBackup(null)).toThrow(BackupError);
    expect(() => parseBackup([])).toThrow(BackupError);
  });

  it('refuse une version future', () => {
    expect(() => parseBackup({ format: 'rythme-backup', version: 99, data: {} })).toThrow(/plus récente/);
  });

  it('signale précisément un élément invalide', () => {
    const bad = makeBackup({ ...data, tasks: [{ ...data.tasks[0]!, context: 'bureau' as never }] });
    expect(() => parseBackup(JSON.parse(JSON.stringify(bad)))).toThrow(/tasks.*context/);
  });

  it('complète les champs facultatifs manquants', () => {
    const b = parseBackup({
      format: 'rythme-backup',
      version: 1,
      data: { tasks: [{ id: 'x', title: 'X', context: 'perso' }] },
    });
    expect(b.data.tasks[0]).toMatchObject({ dueDate: null, priority: 0, done: false, courseId: null });
    expect(b.data.notes).toEqual([]);
    expect(b.data.settings).toBeNull();
  });
});
