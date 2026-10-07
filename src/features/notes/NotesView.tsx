import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Button, ContextDot, EmptyState, IconButton, Kbd, cx } from '../../components/ui';
import { db } from '../../db/db';
import { addCourse, addNote, deleteCourse } from '../../db/repo';
import { formatRelative, todayISO } from '../../domain/dates';
import { search, snippet } from '../../domain/search';
import { CONTEXTS, CONTEXT_LABELS, type Context, type Course, type Note } from '../../domain/types';
import { useAppData } from '../../hooks/useAppData';
import { useHotkeys } from '../../hooks/useHotkeys';
import { usePersistentState } from '../../hooks/usePersistentState';
import { NoteEditor } from './NoteEditor';
import { noteDisplayTitle } from './markdown';

type Filter = 'all' | Context;

export function NotesView() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { defaultContext } = useAppData();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = usePersistentState<Filter>('notes-filter', 'all');
  const [courseFilter, setCourseFilter] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const notes = useLiveQuery(() => db.notes.toArray(), []);
  const courses = useLiveQuery(() => db.courses.toArray(), []) ?? [];
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  const createNote = async () => {
    const context = filter === 'all' ? (courseFilter ? courseById.get(courseFilter)?.context : undefined) ?? defaultContext : filter;
    const n = await addNote({ context, courseId: courseFilter });
    navigate(`/notes/${n.id}`);
  };

  useHotkeys({
    '/': () => searchRef.current?.focus(),
    n: () => void createNote(),
  });

  const visible = useMemo(() => {
    let list = (notes ?? []).filter((n) => (filter === 'all' || n.context === filter) && (!courseFilter || n.courseId === courseFilter));
    list = query.trim()
      ? search(list, query, (n) => [noteDisplayTitle(n.title, n.body), n.body])
      : list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
    return list;
  }, [notes, filter, courseFilter, query]);

  if (!notes) return null;
  const current = params.id ? notes.find((n) => n.id === params.id) : undefined;
  const contextCourses = courses.filter((c) => filter === 'all' || c.context === filter).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto flex max-w-6xl gap-8">
      {/* Liste : masquée sur mobile quand une note est ouverte */}
      <section className={cx('w-full shrink-0 md:w-[320px]', params.id && 'hidden md:block')} aria-label="Liste des notes">
        <header className="mb-5 flex items-center justify-between">
          <h1 className="text-[26px] font-semibold tracking-tight">Notes</h1>
          <Button variant="primary" size="sm" icon="plus" onClick={() => void createNote()}>
            Nouvelle
          </Button>
        </header>

        <div className="relative mb-3">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuery('');
                searchRef.current?.blur();
              } else if (e.key === 'Enter' && visible[0]) navigate(`/notes/${visible[0].id}`);
            }}
            placeholder="Rechercher…"
            aria-label="Rechercher dans les notes"
            className="min-h-11 w-full rounded-lg border border-line bg-surface pl-9 pr-10 text-[15px] outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 md:min-h-9 md:text-sm"
          />
          {!query && <Kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 md:inline-flex">/</Kbd>}
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Contexte">
          {(['all', ...CONTEXTS] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              onClick={() => {
                setFilter(f);
                setCourseFilter(null);
              }}
              className={cx(
                'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors md:min-h-7',
                filter === f ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-ink',
              )}
            >
              {f !== 'all' && <ContextDot context={f} />}
              {f === 'all' ? 'Toutes' : CONTEXT_LABELS[f]}
            </button>
          ))}
        </div>

        <CourseBar
          courses={contextCourses}
          active={courseFilter}
          onSelect={setCourseFilter}
          onAdd={(name) => void addCourse(name, filter === 'all' ? defaultContext : filter)}
          onDelete={(c) => {
            if (courseFilter === c.id) setCourseFilter(null);
            void toast.undoable(`Cours « ${c.name} » supprimé`, () => deleteCourse(c.id));
          }}
        />

        {visible.length === 0 ? (
          <EmptyState icon="note" title={query ? 'Aucune note trouvée' : 'Pas encore de notes'} compact>
            {query
              ? 'Essaie un autre mot : la recherche porte sur le titre et le contenu, sans tenir compte des accents.'
              : 'Prends tes notes de cours, de réunion ou de projet en Markdown. Appuie sur N pour commencer.'}
          </EmptyState>
        ) : (
          <ul className="-mx-2 space-y-0.5">
            {visible.map((n) => (
              <NoteItem key={n.id} note={n} active={n.id === params.id} course={n.courseId ? courseById.get(n.courseId) : undefined} query={query} />
            ))}
          </ul>
        )}
      </section>

      <section className={cx('min-w-0 flex-1', !params.id && 'hidden md:block')} aria-label="Note">
        {current ? (
          <NoteEditor key={current.id} note={current} courses={courses} />
        ) : params.id ? (
          <EmptyState icon="note" title="Note introuvable" action={<Link href="/notes" className="text-sm text-accent">Retour aux notes</Link>}>
            Elle a peut-être été supprimée.
          </EmptyState>
        ) : (
          <div className="flex h-full min-h-[50vh] items-center justify-center rounded-xl border border-dashed border-line">
            <EmptyState icon="edit" title="Sélectionne une note" compact>
              Ou crée-en une nouvelle avec <Kbd>N</Kbd>.
            </EmptyState>
          </div>
        )}
      </section>
    </div>
  );
}

