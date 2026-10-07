import { ContextDot, cx } from '../../components/ui';
import { dayOf, diffDays, formatCountdown, formatMonthShort, formatWeekdayShort, type ISODate } from '../../domain/dates';
import { DEADLINE_KIND_LABELS, type Deadline } from '../../domain/types';
import { useUi } from '../../shell/uiState';

export function DeadlineRow({ deadline, today }: { deadline: Deadline; today: ISODate }) {
  const ui = useUi();
  const days = diffDays(today, deadline.date);
  const soon = days >= 0 && days <= 3;

  return (
    <li>
      <button
        type="button"
        onClick={() => ui.editDeadline(deadline)}
        className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-line/30"
      >
        <span className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-line bg-surface py-1">
          <span className="text-2xs uppercase leading-3 text-muted">{formatMonthShort(deadline.date).replace('.', '')}</span>
          <span className="text-base font-semibold leading-5 tabular-nums">{dayOf(deadline.date)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-5 md:text-sm">{deadline.title}</span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            <ContextDot context={deadline.context} />
            {DEADLINE_KIND_LABELS[deadline.kind]}
            <span className="text-faint">· {formatWeekdayShort(deadline.date)}</span>
          </span>
        </span>
        <span className={cx('shrink-0 text-xs tabular-nums', soon ? 'font-semibold text-danger' : 'text-muted')}>
          {days < 0 ? 'passé' : formatCountdown(days)}
        </span>
      </button>
    </li>
  );
}
