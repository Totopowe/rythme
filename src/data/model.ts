import type { ISODate } from '../domain/dates';
import type { OverrideKind } from '../domain/rhythm';
import type { Absence, DayOverride, Deadline, Profile, Review, RhythmConfig, ShareLink, Task } from '../domain/types';

/** Toutes les données d'un alternant, chargées en mémoire (volume faible). */
export interface UserData {
  profile: Profile;
  rhythm: RhythmConfig | null;
  overrides: DayOverride[];
  absences: Absence[];
  tasks: Task[];
  deadlines: Deadline[];
  reviews: Review[];
  shareLinks: (ShareLink & { token: string })[];
}

/** Collections d'éléments identifiés par `id`. */
export interface Collections {
  tasks: Task;
  deadlines: Deadline;
  absences: Absence;
  reviews: Review;
  shareLinks: ShareLink & { token: string };
}
export type CollectionName = keyof Collections;

/**
 * Opération d'écriture : appliquée tout de suite en local, puis envoyée au serveur
 * (immédiatement, ou plus tard si l'appareil est hors ligne).
 */
export type Op =
  | { [C in CollectionName]: { type: 'put'; coll: C; item: Collections[C] } }[CollectionName]
  | { [C in CollectionName]: { type: 'patch'; coll: C; id: string; patch: Partial<Collections[C]> } }[CollectionName]
  | { type: 'delete'; coll: CollectionName; id: string }
  | { type: 'override'; date: ISODate; kind: OverrideKind | null }
  | { type: 'rhythm'; rhythm: RhythmConfig }
  | { type: 'profile'; patch: Partial<Omit<Profile, 'id' | 'createdAt'>> };

/** Opération en attente, avec un identifiant pour la suivre. */
export interface QueuedOp {
  qid: string;
  op: Op;
}

function upsertById<T extends { id: string }>(list: readonly T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) return [...list, item];
  const next = [...list];
  next[i] = item;
  return next;
}

/** Applique une opération aux données locales (fonction pure). */
export function applyOp(data: UserData, op: Op): UserData {
  switch (op.type) {
    case 'put':
      return { ...data, [op.coll]: upsertById(data[op.coll] as { id: string }[], op.item) };
    case 'patch':
      return {
        ...data,
        [op.coll]: (data[op.coll] as { id: string }[]).map((x) => (x.id === op.id ? { ...x, ...op.patch } : x)),
      };
    case 'delete':
      return { ...data, [op.coll]: (data[op.coll] as { id: string }[]).filter((x) => x.id !== op.id) };
    case 'override': {
      const rest = data.overrides.filter((o) => o.date !== op.date);
      return { ...data, overrides: op.kind ? [...rest, { date: op.date, kind: op.kind }] : rest };
    }
    case 'rhythm':
      return { ...data, rhythm: op.rhythm };
    case 'profile':
      return { ...data, profile: { ...data.profile, ...op.patch } };
  }
}

/** Données du serveur + opérations encore en attente (pour ne jamais perdre une saisie locale). */
export function withPending(server: UserData, pending: readonly QueuedOp[]): UserData {
  return pending.reduce((data, q) => applyOp(data, q.op), server);
}

/**
 * Compacte la file : plusieurs modifications successives du même élément
 * n'en font qu'une, et un élément créé puis supprimé hors ligne disparaît.
 */
export function compactQueue(queue: readonly QueuedOp[]): QueuedOp[] {
  const result: QueuedOp[] = [];
  for (const q of queue) {
    const op = q.op;
    if (op.type === 'patch') {
      const prev = result.findLast(
        (r) => (r.op.type === 'put' || r.op.type === 'patch') && r.op.coll === op.coll && (r.op.type === 'put' ? r.op.item.id : r.op.id) === op.id,
      );
      if (prev && prev === result.at(-1)) {
        prev.op =
          prev.op.type === 'put'
            ? ({ ...prev.op, item: { ...prev.op.item, ...op.patch } } as Op)
            : ({ ...prev.op, patch: { ...(prev.op as { patch: object }).patch, ...op.patch } } as Op);
        continue;
      }
    }
    if (op.type === 'delete') {
      const createdHere = result.some((r) => r.op.type === 'put' && r.op.coll === op.coll && r.op.item.id === op.id);
      if (createdHere) {
        // Jamais envoyé au serveur : on retire simplement toutes ses opérations.
        for (let i = result.length - 1; i >= 0; i--) {
          const r = result[i]!.op;
          if ((r.type === 'put' && r.coll === op.coll && r.item.id === op.id) || (r.type === 'patch' && r.coll === op.coll && r.id === op.id)) {
            result.splice(i, 1);
          }
        }
        continue;
      }
    }
    result.push({ qid: q.qid, op: structuredClone(op) });
  }
  return result;
}

export type FlushResult = 'ok' | 'retry' | { error: string };

/**
 * Envoie les opérations dans l'ordre. S'arrête à la première erreur réseau
 * (les suivantes attendront) ; une opération refusée par le serveur est abandonnée.
 */
export async function flushQueue(
  queue: readonly QueuedOp[],
  send: (op: Op) => Promise<FlushResult>,
): Promise<{ remaining: QueuedOp[]; errors: string[]; sent: number }> {
  const errors: string[] = [];
  let sent = 0;
  for (let i = 0; i < queue.length; i++) {
    const result = await send(queue[i]!.op);
    if (result === 'retry') return { remaining: queue.slice(i), errors, sent };
    if (result === 'ok') sent++;
    else errors.push(result.error);
  }
  return { remaining: [], errors, sent };
}
