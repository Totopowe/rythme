import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Button, IconButton, SectionTitle, Segmented, cx } from '../../components/ui';
import { db } from '../../db/db';
import { setWeekKind } from '../../db/repo';
import { addDays, capitalize, dayOf, formatMonthYear, formatShort, isoWeekNumber, monthOf, startOfWeek, type ISODate } from '../../domain/dates';
import { academicYearStart, academicYearWeeks, type WeekInfo } from '../../domain/rhythm';
import { WEEK_KINDS, WEEK_KIND_LABELS, type Deadline, type Task, type WeekKind } from '../../domain/types';
import { useAppData } from '../../hooks/useAppData';
import { useHotkeys } from '../../hooks/useHotkeys';
import { DeadlineRow } from '../deadlines/DeadlineRow';
import { Legend, weekKindBg } from '../onboarding/RhythmEditor';
import { TaskRow } from '../tasks/TaskRow';
import { useUi } from '../../shell/uiState';

const KIND_OPTIONS = WEEK_KINDS.map((k) => ({ value: k, label: WEEK_KIND_LABELS[k] }));

const weekKindCell: Record<WeekKind, string> = {
  ecole: 'bg-ecole/15 text-ecole hover:bg-ecole/25',
  entreprise: 'bg-entreprise/10 text-entreprise hover:bg-entreprise/20',
  conge: 'bg-perso/15 text-perso hover:bg-perso/25',
};

/** Mois de rattachement d'une semaine : celui de son jeudi (comme les semaines ISO). */
function monthKey(weekStart: ISODate): string {
  return addDays(weekStart, 3).slice(0, 7);
}

