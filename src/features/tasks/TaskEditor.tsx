import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Button, Field, Kbd, Segmented, cx, inputClass, modKey } from '../../components/ui';
import { db } from '../../db/db';
import { deleteTask, updateTask } from '../../db/repo';
import { addDays, isISODate, startOfWeek } from '../../domain/dates';
import { CONTEXTS, CONTEXT_LABELS, PRIORITY_LABELS, type Context, type Priority, type Task } from '../../domain/types';
import { useAppData } from '../../hooks/useAppData';

interface Props {
  task: Task | null;
  onClose: () => void;
}

export const CONTEXT_OPTIONS = CONTEXTS.map((c) => ({ value: c, label: CONTEXT_LABELS[c], dot: c }));
const PRIORITY_OPTIONS = ([0, 1, 2, 3] as const).map((p) => ({ value: String(p) as `${Priority}`, label: PRIORITY_LABELS[p] }));

export function TaskEditor({ task, onClose }: Props) {
  return (
    <Modal open={task !== null} onClose={onClose} label="Modifier la tâche">
      {task && <TaskForm key={task.id} task={task} onClose={onClose} />}
    </Modal>
  );
}

function TaskForm({ task, onClose }: { task: Task; onClose: () => void }) {
  const { today } = useAppData();
  const toast = useToast();
  const courses = useLiveQuery(() => db.courses.toArray(), []) ?? [];
  const [title, setTitle] = useState(task.title);
  const [context, setContext] = useState<Context>(task.context);
  const [dueDate, setDueDate] = useState<string>(task.dueDate ?? '');
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [courseId, setCourseId] = useState<string>(task.courseId ?? '');

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;
    await updateTask(task.id, {
      title: title.trim(),
      context,
      dueDate: isISODate(dueDate) ? dueDate : null,
      priority,
      courseId: courseId || null,
    });
    onClose();
  };

  // ⌘/Ctrl+Entrée enregistre depuis n'importe quel champ.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const quickDates = [
    { label: "Aujourd'hui", value: today },
    { label: 'Demain', value: addDays(today, 1) },
    { label: 'Lundi prochain', value: addDays(startOfWeek(today), 7) },
    { label: 'Aucune', value: '' },
  ];

  const contextCourses = courses.filter((c) => c.context === context);

  return (
    <form onSubmit={save} className="flex flex-col">
      <div className="space-y-5 p-5">
        <input
          aria-label="Titre"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          className="w-full border-none text-lg font-medium outline-none placeholder:text-faint"
          placeholder="Titre de la tâche"
        />

        <Field label="Contexte">
          <Segmented label="Contexte" value={context} onChange={setContext} options={CONTEXT_OPTIONS} />
        </Field>

        <Field label="Date" htmlFor="task-date">
          <div className="flex flex-wrap items-center gap-2">
            <input id="task-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={cx(inputClass, 'w-auto')} />
            {quickDates.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setDueDate(q.value)}
                className={cx(
                  'min-h-10 rounded-full border px-3 text-[13px] transition-colors md:min-h-8',
                  dueDate === q.value ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-ink',
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Priorité">
          <Segmented
            label="Priorité"
            value={String(priority) as `${Priority}`}
            onChange={(v) => setPriority(Number(v) as Priority)}
            options={PRIORITY_OPTIONS}
          />
        </Field>

        {contextCourses.length > 0 && (
          <Field label="Cours ou projet" htmlFor="task-course">
            <select id="task-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className={inputClass}>
              <option value="">Aucun</option>
              {contextCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
        <Button
          variant="danger"
          icon="trash"
          onClick={() => {
            onClose();
            void toast.undoable('Tâche supprimée', () => deleteTask(task.id));
          }}
        >
          Supprimer
        </Button>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 text-xs text-faint md:inline-flex">
            <Kbd>{modKey}</Kbd>
            <Kbd>↵</Kbd>
          </span>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" disabled={!title.trim()}>
            Enregistrer
          </Button>
        </div>
      </div>
    </form>
  );
}
