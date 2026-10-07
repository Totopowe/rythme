import { describe, expect, it } from 'vitest';
import type { Task } from '../domain/types';
import { applyOp, compactQueue, flushQueue, withPending, type Op, type QueuedOp, type UserData } from './model';
import { patchToRow, toRow } from './mappers';

const empty = (): UserData => ({
  profile: { id: 'u', firstName: 'Léa', schoolName: '', theme: 'system', wakeUpDays: 7, onboardedAt: null, createdAt: '' },
  rhythm: null,
  overrides: [],
  absences: [],
  tasks: [],
  deadlines: [],
  reviews: [],
  shareLinks: [],
});

const task = (id: string, title = id): Task => ({
  id,
  title,
  context: 'ecole',
  dueDate: null,
  priority: 0,
  order: 0,
  done: false,
  doneAt: null,
  createdAt: '2026-10-07T10:00:00Z',
});

let n = 0;
const q = (op: Op): QueuedOp => ({ qid: String(++n), op });

describe('applyOp', () => {
  it('crée, modifie et supprime', () => {
    let d = applyOp(empty(), { type: 'put', coll: 'tasks', item: task('a') });
    d = applyOp(d, { type: 'patch', coll: 'tasks', id: 'a', patch: { title: 'A+' } });
    expect(d.tasks[0]?.title).toBe('A+');
    d = applyOp(d, { type: 'delete', coll: 'tasks', id: 'a' });
    expect(d.tasks).toEqual([]);
  });

  it('pose et retire une correction de jour', () => {
    let d = applyOp(empty(), { type: 'override', date: '2026-11-11', kind: 'ferie' });
    d = applyOp(d, { type: 'override', date: '2026-11-11', kind: 'ecole' });
    expect(d.overrides).toEqual([{ date: '2026-11-11', kind: 'ecole' }]);
    d = applyOp(d, { type: 'override', date: '2026-11-11', kind: null });
    expect(d.overrides).toEqual([]);
  });

  it('ne modifie pas les données d’origine', () => {
    const d = empty();
    applyOp(d, { type: 'put', coll: 'tasks', item: task('a') });
    expect(d.tasks).toEqual([]);
  });
});

describe('withPending', () => {
  it('réapplique les saisies locales sur les données du serveur', () => {
    const server = { ...empty(), tasks: [task('a')] };
    const merged = withPending(server, [q({ type: 'put', coll: 'tasks', item: task('b') }), q({ type: 'patch', coll: 'tasks', id: 'a', patch: { done: true } })]);
    expect(merged.tasks.map((t) => [t.id, t.done])).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });
});

describe('compactQueue', () => {
  it('fusionne les modifications successives d’un même élément', () => {
    const out = compactQueue([
      q({ type: 'put', coll: 'tasks', item: task('a') }),
      q({ type: 'patch', coll: 'tasks', id: 'a', patch: { title: 'A1' } }),
      q({ type: 'patch', coll: 'tasks', id: 'a', patch: { priority: 2 } }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.op).toMatchObject({ type: 'put', item: { title: 'A1', priority: 2 } });
  });

  it('efface un élément créé puis supprimé hors ligne', () => {
    const out = compactQueue([
      q({ type: 'put', coll: 'tasks', item: task('a') }),
      q({ type: 'patch', coll: 'tasks', id: 'a', patch: { title: 'A1' } }),
      q({ type: 'put', coll: 'tasks', item: task('b') }),
      q({ type: 'delete', coll: 'tasks', id: 'a' }),
    ]);
    expect(out.map((o) => o.op.type === 'put' && o.op.item.id)).toEqual(['b']);
  });

  it('garde la suppression d’un élément déjà connu du serveur', () => {
    const out = compactQueue([q({ type: 'patch', coll: 'tasks', id: 'a', patch: { title: 'x' } }), q({ type: 'delete', coll: 'tasks', id: 'a' })]);
    expect(out.map((o) => o.op.type)).toEqual(['patch', 'delete']);
  });

  it('ne fusionne pas par-dessus une autre opération (ordre préservé)', () => {
    const out = compactQueue([
      q({ type: 'patch', coll: 'tasks', id: 'a', patch: { order: 1 } }),
      q({ type: 'patch', coll: 'tasks', id: 'b', patch: { order: 0 } }),
      q({ type: 'patch', coll: 'tasks', id: 'a', patch: { title: 'x' } }),
    ]);
    expect(out).toHaveLength(3);
  });
});

describe('flushQueue', () => {
  it('envoie tout quand le réseau répond', async () => {
    const sent: string[] = [];
    const r = await flushQueue([q({ type: 'delete', coll: 'tasks', id: 'a' }), q({ type: 'delete', coll: 'tasks', id: 'b' })], async (op) => {
      sent.push((op as { id: string }).id);
      return 'ok';
    });
    expect(sent).toEqual(['a', 'b']);
    expect(r).toEqual({ remaining: [], errors: [], sent: 2 });
  });

  it('s’arrête au premier problème réseau et garde la suite', async () => {
    const queue = [q({ type: 'delete', coll: 'tasks', id: 'a' }), q({ type: 'delete', coll: 'tasks', id: 'b' }), q({ type: 'delete', coll: 'tasks', id: 'c' })];
    const r = await flushQueue(queue, async (op) => ((op as { id: string }).id === 'b' ? 'retry' : 'ok'));
    expect(r.remaining.map((x) => (x.op as { id: string }).id)).toEqual(['b', 'c']);
    expect(r.sent).toBe(1);
  });

  it('abandonne une opération refusée et continue', async () => {
    const queue = [q({ type: 'delete', coll: 'tasks', id: 'a' }), q({ type: 'delete', coll: 'tasks', id: 'b' })];
    const r = await flushQueue(queue, async (op) => ((op as { id: string }).id === 'a' ? { error: 'refusé' } : 'ok'));
    expect(r).toEqual({ remaining: [], errors: ['refusé'], sent: 1 });
  });
});

describe('mappers', () => {
  it('convertit une tâche en ligne Postgres sans champ dérivé', () => {
    expect(toRow('tasks', { ...task('a'), order: 3, dueDate: '2026-10-09' })).toEqual({
      id: 'a',
      title: 'a',
      context: 'ecole',
      due_date: '2026-10-09',
      priority: 0,
      position: 3,
      done_at: null,
      created_at: '2026-10-07T10:00:00Z',
    });
  });

  it('limite la modification d’un lien à sa révocation', () => {
    expect(patchToRow({ type: 'patch', coll: 'shareLinks', id: 'l', patch: { revokedAt: 'now', token: 'x' } })).toEqual({ revoked_at: 'now' });
    expect(patchToRow({ type: 'patch', coll: 'tasks', id: 't', patch: { done: true, doneAt: 'now' } })).toEqual({ done_at: 'now' });
  });
});
