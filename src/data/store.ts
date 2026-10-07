import { useSyncExternalStore } from 'react';
import { applyOp, compactQueue, flushQueue, withPending, type Op, type QueuedOp, type UserData } from './model';
import { fetchAll, sendOp } from './remote';

/**
 * Store de l'alternant connecté.
 * - Lecture instantanée depuis l'instantané local (fonctionne hors ligne).
 * - Écritures appliquées tout de suite en local, puis envoyées au serveur via une file
 *   persistée : rien n'est perdu si le réseau coupe ou si l'app est fermée.
 */

export type SyncStatus = 'idle' | 'loading' | 'ready' | 'offline-empty';

export interface StoreState {
  status: SyncStatus;
  userId: string | null;
  data: UserData | null;
  /** Nombre d'écritures en attente d'envoi. */
  pending: number;
  online: boolean;
}

let state: StoreState = { status: 'idle', userId: null, data: null, pending: 0, online: typeof navigator === 'undefined' ? true : navigator.onLine };
let queue: QueuedOp[] = [];
let flushing = false;
/** Nombre d'opérations en tête de file en cours d'envoi (à ne plus compacter). */
let inFlight = 0;
let flushAgain = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const errorListeners = new Set<(message: string) => void>();

const snapshotKey = (userId: string) => `rythme:v1:data:${userId}`;
const queueKey = (userId: string) => `rythme:v1:queue:${userId}`;

function emit(): void {
  for (const l of listeners) l();
}

function set(patch: Partial<StoreState>): void {
  state = { ...state, ...patch };
  emit();
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage plein ou indisponible : l'app continue en mémoire */
  }
}

function persist(): void {
  if (!state.userId) return;
  if (state.data) writeJson(snapshotKey(state.userId), state.data);
  writeJson(queueKey(state.userId), queue);
}

/** Démarre le store pour un utilisateur : instantané local d'abord, serveur ensuite. */
export async function startStore(userId: string): Promise<void> {
  if (state.userId === userId && state.status !== 'idle') return;
  queue = readJson<QueuedOp[]>(queueKey(userId)) ?? [];
  const snapshot = readJson<UserData>(snapshotKey(userId));
  set({ userId, data: snapshot, status: snapshot ? 'ready' : 'loading', pending: queue.length });
  await refresh();
  void flush();
}

export function stopStore(): void {
  if (retryTimer) clearTimeout(retryTimer);
  queue = [];
  state = { ...state, status: 'idle', userId: null, data: null, pending: 0 };
  emit();
}

/** Efface les données locales d'un utilisateur (déconnexion, suppression du compte). */
export function clearLocalData(userId: string): void {
  try {
    localStorage.removeItem(snapshotKey(userId));
    localStorage.removeItem(queueKey(userId));
  } catch {
    /* rien à faire */
  }
}

/** Recharge depuis le serveur, en conservant les écritures locales pas encore envoyées. */
export async function refresh(): Promise<void> {
  const userId = state.userId;
  if (!userId) return;
  try {
    const server = await fetchAll(userId);
    if (state.userId !== userId) return;
    set({ data: withPending(server, queue), status: 'ready', online: true });
    persist();
  } catch (e) {
    const network = (e as { network?: boolean }).network !== false;
    if (state.status === 'loading') set({ status: network ? 'offline-empty' : 'loading' });
    if (network) set({ online: false });
    scheduleRetry();
  }
}

/** Applique une écriture localement et la met en file d'envoi. */
export function dispatch(...ops: Op[]): void {
  if (!state.data || !state.userId) return;
  let data = state.data;
  for (const op of ops) {
    data = applyOp(data, op);
    queue.push({ qid: crypto.randomUUID(), op });
  }
  queue = [...queue.slice(0, inFlight), ...compactQueue(queue.slice(inFlight))];
  set({ data, pending: queue.length });
  persist();
  void flush();
}

async function flush(): Promise<void> {
  const userId = state.userId;
  if (!userId || queue.length === 0) return;
  if (flushing) {
    flushAgain = true;
    return;
  }
  flushing = true;
  try {
    const batch = queue;
    inFlight = batch.length;
    const { remaining, errors, sent } = await flushQueue(batch, (op) => sendOp(op, userId));
    inFlight = 0;
    if (state.userId !== userId) return;
    // Les écritures ajoutées pendant l'envoi restent derrière celles non envoyées.
    queue = [...remaining, ...queue.slice(batch.length)];
    set({ pending: queue.length, online: remaining.length === 0 || sent > 0 });
    persist();
    if (errors.length > 0) {
      for (const l of errorListeners) l(errors[0]!);
      // Le serveur a refusé une écriture : on se recale sur son état.
      await refresh();
    }
    if (remaining.length > 0) scheduleRetry();
  } finally {
    flushing = false;
    inFlight = 0;
    if (flushAgain) {
      flushAgain = false;
      void flush();
    }
  }
}

function scheduleRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (queue.length > 0) void flush();
    else if (state.status !== 'ready' || !state.online) void refresh();
  }, 15_000);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    set({ online: true });
    void flush().then(refresh);
  });
  window.addEventListener('offline', () => set({ online: false }));
  // Retour sur l'app : on récupère ce qui a pu changer sur un autre appareil.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.userId) void flush().then(refresh);
  });
}

export function onSyncError(listener: (message: string) => void): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStoreState(): StoreState {
  return state;
}

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getStoreState, getStoreState);
}

/** Données de l'alternant (à utiliser une fois le store prêt). */
export function useData(): UserData {
  const { data } = useStore();
  if (!data) throw new Error('Données non chargées.');
  return data;
}
