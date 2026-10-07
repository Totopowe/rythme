import { useState, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Button, Field, Segmented, cx, inputClass } from '../../components/ui';
import { addDeadline, deleteDeadline, updateDeadline } from '../../db/repo';
import { isISODate, type ISODate } from '../../domain/dates';
import { DEADLINE_KINDS, DEADLINE_KIND_LABELS, type Context, type Deadline, type DeadlineKind } from '../../domain/types';
import { useAppData } from '../../hooks/useAppData';
import { CONTEXT_OPTIONS } from '../tasks/TaskEditor';

export type DeadlineDraft = Deadline | { date: ISODate };

interface Props {
  draft: DeadlineDraft | null;
  onClose: () => void;
}

const isExisting = (d: DeadlineDraft): d is Deadline => 'id' in d;

export function DeadlineEditor({ draft, onClose }: Props) {
  return (
    <Modal open={draft !== null} onClose={onClose} label={draft && isExisting(draft) ? 'Modifier l’échéance' : 'Nouvelle échéance'}>
      {draft && <DeadlineForm key={isExisting(draft) ? draft.id : draft.date} draft={draft} onClose={onClose} />}
    </Modal>
  );
}

function DeadlineForm({ draft, onClose }: { draft: DeadlineDraft; onClose: () => void }) {
  const { defaultContext } = useAppData();
  const toast = useToast();
  const existing = isExisting(draft) ? draft : null;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(draft.date);
  const [context, setContext] = useState<Context>(existing?.context ?? (defaultContext === 'perso' ? 'ecole' : defaultContext));
  const [kind, setKind] = useState<DeadlineKind>(existing?.kind ?? 'rendu');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const valid = title.trim() !== '' && isISODate(date);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const data = { title: title.trim(), date, context, kind, notes };
    if (existing) await updateDeadline(existing.id, data);
    else await addDeadline(data);
    onClose();
  };

  return (
    <form onSubmit={save}>
      <div className="space-y-5 p-5">
        <input
          aria-label="Titre"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          placeholder="Partiel de finance, rendu du mémoire…"
          className="w-full border-none text-lg font-medium outline-none"
        />
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type">
          {DEADLINE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cx(
                'min-h-10 rounded-full border px-3 text-[13px] transition-colors md:min-h-8',
                kind === k ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-ink',
              )}
            >
              {DEADLINE_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <Field label="Date" htmlFor="deadline-date">
            <input id="deadline-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Contexte">
            <Segmented label="Contexte" value={context} onChange={setContext} options={CONTEXT_OPTIONS} />
          </Field>
        </div>
        <Field label="Notes" htmlFor="deadline-notes">
          <textarea
            id="deadline-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Salle, consignes, documents autorisés…"
            className={cx(inputClass, 'py-2')}
          />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
        {existing ? (
          <Button
            variant="danger"
            icon="trash"
            onClick={() => {
              onClose();
              void toast.undoable('Échéance supprimée', () => deleteDeadline(existing.id));
            }}
          >
            Supprimer
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" disabled={!valid}>
            {existing ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      </div>
    </form>
  );
}
