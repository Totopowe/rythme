import { describe, expect, it } from 'vitest';
import {
  academicYearStart,
  academicYearWeeks,
  createRhythm,
  cycleKind,
  DEFAULT_PATTERN,
  modeAt,
  nextChange,
  nextStartOf,
  overrideFor,
  periodAt,
  periodsBetween,
  weeksBetween,
} from './rhythm';

// Lundi 5 octobre 2026 : début du motif Entreprise ×3, École ×1.
const START = '2026-10-05';
const base = () => createRhythm(START, DEFAULT_PATTERN);

describe('modeAt', () => {
  it('suit le motif 3 semaines entreprise / 1 semaine école', () => {
    const r = base();
    expect(modeAt(r, '2026-10-05')).toBe('entreprise');
    expect(modeAt(r, '2026-10-18')).toBe('entreprise'); // dimanche semaine 2
    expect(modeAt(r, '2026-10-19')).toBe('entreprise');
    expect(modeAt(r, '2026-10-26')).toBe('ecole');
    expect(modeAt(r, '2026-11-01')).toBe('ecole'); // dimanche de la semaine d'école
    expect(modeAt(r, '2026-11-02')).toBe('entreprise');
    expect(modeAt(r, '2026-11-23')).toBe('ecole');
  });

  it("aligne une date de début en milieu de semaine sur le lundi", () => {
    const r = createRhythm('2026-10-08', DEFAULT_PATTERN);
    expect(r.startDate).toBe('2026-10-05');
    expect(modeAt(r, '2026-10-26')).toBe('ecole');
  });

  it('prolonge le motif avant la date de début', () => {
    const r = base();
    expect(modeAt(r, '2026-09-28')).toBe('ecole');
    expect(modeAt(r, '2026-09-21')).toBe('entreprise');
  });

  it('reste correct au passage à l’heure d’hiver et sur plusieurs années', () => {
    const r = base();
    // 25 octobre 2026 : changement d'heure ; la semaine du 26 est bien École.
    expect(modeAt(r, '2026-10-25')).toBe('entreprise');
    expect(modeAt(r, '2026-10-26')).toBe('ecole');
    // 2 ans plus tard : 104 semaines = 26 cycles exacts.
    expect(modeAt(r, '2028-10-02')).toBe('entreprise');
    expect(modeAt(r, '2028-10-23')).toBe('ecole');
  });

  it('applique les exceptions en priorité', () => {
    const r = createRhythm(START, DEFAULT_PATTERN, [
      { weekStart: '2026-10-12', kind: 'conge' },
      { weekStart: '2026-10-28', kind: 'entreprise' }, // mercredi → ramené au lundi 26
    ]);
    expect(modeAt(r, '2026-10-14')).toBe('conge');
    expect(modeAt(r, '2026-10-26')).toBe('entreprise');
  });

  it('accepte des motifs irréguliers', () => {
    const r = createRhythm(START, ['ecole', 'ecole', 'entreprise']);
    expect(modeAt(r, '2026-10-05')).toBe('ecole');
    expect(modeAt(r, '2026-10-12')).toBe('ecole');
    expect(modeAt(r, '2026-10-19')).toBe('entreprise');
    expect(modeAt(r, '2026-10-26')).toBe('ecole');
  });

  it('refuse un motif vide', () => {
    expect(() => createRhythm(START, [])).toThrow();
  });
});

describe('periodAt', () => {
  it('regroupe les semaines consécutives de même type', () => {
    expect(periodAt(base(), '2026-10-14')).toEqual({ kind: 'entreprise', start: '2026-10-05', end: '2026-10-25' });
    expect(periodAt(base(), '2026-10-30')).toEqual({ kind: 'ecole', start: '2026-10-26', end: '2026-11-01' });
  });

  it('coupe une période autour d’un congé', () => {
    const r = createRhythm(START, DEFAULT_PATTERN, [{ weekStart: '2026-10-12', kind: 'conge' }]);
    expect(periodAt(r, '2026-10-05')).toEqual({ kind: 'entreprise', start: '2026-10-05', end: '2026-10-11' });
    expect(periodAt(r, '2026-10-12')).toEqual({ kind: 'conge', start: '2026-10-12', end: '2026-10-18' });
  });

  it('ne boucle pas indéfiniment si le rythme ne change jamais', () => {
    const r = createRhythm(START, ['entreprise']);
    const p = periodAt(r, '2026-10-07');
    expect(p.kind).toBe('entreprise');
    expect(p.start < '2026-10-05').toBe(true);
  });
});

