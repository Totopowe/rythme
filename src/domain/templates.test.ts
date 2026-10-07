import { describe, expect, it } from 'vitest';
import { fullWeek } from './rhythm';
import { buildPattern, parsePattern } from './templates';

const E = fullWeek('entreprise');
const S = fullWeek('ecole');

describe('modèles de rythme', () => {
  it('3 sem. / 1 sem., dans les deux sens', () => {
    expect(buildPattern('3s1s')).toEqual([E, E, E, S]);
    expect(buildPattern('3s1s', { startsWith: 'ecole' })).toEqual([S, E, E, E]);
  });

  it('2 sem. / 2 sem.', () => {
    expect(buildPattern('2s2s')).toEqual([E, E, S, S]);
    expect(buildPattern('2s2s', { startsWith: 'ecole' })).toEqual([S, S, E, E]);
  });

  it('4 j / 1 j : vendredi par défaut, jour modifiable', () => {
    expect(buildPattern('4j1j')).toEqual([['entreprise', 'entreprise', 'entreprise', 'entreprise', 'ecole']]);
    expect(buildPattern('4j1j', { schoolDays: [0] })).toEqual([['ecole', 'entreprise', 'entreprise', 'entreprise', 'entreprise']]);
  });

  it('3 j / 2 j : jeudi et vendredi par défaut', () => {
    expect(buildPattern('3j2j')).toEqual([['entreprise', 'entreprise', 'entreprise', 'ecole', 'ecole']]);
  });

  it('sur mesure : une semaine par entrée', () => {
    expect(buildPattern('manuel', { manualWeeks: ['ecole', 'entreprise', 'conge'] })).toEqual([S, E, fullWeek('conge')]);
    expect(buildPattern('manuel')).toEqual([E]);
  });
});

describe('lecture d’un motif stocké', () => {
  it('accepte un motif valide', () => {
    expect(parsePattern([E, S])).toEqual([E, S]);
  });

  it('refuse un motif invalide', () => {
    expect(parsePattern([])).toBeNull();
    expect(parsePattern('x')).toBeNull();
    expect(parsePattern([['ecole']])).toBeNull();
    expect(parsePattern([['ecole', 'ecole', 'ecole', 'ecole', 'vacances']])).toBeNull();
  });
});
