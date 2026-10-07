import { useEffect, useState } from 'react';

/** État d'interface mémorisé localement (filtre choisi, section repliée…). */
export function usePersistentState<T extends string | boolean>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`rythme:${key}`);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* stockage indisponible */
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(`rythme:${key}`, JSON.stringify(value));
    } catch {
      /* idem */
    }
  }, [key, value]);

  return [value, setValue];
}
