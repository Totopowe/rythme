import { makeBackup, parseBackup, type Backup } from '../domain/backup';
import { todayISO } from '../domain/dates';
import { db } from './db';

export async function exportBackup(): Promise<Backup> {
  return db.transaction('r', db.tables, async () =>
    makeBackup({
      settings: (await db.settings.get('main')) ?? null,
      weekOverrides: await db.weekOverrides.toArray(),
      tasks: await db.tasks.toArray(),
      deadlines: await db.deadlines.toArray(),
      courses: await db.courses.toArray(),
      notes: await db.notes.toArray(),
      reviews: await db.reviews.toArray(),
    }),
  );
}

export async function downloadBackup(): Promise<void> {
  const backup = await exportBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rythme-sauvegarde-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readBackupFile(file: File): Promise<Backup> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error("Le fichier n'est pas un JSON valide.");
  }
  return parseBackup(json);
}

/** Remplace toutes les données par celles de la sauvegarde. */
export async function restoreBackup(backup: Backup): Promise<void> {
  const d = backup.data;
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    if (d.settings) await db.settings.put(d.settings);
    await db.weekOverrides.bulkPut(d.weekOverrides);
    await db.tasks.bulkPut(d.tasks);
    await db.deadlines.bulkPut(d.deadlines);
    await db.courses.bulkPut(d.courses);
    await db.notes.bulkPut(d.notes);
    await db.reviews.bulkPut(d.reviews);
  });
}
