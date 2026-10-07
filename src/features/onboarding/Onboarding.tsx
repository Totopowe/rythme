import { useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { Button, Field, cx, inputClass } from '../../components/ui';
import { saveProfile, saveRhythm } from '../../data/actions';
import { useData } from '../../data/store';
import { formatCountdown, todayISO } from '../../domain/dates';
import { createRhythm, modeAt, nextChange } from '../../domain/rhythm';
import { WEEK_KIND_LABELS } from '../../domain/types';
import { RhythmEditor, defaultDraft, draftToConfig, type RhythmDraft } from './RhythmEditor';

/** Onboarding en 2 écrans : qui tu es, puis ton rythme. Objectif : moins de 60 secondes. */
export function Onboarding() {
  const data = useData();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<1 | 2>(data.profile.firstName ? 2 : 1);
  const [firstName, setFirstName] = useState(data.profile.firstName);
  const [schoolName, setSchoolName] = useState(data.profile.schoolName);
  const [draft, setDraft] = useState<RhythmDraft>(defaultDraft);

  const config = draftToConfig(draft);
  const today = todayISO();
  const rhythm = createRhythm(config.startDate, config.pattern);
  const mode = modeAt(rhythm, today);
  const next = nextChange(rhythm, today);

  const goToRhythm = (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;
    saveProfile({ firstName: firstName.trim(), schoolName: schoolName.trim() });
    setStep(2);
  };

  const finish = () => {
    saveRhythm(config);
    saveProfile({ onboardedAt: new Date().toISOString() });
    navigate('/calendrier?bienvenue=1');
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))] md:pt-16">
      <ol className="mb-8 flex gap-2" aria-label="Progression">
        {[1, 2].map((s) => (
          <li key={s} className={cx('h-1 flex-1 rounded-full', s <= step ? 'bg-accent' : 'bg-line')} aria-current={s === step ? 'step' : undefined}>
            <span className="sr-only">Étape {s} sur 2</span>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <form onSubmit={goToRhythm} className="space-y-6">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Bienvenue sur Rythme</h1>
            <p className="mt-2 text-[15px] leading-6 text-muted">Deux questions et ton année est prête.</p>
          </div>
          <Field label="Ton prénom" htmlFor="first-name">
            <input
              id="first-name"
              autoFocus
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={60}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Ton école" htmlFor="school" hint="Affichée à ton tuteur si tu partages ton calendrier.">
            <input
              id="school"
              autoComplete="organization"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              maxLength={120}
              placeholder="ex. IUT de Lyon, ESSCA…"
              className={inputClass}
            />
          </Field>
          <Button type="submit" variant="primary" className="w-full sm:w-auto sm:min-w-[160px]" disabled={!firstName.trim()}>
            Continuer
          </Button>
        </form>
      ) : (
        <div>
          <div className="mb-8">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Ton rythme d’alternance</h1>
            <p className="mt-2 text-[15px] leading-6 text-muted">Choisis un modèle. Tu pourras corriger les jours fériés et semaines décalées ensuite.</p>
          </div>
          <RhythmEditor value={draft} onChange={setDraft} />
          <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted" aria-live="polite">
              Aujourd’hui : <strong className="font-semibold text-ink">{WEEK_KIND_LABELS[mode]}</strong>
              {next && (
                <>
                  {' '}· {WEEK_KIND_LABELS[next.kind]} {formatCountdown(next.daysUntil)}
                </>
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Retour
              </Button>
              <Button variant="primary" onClick={finish} className="flex-1 sm:min-w-[180px] sm:flex-none">
                Voir mon calendrier
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
