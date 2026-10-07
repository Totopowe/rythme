import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ReactNode } from 'react';
import { useToast } from '../../components/Toast';
import { Button, Card, Segmented, cx, inputClass } from '../../components/ui';
import { downloadBackup, readBackupFile, restoreBackup } from '../../db/backup';
import { db } from '../../db/db';
import { clearWeekOverrides, importWeeks, saveSettings } from '../../db/repo';
import { parseWeekList } from '../../domain/weekImport';
import { backupSummary, type Backup } from '../../domain/backup';
import type { ThemePreference, WeekKind } from '../../domain/types';
import { useAppData } from '../../hooks/useAppData';
import { RhythmEditor } from '../onboarding/RhythmEditor';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

export function SettingsView() {
  const { settings } = useAppData();
  const toast = useToast();
  const overrides = useLiveQuery(() => db.weekOverrides.count(), []) ?? 0;
  const [rhythm, setRhythm] = useState<{ startDate: string; pattern: WeekKind[] }>({ startDate: settings.startDate, pattern: settings.pattern });
  const dirty = rhythm.startDate !== settings.startDate || rhythm.pattern.join() !== settings.pattern.join();
  const [pendingImport, setPendingImport] = useState<Backup | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-10">
      <h1 className="text-[26px] font-semibold tracking-tight">Réglages</h1>

      <Section title="Rythme d’alternance" description="Modifier le motif recalcule toute l’année. Les semaines corrigées à la main dans le calendrier restent prioritaires.">
        <RhythmEditor startDate={rhythm.startDate} pattern={rhythm.pattern} onChange={setRhythm} />
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            disabled={!dirty}
            onClick={() => {
              void saveSettings(rhythm);
              toast.show('Rythme enregistré');
            }}
          >
            Enregistrer le rythme
          </Button>
          {overrides > 0 && (
            <Button
              variant="ghost"
              onClick={async () => {
                const saved = await db.weekOverrides.toArray();
                await toast.undoable(`${overrides} correction(s) retirée(s)`, async () => {
                  await clearWeekOverrides();
                  return async () => void (await db.weekOverrides.bulkPut(saved));
                });
              }}
            >
              Retirer les {overrides} semaine(s) corrigée(s)
            </Button>
          )}
        </div>
      </Section>

      <Section
        title="Importer des semaines"
        description="Colle le calendrier de ton école : une ligne par semaine ou par plage. Exemples : « 26/10/2026 école », « 21/12/2026 au 03/01/2027 congé »."
      >
        <WeekImporter />
      </Section>

      <Section title="Réveil des tâches École" description="Les tâches École sans date proche restent discrètes pendant l’entreprise, puis réapparaissent sur Aujourd’hui avant la semaine d’école.">
        <label className="flex items-center gap-3 text-sm">
          Les réveiller
          <input
            type="number"
            min={1}
            max={21}
            value={settings.wakeUpDaysBefore}
            onChange={(e) => {
              const n = Math.min(21, Math.max(1, Number(e.target.value) || 1));
              void saveSettings({ wakeUpDaysBefore: n });
            }}
            className={cx(inputClass, 'w-20 text-center')}
            aria-label="Nombre de jours avant la semaine d’école"
          />
          jours avant la semaine d’école
        </label>
      </Section>

      <Section title="Apparence">
        <Segmented label="Thème" value={settings.theme} onChange={(theme) => void saveSettings({ theme })} options={THEME_OPTIONS} />
      </Section>

      <Section
        title="Sauvegarde"
        description="Tes données restent sur cet appareil (aucun compte, aucun serveur). Exporte régulièrement un fichier JSON pour les garder en sécurité ou les transférer."
      >
        <div className="flex flex-wrap gap-3">
          <Button icon="download" onClick={() => void downloadBackup()}>
            Exporter en JSON
          </Button>
          <Button icon="upload" onClick={() => fileRef.current?.click()}>
            Importer une sauvegarde
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                setImportError(null);
                setPendingImport(await readBackupFile(file));
              } catch (err) {
                setImportError((err as Error).message);
              }
            }}
          />
        </div>
        {importError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {importError}
          </p>
        )}
        {pendingImport && (
          <Card className="mt-4 p-4">
            <p className="text-sm">
              Sauvegarde du {pendingImport.exportedAt ? new Date(pendingImport.exportedAt).toLocaleString('fr-FR') : 'date inconnue'} :{' '}
              <strong>{backupSummary(pendingImport)}</strong>.
            </p>
            <p className="mt-1 text-sm text-muted">L’import remplace toutes les données actuelles. Exporte-les d’abord si besoin.</p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="primary"
                onClick={async () => {
                  await restoreBackup(pendingImport);
                  setPendingImport(null);
                  toast.show('Sauvegarde importée');
                }}
              >
                Remplacer mes données
              </Button>
              <Button variant="ghost" onClick={() => setPendingImport(null)}>
                Annuler
              </Button>
            </div>
          </Card>
        )}
      </Section>

      <DangerZone />
    </div>
  );
}

function WeekImporter() {
  const { settings } = useAppData();
  const toast = useToast();
  const [text, setText] = useState('');
  const parsed = parseWeekList(text);

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        aria-label="Semaines à importer"
        placeholder={'26/10/2026 école\n02/11/2026 au 20/11/2026 entreprise\n21/12/2026 au 03/01/2027 congé'}
        className={cx(inputClass, 'py-2 font-mono text-[13px] md:text-[13px]')}
      />
      {text.trim() && (
        <p className="text-sm text-muted" aria-live="polite">
          {parsed.weeks.length} semaine(s) reconnue(s)
          {parsed.errors.length > 0 && (
            <span className="text-danger"> · lignes ignorées : {parsed.errors.map((e) => e.line).join(', ')}</span>
          )}
        </p>
      )}
      <Button
        disabled={parsed.weeks.length === 0}
        onClick={async () => {
          await importWeeks(settings, parsed.weeks);
          toast.show(`${parsed.weeks.length} semaine(s) importée(s)`);
          setText('');
        }}
      >
        Appliquer au calendrier
      </Button>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-8 first-of-type:border-none first-of-type:pt-0">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {description && <p className="mt-1 max-w-xl text-sm leading-6 text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DangerZone() {
  const [confirm, setConfirm] = useState(false);
  return (
    <Section title="Tout effacer" description="Supprime définitivement toutes les données de cet appareil et relance la configuration.">
      {confirm ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-danger">Action irréversible. Tu as bien exporté tes données ?</span>
          <Button
            variant="danger"
            className="border border-danger/40"
            onClick={async () => {
              await Promise.all(db.tables.map((t) => t.clear()));
              location.hash = '#/';
            }}
          >
            Oui, tout effacer
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Annuler
          </Button>
        </div>
      ) : (
        <Button variant="danger" icon="trash" onClick={() => setConfirm(true)}>
          Effacer toutes les données…
        </Button>
      )}
    </Section>
  );
}
