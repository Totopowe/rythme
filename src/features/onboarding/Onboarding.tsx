import { useState } from 'react';
import { Button } from '../../components/ui';
import { saveSettings } from '../../db/repo';
import { formatCountdown, todayISO } from '../../domain/dates';
import { createRhythm, modeAt, nextChange } from '../../domain/rhythm';
import { WEEK_KIND_LABELS, type WeekKind } from '../../domain/types';
import { DEFAULT_PATTERN } from '../../domain/rhythm';
import { RhythmEditor, defaultStart } from './RhythmEditor';

export function Onboarding() {
  const [value, setValue] = useState<{ startDate: string; pattern: WeekKind[] }>({
    startDate: defaultStart(),
    pattern: [...DEFAULT_PATTERN],
  });

  const today = todayISO();
  const rhythm = createRhythm(value.startDate, value.pattern);
  const mode = modeAt(rhythm, today);
  const next = nextChange(rhythm, today);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))] md:pt-20">
      <div className="mb-10">
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-accent">Rythme</p>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Configure ton alternance</h1>
        <p className="mt-2 text-[15px] leading-6 text-muted">
          Une seule fois. Rythme saura ensuite chaque jour si tu es à l’école ou en entreprise, et adaptera ta journée en conséquence.
        </p>
      </div>

      <RhythmEditor startDate={value.startDate} pattern={value.pattern} onChange={setValue} />

      <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted" aria-live="polite">
          Cette semaine : <strong className="font-semibold text-ink">{WEEK_KIND_LABELS[mode]}</strong>
          {next && (
            <>
              {' '}· {WEEK_KIND_LABELS[next.kind]} {formatCountdown(next.daysUntil)}
            </>
          )}
        </p>
        <Button
          variant="primary"
          onClick={() => void saveSettings({ ...value, onboarded: true, setupDate: today })}
          className="sm:min-w-[160px]"
          autoFocus
        >
          C’est parti
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted">Les congés et semaines irrégulières se corrigent ensuite d’un clic dans le calendrier.</p>
    </main>
  );
}
