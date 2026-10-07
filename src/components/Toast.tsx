import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Restore } from '../data/actions';
import { Icon } from './Icon';
import { cx, isMac } from './ui';

interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
  duration: number;
}

interface ToastApi {
  show: (message: string, options?: { action?: ToastAction; duration?: number }) => void;
  /** Exécute une suppression et propose « Annuler » pendant quelques secondes. */
  undoable: (message: string, remove: () => Restore | Promise<Restore>) => Promise<void>;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>.');
  return ctx;
}

const UNDO_DURATION = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  /** Dernière action annulable, pour ⌘Z / Ctrl+Z. */
  const lastUndo = useRef<{ id: number; run: () => void | Promise<void> } | null>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    if (lastUndo.current?.id === id) lastUndo.current = null;
  }, []);

  const show = useCallback<ToastApi['show']>((message, options) => {
    const id = nextId.current++;
    const item: ToastItem = { id, message, action: options?.action, duration: options?.duration ?? (options?.action ? UNDO_DURATION : 3000) };
    setToasts((list) => [...list.slice(-2), item]);
    if (options?.action?.label === 'Annuler') lastUndo.current = { id, run: options.action.run };
  }, []);

  const undoable = useCallback<ToastApi['undoable']>(
    async (message, remove) => {
      const restore = await remove();
      show(message, { action: { label: 'Annuler', run: restore } });
    },
    [show],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || !(isMac ? e.metaKey : e.ctrlKey) || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      const undo = lastUndo.current;
      if (!undo) return;
      e.preventDefault();
      void undo.run();
      dismiss(undo.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss]);

  const api = useMemo(() => ({ show, undoable }), [show, undoable]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <Toast key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [paused, item.id, item.duration, onDismiss]);

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto flex min-h-11 w-full max-w-sm animate-slide-up items-center gap-3 rounded-xl bg-ink py-1.5 pl-4 pr-1.5 text-sm text-bg shadow-overlay"
    >
      <span className="flex-1">{item.message}</span>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            void item.action!.run();
            onDismiss(item.id);
          }}
          className={cx('min-h-9 rounded-lg px-3 font-semibold text-bg underline-offset-2 hover:bg-bg/10')}
        >
          {item.action.label}
        </button>
      )}
      <button type="button" aria-label="Fermer" onClick={() => onDismiss(item.id)} className="flex h-9 w-9 items-center justify-center rounded-lg text-bg/60 hover:bg-bg/10 hover:text-bg">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