function NoteItem({ note, active, course, query }: { note: Note; active: boolean; course?: Course; query: string }) {
  const title = noteDisplayTitle(note.title, note.body);
  const excerpt = snippet(note.title.trim() ? note.body : note.body.split('\n').slice(1).join('\n'), query, 50);
  return (
    <li>
      <Link
        href={`/notes/${note.id}`}
        aria-current={active ? 'page' : undefined}
        className={cx('block rounded-lg px-3 py-2.5 transition-colors', active ? 'bg-accent-soft' : 'hover:bg-line/40')}
      >
        <span className="flex items-center gap-2">
          {note.pinned && <Icon name="pin" size={12} className="shrink-0 text-accent" />}
          <span className="truncate text-[15px] font-medium md:text-sm">{title}</span>
        </span>
        {excerpt && <span className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-muted">{excerpt}</span>}
        <span className="mt-1 flex items-center gap-2 text-xs text-faint">
          <ContextDot context={note.context} />
          {course ? course.name : CONTEXT_LABELS[note.context]}
          <span>· {formatRelative(note.updatedAt.slice(0, 10), todayISO())}</span>
        </span>
      </Link>
    </li>
  );
}

interface CourseBarProps {
  courses: Course[];
  active: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (name: string) => void;
  onDelete: (course: Course) => void;
}

function CourseBar({ courses, active, onSelect, onAdd, onDelete }: CourseBarProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-2xs font-semibold uppercase tracking-wider text-faint">Cours et projets</span>
        <IconButton icon="plus" label="Ajouter un cours ou projet" size={15} onClick={() => setAdding(true)} className="md:h-6 md:w-6" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {courses.map((c) => (
          <span key={c.id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(active === c.id ? null : c.id)}
              aria-pressed={active === c.id}
              className={cx(
                'inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors md:min-h-7',
                active === c.id ? 'bg-ink text-bg' : 'bg-line/50 text-ink hover:bg-line',
              )}
            >
              <ContextDot context={c.context} />
              {c.name}
            </button>
            <button
              type="button"
              aria-label={`Supprimer le cours ${c.name}`}
              onClick={() => onDelete(c)}
              className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-muted text-bg group-hover:flex"
            >
              <Icon name="close" size={10} strokeWidth={3} />
            </button>
          </span>
        ))}
        {adding && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onAdd(name.trim());
              setName('');
              setAdding(false);
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => !name && setAdding(false)}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
              placeholder="Nom du cours…"
              aria-label="Nom du cours ou projet"
              className="min-h-9 w-36 rounded-md border border-accent/50 px-2 text-[13px] outline-none md:min-h-7"
            />
          </form>
        )}
        {courses.length === 0 && !adding && <p className="px-1 text-xs text-muted">Regroupe tes notes par matière ou projet.</p>}
      </div>
    </div>
  );
}
