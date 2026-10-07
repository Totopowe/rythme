import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useMemo } from 'react';
import { db } from '../db/db';
import type { ISODate } from '../domain/dates';
import { createRhythm, modeAt, type Rhythm } from '../domain/rhythm';
import { contextForWeek, type Context, type Settings, type WeekKind } from '../domain/types';
import { useToday } from './useToday';

export interface AppData {
  settings: Settings;
  rhythm: Rhythm;
  today: ISODate;
  mode: WeekKind;
  /** Contexte par défaut des nouveaux éléments (celui de la semaine en cours). */
  defaultContext: Context;
}

/** Chargement initial : `undefined` tant que IndexedDB n'a pas répondu, `null` si aucun réglage. */
export function useLoadAppData(): AppData | null | undefined {
  const settings = useLiveQuery(async () => (await db.settings.get('main')) ?? null, []);
  const overrides = useLiveQuery(() => db.weekOverrides.toArray(), []);
  const today = useToday();

  return useMemo(() => {
    if (settings === undefined || overrides === undefined) return undefined;
    if (settings === null || !settings.onboarded) return null;
    const rhythm = createRhythm(settings.startDate, settings.pattern, overrides);
    const mode = modeAt(rhythm, today);
    return { settings, rhythm, today, mode, defaultContext: contextForWeek(mode) };
  }, [settings, overrides, today]);
}

export const AppDataContext = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const data = useContext(AppDataContext);
  if (!data) throw new Error('useAppData doit être utilisé après la configuration.');
  return data;
}
