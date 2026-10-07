import { useMemo } from 'react';
import { Field, IconButton, Segmented, cx, inputClass } from '../../components/ui';
import { dayOf, formatShort, isISODate, monthOf, startOfWeek, todayISO, type ISODate } from '../../domain/dates';
import { createRhythm, cycleKind, weeksBetween, type DayKind, type WeekInfo } from '../../domain/rhythm';
import { TEMPLATES, WEEKDAY_LABELS, buildPattern, type TemplateId, type TemplateOptions } from '../../domain/templates';
import { WEEK_KIND_LABELS, type RhythmConfig } from '../../domain/types';

export const weekKindBg: Record<DayKind, string> = {
  ecole: 'bg-ecole',
  entreprise: 'bg-entreprise',
  conge: 'bg-perso',
};

export const weekKindSoft: Record<DayKind, string> = {
  ecole: 'bg-ecole/15 text-ecole',
  entreprise: 'bg-entreprise/15 text-entreprise',
  conge: 'bg-perso/15 text-perso',
};

/** État du formulaire de rythme (avant conversion en motif). */
export interface RhythmDraft {
  template: TemplateId;
  startDate: ISODate;
  options: Required<TemplateOptions>;
}

export function defaultDraft(): RhythmDraft {
  return {
    template: '3s1s',
    startDate: startOfWeek(todayISO()),
    options: { startsWith: 'entreprise', schoolDays: [4], manualWeeks: ['entreprise', 'entreprise', 'entreprise', 'ecole'] },
  };
}

export function draftToConfig(d: RhythmDraft): RhythmConfig {
  return { template: d.template, startDate: startOfWeek(d.startDate), pattern: buildPattern(d.template, d.options) };
}

/** Reconstitue un brouillon à partir d'un rythme enregistré (réglages). */
export function configToDraft(c: RhythmConfig): RhythmDraft {
  const base = defaultDraft();
  const first = c.pattern[0]!;
  const schoolDays = first.flatMap((k, i) => (k === 'ecole' ? [i] : []));
  return {
    template: c.template,
    startDate: c.startDate,
    options: {
      startsWith: first[0] === 'ecole' ? 'ecole' : 'entreprise',
      schoolDays: schoolDays.length && schoolDays.length < 5 ? schoolDays : base.options.schoolDays,
      manualWeeks: c.template === 'manuel' ? c.pattern.map((w) => w[0]) : base.options.manualWeeks,
    },
  };
}

interface Props {
  value: RhythmDraft;
  onChange: (value: RhythmDraft) => void;
}

