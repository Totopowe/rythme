import { describe, expect, it } from 'vitest';
import { createRhythm, DEFAULT_PATTERN, fullWeek } from './rhythm';
import {
  isDormant,
  pendingTransition,
  reviewContent,
  schoolWakeState,
  todayBuckets,
  upcomingDeadlines,
} from './planning';
import type { Context, Deadline, Task } from './types';

// Entreprise : 5→25 oct., École : 26 oct.→1er nov., Entreprise : 2→22 nov., École : 23→29 nov.
const rhythm = createRhythm('2026-10-05', DEFAULT_PATTERN);

let seq = 0;
function task(partial: Partial<Task> & { context?: Context } = {}): Task {
  seq++;
  return {
    id: `t${seq}`,
    title: `Tâche ${seq}`,
    context: 'perso',
    dueDate: null,
    priority: 0,
    order: seq,
    done: false,
    doneAt: null,
    createdAt: `2026-01-01T00:00:${String(seq).padStart(2, '0')}`,
    ...partial,
  };
}

function deadline(date: string, title = 'D'): Deadline {
  return { id: date + title, title, date, context: 'ecole', kind: 'rendu', notes: '', visibleToTutor: false, createdAt: '' };
}

describe('schoolWakeState', () => {
  it('dort loin de la semaine d’école', () => {
    expect(schoolWakeState(rhythm, '2026-10-07', 7)).toEqual({
      awake: false,
      inSchool: false,
      schoolStart: '2026-10-26',
      daysUntil: 19,
    });
  });

  it('se réveille N jours avant', () => {
    expect(schoolWakeState(rhythm, '2026-10-19', 7).awake).toBe(true);
    expect(schoolWakeState(rhythm, '2026-10-18', 7).awake).toBe(false);
    expect(schoolWakeState(rhythm, '2026-10-12', 14).awake).toBe(true);
  });

  it('est éveillé pendant la semaine d’école', () => {
    expect(schoolWakeState(rhythm, '2026-10-28', 7)).toMatchObject({ awake: true, inSchool: true, schoolStart: '2026-10-26' });
  });

  it('gère un rythme sans école', () => {
    const r = createRhythm('2026-10-05', [fullWeek('entreprise')]);
    expect(schoolWakeState(r, '2026-10-07', 7).awake).toBe(false);
  });
});

describe('isDormant', () => {
  const asleep = schoolWakeState(rhythm, '2026-10-07', 7);
  const awake = schoolWakeState(rhythm, '2026-10-20', 7);

  it('endort les tâches École sans date proche pendant l’entreprise', () => {
    expect(isDormant(task({ context: 'ecole' }), asleep, '2026-10-07')).toBe(true);
    expect(isDormant(task({ context: 'ecole', dueDate: '2026-10-30' }), asleep, '2026-10-07')).toBe(true);
  });

  it('garde éveillées les tâches à date proche, les autres contextes et les tâches faites', () => {
    expect(isDormant(task({ context: 'ecole', dueDate: '2026-10-09' }), asleep, '2026-10-07')).toBe(false);
    expect(isDormant(task({ context: 'perso' }), asleep, '2026-10-07')).toBe(false);
    expect(isDormant(task({ context: 'ecole', done: true }), asleep, '2026-10-07')).toBe(false);
  });

  it('réveille tout à l’approche de l’école', () => {
    expect(isDormant(task({ context: 'ecole' }), awake, '2026-10-20')).toBe(false);
  });
});

