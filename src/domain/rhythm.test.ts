import { describe, expect, it } from 'vitest';
import {
  academicYearStart,
  academicYearWeeks,
  createRhythm,
  cycleKind,
  dayInfo,
  dayOverrideFor,
  DEFAULT_PATTERN,
  dominantKind,
  fullWeek,
  isDailyRhythm,
  modeAt,
  nextChange,
  nextStartOf,
  periodAt,
  periodsBetween,
  weekInfo,
  weekOverridesFor,
  weeksBetween,
} from './rhythm';
import { buildPattern } from './templates';

// Lundi 5 octobre 2026 : début du motif Entreprise ×3, École ×1.
const START = '2026-10-05';
const base = () => createRhythm(START, DEFAULT_PATTERN);
const daily = () => createRhythm(START, buildPattern('4j1j')); // école le vendredi

describe('rythme par semaines (3 sem. / 1 sem.)', () => {
  it('suit le motif', () => {
    const r = base();
    expect(modeAt(r, '2026-10-05')).toBe('entreprise');
    expect(modeAt(r, '2026-10-23')).toBe('entreprise');
    expect(modeAt(r, '2026-10-26')).toBe('ecole');
    expect(modeAt(r, '2026-10-30')).toBe('ecole');
    expect(modeAt(r, '2026-11-02')).toBe('entreprise');
    expect(modeAt(r, '2026-11-23')).toBe('ecole');
  });

  it('donne au week-end le mode du vendredi', () => {
    expect(modeAt(base(), '2026-10-25')).toBe('entreprise'); // dimanche avant l'école
    expect(modeAt(base(), '2026-11-01')).toBe('ecole'); // dimanche après l'école
    expect(dayInfo(base(), '2026-10-31').weekend).toBe(true);
  });

  it('aligne une date de début en milieu de semaine sur le lundi', () => {
    const r = createRhythm('2026-10-08', DEFAULT_PATTERN);
    expect(r.startDate).toBe('2026-10-05');
    expect(modeAt(r, '2026-10-26')).toBe('ecole');
  });

  it('prolonge le motif avant la date de début', () => {
    expect(modeAt(base(), '2026-09-28')).toBe('ecole');
    expect(modeAt(base(), '2026-09-21')).toBe('entreprise');
  });

  it('reste juste au changement d’heure et sur plusieurs années', () => {
    expect(modeAt(base(), '2026-10-26')).toBe('ecole'); // lendemain du passage à l'heure d'hiver
    expect(modeAt(base(), '2028-10-02')).toBe('entreprise'); // 104 semaines = 26 cycles
    expect(modeAt(base(), '2028-10-23')).toBe('ecole');
  });

  it('refuse un motif vide', () => {
    expect(() => createRhythm(START, [])).toThrow();
  });
});

describe('rythme par jours (4 j / 1 j)', () => {
  it('place l’école le bon jour chaque semaine', () => {
    expect(modeAt(daily(), '2026-10-08')).toBe('entreprise'); // jeudi
    expect(modeAt(daily(), '2026-10-09')).toBe('ecole'); // vendredi
    expect(modeAt(daily(), '2026-10-16')).toBe('ecole');
    expect(modeAt(daily(), '2026-10-10')).toBe('ecole'); // samedi : comme vendredi
  });

  it('est reconnu comme rythme par jours', () => {
    expect(isDailyRhythm(daily())).toBe(true);
    expect(isDailyRhythm(base())).toBe(false);
  });

  it('compte à rebours au jour près', () => {
    expect(nextChange(daily(), '2026-10-07')).toEqual({ kind: 'ecole', date: '2026-10-09', daysUntil: 2 });
    // Vendredi à l'école → retour en entreprise lundi.
    expect(nextChange(daily(), '2026-10-09')).toEqual({ kind: 'entreprise', date: '2026-10-12', daysUntil: 3 });
  });

  it('résume la semaine par son mode dominant', () => {
    const w = weekInfo(daily(), '2026-10-07');
    expect(w.kind).toBe('entreprise');
    expect(w.days).toEqual(['entreprise', 'entreprise', 'entreprise', 'entreprise', 'ecole']);
    expect(w.mixed).toBe(true);
  });

  it('accepte plusieurs jours d’école', () => {
    const r = createRhythm(START, buildPattern('3j2j', { schoolDays: [0, 1] }));
    expect(weekInfo(r, START).days).toEqual(['ecole', 'ecole', 'entreprise', 'entreprise', 'entreprise']);
  });
});

