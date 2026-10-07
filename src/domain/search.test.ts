import { describe, expect, it } from 'vitest';
import { matchScore, queryTerms, search, snippet } from './search';

describe('recherche', () => {
  it('ignore la casse et les accents', () => {
    expect(queryTerms('  Écoles  Marché ')).toEqual(['ecoles', 'marche']);
    expect(matchScore(['ecole'], 'Notes d’École')).toBeGreaterThan(0);
  });

  it('exige tous les mots', () => {
    expect(matchScore(['finance', 'bilan'], 'Finance', 'le bilan comptable')).toBeGreaterThan(0);
    expect(matchScore(['finance', 'absent'], 'Finance', 'le bilan')).toBe(0);
  });

  it('classe le titre avant le contenu', () => {
    const notes = [
      { title: 'Marketing', body: 'cours de finance' },
      { title: 'Finance d’entreprise', body: '' },
    ];
    expect(search(notes, 'finance', (n) => [n.title, n.body]).map((n) => n.title)).toEqual(['Finance d’entreprise', 'Marketing']);
  });

  it('renvoie tout pour une requête vide', () => {
    expect(search([1, 2], '  ', () => ['x'])).toEqual([1, 2]);
  });

  it('extrait un passage autour du mot trouvé', () => {
    const body = 'a'.repeat(100) + ' le **bilan** comptable ' + 'b'.repeat(100);
    const s = snippet(body, 'bilan', 20);
    expect(s.startsWith('… ')).toBe(true);
    expect(s).toContain('bilan comptable');
  });
});