describe('todayBuckets', () => {
  it('répartit les tâches', () => {
    const today = '2026-10-20'; // mardi, école dans 6 jours
    const wake = schoolWakeState(rhythm, today, 7);
    const late = task({ dueDate: '2026-10-18' });
    const now = task({ dueDate: today });
    const doneNow = task({ dueDate: today, done: true });
    const friday = task({ dueDate: '2026-10-23' });
    const later = task({ dueDate: '2026-11-10' });
    const school = task({ context: 'ecole' });
    const doneLate = task({ dueDate: '2026-10-01', done: true });
    const b = todayBuckets([late, now, doneNow, friday, later, school, doneLate], today, wake);
    expect(b.overdue).toEqual([late]);
    expect(b.today).toEqual([now, doneNow]);
    expect(b.thisWeek).toEqual([friday]);
    expect(b.wokenUp).toEqual([school]);
  });

  it('ne met pas de tâches réveillées pendant l’école ni loin de l’école', () => {
    const school = task({ context: 'ecole' });
    expect(todayBuckets([school], '2026-10-27', schoolWakeState(rhythm, '2026-10-27', 7)).wokenUp).toEqual([]);
    expect(todayBuckets([school], '2026-10-07', schoolWakeState(rhythm, '2026-10-07', 7)).wokenUp).toEqual([]);
  });

  it('trie par priorité les tâches du jour', () => {
    const today = '2026-10-07';
    const low = task({ dueDate: today, priority: 1 });
    const high = task({ dueDate: today, priority: 3 });
    expect(todayBuckets([low, high], today, schoolWakeState(rhythm, today, 7)).today).toEqual([high, low]);
  });
});

describe('upcomingDeadlines', () => {
  it('garde les échéances à venir dans la fenêtre, triées', () => {
    const list = [deadline('2026-10-25'), deadline('2026-10-06'), deadline('2026-10-10'), deadline('2026-12-01')];
    expect(upcomingDeadlines(list, '2026-10-07').map((d) => d.date)).toEqual(['2026-10-10', '2026-10-25']);
  });
});

describe('pendingTransition', () => {
  it('ne propose rien en milieu de période', () => {
    expect(pendingTransition(rhythm, '2026-10-14', [])).toBeNull();
    expect(pendingTransition(rhythm, '2026-10-22', [])).toBeNull(); // jeudi
  });

  it('propose la revue à partir du vendredi de la dernière semaine', () => {
    const t = pendingTransition(rhythm, '2026-10-23', []);
    expect(t).toMatchObject({ from: 'entreprise', to: 'ecole' });
    expect(t?.period.end).toBe('2026-10-25');
    expect(t?.next).toEqual({ kind: 'ecole', start: '2026-10-26', end: '2026-11-01' });
  });

  it('rattrape une revue oubliée en début de période', () => {
    expect(pendingTransition(rhythm, '2026-10-27', [])?.period.end).toBe('2026-10-25');
    expect(pendingTransition(rhythm, '2026-10-29', [])).toBeNull();
  });

  it('ne fait pas rattraper une période antérieure à la configuration', () => {
    expect(pendingTransition(rhythm, '2026-10-27', [], '2026-10-26')).toBeNull();
    expect(pendingTransition(rhythm, '2026-10-27', [], '2026-10-20')?.period.end).toBe('2026-10-25');
  });

  it('ne repropose pas une revue faite', () => {
    expect(pendingTransition(rhythm, '2026-10-24', [{ periodEnd: '2026-10-25' }])).toBeNull();
    expect(pendingTransition(rhythm, '2026-10-26', [{ periodEnd: '2026-10-25' }])).toBeNull();
  });

  it('enchaîne : en fin d’école, propose École → Entreprise', () => {
    const t = pendingTransition(rhythm, '2026-10-30', [{ periodEnd: '2026-10-25' }]);
    expect(t).toMatchObject({ from: 'ecole', to: 'entreprise' });
  });
});

describe('reviewContent', () => {
  it('liste ce qui reste, ce qu’il faut préparer et les échéances à venir', () => {
    const t = pendingTransition(rhythm, '2026-10-23', [])!;
    const entOpen = task({ context: 'entreprise' });
    const entDone = task({ context: 'entreprise', done: true });
    const school = task({ context: 'ecole', dueDate: '2026-10-27' });
    const perso = task({ context: 'perso' });
    const c = reviewContent(t, [entOpen, entDone, school, perso], [deadline('2026-10-28'), deadline('2026-11-05')]);
    expect(c.pending).toEqual([entOpen]);
    expect(c.toPrepare).toEqual([school]);
    expect(c.deadlines.map((d) => d.date)).toEqual(['2026-10-28']);
  });
});
