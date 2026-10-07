import { useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { useToast } from '../../components/Toast';
import { Button, Field, Segmented, cx, inputClass } from '../../components/ui';
import { clearOverrides, importWeeks, saveProfile, saveRhythm } from '../../data/actions';
import { downloadMyData } from '../../data/exportData';
import { clearLocalData, getStoreState } from '../../data/store';
import { supabase } from '../../data/supabase';
import { parseWeekList } from '../../domain/weekImport';
import type { ThemePreference } from '../../domain/types';
import { useAppData } from '../../hooks/useAppData';
import { RhythmEditor, configToDraft, draftToConfig, type RhythmDraft } from '../onboarding/RhythmEditor';
import { PRIVACY_PATH } from '../../shell/routes';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

export function SettingsView() {
  const { profile, rhythmConfig, data } = useAppData();
  const toast = useToast();
  const [draft, setDraft] = useState<RhythmDraft>(() => configToDraft(rhythmConfig));
  const draftConfig = draftToConfig(draft);
  const dirty = JSON.stringify(draftConfig) !== JSON.stringify(rhythmConfig);
  const overrides = data.overrides.length;

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-10">
      <h1 className="text-[26px] font-semibold tracking-tight">Réglages</h1>

      <Section title="Profil">
        <ProfileForm firstName={profile.firstName} schoolName={profile.schoolName} />
      </Section>

      <Section title="Rythme d’alternance" description="Modifier le rythme recalcule toute l’année. Les jours corrigés à la main dans le calendrier restent prioritaires.">
        <RhythmEditor value={draft} onChange={setDraft} />
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            disabled={!dirty}
            onClick={() => {
              saveRhythm(draftConfig);
              toast.show('Rythme enregistré');
            }}
          >
            Enregistrer le rythme
          </Button>
          {overrides > 0 && (
            <Button variant="ghost" onClick={() => void toast.undoable(`${overrides} jour(s) corrigé(s) retiré(s)`, clearOverrides)}>
              Retirer les {overrides} jour(s) corrigé(s)
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

      <Section title="Réveil des tâches École" description="Les tâches École sans date proche restent discrètes en entreprise, puis réapparaissent sur Aujourd’hui avant l’école.">
        <label className="flex flex-wrap items-center gap-3 text-sm">
          Les réveiller
          <input
            type="number"
            min={1}
            max={21}
            value={profile.wakeUpDays}
            onChange={(e) => saveProfile({ wakeUpDays: Math.min(21, Math.max(1, Number(e.target.value) || 1)) })}
            className={cx(inputClass, 'w-20 text-center')}
            aria-label="Nombre de jours avant l’école"
          />
          jours avant l’école
        </label>
      </Section>

      <Section title="Apparence">
        <Segmented label="Thème" value={profile.theme} onChange={(theme) => saveProfile({ theme })} options={THEME_OPTIONS} />
      </Section>

      <Section
        title="Mes données"
        description="Tes données sont stockées chez Supabase, dans l’Union européenne. Tu peux en télécharger une copie complète à tout moment."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button icon="download" onClick={downloadMyData}>
            Exporter mes données (JSON)
          </Button>
          <Link href={PRIVACY_PATH} className="text-sm text-accent underline-offset-2 hover:underline">
            Politique de confidentialité
          </Link>
        </div>
      </Section>

      <AccountSection />
    </div>
  );
}

function ProfileForm({ firstName, schoolName }: { firstName: string; schoolName: string }) {
  const toast = useToast();
  const [name, setName] = useState(firstName);
  const [school, setSchool] = useState(schoolName);
  const dirty = name.trim() !== firstName || school.trim() !== schoolName;
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        saveProfile({ firstName: name.trim(), schoolName: school.trim() });
        toast.show('Profil enregistré');
      }}
    >
      <Field label="Prénom" htmlFor="profile-name">
        <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputClass} required />
      </Field>
      <Field label="École" htmlFor="profile-school">
        <input id="profile-school" value={school} onChange={(e) => setSchool(e.target.value)} maxLength={120} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={!dirty || !name.trim()}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function WeekImporter() {
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
          {parsed.errors.length > 0 && <span className="text-danger"> · lignes ignorées : {parsed.errors.map((e) => e.line).join(', ')}</span>}
        </p>
      )}
      <Button
        disabled={parsed.weeks.length === 0}
        onClick={() => {
          importWeeks(parsed.weeks);
          toast.show(`${parsed.weeks.length} semaine(s) importée(s)`);
          setText('');
        }}
      >
        Appliquer au calendrier
      </Button>
    </div>
  );
}

async function signOut(): Promise<void> {
  const userId = getStoreState().userId;
  await supabase.auth.signOut();
  if (userId) clearLocalData(userId);
}

function AccountSection() {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = async () => {
    setBusy(true);
    setError(null);
    const userId = getStoreState().userId;
    const { error: err } = await supabase.rpc('delete_my_account');
    if (err) {
      setBusy(false);
      setError('La suppression a échoué (connexion ?). Rien n’a été supprimé, réessaie.');
      return;
    }
    if (userId) clearLocalData(userId);
    await supabase.auth.signOut();
  };

  return (
    <Section title="Compte">
      <div className="flex flex-wrap gap-3">
        <Button icon="logout" onClick={() => void signOut()}>
          Se déconnecter
        </Button>
        {!confirm && (
          <Button variant="danger" icon="trash" onClick={() => setConfirm(true)}>
            Supprimer mon compte…
          </Button>
        )}
      </div>
      {confirm && (
        <div className="mt-4 rounded-xl border border-danger/40 bg-danger/5 p-4">
          <p className="text-sm font-medium">Supprimer définitivement ton compte ?</p>
          <p className="mt-1 text-sm text-muted">
            Tâches, échéances, rythme, absences, revues et liens de partage sont effacés immédiatement et définitivement. Ton tuteur perd l’accès. Pense à
            exporter tes données avant.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="danger" className="border border-danger/40" disabled={busy} onClick={() => void deleteAccount()}>
              {busy ? 'Suppression…' : 'Oui, tout supprimer'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </Section>
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