describe('corrections ponctuelles', () => {
  it('un jour férié compte comme congé et est signalé', () => {
    const r = createRhythm(START, DEFAULT_PATTERN, [{ date: '2026-11-11', kind: 'ferie' }]);
    expect(dayInfo(r, '2026-11-11')).toMatchObject({ kind: 'conge', holiday: true, isOverride: true });
    expect(weekInfo(r, '2026-11-11')).toMatchObject({ kind: 'entreprise', holidays: 1, mixed: true });
  });

  it('une semaine décalée change son mode dominant', () => {
    const overrides = weekOverridesFor(base(), '2026-10-19', 'ecole').map((o) => ({ date: o.date, kind: o.kind! }));
    const r = createRhythm(START, DEFAULT_PATTERN, overrides);
    expect(weekInfo(r, '2026-10-19').kind).toBe('ecole');
    expect(weekInfo(r, '2026-10-19').isOverride).toBe(true);
  });

  it('n’enregistre pas de correction inutile', () => {
    expect(weekOverridesFor(base(), '2026-10-26', 'ecole').every((o) => o.kind === null)).toBe(true);
    expect(weekOverridesFor(base(), '2026-10-26', 'conge').every((o) => o.kind === 'conge')).toBe(true);
    expect(dayOverrideFor(base(), '2026-10-26', 'ecole')).toBeNull();
    expect(dayOverrideFor(base(), '2026-10-26', 'ferie')).toBe('ferie');
  });
});

describe('périodes', () => {
  it('regroupe les semaines de même mode', () => {
    expect(periodAt(base(), '2026-10-14')).toEqual({ kind: 'entreprise', start: '2026-10-05', end: '2026-10-25' });
    expect(periodAt(base(), '2026-10-30')).toEqual({ kind: 'ecole', start: '2026-10-26', end: '2026-11-01' });
  });

  it('découpe un intervalle', () => {
    expect(periodsBetween(base(), '2026-10-05', '2026-11-08').map((p) => p.kind)).toEqual(['entreprise', 'ecole', 'entreprise']);
  });

  it('ne boucle pas si le mode ne change jamais', () => {
    const r = createRhythm(START, [fullWeek('entreprise')]);
    expect(periodAt(r, '2026-10-07').kind).toBe('entreprise');
    expect(nextChange(r, START)).toBeNull();
  });
});

describe('compte à rebours', () => {
  it('annonce le prochain changement', () => {
    expect(nextChange(base(), '2026-10-20')).toEqual({ kind: 'ecole', date: '2026-10-26', daysUntil: 6 });
    expect(nextChange(base(), '2026-11-01')).toEqual({ kind: 'entreprise', date: '2026-11-02', daysUntil: 1 });
  });

  it('trouve la prochaine école même après un congé', () => {
    const overrides = weekOverridesFor(base(), '2026-10-19', 'conge').map((o) => ({ date: o.date, kind: o.kind! }));
    const r = createRhythm(START, DEFAULT_PATTERN, overrides);
    expect(nextStartOf(r, '2026-10-06', 'ecole')).toEqual({ kind: 'ecole', date: '2026-10-26', daysUntil: 20 });
  });

  it('ignore la séquence en cours', () => {
    expect(nextStartOf(base(), '2026-10-27', 'ecole')?.date).toBe('2026-11-23');
  });
});

describe('outils', () => {
  it('mode dominant avec départage', () => {
    expect(dominantKind(['ecole', 'ecole', 'entreprise', 'entreprise', 'conge'])).toBe('ecole');
    expect(dominantKind(['conge', 'conge', 'conge', 'entreprise', 'entreprise'])).toBe('conge');
  });

  it('liste des semaines', () => {
    expect(weeksBetween(base(), '2026-10-07', 4).map((w) => w.kind)).toEqual(['entreprise', 'entreprise', 'entreprise', 'ecole']);
  });

  it('cycle des modes', () => {
    expect(cycleKind('ecole')).toBe('entreprise');
    expect(cycleKind('entreprise')).toBe('conge');
    expect(cycleKind('conge')).toBe('ecole');
  });

  it('année scolaire', () => {
    expect(academicYearStart('2026-10-07')).toBe(2026);
    expect(academicYearStart('2027-03-01')).toBe(2026);
    expect(academicYearStart('2027-08-10')).toBe(2027);
    const weeks = academicYearWeeks(base(), 2026);
    expect(weeks[0]?.weekStart).toBe('2026-08-31');
    expect(weeks.at(-1)?.weekStart).toBe('2027-08-23');
    expect(weeks).toHaveLength(52);
  });
});
