import { describe, expect, it } from 'vitest';
import { computeUsageStats, type UsageEvent } from './analytics';

const ev = (subjectId: string, type: string, day: string, hour = '10'): UsageEvent => ({ subjectId, type, createdAt: `${day}T${hour}:00:00.000Z` });

// Mercredi 4 novembre 2026, semaine du lundi 2 novembre.
const NOW = new Date('2026-11-04T12:00:00Z');

describe('computeUsageStats', () => {
  const events: UsageEvent[] = [
    // Cohorte du 5 octobre : A (revient en S1, S2 et S4), B (revient en S1 seulement), C (jamais).
    ev('A', 'signup', '2026-10-05'),
    ev('A', 'login', '2026-10-05'),
    ev('A', 'login', '2026-10-13'), // J+8 → semaine 1
    ev('A', 'task_created', '2026-10-20'), // J+15 → semaine 2
    ev('A', 'login', '2026-11-03'), // J+29 → semaine 4
    ev('B', 'signup', '2026-10-07'),
    ev('B', 'login', '2026-10-15'), // J+8 → semaine 1
    ev('C', 'signup', '2026-10-08'),
    // Cohorte du 26 octobre : D, trop récente pour la semaine 2.
    ev('D', 'signup', '2026-10-27'),
    ev('D', 'login', '2026-11-04'), // J+8 → semaine 1
    // Événement sans inscription (compte supprimé avant l'onboarding…) : actif mais hors cohortes.
    ev('E', 'login', '2026-11-02'),
  ];
  const stats = computeUsageStats(events, NOW, 6);

  it('compte les inscrits une seule fois', () => {
    expect(stats.signups).toBe(4);
  });

  it('calcule la rétention par cohorte', () => {
    const [recent, october] = stats.cohorts;
    expect(october).toMatchObject({ weekStart: '2026-10-05', size: 3 });
    expect(october!.retention[1]).toEqual({ retained: 2, measurable: true });
    expect(october!.retention[2]).toEqual({ retained: 1, measurable: true });
    // Fenêtre S4 de C (inscrit le 8/10) : 5/11 → 12/11, pas encore terminée.
    expect(october!.retention[4]).toEqual({ retained: 1, measurable: false });

    expect(recent).toMatchObject({ weekStart: '2026-10-26', size: 1 });
    expect(recent!.retention[1].measurable).toBe(false);
  });

  it('pondère la rétention globale par les cohortes mesurables', () => {
    expect(stats.overall[1]).toBeCloseTo(2 / 3);
    expect(stats.overall[2]).toBeCloseTo(1 / 3);
    expect(stats.overall[4]).toBeNull();
  });

  it('compte les actifs par semaine, sans l’inscription seule', () => {
    const byWeek = Object.fromEntries(stats.weekly.map((w) => [w.weekStart, w]));
    expect(byWeek['2026-10-05']).toEqual({ weekStart: '2026-10-05', active: 1, signups: 3 }); // A seulement (C n'a rien fait)
    expect(byWeek['2026-10-12']!.active).toBe(2);
    expect(byWeek['2026-11-02']!.active).toBe(3); // A, D, E
    expect(stats.weekly).toHaveLength(6);
  });

  it('compte les actifs des 7 derniers jours', () => {
    expect(stats.activeLast7Days).toBe(3);
  });

  it('compte les événements par type', () => {
    expect(stats.eventsByType).toMatchObject({ signup: 4, login: 6, task_created: 1 });
  });

  it('fonctionne sans aucun événement', () => {
    const empty = computeUsageStats([], NOW);
    expect(empty).toMatchObject({ signups: 0, activeLast7Days: 0, cohorts: [] });
    expect(empty.overall).toEqual({ 1: null, 2: null, 4: null });
  });
});
