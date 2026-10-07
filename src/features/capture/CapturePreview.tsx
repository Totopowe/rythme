import { Icon } from '../../components/Icon';
import { ContextDot, cx } from '../../components/ui';
import { formatRelative, type ISODate } from '../../domain/dates';
import type { CaptureResult } from '../../domain/quickCapture';
import { CONTEXT_LABELS, DEADLINE_KIND_LABELS, PRIORITY_LABELS, type Context } from '../../domain/types';

interface Props {
  parsed: CaptureResult;
  defaultContext: Context;
  today: ISODate;
  className?: string;
}

const chip = 'inline-flex items-center gap-1.5 rounded-md bg-line/50 px-2 py-0.5 text-xs text-muted';

/** Aperçu en direct de ce que la capture va créer. */
export function CapturePreview({ parsed, defaultContext, today, className }: Props) {
  const context = parsed.context ?? defaultContext;
  return (
    <div className={cx('flex flex-wrap items-center gap-1.5', className)} aria-live="polite">
      <span className={cx(chip, parsed.context && 'text-ink')}>
        <ContextDot context={context} />
        {CONTEXT_LABELS[context]}
        {!parsed.context && <span className="text-faint">(semaine en cours)</span>}
      </span>
      {parsed.deadlineKind && (
        <span className={cx(chip, 'text-ink')}>
          <Icon name="alarm" size={12} />
          {DEADLINE_KIND_LABELS[parsed.deadlineKind]}
        </span>
      )}
      {parsed.dueDate && (
        <span className={cx(chip, 'text-ink')}>
          <Icon name="calendar" size={12} />
          {formatRelative(parsed.dueDate, today)}
        </span>
      )}
      {parsed.priority > 0 && (
        <span className={cx(chip, 'text-ink')}>
          <Icon name="flag" size={12} />
          {PRIORITY_LABELS[parsed.priority]}
        </span>
      )}
    </div>
  );
}
