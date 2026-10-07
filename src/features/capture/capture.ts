import { addDeadline, addTask } from '../../db/repo';
import { formatRelative, type ISODate } from '../../domain/dates';
import type { CaptureResult } from '../../domain/quickCapture';
import { CONTEXT_LABELS, DEADLINE_KIND_LABELS, type Context } from '../../domain/types';

export type CommitOutcome = { ok: true; message: string } | { ok: false; message: string };

/** Crée la tâche (ou l'échéance) décrite par une saisie analysée. */
export async function commitCapture(parsed: CaptureResult, defaultContext: Context, today: ISODate): Promise<CommitOutcome> {
  if (!parsed.title) return { ok: false, message: 'Ajoute un titre.' };
  const context = parsed.context ?? defaultContext;

  if (parsed.deadlineKind) {
    if (!parsed.dueDate) return { ok: false, message: 'Une échéance a besoin d’une date (ex. « vendredi », « 12/11 »).' };
    await addDeadline({ title: parsed.title, date: parsed.dueDate, context, kind: parsed.deadlineKind });
    return {
      ok: true,
      message: `Échéance ajoutée · ${DEADLINE_KIND_LABELS[parsed.deadlineKind]} ${formatRelative(parsed.dueDate, today).toLowerCase()}`,
    };
  }

  await addTask({ title: parsed.title, context, dueDate: parsed.dueDate, priority: parsed.priority });
  const when = parsed.dueDate ? ` · ${formatRelative(parsed.dueDate, today)}` : '';
  return { ok: true, message: `Tâche ${CONTEXT_LABELS[context]} ajoutée${when}` };
}
