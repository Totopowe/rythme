import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from './ui';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Libellé accessible. */
  label: string;
  children: ReactNode;
  /** `palette` : en haut de l'écran (palette de commandes) ; `dialog` : centré, en feuille sur mobile. */
  variant?: 'dialog' | 'palette';
  className?: string;
}

/**
 * Fenêtre modale basée sur <dialog> natif : piège du focus, Échap et
 * inertie du reste de la page sont gérés par le navigateur.
 */
export function Modal({ open, onClose, label, children, variant = 'dialog', className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onMouseDown={(e) => {
        // Clic sur le fond (le <dialog> lui-même, hors contenu) → fermer.
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        'm-0 max-h-none max-w-none bg-transparent p-0 text-ink backdrop:bg-black/35 dark:backdrop:bg-black/60',
        'open:animate-fade-in',
        variant === 'palette'
          ? 'inset-0 h-full w-full pt-[10vh]'
          : 'inset-0 h-full w-full',
      )}
    >
      {open && (
        <div
          className={cx(
            'pointer-events-none flex h-full w-full',
            variant === 'palette' ? 'items-start justify-center px-3' : 'items-end justify-center md:items-center md:p-6',
          )}
        >
          <div
            className={cx(
              'pointer-events-auto w-full overflow-hidden border border-line bg-raised shadow-overlay',
              variant === 'palette'
                ? 'animate-pop-in rounded-xl md:max-w-[640px]'
                : 'animate-slide-up rounded-t-2xl pb-safe md:max-w-lg md:animate-pop-in md:rounded-xl md:pb-0',
              className,
            )}
          >
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}
