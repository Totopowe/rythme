import type { ReactNode } from 'react';
import { EmptyState, SectionTitle } from '../../components/ui';
import { formatCountdown } from '../../domain/dates';
import { schoolWakeState, todayBuckets, upcomingDeadlines } from '../../domain/planning';
import type { Task } from '../../domain/types';
import { useAppData } from '../../hooks/useAppData';
import { QuickAdd } from '../capture/QuickAdd';
import { DeadlineRow } from '../deadlines/DeadlineRow';
import { TaskRow } from '../tasks/TaskRow';
import { ModeHero } from './ModeHero';
import { ShareInvite } from './ShareInvite';
import { ReviewBanner } from '../review/ReviewBanner';

export function TodayView() {
  const { today, rhythm, profile, mode, data } = useAppData();
  const { tasks, deadlines } = data;

  const wake = schoolWakeState(rhythm, today, profile.wakeUpDays);
  const buckets = todayBuckets(tasks, today, wake);
  const upcoming = upcomingDeadlines(deadlines, today);
  const nothingToday = buckets.today.length === 0 && buckets.overdue.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <ModeHero />
      <ReviewBanner />
      <QuickAdd className="mb-8" />

      <div className="space-y-8">
        {buckets.overdue.length > 0 && <TaskSection title="En retard" tasks={buckets.overdue} today={today} />}

        {nothingToday ? (
          <section>
            <SectionTitle>Aujourd’hui</SectionTitle>
            <div className="rounded-xl border border-dashed border-line">
              <EmptyState icon="sun" title="Rien de prévu aujourd’hui" compact>
                {mode === 'entreprise'
                  ? 'Profite de ta journée en entreprise. Ajoute une tâche ci-dessus si quelque chose te vient.'
                  : 'Note ce que tu veux accomplir avec le champ ci-dessus, ou appuie sur N.'}
              </EmptyState>
            </div>
          </section>
        ) : (
          buckets.today.length > 0 && <TaskSection title="Aujourd’hui" tasks={buckets.today} today={today} />
        )}

        {buckets.wokenUp.length > 0 && (
          <TaskSection
            title="À préparer pour l’école"
            tasks={buckets.wokenUp}
            today={today}
            hint={wake.daysUntil !== null ? `École ${formatCountdown(wake.daysUntil)}` : undefined}
          />
        )}

        {buckets.thisWeek.length > 0 && <TaskSection title="Cette semaine" tasks={buckets.thisWeek} today={today} />}

        <section>
          <SectionTitle count={upcoming.length}>Prochaines échéances</SectionTitle>
          {upcoming.length > 0 ? (
            <ul className="-mx-2">
              {upcoming.map((d) => (
                <DeadlineRow key={d.id} deadline={d} today={today} />
              ))}
            </ul>
          ) : (
            <p className="px-1 text-sm text-muted">
              Aucune échéance dans les 30 prochains jours. Ajoute un partiel avec « @partiel 12/11 » dans la capture.
            </p>
          )}
        </section>

        <ShareInvite />
      </div>
    </div>
  );
}

function TaskSection({ title, tasks, today, hint }: { title: string; tasks: Task[]; today: string; hint?: ReactNode }) {
  return (
    <section>
      <SectionTitle count={tasks.length} action={hint && <span className="text-xs text-accent">{hint}</span>}>
        {title}
      </SectionTitle>
      <ul className="-mx-1">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} today={today} />
        ))}
      </ul>
    </section>
  );
}
