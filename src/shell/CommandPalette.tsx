import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Icon, type IconName } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Kbd, cx } from '../components/ui';
import { downloadBackup } from '../db/backup';
import { db } from '../db/db';
import { addNote, saveSettings } from '../db/repo';
import { formatRelative } from '../domain/dates';
import { parseCapture } from '../domain/quickCapture';
import { matchScore, queryTerms, search } from '../domain/search';
import { CONTEXT_LABELS } from '../domain/types';
import { useAppData } from '../hooks/useAppData';
import { CapturePreview } from '../features/capture/CapturePreview';
import { commitCapture } from '../features/capture/capture';
import { NAV_ITEMS, REVIEW_PATH, SETTINGS_PATH } from './routes';
import { useUi } from './uiState';

interface Props {
  open: boolean;
  initial: string;
  onClose: () => void;
}

export function CommandPalette({ open, initial, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} label="Palette de commandes" variant="palette">
      {open && <PaletteBody initial={initial} onClose={onClose} />}
    </Modal>
  );
}

interface Item {
  id: string;
  group: 'Créer' | 'Actions' | 'Aller à' | 'Tâches' | 'Notes';
  label: string;
  icon: IconName;
  hint?: string;
  keywords?: string;
  /** Message d'erreur si l'action ne peut pas s'exécuter (la palette reste ouverte). */
  validate?: () => string | null;
  run: () => void | Promise<void>;
}