describe('nextChange', () => {
  it('donne le compte à rebours avant le prochain mode', () => {
    // Mardi 20 octobre → École lundi 26 : dans 6 jours.
    expect(nextChange(base(), '2026-10-20')).toEqual({ kind: 'ecole', date: '2026-10-26', daysUntil: 6 });
    expect(nextChange(base(), '2026-10-26')).toEqual({ kind: 'entreprise', date: '2026-11-02', daysUntil: 7 });
    expect(nextChange(base(), '2026-11-01')).toEqual({ kind: 'entreprise', date: '2026-11-02', daysUntil: 1 });
  });

  it('renvoie null si le mode ne change jamais', () => {
    expect(nextChange(createRhythm(START, ['ecole']), START)).toBeNull();
  });
});

describe('nextStartOf', () => {
  it('trouve la prochaine semaine d’école même après un congé', () => {
    const r = createRhythm(START, DEFAULT_PATTERN, [{ weekStart: '2026-10-19', kind: 'conge' }]);
    expect(nextStartOf(r, '2026-10-06', 'ecole')).toEqual({ kind: 'ecole', date: '2026-10-26', daysUntil: 20 });
  });

  it('ignore la période en cours', () => {
    expect(nextStartOf(base(), '2026-10-27', 'ecole')?.date).toBe('2026-11-23');
  });
});

describe('weeksBetween / periodsBetween', () => {
  it('liste les semaines avec leurs exceptions', () => {
    const r = createRhythm(START, DEFAULT_PATTERN, [{ weekStart: '2026-10-12', kind: 'conge' }]);
    const weeks = weeksBetween(r, '2026-10-07', 4);
    expect(weeks.map((w) => w.kind)).toEqual(['entreprise', 'conge', 'entreprise', 'ecole']);
    expect(weeks[1]?.isOverride).toBe(true);
    expect(weeks[0]?.weekStart).toBe('2026-10-05');
  });

  it('découpe un intervalle en périodes', () => {
    const periods = periodsBetween(base(), '2026-10-05', '2026-11-08');
    expect(periods.map((p) => p.kind)).toEqual(['entreprise', 'ecole', 'entreprise']);
  });
});

describe('overrideFor / cycleKind', () => {
  it('n’enregistre pas d’exception inutile', () => {
    expect(overrideFor(base(), '2026-10-26', 'ecole')).toBeNull();
    expect(overrideFor(base(), '2026-10-26', 'conge')).toBe('conge');
  });

  it('fait tourner les types de semaine', () => {
    expect(cycleKind('ecole')).toBe('entreprise');
    expect(cycleKind('entreprise')).toBe('conge');
    expect(cycleKind('conge')).toBe('ecole');
  });
});

describe('année scolaire', () => {
  it('commence en août pour l’année suivante', () => {
    expect(academicYearStart('2026-10-07')).toBe(2026);
    expect(academicYearStart('2027-03-01')).toBe(2026);
    expect(academicYearStart('2027-08-10')).toBe(2027);
  });

  it('couvre septembre à août', () => {
    const weeks = academicYearWeeks(base(), 2026);
    expect(weeks[0]?.weekStart).toBe('2026-08-31'); // jeudi 3 septembre
    expect(weeks.at(-1)?.weekStart).toBe('2027-08-23'); // le 30 août tombe dans une semaine de septembre
    expect(weeks.length).toBe(52);
    // 2027 : le 1er septembre est un mercredi, la semaine du 30 août est la première.
    expect(academicYearWeeks(base(), 2027)[0]?.weekStart).toBe('2027-08-30');
  });
});
