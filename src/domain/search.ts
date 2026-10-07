import { normalize } from './quickCapture';

/** Découpe une requête en mots normalisés (minuscules, sans accents). */
export function queryTerms(query: string): string[] {
  return query
    .split(/\s+/)
    .map((w) => normalize(w))
    .filter(Boolean);
}

export function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Score de correspondance : 0 si un mot manque, sinon plus élevé quand les mots
 * apparaissent dans le titre et en début de mot.
 */
export function matchScore(terms: readonly string[], title: string, body = ''): number {
  if (terms.length === 0) return 1;
  const t = foldText(title);
  const b = foldText(body);
  let score = 0;
  for (const term of terms) {
    const inTitle = t.indexOf(term);
    if (inTitle >= 0) {
      score += 10;
      if (inTitle === 0 || /\W/.test(t.charAt(inTitle - 1))) score += 5;
      continue;
    }
    if (b.includes(term)) {
      score += 2;
      continue;
    }
    return 0;
  }
  return score;
}

export function search<T>(items: readonly T[], query: string, fields: (item: T) => [title: string, body?: string]): T[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [...items];
  return items
    .map((item) => ({ item, score: matchScore(terms, ...fields(item)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}

/** Extrait autour de la première occurrence pour l'aperçu des résultats. */
export function snippet(body: string, query: string, radius = 60): string {
  const terms = queryTerms(query);
  const folded = foldText(body);
  const first = terms.map((t) => folded.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  const clean = (s: string) => s.replace(/[#*_`>\[\]]/g, '').replace(/\s+/g, ' ').trim();
  if (first === undefined) return clean(body.slice(0, radius * 2));
  const start = Math.max(0, first - radius);
  return (start > 0 ? '… ' : '') + clean(body.slice(start, first + radius));
}
