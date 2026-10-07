import Dexie, { type Table } from 'dexie';
import type { Course, Deadline, Note, Review, Settings, Task, WeekOverride } from '../domain/types';

export class RythmeDB extends Dexie {
  settings!: Table<Settings, 'main'>;
  weekOverrides!: Table<WeekOverride, string>;
  tasks!: Table<Task, string>;
  deadlines!: Table<Deadline, string>;
  courses!: Table<Course, string>;
  notes!: Table<Note, string>;
  reviews!: Table<Review, string>;

  constructor(name = 'rythme') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      weekOverrides: 'weekStart',
      tasks: 'id, context, dueDate, done, order',
      deadlines: 'id, date, context',
      courses: 'id, context',
      notes: 'id, context, courseId, updatedAt',
      reviews: 'id, periodEnd',
    });
  }
}

export const db = new RythmeDB();

export function newId(): string {
  return crypto.randomUUID();
}

export function nowStamp(): string {
  return new Date().toISOString();
}
