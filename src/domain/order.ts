/**
 * Réordonne une liste complète après un déplacement dans une sous-liste filtrée.
 * Les éléments hors filtre gardent leur position ; ceux du filtre occupent les
 * mêmes emplacements, dans le nouvel ordre.
 */
export function reorderWithin(allIds: readonly string[], visibleIds: readonly string[], fromId: string, toId: string): string[] {
  const from = visibleIds.indexOf(fromId);
  const to = visibleIds.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return [...allIds];

  const moved = [...visibleIds];
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item!);

  const visible = new Set(visibleIds);
  let cursor = 0;
  return allIds.map((id) => (visible.has(id) ? moved[cursor++]! : id));
}
