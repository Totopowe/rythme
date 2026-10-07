import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Icon } from '../components/Icon';
import { IconButton, Kbd, cx, modKey } from '../components/ui';
import type { Task } from '../domain/types';
import { WEEK_KIND_LABELS } from '../domain/types';
import { useAppData } from '../hooks/useAppData';
import { useHotkeys } from '../hooks/useHotkeys';
import { DeadlineEditor, type DeadlineDraft } from '../features/deadlines/DeadlineEditor';
import { TaskEditor } from '../features/tasks/TaskEditor';
import { AbsenceEditor, type AbsenceDraft } from '../features/absences/AbsenceEditor';
import { FeedbackDialog } from '../features/feedback/FeedbackDialog';
import { modeIcon } from '../features/today/ModeHero';
import { NAV_ITEMS, SETTINGS_PATH } from './routes';
import { UiContext, useUi, type UiApi } from './uiState';
import { CommandPalette } from './CommandPalette';
import { ShortcutsHelp } from './ShortcutsHelp';

export function Shell({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const [palette, setPalette] = useState<{ open: boolean; initial: string }>({ open: false, initial: '' });
  const [helpOpen, setHelpOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deadlineDraft, setDeadlineDraft] = useState<DeadlineDraft | null>(null);
  const [absenceDraft, setAbsenceDraft] = useState<AbsenceDraft | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const openPalette = useCallback((initial = '') => setPalette({ open: true, initial }), []);
  const ui = useMemo<UiApi>(
    () => ({
      openPalette,
      openHelp: () => setHelpOpen(true),
      editTask: setEditingTask,
      editDeadline: setDeadlineDraft,
      editAbsence: setAbsenceDraft,
      openFeedback: () => setFeedbackOpen(true),
    }),
    [openPalette],
  );

  useHotkeys({
    'mod+k': () => setPalette((p) => (p.open ? { ...p, open: false } : { open: true, initial: '' })),
    '?': () => setHelpOpen(true),
    ',': () => navigate(SETTINGS_PATH),
    ...Object.fromEntries(NAV_ITEMS.map((item) => [item.key, () => navigate(item.path)])),
  });

  return (
    <UiContext.Provider value={ui}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar />
          <main id="contenu" className="flex-1 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 md:px-10 md:pb-16 md:pt-12">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>

      <CommandPalette open={palette.open} initial={palette.initial} onClose={() => setPalette({ open: false, initial: '' })} />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <TaskEditor task={editingTask} onClose={() => setEditingTask(null)} />
      <DeadlineEditor draft={deadlineDraft} onClose={() => setDeadlineDraft(null)} />
      <AbsenceEditor draft={absenceDraft} onClose={() => setAbsenceDraft(null)} />
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </UiContext.Provider>
  );
}

function isActive(location: string, path: string): boolean {
  return path === '/' ? location === '/' : location.startsWith(path);
}

function ModePill() {
  const { mode } = useAppData();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
      <Icon name={modeIcon[mode]} size={13} />
      {WEEK_KIND_LABELS[mode]}
    </span>
  );
}

function Sidebar() {
  const [location] = useLocation();
  const { openPalette, openHelp, openFeedback } = useUi();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-bg px-3 py-5 md:flex">
      <div className="mb-6 flex items-center justify-between px-2">
        <span className="text-[15px] font-semibold tracking-tight">Rythme</span>
        <ModePill />
      </div>

      <button
        type="button"
        onClick={() => openPalette()}
        className="mb-5 flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-muted transition-colors hover:border-faint hover:text-ink"
      >
        <Icon name="bolt" size={15} />
        <span className="flex-1 text-left">Capturer, chercher…</span>
        <Kbd>{modKey}K</Kbd>
      </button>

      <nav aria-label="Navigation principale" className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(location, item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'group flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors',
                active ? 'bg-line/60 font-medium text-ink' : 'text-muted hover:bg-line/40 hover:text-ink',
              )}
            >
              <Icon name={item.icon} size={17} className={active ? 'text-accent' : undefined} />
              <span className="flex-1">{item.label}</span>
              <span className="text-2xs text-faint opacity-0 transition-opacity group-hover:opacity-100">{item.key}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5">
        <button type="button" onClick={openFeedback} className="flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm text-muted transition-colors hover:bg-line/40 hover:text-ink">
          <Icon name="message" size={17} />
          Donner mon avis
        </button>
        <Link
          href={SETTINGS_PATH}
          aria-current={isActive(location, SETTINGS_PATH) ? 'page' : undefined}
          className={cx(
            'flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors',
            isActive(location, SETTINGS_PATH) ? 'bg-line/60 font-medium text-ink' : 'text-muted hover:bg-line/40 hover:text-ink',
          )}
        >
          <Icon name="settings" size={17} />
          Réglages
        </Link>
        <button type="button" onClick={openHelp} className="flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm text-muted transition-colors hover:bg-line/40 hover:text-ink">
          <Icon name="keyboard" size={17} />
          <span className="flex-1 text-left">Raccourcis</span>
          <Kbd>?</Kbd>
        </button>
      </div>
    </aside>
  );
}

function MobileTopBar() {
  const { openFeedback } = useUi();
  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-line/60 bg-bg/85 backdrop-blur-md md:hidden">
      <div className="flex h-12 items-center justify-between pl-4 pr-1">
        <ModePill />
        <div className="flex items-center">
          <IconButton icon="message" label="Donner mon avis" onClick={openFeedback} />
          <Link href={SETTINGS_PATH} aria-label="Réglages" className="flex h-11 w-11 items-center justify-center rounded-lg text-muted">
            <Icon name="settings" size={19} />
          </Link>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const [location] = useLocation();
  const { openPalette } = useUi();
  const [first, second, third, fourth] = NAV_ITEMS as [typeof NAV_ITEMS[0], typeof NAV_ITEMS[0], typeof NAV_ITEMS[0], typeof NAV_ITEMS[0]];

  const tab = (item: typeof first) => {
    const active = isActive(location, item.path);
    return (
      <Link
        key={item.path}
        href={item.path}
        aria-current={active ? 'page' : undefined}
        className={cx('flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-2xs font-medium', active ? 'text-accent' : 'text-muted')}
      >
        <Icon name={item.icon} size={22} strokeWidth={active ? 2 : 1.75} />
        {item.label}
      </Link>
    );
  };

  return (
    <nav aria-label="Navigation principale" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-bg/90 backdrop-blur-md md:hidden">
      <div className="flex items-stretch px-1">
        {tab(first)}
        {tab(second)}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => openPalette()}
            aria-label="Capture rapide"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-pop active:scale-95 dark:text-bg"
          >
            <Icon name="plus" size={24} strokeWidth={2.25} />
          </button>
        </div>
        {tab(third)}
        {tab(fourth)}
      </div>
    </nav>
  );
}
