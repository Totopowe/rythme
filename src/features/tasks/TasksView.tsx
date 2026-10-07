import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Button, EmptyState, Segmented, cx } from '../../components/ui';
import { db } from '../../db/db';
import { clearCompletedTasks, reorderTasks } from '../../db/repo';
import type { ISODate } from '../../domain/dates';
import { reorderWithin } from '../../domain/order';
import { byOrder, isDormant, schoolWakeState, type SchoolWakeState } from '../../domain/planning';
import { CONTEXTS, CONTEXT_LABELS, type Context, type Task } from '../../domain/types';
import { useAppData } from '../../hooks/useAppData';
import { useHotkeys } from '../../hooks/useHotkeys';
import { usePersistentState } from '../../hooks/usePersistentState';
import { QuickAdd } from '../capture/QuickAdd';
import { TaskRow } from './TaskRow';

type Filter = 'all' | Context;
const FILTERS: Filter[] = ['all', ...CONTEXTS];
const FILTER_OPTIONS = FILTERS.map((f) => ({
  value: f,
  label: f === 'all' ? 'Toutes' : CONTEXT_LABELS[f],
  dot: f === 'all' ? undefined : f,
}));

const announcements: Announcements = {
  onDragStart: () => 'Tâche saisie. Utilise les flèches pour la déplacer, Espace pour la déposer, Échap pour annuler.',
  onDragOver: ({ over }) => (over ? 'Position mise à jour.' : 'Hors de la liste.'),
  onDragEnd: ({ over }) => (over ? 'Tâche déposée.' : 'Déplacement annulé.'),
  onDragCancel: () => 'Déplacement annulé.',
};

export function TasksView() {
  const { today, rhythm, settings } = useAppData();
  const toast = useToast();
  const [filter, setFilter] = usePersistentState<Filter>('tasks-filter', 'all');
  const [showDone, setShowDone] = usePersistentState<boolean>('tasks-show-done', false);
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);

  useHotkeys({ f: () => setFilter(FILTERS[(FILTERS.indexOf(filter) + 1) % FILTERS.length]!) });

  const wake = schoolWakeState(rhythm, today, settings.wakeUpDaysBefore);
  const { open, done, allOpenIds, counts } = useMemo(() => {
    const all = tasks ?? [];
    const openAll = all.filter((t) => !t.done).sort(byOrder);
    const counts = Object.fromEntries(CONTEXTS.map((c) => [c, openAll.filter((t) => t.context === c).length])) as Record<Context, number>;
    const match = (t: Task) => filter === 'all' || t.context === filter;
    return {
      open: openAll.filter(match),
      done: all.filter((t) => t.done && match(t)).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')),
      allOpenIds: openAll.map((t) => t.id),
      counts,
    };
  }, [tasks, filter]);

  if (!tasks) return null;

  const onReorder = (fromId: string, toId: string) => {
    void reorderTasks(reorderWithin(allOpenIds, open.map((t) => t.id), fromId, toId));
  };

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Tâches</h1>
          <p className="mt-1 text-sm text-muted">
            {open.length === 0 ? 'Tout est fait.' : `${open.length} à faire`}
            {filter === 'all' && open.length > 0 && (
              <span className="text-faint"> · {CONTEXTS.filter((c) => counts[c] > 0).map((c) => `${counts[c]} ${CONTEXT_LABELS[c]}`).join(' · ')}</span>
            )}
          </p>
        </div>
        <Segmented label="Filtrer par contexte" value={filter} onChange={setFilter} options={FILTER_OPTIONS} className="self-start overflow-x-auto" />
      </header>

      <QuickAdd context={filter === 'all' ? undefined : filter} className="mb-6" placeholder={filter === 'all' ? 'Ajouter une tâche…' : `Ajouter une tâche ${CONTEXT_LABELS[filter]}…`} />

      {open.length === 0 ? (
        <EmptyState icon="check" title={tasks.length === 0 ? 'Aucune tâche pour l’instant' : 'Rien à faire ici'}>
          {tasks.length === 0 ? (
            <>
              Tape par exemple « rendre dossier finance #ecole vendredi » dans le champ ci-dessus. Le contexte, la date et la priorité sont reconnus
              automatiquement.
            </>
          ) : (
            'Profite, ou ajoute la prochaine chose à faire.'
          )}
        </EmptyState>
      ) : (
        <SortableTaskList tasks={open} today={today} wake={wake} showContext={filter === 'all'} onReorder={onReorder} />
      )}

      {done.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowDone(!showDone)}
              aria-expanded={showDone}
              className="flex min-h-11 items-center gap-1.5 px-1 text-[13px] font-semibold text-muted hover:text-ink"
            >
              <Icon name="chevronRight" size={14} className={cx('transition-transform', showDone && 'rotate-90')} />
              Terminées <span className="font-normal text-faint">{done.length}</span>
            </button>
            {showDone && (
              <Button variant="ghost" size="sm" onClick={() => void toast.undoable(`${done.length} tâche(s) effacée(s)`, clearCompletedTasks)}>
                Tout effacer
              </Button>
            )}
          </div>
          {showDone && (
            <ul className="-mx-1 mt-1 animate-fade-in">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} today={today} showContext={filter === 'all'} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

interface ListProps {
  tasks: Task[];
  today: ISODate;
  wake: SchoolWakeState;
  showContext: boolean;
  onReorder: (fromId: string, toId: string) => void;
}

function SortableTaskList({ tasks, today, wake, showContext, onReorder }: ListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: 'Appuie sur Espace pour saisir la tâche, puis utilise les flèches.' } }}
    >
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="-ml-2 -mr-1 md:-ml-8">
          {tasks.map((t, i) => (
            <SortableTask
              key={t.id}
              task={t}
              today={today}
              dormant={isDormant(t, wake, today)}
              showContext={showContext}
              onMove={(delta) => {
                const neighbour = tasks[i + delta];
                if (neighbour) onReorder(t.id, neighbour.id);
              }}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

interface SortableTaskProps {
  task: Task;
  today: ISODate;
  dormant: boolean;
  showContext: boolean;
  onMove: (delta: 1 | -1) => void;
}

function SortableTask({ task, today, dormant, showContext, onMove }: SortableTaskProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <TaskRow
      task={task}
      today={today}
      dormant={dormant}
      showContext={showContext}
      rowRef={setNodeRef}
      onMove={onMove}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(isDragging && 'z-10 bg-raised shadow-pop hover:bg-raised')}
      handle={
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Déplacer « ${task.title} »`}
          {...attributes}
          {...listeners}
          className="flex h-11 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-faint opacity-60 transition-opacity hover:text-muted focus-visible:opacity-100 active:cursor-grabbing md:w-7 md:opacity-0 md:group-hover:opacity-100"
        >
          <Icon name="grip" size={16} strokeWidth={2.5} />
        </button>
      }
    />
  );
}
