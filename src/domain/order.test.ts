import { describe, expect, it } from 'vitest';
import { reorderWithin } from './order';

describe('reorderWithin', () => {
  it('déplace dans la liste complète', () => {
    expect(reorderWithin(['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
    expect(reorderWithin(['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd'], 'd', 'a')).toEqual(['d', 'a', 'b', 'c']);
  });

  it('ne bouge pas les éléments hors filtre', () => {
    // Filtre : a, c, e. On place e en tête.
    expect(reorderWithin(['a', 'b', 'c', 'd', 'e'], ['a', 'c', 'e'], 'e', 'a')).toEqual(['e', 'b', 'a', 'd', 'c']);
  });

  it('ignore un déplacement nul ou invalide', () => {
    expect(reorderWithin(['a', 'b'], ['a', 'b'], 'a', 'a')).toEqual(['a', 'b']);
    expect(reorderWithin(['a', 'b'], ['a', 'b'], 'x', 'a')).toEqual(['a', 'b']);
  });
});
