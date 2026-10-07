import { useMemo } from 'react';
import { useData } from '../data/store';
import type { UserData } from '../data/model';
import type { ISODate } from '../domain/dates';
import { createRhythm, modeAt, type Rhythm } from '../domain/rhythm';
import { contextForWeek, type Context, type Profile, type RhythmConfig, type WeekKind } from '../domain/types';
import { useToday } from './useToday';

export interface AppData {
  profile: Profile;
  rhythmConfig: RhythmConfig;
  rhythm: Rhythm;
  today: ISODate;
  mode: WeekKind;
  /** Contexte par défaut des nouveaux éléments (celui du jour). */
  defaultContext: Context;
  data: UserData;
}

/** Données dérivées utilisées partout (une fois l'onboarding terminé). */
export function useAppData(): AppData {
  const data = useData();
  const today = useToday();
  return useMemo(() => {
    if (!data.rhythm) throw new Error('Rythme non configuré.');
    const rhythm = createRhythm(data.rhythm.startDate, data.rhythm.pattern, data.overrides);
    const mode = modeAt(rhythm, today);
    return { profile: data.profile, rhythmConfig: data.rhythm, rhythm, today, mode, defaultContext: contextForWeek(mode), data };
  }, [data, today]);
}