function PaletteBody({ initial, onClose }: { initial: string; onClose: () => void }) {
  const { today, defaultContext, settings } = useAppData();
  const ui = useUi();
  const toast = useToast();
  const [, navigate] = useLocation();
  const [text, setText] = useState(initial);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const tasks = useLiveQuery(() => db.tasks.filter((t) => !t.done).toArray(), []) ?? [];
  const notes = useLiveQuery(() => db.notes.toArray(), []) ?? [];

  const parsed = parseCapture(text, today);
  const query = text.trim();

  const commands = useMemo<Item[]>(() => {
    const go = (path: string) => () => navigate(path);
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    return [
      ...NAV_ITEMS.map((n) => ({ id: `go-${n.path}`, group: 'Aller à' as const, label: n.label, icon: n.icon, hint: n.key, run: go(n.path) })),
      { id: 'go-settings', group: 'Aller à', label: 'Réglages', icon: 'settings', hint: ',', keywords: 'rythme parametres', run: go(SETTINGS_PATH) },
      { id: 'go-review', group: 'Aller à', label: 'Revue de transition', icon: 'refresh', keywords: 'bilan periode', run: go(REVIEW_PATH) },
      {
        id: 'new-note',
        group: 'Actions',
        label: 'Nouvelle note',
        icon: 'note',
        keywords: 'creer ecrire markdown',
        run: async () => {
          const n = await addNote({ context: defaultContext });
          navigate(`/notes/${n.id}`);
        },
      },
      { id: 'new-deadline', group: 'Actions', label: 'Nouvelle échéance', icon: 'alarm', keywords: 'partiel rendu examen memoire reunion', run: () => ui.editDeadline({ date: today }) },
      {
        id: 'theme',
        group: 'Actions',
        label: nextTheme === 'dark' ? 'Passer en mode sombre' : 'Passer en mode clair',
        icon: nextTheme === 'dark' ? 'moon' : 'sun',
        keywords: 'theme apparence couleur',
        run: () => saveSettings({ theme: nextTheme }),
      },
      { id: 'export', group: 'Actions', label: 'Exporter mes données (JSON)', icon: 'download', keywords: 'sauvegarde backup', run: () => downloadBackup() },
      { id: 'help', group: 'Actions', label: 'Raccourcis clavier', icon: 'keyboard', hint: '?', keywords: 'aide clavier', run: () => ui.openHelp() },
    ];
  }, [navigate, settings.theme, defaultContext, ui, today]);

  const items = useMemo<Item[]>(() => {
    if (!query) return commands;
    const result: Item[] = [];
    const ctx = parsed.context ?? defaultContext;
    if (parsed.title) {
      result.push({
        id: 'capture',
        group: 'Créer',
        label: parsed.deadlineKind ? `Créer l’échéance « ${parsed.title} »` : `Créer la tâche « ${parsed.title} »`,
        icon: parsed.deadlineKind ? 'alarm' : 'plus',
        validate: () => (parsed.deadlineKind && !parsed.dueDate ? 'Une échéance a besoin d’une date (ex. « vendredi », « 12/11 »).' : null),
        run: async () => {
          const outcome = await commitCapture(parsed, ctx, today);
          toast.show(outcome.message);
        },
      });
    }
    const terms = queryTerms(query);
    result.push(...commands.filter((c) => matchScore(terms, c.label, c.keywords) > 0));
    result.push(
      ...search(tasks, query, (t) => [t.title])
        .slice(0, 5)
        .map<Item>((t) => ({
          id: `task-${t.id}`,
          group: 'Tâches',
          label: t.title,
          icon: 'check',
          hint: [CONTEXT_LABELS[t.context], t.dueDate && formatRelative(t.dueDate, today)].filter(Boolean).join(' · '),
          run: () => ui.editTask(t),
        })),
    );
    result.push(
      ...search(notes, query, (n) => [n.title, n.body])
        .slice(0, 5)
        .map<Item>((n) => ({
          id: `note-${n.id}`,
          group: 'Notes',
          label: n.title || 'Sans titre',
          icon: 'note',
          hint: CONTEXT_LABELS[n.context],
          run: () => navigate(`/notes/${n.id}`),
        })),
    );
    return result;
  }, [query, parsed, commands, tasks, notes, defaultContext, today, toast, ui, navigate]);

  useEffect(() => setSelected(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  // La palette se ferme tout de suite ; l'action s'exécute ensuite.
  const run = (item: Item | undefined) => {
    if (!item) return;
    const problem = item.validate?.();
    if (problem) {
      setError(problem);
      return;
    }
    onClose();
    void Promise.resolve(item.run()).catch((e: Error) => toast.show(e.message));
  };

  // Option+Entrée : toujours créer la tâche, même si une autre ligne est sélectionnée.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      setSelected((s) => Math.min(items.length - 1, s + 1));
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      setSelected((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(e.altKey ? items.find((i) => i.id === 'capture') : items[selected]);
    }
  };

  let lastGroup = '';

  return (
    <div onKeyDown={onKeyDown}>
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Icon name="bolt" size={18} className="shrink-0 text-accent" />
        <input
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder="Capturer une tâche ou chercher…"
          aria-label="Capturer une tâche ou chercher"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={items[selected] ? `palette-${items[selected].id}` : undefined}
          enterKeyHint="go"
          autoComplete="off"
          spellCheck={false}
          className="h-14 flex-1 border-none text-base outline-none"
        />
        <span className="hidden md:inline-flex">
          <Kbd>Échap</Kbd>
        </span>
      </div>

      {query && parsed.title && (
        <div className="border-b border-line px-4 py-2.5">
          <CapturePreview parsed={parsed} defaultContext={defaultContext} today={today} />
          {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
        </div>
      )}

      <ul ref={listRef} id="palette-list" role="listbox" aria-label="Résultats" className="max-h-[min(420px,55vh)] overflow-y-auto p-2">
        {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">Aucun résultat. Ajoute du texte pour créer une tâche.</li>}
        {items.map((item, i) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <li key={item.id} role="presentation">
              {header && <div className="px-3 pb-1 pt-3 text-2xs font-semibold uppercase tracking-wider text-faint first:pt-1">{header}</div>}
              <div
                id={`palette-${item.id}`}
                role="option"
                aria-selected={i === selected}
                data-index={i}
                onMouseMove={() => setSelected(i)}
                onClick={() => run(item)}
                className={cx(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm',
                  i === selected ? 'bg-accent-soft text-ink' : 'text-ink/90',
                )}
              >
                <Icon name={item.icon} size={16} className={i === selected ? 'text-accent' : 'text-muted'} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint && <span className="shrink-0 text-xs text-muted">{item.hint}</span>}
                {i === selected && <Kbd className="hidden md:inline-flex">↵</Kbd>}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-xs text-muted md:flex">
        <span className="inline-flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> naviguer
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>↵</Kbd> valider
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>#ecole</Kbd> <Kbd>vendredi</Kbd> <Kbd>!!</Kbd> <Kbd>@partiel</Kbd>
        </span>
      </div>
    </div>
  );
}
