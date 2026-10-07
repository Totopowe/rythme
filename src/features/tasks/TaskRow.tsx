import { memo, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { ContextDot, cx } from '../../components/ui';
import { deleteTask, toggleTask } from '../../db/repo';
import { formatRelative, type ISODate } from '../../domain/dates';
import { CONTEXT_LABELS, PRIORITY_LABELS, type Task } from '../../domain/types';
import { useUi } from '../../shell/uiState';

interface Props {
  task: Task;
  today: ISODate;
  showContext?: boolean;
  dormant?: boolean;
  /** Poignée de glisser-déposer (liste réordonnable). */
  handle?: ReactNode;
  className?: string;
}

const priorityColor = ['', 'text-faint', 'text-perso', 'text-danger'] as const;

/** Déplace le focus vers la ligne précédente/suivante de la liste. */
export function focusSibling(from: HTMLElement, delta: 1 | -1): void {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-row]'));
  const index = rows.indexOf(from);
  rows[index + delta]?.focus();
}

export const TaskRow = memo(function TaskRow({ task, today, showContext = true, dormant, handle, className }: Props) {
  const ui = useUi();
  const toast = useToast();
  const overdue = !task.done && task.dueDate !== null && task.dueDate < today;

  const remove = () => toast.undoable('Tâche supprimée', () => deleteTask(task.id));

  const onKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.target !== e.currentTarget || e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'x':
      case ' ':
        e.preventDefault();
        void toggleTask(task);
        break;
      case 'Enter':
      case 'e':
        e.preventDefault();
        ui.editTask(task);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        focusSibling(e.currentTarget, 1);
        void remove();
        break;
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        focusSibling(e.currentTarget, 1);
        break;
      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        focusSibling(e.currentTarget, -1);
        break;
    }
  };

  return (
    <li
      data-row
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={`${task.title}${task.done ? ', faite' : ''}`}
      className={cx(
        'group relative flex min-h-12 items-center gap-1 rounded-lg pr-1 outline-none transition-colors hover:bg-line/30 focus-visible:bg-accent-soft/60 focus-visible:outline-none',
        dormant && 'opacity-60',
        className,
      )}
    >
      {handle}
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? 'Marquer comme à faire' : 'Marquer comme faite'}
        tabIndex={-1}
        onClick={() => void toggleTask(task)}
        className="flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <span
          className={cx(
            'flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px] transition-colors',
            task.done ? 'border-accent bg-accent text-white dark:text-bg' : 'border-faint group-hover:border-muted',
            !task.done && task.priority === 3 && 'border-danger',
          )}
        >
          {task.done && <Icon name="check" size={12} strokeWidth={3} />}
        </span>
      </button>

      <button
        type="button"
        tabIndex={-1}
        onClick={() => ui.editTask(task)}
        className="flex min-h-11 min-w-0 flex-1 flex-col justify-center py-1.5 text-left"
      >
        <span className={cx('truncate text-[15px] leading-5 md:text-sm', task.done && 'text-faint line-through decoration-faint/60')}>
          {task.title}
        </span>
        {(showContext || task.dueDate || task.priority > 0 || dormant) && (
          <span className="mt-0.5 flex items-center gap-2.5 text-xs text-muted">
            {showContext && (
              <span className="inline-flex items-center gap-1.5">
                <ContextDot context={task.context} />
                {CONTEXT_LABELS[task.context]}
              </span>
            )}
            {task.dueDate && (
              <span className={cx('tabular-nums', overdue && 'font-medium text-danger')}>{formatRelative(task.dueDate, today)}</span>
            )}
            {task.priority > 0 && (
              <span className={cx('inline-flex items-center gap-0.5', priorityColor[task.priority])}>
                <Icon name="flag" size={12} />
                <span className="sr-only">Priorité {PRIORITY_LABELS[task.priority]}</span>
              </span>
            )}
            {dormant && <span className="text-faint">en sommeil jusqu’à l’approche de l’école</span>}
          </span>
        )}
      </button>

      <button
        type="button"
        tabIndex={-1}
        aria-label="Supprimer la tâche"
        onClick={() => void remove()}
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100 md:flex"
      >
        <Icon name="trash" size={16} />
      </button>
    </li>
  );
});
