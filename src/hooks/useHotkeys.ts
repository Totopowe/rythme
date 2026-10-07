import { useEffect, useRef } from 'react';

/**
 * Raccourcis clavier globaux.
 * Clés : 'k', '?', 'mod+k', 'shift+n'… (`mod` = ⌘ sur Mac, Ctrl ailleurs).
 * Les raccourcis sans modificateur sont ignorés pendant la saisie de texte
 * et quand une fenêtre modale est ouverte.
 */
export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return !!el.closest('input, textarea, select, [contenteditable="true"]');
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function comboOf(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (isMac ? e.metaKey : e.ctrlKey) parts.push('mod');
  if (e.altKey) parts.push('alt');
  // « ? » arrive déjà avec shift : on ne l'ajoute que pour les lettres.
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.shiftKey && /^[a-z]$/.test(key)) parts.push('shift');
  parts.push(key);
  return parts.join('+');
}

export function useHotkeys(map: HotkeyMap, enabled = true): void {
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.defaultPrevented) return;
      const combo = comboOf(e);
      const handler = mapRef.current[combo];
      if (!handler) return;
      const hasModifier = combo.startsWith('mod+') || combo.startsWith('alt+');
      if (!hasModifier) {
        if (isTypingTarget(e.target)) return;
        if (document.querySelector('dialog[open]')) return;
      }
      e.preventDefault();
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
