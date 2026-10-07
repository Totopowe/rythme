import { Link } from 'wouter';
import { Icon } from '../../components/Icon';
import { formatShort } from '../../domain/dates';
import { pendingTransition } from '../../domain/planning';
import { WEEK_KIND_LABELS } from '../../domain/types';
import { useAppData } from '../../hooks/useAppData';
import { REVIEW_PATH } from '../../shell/routes';

/** Invitation à faire la revue en fin de période (ou en rattrapage au début de la suivante). */
export function ReviewBanner() {
  const { rhythm, today, profile, data } = useAppData();
  const t = pendingTransition(rhythm, today, data.reviews, profile.createdAt.slice(0, 10));
  if (!t) return null;
  const ended = t.period.end < today;

  return (
    <Link
      href={REVIEW_PATH}
      className="mb-8 flex items-center gap-4 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3.5 transition-colors hover:border-accent/60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white dark:text-bg">
        <Icon name="refresh" size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">
          {ended ? 'Revue de transition à rattraper' : `Fin de période ${WEEK_KIND_LABELS[t.from].toLowerCase()}`}
        </span>
        <span className="block text-[13px] text-muted">
          {WEEK_KIND_LABELS[t.to]} à partir du {formatShort(t.next.start)} · fais le point en 2 minutes
        </span>
      </span>
      <Icon name="chevronRight" size={18} className="shrink-0 text-accent" />
    </Link>
  );
}
