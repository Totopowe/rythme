import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { CONTEXT_LABELS, type Context } from '../domain/types';
import { Icon, type IconName } from './Icon';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: IconName;
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent/90 dark:text-bg shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-line/40',
  ghost: 'text-muted hover:text-ink hover:bg-line/50',
  danger: 'text-danger hover:bg-danger/10',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        size === 'md' ? 'min-h-11 px-4 text-sm md:min-h-9' : 'min-h-11 px-3 text-[13px] md:min-h-8',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  size?: number;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 18, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-line/50 hover:text-ink md:h-8 md:w-8',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
});

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface px-1 font-sans text-2xs font-medium text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = isMac ? '⌘' : 'Ctrl';

const contextText: Record<Context, string> = {
  ecole: 'text-ecole',
  entreprise: 'text-entreprise',
  perso: 'text-perso',
};
const contextBg: Record<Context, string> = {
  ecole: 'bg-ecole',
  entreprise: 'bg-entreprise',
  perso: 'bg-perso',
};

export function contextTextClass(ctx: Context): string {
  return contextText[ctx];
}
export function contextBgClass(ctx: Context): string {
  return contextBg[ctx];
}

export function ContextDot({ context, className }: { context: Context; className?: string }) {
  return <span aria-hidden="true" className={cx('inline-block h-2 w-2 shrink-0 rounded-full', contextBg[context], className)} />;
}

export function ContextBadge({ context, className }: { context: Context; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs font-medium', contextText[context], className)}>
      <ContextDot context={context} />
      {CONTEXT_LABELS[context]}
    </span>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; dot?: Context }[];
  label: string;
  className?: string;
}

export function Segmented<T extends string>({ value, onChange, options, label, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex rounded-lg bg-line/50 p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors md:min-h-7',
              active ? 'bg-surface text-ink shadow-sm dark:bg-raised' : 'text-muted hover:text-ink',
            )}
          >
            {o.dot && <ContextDot context={o.dot} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface EmptyStateProps {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, children, action, compact }: EmptyStateProps) {
  return (
    <div className={cx('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-16')}>
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon name={icon} size={20} />
      </div>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {children && <div className="mt-1.5 max-w-sm text-sm leading-6 text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, count, action }: { children: ReactNode; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 px-1">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-muted">
        {children}
        {count !== undefined && count > 0 && <span className="font-normal text-faint">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-xl border border-line bg-surface', className)}>{children}</div>;
}

export const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-accent/60 focus:ring-2 focus:ring-accent/20 min-h-11 md:min-h-9 md:text-sm';

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-5 text-muted">{hint}</p>}
    </div>
  );
}
