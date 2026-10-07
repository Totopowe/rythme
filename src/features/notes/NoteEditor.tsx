import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { IconButton, Kbd, Segmented, cx, modKey } from '../../components/ui';
import { deleteNote, updateNote } from '../../db/repo';
import type { Course, Note } from '../../domain/types';
import { CONTEXT_OPTIONS } from '../tasks/TaskEditor';
import { renderMarkdown } from './markdown';

const SAVE_DELAY = 400;

/** Éditeur Markdown avec enregistrement automatique. */
export function NoteEditor({ note, courses }: { note: Note; courses: Course[] }) {
  const [, navigate] = useLocation();
  const toast = useToast();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [preview, setPreview] = useState(() => note.body.trim().length > 0);
  const [saved, setSaved] = useState(true);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const pending = useRef<{ title: string; body: string } | null>(null);

  // Enregistrement différé, et immédiat en quittant la note.
  useEffect(() => {
    if (title === note.title && body === note.body) return;
    pending.current = { title, body };
    setSaved(false);
    const timer = setTimeout(() => {
      void updateNote(note.id, { title, body }).then(() => setSaved(true));
      pending.current = null;
    }, SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [title, body, note.id, note.title, note.body]);

  useEffect(
    () => () => {
      if (pending.current) void updateNote(note.id, pending.current);
    },
    [note.id],
  );

  // Nouvelle note : focus sur le titre.
  useEffect(() => {
    if (!note.title && !note.body) titleRef.current?.focus();
  }, [note.title, note.body]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPreview((p) => {
          if (p) setTimeout(() => bodyRef.current?.focus(), 0);
          return !p;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Hauteur automatique du champ de texte.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 320)}px`;
  }, [body, preview]);

  const html = useMemo(() => (preview ? renderMarkdown(body) : ''), [preview, body]);
  const contextCourses = courses.filter((c) => c.context === note.context);

  return (
    <article className="pb-16">
      <div className="mb-6 flex items-center gap-1 border-b border-line pb-3">
        <Link href="/notes" aria-label="Retour aux notes" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-muted md:hidden">
          <Icon name="chevronLeft" size={20} />
        </Link>
        <Segmented
          label="Contexte de la note"
          value={note.context}
          onChange={(context) => void updateNote(note.id, { context, courseId: null })}
          options={CONTEXT_OPTIONS}
          className="hidden sm:inline-flex"
        />
        {contextCourses.length > 0 && (
          <select
            aria-label="Cours ou projet"
            value={note.courseId ?? ''}
            onChange={(e) => void updateNote(note.id, { courseId: e.target.value || null })}
            className="ml-2 min-h-9 max-w-[160px] rounded-md border border-line bg-surface px-2 text-[13px] text-ink md:min-h-7"
          >
            <option value="">Aucun cours</option>
            {contextCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto mr-2 text-xs text-faint" aria-live="polite">
          {saved ? 'Enregistré' : 'Enregistrement…'}
        </span>
        <IconButton
          icon={preview ? 'edit' : 'eye'}
          label={preview ? `Modifier (${modKey}E)` : `Aperçu (${modKey}E)`}
          onClick={() => setPreview(!preview)}
        />
        <IconButton
          icon="pin"
          label={note.pinned ? 'Désépingler' : 'Épingler en haut de la liste'}
          aria-pressed={note.pinned}
          onClick={() => void updateNote(note.id, { pinned: !note.pinned })}
          className={note.pinned ? 'text-accent' : undefined}
        />
        <IconButton
          icon="trash"
          label="Supprimer la note"
          onClick={() => {
            pending.current = null;
            navigate('/notes');
            void toast.undoable('Note supprimée', () => deleteNote(note.id));
          }}
        />
      </div>

      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') titleRef.current?.blur();
          if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            setPreview(false);
            setTimeout(() => bodyRef.current?.focus(), 0);
          }
        }}
        placeholder="Titre"
        aria-label="Titre de la note"
        className="mb-4 w-full border-none text-2xl font-semibold tracking-tight outline-none"
      />

      {preview ? (
        <div
          className={cx('prose-note min-h-[320px] cursor-text', !body.trim() && 'text-faint')}
          onDoubleClick={() => setPreview(false)}
          // Contenu assaini par DOMPurify.
          dangerouslySetInnerHTML={{ __html: body.trim() ? html : '<p>Note vide. Double-clique pour écrire.</p>' }}
        />
      ) : (
        <>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') bodyRef.current?.blur();
            }}
            placeholder={'Écris en Markdown…\n\n# Titre\n- liste\n**gras**, *italique*, [lien](https://…)\n- [ ] case à cocher'}
            aria-label="Contenu de la note (Markdown)"
            spellCheck
            className="block w-full resize-none border-none text-[15px] leading-7 outline-none"
          />
          <p className="mt-4 hidden items-center gap-1.5 text-xs text-faint md:flex">
            <Kbd>{modKey}</Kbd>
            <Kbd>E</Kbd> pour l’aperçu · enregistrement automatique
          </p>
        </>
      )}
    </article>
  );
}
