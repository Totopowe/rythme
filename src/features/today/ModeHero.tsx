import { Icon, type IconName } from '../../components/Icon';
import { cx } from '../../components/ui';
import { capitalize, diffDays, formatCountdown, formatLong, formatShort } from '../../domain/dates';
import { dayInfo, isDailyRhythm, nextChange, nextStartOf, periodAt } from '../../domain/rhythm';
import { WEEK_KIND_LABELS, type WeekKind } from '../../domain/types';
import { useAppData } from '../../hooks/useAppData';

export const modeIcon: Record<WeekKind, IconName> = {
  ecole: 'school',
  entreprise: 'briefcase',
  conge: 'leaf',
};

/** En-tête de la vue Aujourd'hui : mode courant, progression et compte à rebours. */
export function ModeHero() {
  const { rhythm, today, mode } = useAppData();
  const period = periodAt(rhythm, today);
  const totalWeeks = Math.round((diffDays(period.start, period.end) + 1) / 7);
  const currentWeek = Math.floor(diffDays(period.start, today) / 7) + 1;
  const change = nextChange(rhythm, today);
  // Pour l'entreprise, on annonce l'école même si un congé s'intercale.
  const target = mode === 'entreprise' ? nextStartOf(rhythm, today, 'ecole') : change;
  const dayProgress = (diffDays(period.start, today) + 1) / (diffDays(period.start, period.end) + 1);
  const daily = isDailyRhythm(rhythm);
  const info = dayInfo(rhythm, today);
  const title = info.holiday
    ? 'Jour férié'
    : info.weekend
      ? 'Week-end'
      : daily
        ? mode === 'conge'
          ? 'Journée de congé'
          : `Journée ${WEEK_KIND_LABELS[mode]}`
        : mode === 'conge'
          ? 'Semaine de congé'
          : `Semaine ${WEEK_KIND_LABELS[mode]}`;
  // Les rythmes par jours n'ont pas de « période » de plusieurs semaines à suivre.
  const showProgress = !daily && totalWeeks > 1 && totalWeeks < 20;

  return (
    <header className="mb-8">
      <p className="text-[13px] font-medium text-muted">{capitalize(formatLong(today))}</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Icon name={modeIcon[mode]} size={20} />
        </span>
        <div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
            {title}
          </h1>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted">
        {showProgress && (
          <span>
            Semaine {currentWeek} sur {totalWeeks}
          </span>
        )}
        {target && (
          <span>
            <strong className="font-semibold text-ink">
              {WEEK_KIND_LABELS[target.kind]} {formatCountdown(target.daysUntil)}
            </strong>
            <span className="text-faint"> · lun. {formatShort(target.date)}</span>
          </span>
        )}
      </div>

      {showProgress && (
        <div
          className="mt-4 flex gap-1"
          role="progressbar"
          aria-label="Avancement de la période"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(dayProgress * 100)}
        >
          {Array.from({ length: totalWeeks }, (_, i) => {
            const fill = Math.min(1, Math.max(0, dayProgress * totalWeeks - i));
            return (
              <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                <span className={cx('block h-full rounded-full bg-accent transition-[width]')} style={{ width: `${fill * 100}%` }} />
              </span>
            );
          })}
        </div>
      )}
    </header>
  );
}
