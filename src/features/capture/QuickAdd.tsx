import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Kbd, cx } from '../../components/ui';
import { parseCapture } from '../../domain/quickCapture';
import type { Context } from '../../domain/types';
import { useAppData } from '../../hooks/useAppData';
import { useHotkeys } from '../../hooks/useHotkeys';
import { CapturePreview } from './CapturePreview';
import { commitCapture } from './capture';

interface Props {
  /** Contexte imposé quand la saisie n'en précise pas (sinon : celui de la semaine). */
  context?: Context;
  placeholder?: string;
  className?: string;
}

/** Champ d'ajout rapide en tête de liste. Raccourci : N. */
export function QuickAdd({ context, placeholder = 'Ajouter une tâche…', className }: Props) {
  const { today, defaultContext } = useAppData();
  const toast = useToast();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = parseCapture(text, today);
  const fallback = context ?? defaultContext;

  useHotkeys({ n: () => inputRef.current?.focus() });

  const submit = async () => {
    const outcome = await commitCapture(parsed, fallback, today);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    setText('');
    setError(null);
    toast.show(outcome.message);
  };

  return (
    <div className={cx('rounded-xl border border-line bg-surface transition-shadow focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15', className)}>
      <div className="flex items-center gap-1 pl-3 pr-2">
        <Icon name="plus" size={18} className="shrink-0 text-faint" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            } else if (e.key === 'Escape') {
              setText('');
              inputRef.current?.blur();
            }
          }}
          aria-label="Ajouter une tâche"
          aria-describedby="quickadd-help"
          placeholder={placeholder}
          enterKeyHint="done"
          className="min-h-12 flex-1 border-none px-2 text-[15px] outline-none md:min-h-11 md:text-sm"
        />
        {!text && (
          <span className="hidden md:inline-flex">
            <Kbd>N</Kbd>
          </span>
        )}
      </div>
      {text.trim() && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2">
          <CapturePreview parsed={parsed} defaultContext={fallback} today={today} />
          {error ? <span className="text-xs text-danger">{error}</span> : <span className="hidden text-xs text-faint md:inline">Entrée pour ajouter</span>}
        </div>
      )}
      <p id="quickadd-help" className="sr-only">
        Exemples : « rendre dossier #ecole vendredi », « appeler tuteur demain !! », « partiel compta @partiel 12/11 ».
      </p>
    </div>
  );
}
