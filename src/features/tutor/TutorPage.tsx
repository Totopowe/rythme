import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'wouter';
import { Icon } from '../../components/Icon';
import { cx } from '../../components/ui';
import { supabase } from '../../data/supabase';
import { addDays, capitalize, dayOf, diffDays, formatCountdown, formatLong, formatShort, formatWeekdayShort, startOfWeek, weekday, type ISODate } from '../../domain/dates';
import { createRhythm, dayInfo, nextStartOf, weeksBetween, type DayKind, type OverrideKind, type Rhythm } from '../../domain/rhythm';
import { parsePattern } from '../../domain/templates';
import { ABSENCE_KIND_LABELS, DEADLINE_KIND_LABELS, type AbsenceKind, type DeadlineKind } from '../../domain/types';
import { useTheme } from '../../hooks/useTheme';
import { useToday } from '../../hooks/useToday';

interface TutorView {
  first_name: string;
  school_name: string;
  rhythm: { start_date: string; pattern: unknown } | null;
  overrides: { date: string; kind: OverrideKind }[];
  absences: { start_date: string; end_date: string; kind: AbsenceKind }[];
  deadlines: { title: string; date: string; kind: DeadlineKind }[];
}

type DayStatus = DayKind | 'absent' | 'ferie';

const STATUS_STYLE: Record<DayStatus, string> = {
  ecole: 'bg-ecole text-white dark:text-bg',
  entreprise: 'bg-entreprise text-white dark:text-bg',
  conge: 'bg-perso text-white dark:text-bg',
  absent: 'bg-line text-muted bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,rgb(var(--faint)/0.35)_4px,rgb(var(--faint)/0.35)_6px)]',
  ferie: 'bg-line text-muted',
};

const STATUS_LABEL: Record<DayStatus, string> = {
  ecole: 'École',
  entreprise: 'Entreprise',
  conge: 'Congé',
  absent: 'Absent·e',
  ferie: 'Férié',
};

const SENTENCE: Record<DayStatus, string> = {
  ecole: 'à l’école',
  entreprise: 'en entreprise',
  conge: 'en congé',
  absent: 'absent·e',
  ferie: 'en jour férié',
};

/** Page publique, en lecture seule, ouverte par le tuteur via le lien privé. */
export function TutorPage() {
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<TutorView | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    void supabase.rpc('get_tutor_view', { share_token: token }).then(({ data, error }) => {
      if (error) setFailed(true);
      else setView((data as TutorView | null) ?? null);
    });
  }, [token]);

  if (failed) return <Message title="Connexion impossible" text="La page n’a pas pu être chargée. Vérifie ta connexion et réessaie." />;
  if (view === undefined) return <main className="min-h-dvh" aria-busy="true" />;
  if (view === null || !view.rhythm) return <Message title="Lien indisponible" text="Ce lien a été révoqué ou n’existe pas. Demande un nouveau lien à ton alternant·e." />;
  return <TutorCalendar view={view} />;
}

function Message({ title, text }: { title: string; text: string }) {
  useTheme('system', null);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm leading-6 text-muted">{text}</p>
    </main>
  );
}