export function RhythmEditor({ value, onChange }: Props) {
  const info = TEMPLATES.find((t) => t.id === value.template)!;
  const set = (patch: Partial<RhythmDraft>) => onChange({ ...value, ...patch });
  const setOptions = (patch: Partial<TemplateOptions>) => onChange({ ...value, options: { ...value.options, ...patch } });

  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Modèle de rythme" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={value.template === t.id}
            onClick={() => {
              const patch: Partial<RhythmDraft> = { template: t.id };
              if (t.defaultSchoolDays) patch.options = { ...value.options, schoolDays: t.defaultSchoolDays };
              set(patch);
            }}
            className={cx(
              'flex min-h-[64px] flex-col items-start justify-center rounded-xl border px-3.5 py-2.5 text-left transition-colors',
              value.template === t.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-faint',
            )}
          >
            <span className={cx('text-[15px] font-semibold', value.template === t.id && 'text-accent')}>{t.label}</span>
            <span className="mt-0.5 text-xs leading-4 text-muted">{t.hint}</span>
          </button>
        ))}
      </div>

      {info.unit === 'weeks' && (
        <Field label="La première semaine, tu es…">
          <Segmented
            label="Mode de la première semaine"
            value={value.options.startsWith}
            onChange={(startsWith) => setOptions({ startsWith })}
            options={[
              { value: 'entreprise', label: 'En entreprise' },
              { value: 'ecole', label: 'À l’école' },
            ]}
          />
        </Field>
      )}

      {info.unit === 'days' && (
        <Field label={value.template === '4j1j' ? 'Ton jour d’école' : 'Tes jours d’école'}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jours d'école">
            {WEEKDAY_LABELS.map((label, i) => {
              const on = value.options.schoolDays.includes(i);
              const max = value.template === '4j1j' ? 1 : 2;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    let days = on ? value.options.schoolDays.filter((d) => d !== i) : [...value.options.schoolDays, i];
                    if (days.length > max) days = days.slice(-max);
                    if (days.length > 0) setOptions({ schoolDays: [...days].sort() });
                  }}
                  className={cx(
                    'min-h-11 rounded-lg px-3 text-[13px] font-medium transition-colors md:min-h-9',
                    on ? 'bg-ecole text-white dark:text-bg' : 'bg-line/50 text-muted hover:text-ink',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {info.unit === 'manual' && (
        <Field label="Ton cycle, semaine par semaine" hint="Clique sur une semaine pour alterner École → Entreprise → Congé. Le cycle se répète ensuite.">
          <div className="flex flex-wrap items-center gap-2">
            {value.options.manualWeeks.map((kind, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setOptions({ manualWeeks: value.options.manualWeeks.map((k, j) => (j === i ? cycleKind(k) : k)) })}
                aria-label={`Semaine ${i + 1} : ${WEEK_KIND_LABELS[kind]}. Changer.`}
                className={cx('flex min-h-11 min-w-[88px] flex-col items-start rounded-lg px-3 py-1.5 text-left', weekKindSoft[kind])}
              >
                <span className="text-2xs opacity-70">Sem. {i + 1}</span>
                <span className="text-[13px] font-semibold">{WEEK_KIND_LABELS[kind]}</span>
              </button>
            ))}
            <IconButton
              icon="plus"
              label="Ajouter une semaine"
              disabled={value.options.manualWeeks.length >= 52}
              onClick={() => setOptions({ manualWeeks: [...value.options.manualWeeks, 'entreprise'] })}
            />
            {value.options.manualWeeks.length > 1 && (
              <IconButton icon="close" label="Retirer la dernière semaine" onClick={() => setOptions({ manualWeeks: value.options.manualWeeks.slice(0, -1) })} />
            )}
          </div>
        </Field>
      )}

      <Field label="Date de début" htmlFor="rhythm-start" hint="Le lundi où commence ce rythme (une date en milieu de semaine est ramenée au lundi).">
        <input
          id="rhythm-start"
          type="date"
          value={value.startDate}
          onChange={(e) => isISODate(e.target.value) && set({ startDate: e.target.value })}
          className={cx(inputClass, 'max-w-[220px]')}
        />
      </Field>

      <RhythmPreview config={draftToConfig(value)} />
    </div>
  );
}

/** Aperçu des prochaines semaines, jour par jour. */
export function RhythmPreview({ config, weeks = 12 }: { config: RhythmConfig; weeks?: number }) {
  const list = useMemo(() => weeksBetween(createRhythm(config.startDate, config.pattern), startOfWeek(todayISO()), weeks), [config, weeks]);
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium">Aperçu</p>
      <ol className="grid grid-cols-6 gap-x-1.5 gap-y-3 sm:grid-cols-12" aria-label="Aperçu des prochaines semaines">
        {list.map((w) => (
          <WeekBar key={w.weekStart} week={w} />
        ))}
      </ol>
      <Legend />
    </div>
  );
}

function WeekBar({ week }: { week: WeekInfo }) {
  return (
    <li className="flex flex-col gap-1" title={`Semaine du ${formatShort(week.weekStart)}`}>
      <span className="flex h-7 gap-px overflow-hidden rounded">
        {week.days.map((d, i) => (
          <span key={i} className={cx('flex-1', weekKindBg[d])} />
        ))}
      </span>
      <span className="whitespace-nowrap text-center text-2xs tabular-nums text-faint">
        {dayOf(week.weekStart)}/{monthOf(week.weekStart)}
      </span>
      <span className="sr-only">{week.days.map((d) => WEEK_KIND_LABELS[d]).join(', ')}</span>
    </li>
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
