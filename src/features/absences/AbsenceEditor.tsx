import { useState, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Button, Field, cx, inputClass } from '../../components/ui';
import { addAbsence, deleteAbsence, updateAbsence } from '../../data/actions';
import { isISODate, type ISODate } from '../../domain/dates';
import { ABSENCE_KINDS, ABSENCE_KIND_LABELS, type Absence, type AbsenceKind } from '../../domain/types';

export type AbsenceDraft = Absence | { startDate: ISODate };

const isExisting = (d: AbsenceDraft): d is Absence => 'id' in d;

export function AbsenceEditor({ draft, onClose }: { draft: AbsenceDraft | null; onClose: () => void }) {
  return (
    <Modal open={draft !== null} onClose={onClose} label={draft && isExisting(draft) ? 'Modifier l’absence' : 'Nouvelle absence'}>
      {draft && <AbsenceForm key={isExisting(draft) ? draft.id : draft.startDate} draft={draft} onClose={onClose} />}
    </Modal>
  );
}

function AbsenceForm({ draft, onClose }: { draft: AbsenceDraft; onClose: () => void }) {
  const toast = useToast();
  const existing = isExisting(draft) ? draft : null;
  const [startDate, setStartDate] = useState(draft.startDate);
  const [endDate, setEndDate] = useState(existing?.endDate ?? draft.startDate);
  const [kind, setKind] = useState<AbsenceKind>(existing?.kind ?? 'conge');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [visibleToTutor, setVisibleToTutor] = useState(existing?.visibleToTutor ?? true);
  const valid = isISODate(startDate) && isISODate(endDate) && endDate >= startDate;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const data = { startDate, endDate, kind, label: label.trim(), visibleToTutor };
    if (existing) updateAbsence(existing.id, data);
    else addAbsence(data);
    onClose();
  };

  return (
    <form onSubmit={save}>
      <div className="space-y-5 p-5">
        <h2 className="text-lg font-semibold">{existing ? 'Modifier l’absence' : 'Absence prévue'}</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type d'absence">
          {ABSENCE_KINDS.map((k) => (
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
              {ABSENCE_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Du" htmlFor="absence-start">
            <input
              id="absence-start"
              type="date"
              required
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value > endDate) setEndDate(e.target.value);
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Au" htmlFor="absence-end">
            <input id="absence-end" type="date" required min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Précision (privée)" htmlFor="absence-label" hint="Visible par toi seul, jamais par ton tuteur.">
          <input id="absence-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="ex. vacances de Noël" className={inputClass} />
        </Field>
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border border-line px-3 py-2">
          <span>
            <span className="block text-sm font-medium">Visible par mon tuteur</span>
            <span className="block text-xs text-muted">Il voit seulement les dates et le type.</span>
          </span>
          <input type="checkbox" checked={visibleToTutor} onChange={(e) => setVisibleToTutor(e.target.checked)} className="h-5 w-5 shrink-0 accent-[rgb(var(--accent))]" />
        </label>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
        {existing ? (
          <Button
            variant="danger"
            icon="trash"
            onClick={() => {
              onClose();
              void toast.undoable('Absence supprimée', () => deleteAbsence(existing.id));
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
