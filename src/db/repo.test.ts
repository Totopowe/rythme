import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, restoreBackup } from './backup';
import { db } from './db';
import { addCourse, addNote, addTask, deleteCourse, deleteTask, reorderTasks, saveSettings, setWeekKind, toggleTask } from './repo';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('dépôt', () => {
  it('ajoute les nouvelles tâches en haut et réordonne', async () => {
    const a = await addTask({ title: 'A', context: 'perso' });
    const b = await addTask({ title: 'B', context: 'perso' });
    let ordered = await db.tasks.orderBy('order').toArray();
    expect(ordered.map((t) => t.title)).toEqual(['B', 'A']);
    await reorderTasks([a.id, b.id]);
    ordered = await db.tasks.orderBy('order').toArray();
    expect(ordered.map((t) => t.title)).toEqual(['A', 'B']);
  });

  it('coche puis décoche', async () => {
    const t = await addTask({ title: 'A', context: 'perso' });
    await toggleTask(t);
    const done = (await db.tasks.get(t.id))!;
    expect(done.done).toBe(true);
    expect(done.doneAt).not.toBeNull();
    await toggleTask(done);
    expect((await db.tasks.get(t.id))!.done).toBe(false);
  });

  it('annule une suppression', async () => {
    const t = await addTask({ title: 'A', context: 'ecole' });
    const restore = await deleteTask(t.id);
    expect(await db.tasks.count()).toBe(0);
    await restore();
    expect(await db.tasks.get(t.id)).toEqual(t);
  });

  it('détache les notes d’un cours supprimé puis les rattache à l’annulation', async () => {
    const c = await addCourse('Finance', 'ecole');
    const n = await addNote({ context: 'ecole', courseId: c.id });
    const restore = await deleteCourse(c.id);
    expect((await db.notes.get(n.id))!.courseId).toBeNull();
    await restore();
    expect((await db.notes.get(n.id))!.courseId).toBe(c.id);
    expect(await db.courses.get(c.id)).toBeDefined();
  });

  it('n’enregistre une exception de semaine que si nécessaire', async () => {
    await saveSettings({ startDate: '2026-10-05', pattern: ['entreprise', 'entreprise', 'entreprise', 'ecole'] });
    const settings = (await db.settings.get('main'))!;
    await setWeekKind(settings, '2026-10-14', 'conge');
    expect(await db.weekOverrides.toArray()).toEqual([{ weekStart: '2026-10-12', kind: 'conge' }]);
    await setWeekKind(settings, '2026-10-12', 'entreprise');
    expect(await db.weekOverrides.count()).toBe(0);
  });

  it('exporte puis restaure toutes les données', async () => {
    await saveSettings({ startDate: '2026-10-05', onboarded: true });
    await addTask({ title: 'A', context: 'ecole', dueDate: '2026-10-09' });
    await addNote({ context: 'perso', title: 'N', body: 'texte' });
    const backup = await exportBackup();
    await Promise.all(db.tables.map((t) => t.clear()));
    await restoreBackup(backup);
    expect(await exportBackup()).toEqual({ ...backup, exportedAt: expect.any(String) });
  });
});
