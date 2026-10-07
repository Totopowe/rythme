import { useEffect, useMemo, useState } from 'react';
import { useSearch } from 'wouter';
import { Icon } from '../../components/Icon';
import { Button, IconButton, SectionTitle, Segmented, cx } from '../../components/ui';
import { setDayKind, setWeekKind } from '../../data/actions';
import {
  addDays,
  capitalize,
  dayOf,
  formatMonthYear,
  formatShort,
  formatWeekdayShort,
  isoWeekNumber,
  monthOf,
  startOfWeek,
  type ISODate,
} from '../../domain/dates';
import { academicYearStart, academicYearWeeks, cycleKind, dayInfo, type DayKind, type WeekInfo } from '../../domain/rhythm';
import { ABSENCE_KIND_LABELS, WEEK_KINDS, WEEK_KIND_LABELS, type Absence, type Deadline, type Task } from '../../domain/types';
import { useAppData } from '../../hooks/useAppData';
import { useHotkeys } from '../../hooks/useHotkeys';
import { useUi } from '../../shell/uiState';
import { DeadlineRow } from '../deadlines/DeadlineRow';
import { Legend, weekKindBg } from '../onboarding/RhythmEditor';
import { TaskRow } from '../tasks/TaskRow';

const KIND_OPTIONS = WEEK_KINDS.map((k) => ({ value: k, label: WEEK_KIND_LABELS[k] }));

const weekKindCell: Record<DayKind, string> = {
  ecole: 'bg-ecole/15 text-ecole hover:bg-ecole/25',
  entreprise: 'bg-entreprise/10 text-entreprise hover:bg-entreprise/20',
  conge: 'bg-perso/15 text-perso hover:bg-perso/25',
};

/** Mois de rattachement d'une semaine : celui de son jeudi (comme les semaines ISO). */
function monthKey(weekStart: ISODate): string {
  return addDays(weekStart, 3).slice(0, 7);
}

function overlapsWeek(a: Absence, weekStart: ISODate): boolean {
  return a.startDate <= addDays(weekStart, 6) && a.endDate >= weekStart;
}

