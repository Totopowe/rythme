import { useEffect } from 'react';
import type { ThemePreference, WeekKind } from '../domain/types';

/** Applique le thème (classe `dark`) et l'accent du mode sur <html>. */
export function useTheme(preference: ThemePreference, mode: WeekKind | null): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = preference === 'dark' || (preference === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      const meta = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
      meta.forEach((m) => (m.content = dark ? '#111113' : '#fbfbfa'));
    };
    apply();
    try {
      localStorage.setItem('rythme-theme', preference);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  useEffect(() => {
    const root = document.documentElement;
    if (mode) root.dataset.mode = mode;
    else delete root.dataset.mode;
    try {
      if (mode) localStorage.setItem('rythme-mode', mode);
    } catch {
      /* idem */
    }
  }, [mode]);
}
