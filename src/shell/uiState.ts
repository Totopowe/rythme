import { createContext, useContext } from 'react';
import type { Deadline, Task } from '../domain/types';
import type { ISODate } from '../domain/dates';

export interface UiApi {
  /** Ouvre la palette ; `initial` pré-remplit la saisie. */
  openPalette: (initial?: string) => void;
  openHelp: () => void;
  editTask: (task: Task) => void;
  /** Nouvelle échéance (date pré-remplie) ou modification d'une échéance existante. */
  editDeadline: (deadline: Deadline | { date: ISODate }) => void;
}

export const UiContext = createContext<UiApi | null>(null);

export function useUi(): UiApi {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('useUi doit être utilisé dans le Shell.');
  return ui;
}