export function CalendarView() {
  const { rhythm, today, data } = useAppData();
  const welcome = useSearch().includes('bienvenue');
  const [year, setYear] = useState(() => academicYearStart(today));
  const [selected, setSelected] = useState<ISODate>(() => startOfWeek(today));
  const { deadlines, absences } = data;
  const datedTasks = useMemo(() => data.tasks.filter((t) => !t.done && t.dueDate !== null), [data.tasks]);

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

  const schoolDays = weeks.reduce((n, w) => n + w.days.filter((d) => d === 'ecole').length, 0);
  const companyDays = weeks.reduce((n, w) => n + w.days.filter((d) => d === 'entreprise').length, 0);

  return (
    <div className="mx-auto max-w-5xl">
      {welcome && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3.5 text-sm">
          <Icon name="sparkle" size={18} className="mt-0.5 shrink-0 text-accent" />
          <p>
            <strong className="font-semibold">Ton année est prête.</strong> Clique sur une semaine pour corriger un jour férié ou une semaine décalée, ou ajouter
            une absence. Tout le reste se passe dans <a href="/" className="font-medium text-accent underline-offset-2 hover:underline">Aujourd’hui</a>.
          </p>
        </div>
      )}

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Calendrier</h1>
          <p className="mt-1 text-sm text-muted">
            {schoolDays} jours d’école · {companyDays} jours en entreprise
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

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
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
                    hasAbsence={absences.some((a) => overlapsWeek(a, w.weekStart))}
                    onSelect={() => setSelected(w.weekStart)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <WeekDetail
          key={selected}
          week={weeks.find((w) => w.weekStart === selected)}
          deadlines={deadlinesByWeek.get(selected) ?? []}
          absences={absences.filter((a) => overlapsWeek(a, selected))}
          tasks={datedTasks.filter((t) => startOfWeek(t.dueDate!) === selected)}
          today={today}
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

/** Frise annuelle compacte : une barre par semaine, découpée par jour si la semaine est mixte. */
function YearStrip({ weeks, selected, currentWeek, deadlinesByWeek, onSelect }: StripProps) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-end gap-[2px]" role="group" aria-label="Frise de l’année">
        {weeks.map((w) => {
          const newMonth = dayOf(addDays(w.weekStart, 3)) <= 7;
          const isSelected = w.weekStart === selected;
          return (
            <button
              key={w.weekStart}
              type="button"
              tabIndex={-1}
              onClick={() => onSelect(w.weekStart)}
              aria-label={`Semaine du ${formatShort(w.weekStart)} : ${WEEK_KIND_LABELS[w.kind]}`}
              className="group relative flex h-14 min-w-0 flex-1 flex-col items-center justify-end"
            >
              {deadlinesByWeek.has(w.weekStart) && <span className="absolute top-0 h-1.5 w-1.5 rounded-full bg-danger" />}
              <span
                className={cx(
                  'flex w-full flex-col-reverse overflow-hidden rounded-[3px] transition-all',
                  isSelected ? 'h-10 ring-2 ring-ink/70 ring-offset-1 ring-offset-surface' : 'h-7 opacity-80 group-hover:h-9 group-hover:opacity-100',
                )}
              >
                {w.days.map((d, i) => (
                  <span key={i} className={cx('w-full flex-1', weekKindBg[d])} />
                ))}
              </span>
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
  hasAbsence: boolean;
  onSelect: () => void;
}

function WeekCell({ week, selected, isCurrent, deadlines, hasAbsence, onSelect }: CellProps) {
  const end = addDays(week.weekStart, 6);
  const range = monthOf(end) === monthOf(week.weekStart) ? `${dayOf(week.weekStart)}–${dayOf(end)}` : `${formatShort(week.weekStart)} – ${formatShort(end)}`;
  const label = week.mixed
    ? `${week.days.filter((d) => d === 'ecole').length} j école · ${week.days.filter((d) => d === 'entreprise').length} j entr.`
    : WEEK_KIND_LABELS[week.kind];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Semaine du ${formatShort(week.weekStart)}, ${label}${deadlines.length ? `, ${deadlines.length} échéance(s)` : ''}`}
      className={cx('relative flex min-h-[76px] flex-col rounded-lg p-2.5 text-left transition-colors', weekKindCell[week.kind], selected && 'ring-2 ring-ink/70')}
    >
      <span className="text-xs font-semibold tabular-nums">{range}</span>
      <span className="mt-0.5 text-2xs opacity-80">
        {label}
        {week.holidays > 0 && ' · férié'}
        {week.isOverride && week.holidays === 0 && ' · modifiée'}
      </span>
      {week.mixed && (
        <span className="mt-1.5 flex gap-0.5" aria-hidden="true">
          {week.days.map((d, i) => (
            <span key={i} className={cx('h-1 flex-1 rounded-full', weekKindBg[d])} />
          ))}
        </span>
      )}
      {isCurrent && (
        <span className="mt-1 inline-flex items-center gap-1 text-2xs font-semibold text-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />
          Cette semaine
        </span>
      )}
      {(deadlines.length > 0 || hasAbsence) && (
        <span className="mt-auto space-y-0.5 pt-1.5">
          {hasAbsence && <span className="block truncate text-2xs text-ink">◌ Absence prévue</span>}
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
  week: WeekInfo | undefined;
  deadlines: Deadline[];
  absences: Absence[];
  tasks: Task[];
  today: ISODate;
}

function WeekDetail({ week, deadlines, absences, tasks, today }: DetailProps) {
  const { rhythm } = useAppData();
  const { editDeadline, editAbsence } = useUi();
  if (!week) return null;
  const { weekStart } = week;
  const end = addDays(weekStart, 6);
  const defaultDate = weekStart <= today && today <= end ? today : weekStart;

  return (
    <aside className="h-fit space-y-6 rounded-xl border border-line bg-surface p-5 lg:sticky lg:top-8" aria-label="Détail de la semaine">
      <div>
        <p className="text-xs text-muted">Semaine {isoWeekNumber(weekStart)}</p>
        <h2 className="mt-0.5 text-lg font-semibold tracking-tight">
          {formatShort(weekStart)} – {formatShort(end)}
        </h2>
      </div>

      <div className="space-y-3">
        <Segmented label="Mode de toute la semaine" value={week.mixed ? ('' as DayKind) : week.kind} onChange={(k) => setWeekKind(weekStart, k)} options={KIND_OPTIONS} />
        <ul className="grid grid-cols-5 gap-1" aria-label="Jours de la semaine">
          {[0, 1, 2, 3, 4].map((i) => {
            const date = addDays(weekStart, i);
            const info = dayInfo(rhythm, date);
            const label = info.holiday ? 'Férié' : WEEK_KIND_LABELS[info.kind];
            return (
              <li key={date}>
                <button
                  type="button"
                  onClick={() => setDayKind(date, info.holiday ? 'ecole' : info.kind === 'conge' ? 'ferie' : cycleKind(info.kind))}
                  aria-label={`${formatShort(date)} : ${label}. Changer.`}
                  title="Cliquer pour changer : École → Entreprise → Congé → Férié"
                  className={cx(
                    'flex min-h-[52px] w-full flex-col items-center justify-center rounded-lg text-center transition-colors',
                    info.holiday ? 'bg-line/60 text-muted' : weekKindCell[info.kind],
                    date === today && 'ring-2 ring-ink/60',
                  )}
                >
                  <span className="text-2xs capitalize opacity-80">{formatWeekdayShort(date).replace('.', '')}</span>
                  <span className="text-xs font-semibold tabular-nums">{dayOf(date)}</span>
                  <span className="text-[10px] leading-3">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">
          {week.isOverride ? 'Semaine corrigée. Clique sur un jour pour l’ajuster.' : 'Selon ton rythme. Clique sur un jour pour le corriger (férié, décalage).'}
        </p>
      </div>

      <section>
        <SectionTitle
          count={absences.length}
          action={
            <Button size="sm" variant="ghost" icon="plus" onClick={() => editAbsence({ startDate: defaultDate })}>
              Absence
            </Button>
          }
        >
          Absences
        </SectionTitle>
        {absences.length ? (
          <ul className="-mx-2">
            {absences.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => editAbsence(a)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm hover:bg-line/30"
                >
                  <span>
                    {ABSENCE_KIND_LABELS[a.kind]}
                    {a.label && <span className="text-muted"> · {a.label}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {a.startDate === a.endDate ? formatShort(a.startDate) : `${formatShort(a.startDate)} → ${formatShort(a.endDate)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-sm text-muted">Aucune absence prévue.</p>
        )}
      </section>

      <section>
        <SectionTitle
          count={deadlines.length}
          action={
            <Button size="sm" variant="ghost" icon="plus" onClick={() => editDeadline({ date: defaultDate })}>
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
    </aside>
  );
}