export function CalendarView() {
  const { rhythm, today, settings } = useAppData();
  const [year, setYear] = useState(() => academicYearStart(today));
  const [selected, setSelected] = useState<ISODate>(() => startOfWeek(today));
  const deadlines = useLiveQuery(() => db.deadlines.toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.filter((t) => !t.done && t.dueDate !== null).toArray(), []) ?? [];

  const weeks = useMemo(() => academicYearWeeks(rhythm, year), [rhythm, year]);
  const currentWeek = startOfWeek(today);

  const deadlinesByWeek = useMemo(() => {
    const map = new Map<ISODate, Deadline[]>();
    for (const d of deadlines) {
      const key = startOfWeek(d.date);
      map.set(key, [...(map.get(key) ?? []), d]);
    }
    for (const list of map.values()) list.sort((a, b) => a.date.localeCompare(b.date));
    return map;
  }, [deadlines]);

  const months = useMemo(() => {
    const groups: { key: string; weeks: WeekInfo[] }[] = [];
    for (const w of weeks) {
      const key = monthKey(w.weekStart);
      const last = groups.at(-1);
      if (last?.key === key) last.weeks.push(w);
      else groups.push({ key, weeks: [w] });
    }
    return groups;
  }, [weeks]);

  // Garde la semaine sélectionnée dans l'année affichée.
  useEffect(() => {
    if (weeks.length && !weeks.some((w) => w.weekStart === selected)) {
      setSelected(weeks.some((w) => w.weekStart === currentWeek) ? currentWeek : weeks[0]!.weekStart);
    }
  }, [weeks, selected, currentWeek]);

  const move = (delta: number) => {
    const next = addDays(selected, delta * 7);
    setSelected(next);
    const nextYear = academicYearStart(addDays(next, 3));
    if (nextYear !== year) setYear(nextYear);
  };

  useHotkeys({
    ArrowLeft: () => move(-1),
    ArrowRight: () => move(1),
    ArrowUp: () => move(-4),
    ArrowDown: () => move(4),
    t: () => {
      setYear(academicYearStart(today));
      setSelected(currentWeek);
    },
  });

  const counts = WEEK_KINDS.map((k) => ({ kind: k, n: weeks.filter((w) => w.kind === k).length }));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Calendrier</h1>
          <p className="mt-1 text-sm text-muted">
            {counts
              .filter((c) => c.n > 0)
              .map((c) => `${c.n} sem. ${WEEK_KIND_LABELS[c.kind].toLowerCase()}`)
              .join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton icon="chevronLeft" label="Année précédente" onClick={() => setYear(year - 1)} />
          <span className="min-w-[96px] text-center text-sm font-medium tabular-nums">
            {year}–{year + 1}
          </span>
          <IconButton icon="chevronRight" label="Année suivante" onClick={() => setYear(year + 1)} />
          {year !== academicYearStart(today) && (
            <Button size="sm" variant="ghost" onClick={() => setYear(academicYearStart(today))}>
              Aujourd’hui
            </Button>
          )}
        </div>
      </header>

      <YearStrip weeks={weeks} selected={selected} currentWeek={currentWeek} deadlinesByWeek={deadlinesByWeek} onSelect={setSelected} />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {months.map((m) => (
            <section key={m.key} aria-label={formatMonthYear(`${m.key}-01`)}>
              <h2 className="mb-2 text-[13px] font-semibold text-muted">{capitalize(formatMonthYear(`${m.key}-01`))}</h2>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {m.weeks.map((w) => (
                  <WeekCell
                    key={w.weekStart}
                    week={w}
                    selected={w.weekStart === selected}
                    isCurrent={w.weekStart === currentWeek}
                    deadlines={deadlinesByWeek.get(w.weekStart) ?? []}
                    onSelect={() => setSelected(w.weekStart)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <WeekDetail
          key={selected}
          weekStart={selected}
          week={weeks.find((w) => w.weekStart === selected)}
          deadlines={deadlinesByWeek.get(selected) ?? []}
          tasks={tasks.filter((t) => startOfWeek(t.dueDate!) === selected)}
          today={today}
          onChangeKind={(kind) => void setWeekKind(settings, selected, kind)}
        />
      </div>
    </div>
  );
}

interface StripProps {
  weeks: WeekInfo[];
  selected: ISODate;
  currentWeek: ISODate;
  deadlinesByWeek: Map<ISODate, Deadline[]>;
  onSelect: (week: ISODate) => void;
}

/** Frise annuelle compacte : une barre par semaine. */
function YearStrip({ weeks, selected, currentWeek, deadlinesByWeek, onSelect }: StripProps) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-end gap-[2px]" role="group" aria-label="Frise de l’année">
        {weeks.map((w) => {
          const hasDeadline = deadlinesByWeek.has(w.weekStart);
          const newMonth = dayOf(addDays(w.weekStart, 3)) <= 7;
          return (
            <button
              key={w.weekStart}
              type="button"
              tabIndex={-1}
              onClick={() => onSelect(w.weekStart)}
              aria-label={`Semaine du ${formatShort(w.weekStart)} : ${WEEK_KIND_LABELS[w.kind]}`}
              className="group relative flex h-14 min-w-0 flex-1 flex-col items-center justify-end"
            >
              {hasDeadline && <span className="absolute top-0 h-1.5 w-1.5 rounded-full bg-danger" />}
              <span
                className={cx(
                  'w-full rounded-[3px] transition-all',
                  weekKindBg[w.kind],
                  w.weekStart === selected ? 'h-10 ring-2 ring-ink/70 ring-offset-1 ring-offset-surface' : 'h-7 opacity-80 group-hover:h-9 group-hover:opacity-100',
                )}
              />
              {w.weekStart === currentWeek && <span className="absolute -bottom-2.5 h-1 w-1 rounded-full bg-ink" aria-hidden="true" />}
              {newMonth && (
                <span className="pointer-events-none absolute -bottom-6 left-0 hidden text-2xs text-faint sm:block">
                  {formatShort(addDays(w.weekStart, 3)).split(' ')[1]?.replace('.', '')}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <Legend />
        <span className="hidden text-xs text-faint md:inline">← → pour changer de semaine · T pour revenir à aujourd’hui</span>
      </div>
    </div>
  );
}

interface CellProps {
  week: WeekInfo;
  selected: boolean;
  isCurrent: boolean;
  deadlines: Deadline[];
  onSelect: () => void;
}

function WeekCell({ week, selected, isCurrent, deadlines, onSelect }: CellProps) {
  const end = addDays(week.weekStart, 6);
  const range = monthOf(end) === monthOf(week.weekStart) ? `${dayOf(week.weekStart)}–${dayOf(end)}` : `${formatShort(week.weekStart)} – ${formatShort(end)}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Semaine du ${formatShort(week.weekStart)}, ${WEEK_KIND_LABELS[week.kind]}${deadlines.length ? `, ${deadlines.length} échéance(s)` : ''}`}
      className={cx(
        'relative flex min-h-[72px] flex-col rounded-lg p-2.5 text-left transition-colors',
        weekKindCell[week.kind],
        selected && 'ring-2 ring-ink/70',
      )}
    >
      <span className="text-xs font-semibold tabular-nums">{range}</span>
      <span className="mt-0.5 text-2xs opacity-80">
        {WEEK_KIND_LABELS[week.kind]}
        {week.isOverride && ' · modifiée'}
      </span>
      {isCurrent && (
        <span className="mt-1 inline-flex items-center gap-1 text-2xs font-semibold text-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />
          Cette semaine
        </span>
      )}
      {deadlines.length > 0 && (
        <span className="mt-auto space-y-0.5 pt-1.5">
          {deadlines.slice(0, 2).map((d) => (
            <span key={d.id} className="flex items-center gap-1 truncate text-2xs text-ink">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
              <span className="truncate">{d.title}</span>
            </span>
          ))}
          {deadlines.length > 2 && <span className="block text-2xs text-muted">+{deadlines.length - 2}</span>}
        </span>
      )}
    </button>
  );
}

interface DetailProps {
  weekStart: ISODate;
  week: WeekInfo | undefined;
  deadlines: Deadline[];
  tasks: Task[];
  today: ISODate;
  onChangeKind: (kind: WeekKind) => void;
}

function WeekDetail({ weekStart, week, deadlines, tasks, today, onChangeKind }: DetailProps) {
  const { editDeadline } = useUi();
  if (!week) return null;
  const end = addDays(weekStart, 6);

  return (
    <aside className="h-fit space-y-6 rounded-xl border border-line bg-surface p-5 lg:sticky lg:top-8" aria-label="Détail de la semaine">
      <div>
        <p className="text-xs text-muted">Semaine {isoWeekNumber(weekStart)}</p>
        <h2 className="mt-0.5 text-lg font-semibold tracking-tight">
          {formatShort(weekStart)} – {formatShort(end)}
        </h2>
      </div>

      <div className="space-y-2">
        <Segmented label="Type de semaine" value={week.kind} onChange={onChangeKind} options={KIND_OPTIONS} />
        <p className="text-xs text-muted">
          {week.isOverride ? 'Exception au motif habituel. Choisis le type d’origine pour la retirer.' : 'Selon ton motif d’alternance.'}
        </p>
      </div>

      <section>
        <SectionTitle
          count={deadlines.length}
          action={
            <Button size="sm" variant="ghost" icon="plus" onClick={() => editDeadline({ date: weekStart < today && today <= end ? today : weekStart })}>
              Échéance
            </Button>
          }
        >
          Échéances
        </SectionTitle>
        {deadlines.length ? (
          <ul className="-mx-2">
            {deadlines.map((d) => (
              <DeadlineRow key={d.id} deadline={d} today={today} />
            ))}
          </ul>
        ) : (
          <p className="px-1 text-sm text-muted">Aucune échéance cette semaine.</p>
        )}
      </section>

      {tasks.length > 0 && (
        <section>
          <SectionTitle count={tasks.length}>Tâches prévues</SectionTitle>
          <ul className="-mx-1">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} today={today} />
            ))}
          </ul>
        </section>
      )}

      {weekStart === startOfWeek(today) && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Icon name="sun" size={14} /> C’est la semaine en cours.
        </p>
      )}
    </aside>
  );
}
