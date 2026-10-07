import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Button, EmptyState, Kbd, SectionTitle, cx, modKey } from '../../components/ui';
import { db } from '../../db/db';
import { addNote, saveReview, updateTask } from '../../db/repo';
import { addDays, formatShort } from '../../domain/dates';
import { pendingTransition, reviewContent, transitionAfter, type Transition } from '../../domain/planning';
import { nextStartOf, periodAt } from '../../domain/rhythm';
import { CONTEXT_LABELS, WEEK_KIND_LABELS, contextForWeek, type Task } from '../../domain/types';
import { useAppData } from '../../hooks/useAppData';
import { QuickAdd } from '../capture/QuickAdd';
import { DeadlineRow } from '../deadlines/DeadlineRow';
import { TaskRow } from '../tasks/TaskRow';

const STEPS = ['En suspens', 'À préparer', 'Bilan'] as const;

/** Libellé court d'une transition : « Entreprise → École ». */
export function transitionLabel(t: Transition): string {
  return `${WEEK_KIND_LABELS[t.from]} → ${WEEK_KIND_LABELS[t.to]}`;
}

export function ReviewView() {
  const { rhythm, today, settings } = useAppData();
  const reviews = useLiveQuery(() => db.reviews.toArray(), []);
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const deadlines = useLiveQuery(() => db.deadlines.toArray(), []);
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState('');
  const [alsoNote, setAlsoNote] = useState(true);
  const [, navigate] = useLocation();
  const toast = useToast();

  // Hors fenêtre de revue, on prépare quand même la fin de la période en cours.
  const t = reviews ? pendingTransition(rhythm, today, reviews, settings.setupDate) ?? transitionAfter(rhythm, periodAt(rhythm, today)) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (step < STEPS.length - 1) setStep(step + 1);
        else void finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!t || !tasks || !deadlines || !reviews) return null;

  const content = reviewContent(t, tasks, deadlines);
  const alreadyDone = reviews.some((r) => r.periodEnd === t.period.end);
  const fromCtx = contextForWeek(t.from);
  const toCtx = contextForWeek(t.to);

  /** Reporte une tâche au début de la prochaine période du même type. */
  const postpone = (task: Task) => {
    const next = nextStartOf(rhythm, today, t.from);
    const date = next?.date ?? addDays(today, 7);
    void updateTask(task.id, { dueDate: date });
    toast.show(`Reportée au ${formatShort(date)}`);
  };

  async function finish() {
    if (!t) return;
    await saveReview({ periodEnd: t.period.end, fromKind: t.from, toKind: t.to, summary });
    if (alsoNote && summary.trim()) {
      await addNote({
        context: fromCtx,
        title: `Bilan ${WEEK_KIND_LABELS[t.from]} · ${formatShort(t.period.start)} – ${formatShort(t.period.end)}`,
        body: summary,
      });
    }
    toast.show('Revue terminée. Bonne période !');
    navigate('/');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <p className="text-[13px] font-medium text-accent">Revue de transition</p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight">{transitionLabel(t)}</h1>
        <p className="mt-1 text-sm text-muted">
          Fin de la période {WEEK_KIND_LABELS[t.from].toLowerCase()} le {formatShort(t.period.end)} · {WEEK_KIND_LABELS[t.to]} du{' '}
          {formatShort(t.next.start)} au {formatShort(t.next.end)}
          {alreadyDone && ' · déjà faite, tu peux la refaire'}
        </p>

        <ol className="mt-6 grid grid-cols-3 gap-2" aria-label="Étapes">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? 'step' : undefined}
                className="w-full text-left"
              >
                <span className={cx('block h-1 rounded-full transition-colors', i <= step ? 'bg-accent' : 'bg-line')} />
                <span className={cx('mt-2 block text-xs font-medium', i === step ? 'text-ink' : 'text-muted')}>
                  {i + 1}. {label}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </header>

      <div key={step} className="animate-fade-in">
        {step === 0 && (
          <section>
            <p className="mb-4 text-[15px] leading-6 text-muted">
              Ce qui reste ouvert côté <strong className="text-ink">{CONTEXT_LABELS[fromCtx]}</strong>. Coche, reporte à la prochaine période{' '}
              {WEEK_KIND_LABELS[t.from].toLowerCase()}, ou supprime.
            </p>
            {content.pending.length === 0 ? (
              <EmptyState icon="check" title="Rien en suspens" compact>
                Tout est bouclé pour cette période. Bien joué.
              </EmptyState>
            ) : (
              <ul className="-mx-1">
                {content.pending.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    today={today}
                    showContext={false}
                    trailing={
                      <Button size="sm" variant="ghost" onClick={() => postpone(task)} aria-label={`Reporter « ${task.title} »`}>
                        Reporter
                      </Button>
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        )}

        {step === 1 && (
          <section className="space-y-8">
            <div>
              <p className="mb-4 text-[15px] leading-6 text-muted">
                Ce qu’il faut avoir en tête pour la période <strong className="text-ink">{WEEK_KIND_LABELS[t.to].toLowerCase()}</strong>. Ajoute ce qui
                manque.
              </p>
              <QuickAdd context={toCtx} placeholder={`À préparer pour la période ${WEEK_KIND_LABELS[t.to].toLowerCase()}…`} />
            </div>
            {content.deadlines.length > 0 && (
              <div>
                <SectionTitle count={content.deadlines.length}>Échéances de la période</SectionTitle>
                <ul className="-mx-2">
                  {content.deadlines.map((d) => (
                    <DeadlineRow key={d.id} deadline={d} today={today} />
                  ))}
                </ul>
              </div>
            )}
            <div>
              <SectionTitle count={content.toPrepare.length}>Tâches {CONTEXT_LABELS[toCtx]}</SectionTitle>
              {content.toPrepare.length ? (
                <ul className="-mx-1">
                  {content.toPrepare.map((task) => (
                    <TaskRow key={task.id} task={task} today={today} showContext={false} />
                  ))}
                </ul>
              ) : (
                <p className="px-1 text-sm text-muted">Aucune tâche ouverte pour l’instant.</p>
              )}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <label htmlFor="review-summary" className="block text-[15px] leading-6 text-muted">
              Une note libre : ce qui a marché, ce qui a coincé, ce que tu veux changer.
            </label>
            <textarea
              id="review-summary"
              autoFocus
              rows={8}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={'Ce qui a bien marché…\nCe qui a coincé…\nPour la prochaine fois…'}
              className="w-full rounded-xl border border-line bg-surface p-4 text-[15px] leading-7 outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            />
            <label className="flex min-h-11 items-center gap-3 text-sm text-muted">
              <input type="checkbox" checked={alsoNote} onChange={(e) => setAlsoNote(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
              Enregistrer aussi ce bilan dans mes notes
            </label>
          </section>
        )}
      </div>

      <footer className="mt-10 flex items-center justify-between border-t border-line pt-5">
        <Button variant="ghost" onClick={() => (step === 0 ? navigate('/') : setStep(step - 1))}>
          {step === 0 ? 'Plus tard' : 'Retour'}
        </Button>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1 text-xs text-faint md:inline-flex">
            <Kbd>{modKey}</Kbd>
            <Kbd>↵</Kbd>
          </span>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)}>
              Continuer <Icon name="arrowRight" size={16} />
            </Button>
          ) : (
            <Button variant="primary" icon="check" onClick={() => void finish()}>
              Terminer la revue
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
