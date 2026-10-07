import { useMemo } from 'react';
import { Field, IconButton, cx, inputClass } from '../../components/ui';
import { formatShort, isISODate, startOfWeek, todayISO, type ISODate } from '../../domain/dates';
import { createRhythm, cycleKind, weeksBetween } from '../../domain/rhythm';
import { WEEK_KIND_LABELS, type WeekKind } from '../../domain/types';

export const weekKindBg: Record<WeekKind, string> = {
  ecole: 'bg-ecole',
  entreprise: 'bg-entreprise',
  conge: 'bg-perso',
};

export const weekKindSoft: Record<WeekKind, string> = {
  ecole: 'bg-ecole/15 text-ecole',
  entreprise: 'bg-entreprise/15 text-entreprise',
  conge: 'bg-perso/15 text-perso',
};

const PRESETS: { label: string; pattern: WeekKind[] }[] = [
  { label: '3 entreprise / 1 école', pattern: ['entreprise', 'entreprise', 'entreprise', 'ecole'] },
  { label: '1 école / 3 entreprise', pattern: ['ecole', 'entreprise', 'entreprise', 'entreprise'] },
  { label: '2 / 2', pattern: ['entreprise', 'entreprise', 'ecole', 'ecole'] },
  { label: '1 / 1', pattern: ['entreprise', 'ecole'] },
];

interface Props {
  startDate: ISODate;
  pattern: WeekKind[];
  onChange: (value: { startDate: ISODate; pattern: WeekKind[] }) => void;
}

/** Saisie du motif d'alternance avec aperçu des semaines à venir. */
export function RhythmEditor({ startDate, pattern, onChange }: Props) {
  const preview = useMemo(() => {
    const rhythm = createRhythm(startDate, pattern);
    return weeksBetween(rhythm, startOfWeek(todayISO()), 16);
  }, [startDate, pattern]);

  const setPattern = (p: WeekKind[]) => onChange({ startDate, pattern: p });
  const samePattern = (p: WeekKind[]) => p.length === pattern.length && p.every((k, i) => k === pattern[i]);

  return (
    <div className="space-y-6">
      <Field label="Début du motif" htmlFor="rhythm-start" hint="Le lundi de la première semaine de la séquence ci-dessous. Une date en milieu de semaine est ramenée au lundi.">
        <input
          id="rhythm-start"
          type="date"
          value={startDate}
          onChange={(e) => isISODate(e.target.value) && onChange({ startDate: e.target.value, pattern })}
          className={cx(inputClass, 'max-w-[220px]')}
        />
      </Field>

      <div className="space-y-2">
        <p className="text-[13px] font-medium">Séquence</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setPattern([...p.pattern])}
              aria-pressed={samePattern(p.pattern)}
              className={cx(
                'min-h-10 rounded-full border px-3.5 text-[13px] transition-colors md:min-h-8',
                samePattern(p.pattern) ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-ink',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {pattern.map((kind, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPattern(pattern.map((k, j) => (j === i ? cycleKind(k) : k)))}
              aria-label={`Semaine ${i + 1} : ${WEEK_KIND_LABELS[kind]}. Cliquer pour changer.`}
              className={cx('flex min-h-11 min-w-[92px] flex-col items-start rounded-lg px-3 py-1.5 text-left transition-colors', weekKindSoft[kind])}
            >
              <span className="text-2xs opacity-70">Semaine {i + 1}</span>
              <span className="text-[13px] font-semibold">{WEEK_KIND_LABELS[kind]}</span>
            </button>
          ))}
          <div className="flex items-center">
            <IconButton icon="plus" label="Ajouter une semaine" onClick={() => setPattern([...pattern, 'entreprise'])} disabled={pattern.length >= 12} />
            {pattern.length > 1 && (
              <IconButton icon="close" label="Retirer la dernière semaine" onClick={() => setPattern(pattern.slice(0, -1))} />
            )}
          </div>
        </div>
        <p className="text-xs text-muted">Clique sur une semaine pour alterner École → Entreprise → Congé.</p>
      </div>

      <div className="space-y-2">
        <p className="text-[13px] font-medium">Aperçu des 16 prochaines semaines</p>
        <ol className="grid grid-cols-8 gap-1 sm:grid-cols-[repeat(16,minmax(0,1fr))]" aria-label="Aperçu des semaines">
          {preview.map((w) => (
            <li key={w.weekStart} className="flex flex-col items-center gap-1" title={`${formatShort(w.weekStart)} – ${WEEK_KIND_LABELS[w.kind]}`}>
              <span className={cx('h-6 w-full rounded', weekKindBg[w.kind])} />
              <span className="text-2xs tabular-nums text-faint">{formatShort(w.weekStart).replace('.', '')}</span>
              <span className="sr-only">{WEEK_KIND_LABELS[w.kind]}</span>
            </li>
          ))}
        </ol>
        <Legend />
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {(['entreprise', 'ecole', 'conge'] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className={cx('h-2.5 w-2.5 rounded-sm', weekKindBg[k])} />
          {WEEK_KIND_LABELS[k]}
        </span>
      ))}
    </div>
  );
}

/** Lundi par défaut proposé à la configuration : celui de la semaine en cours. */
export function defaultStart(): ISODate {
  return startOfWeek(todayISO());
}