function TutorCalendar({ view }: { view: TutorView }) {
  const today = useToday();
  const rhythm = useMemo<Rhythm>(
    () => createRhythm(view.rhythm!.start_date, parsePattern(view.rhythm!.pattern) ?? [['entreprise', 'entreprise', 'entreprise', 'entreprise', 'entreprise']], view.overrides),
    [view],
  );
  const name = view.first_name || 'Votre alternant·e';

  const status = (date: ISODate): DayStatus => {
    if (view.absences.some((a) => a.start_date <= date && date <= a.end_date)) return 'absent';
    const info = dayInfo(rhythm, date);
    return info.holiday ? 'ferie' : info.kind;
  };

  const isWeekend = weekday(today) >= 5;
  const nextMonday = addDays(startOfWeek(today), 7);
  const todayStatus = status(isWeekend ? nextMonday : today);
  useTheme('system', todayStatus === 'ecole' || todayStatus === 'entreprise' || todayStatus === 'conge' ? todayStatus : null);

  const nextSchool = nextStartOf(rhythm, today, 'ecole');
  const weeks = weeksBetween(rhythm, today, 8);
  const absences = view.absences.filter((a) => a.end_date >= today);
  const deadlines = view.deadlines.filter((d) => d.date >= today);

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <p className="text-[13px] text-muted">Calendrier d’alternance</p>
      <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">
        {name}
        {view.school_name && <span className="block text-base font-normal text-muted">{view.school_name}</span>}
      </h1>

      <section className="mt-6 rounded-2xl bg-accent-soft p-5" aria-live="polite">
        <p className="text-[13px] font-medium text-muted">{capitalize(formatLong(today))}</p>
        <p className="mt-1 text-[22px] font-semibold leading-snug">
          {isWeekend ? (
            <>
              C’est le week-end. Lundi, {name} sera <span className="text-accent">{SENTENCE[todayStatus]}</span>.
            </>
          ) : (
            <>
              Aujourd’hui, {name} est <span className="text-accent">{SENTENCE[todayStatus]}</span>.
            </>
          )}
        </p>
        {nextSchool && todayStatus !== 'ecole' && (
          <p className="mt-2 text-sm text-muted">
            Prochain passage à l’école : {formatWeekdayShort(nextSchool.date).replace('.', '')} {formatShort(nextSchool.date)} ({formatCountdown(nextSchool.daysUntil)})
          </p>
        )}
      </section>

      <section className="mt-8" aria-labelledby="weeks-title">
        <h2 id="weeks-title" className="mb-3 text-[13px] font-semibold text-muted">
          Les 8 prochaines semaines
        </h2>
        <div className="mb-2 grid grid-cols-[88px_repeat(5,1fr)] gap-1 text-center text-2xs text-faint" aria-hidden="true">
          <span />
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <ol className="space-y-1">
          {weeks.map((w) => (
            <li key={w.weekStart} className="grid grid-cols-[88px_repeat(5,1fr)] items-center gap-1">
              <span className="text-xs tabular-nums text-muted">
                {w.weekStart === startOfWeek(today) ? 'Cette sem.' : `Sem. du ${formatShort(w.weekStart).replace('.', '')}`}
              </span>
              {[0, 1, 2, 3, 4].map((i) => {
                const date = addDays(w.weekStart, i);
                const s = status(date);
                return (
                  <span
                    key={date}
                    title={`${formatLong(date)} : ${STATUS_LABEL[s]}`}
                    className={cx(
                      'flex h-10 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums',
                      STATUS_STYLE[s],
                      date < today && 'opacity-40',
                      date === today && 'ring-2 ring-ink ring-offset-2 ring-offset-bg',
                    )}
                  >
                    {dayOf(date)}
                    <span className="sr-only"> : {STATUS_LABEL[s]}</span>
                  </span>
                );
              })}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {(['entreprise', 'ecole', 'conge', 'absent'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={cx('h-3 w-3 rounded-sm', STATUS_STYLE[s])} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </section>

      {absences.length > 0 && (
        <section className="mt-8" aria-labelledby="absences-title">
          <h2 id="absences-title" className="mb-2 text-[13px] font-semibold text-muted">
            Absences prévues
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {absences.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>{ABSENCE_KIND_LABELS[a.kind]}</span>
                <span className="text-muted">
                  {a.start_date === a.end_date ? formatShort(a.start_date) : `du ${formatShort(a.start_date)} au ${formatShort(a.end_date)}`}
                  {a.start_date > today && ` · ${formatCountdown(diffDays(today, a.start_date))}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {deadlines.length > 0 && (
        <section className="mt-8" aria-labelledby="deadlines-title">
          <h2 id="deadlines-title" className="mb-2 text-[13px] font-semibold text-muted">
            Échéances importantes
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {deadlines.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{d.title}</span>
                  <span className="text-xs text-muted">{DEADLINE_KIND_LABELS[d.kind]}</span>
                </span>
                <span className="shrink-0 text-muted">{formatShort(d.date)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <a
        href={`${location.origin.replace(/^https?:/, 'webcal:')}/cal/${location.pathname.split('/').pop()}.ics`}
        className="mt-8 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-medium hover:border-faint"
      >
        <Icon name="calendar" size={16} />
        Ajouter à mon agenda
      </a>

      <footer className="mt-10 text-center text-xs leading-5 text-faint">
        Lien privé en lecture seule, partagé par {name} via Rythme et révocable à tout moment.
        <br />
        Seules les informations choisies par {name} sont affichées.
      </footer>
    </main>
  );
}
