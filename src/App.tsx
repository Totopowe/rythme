import { Suspense, lazy, useEffect, useMemo } from 'react';
import { Route, Switch } from 'wouter';
import { ToastProvider, useToast } from './components/Toast';
import { EmptyState } from './components/ui';
import { onSyncError, startStore, stopStore, useStore } from './data/store';
import { supabase, supabaseConfigured } from './data/supabase';
import { AuthConfirm, SignIn } from './features/auth/SignIn';
import { Onboarding } from './features/onboarding/Onboarding';
import { TodayView } from './features/today/TodayView';
import { createRhythm, modeAt } from './domain/rhythm';
import { useToday } from './hooks/useToday';
import { useSession } from './hooks/useSession';
import { useTheme } from './hooks/useTheme';
import { Shell } from './shell/Shell';

// Vues secondaires chargées à la demande : la vue Aujourd'hui s'affiche plus vite.
const CalendarView = lazy(() => import('./features/calendar/CalendarView').then((m) => ({ default: m.CalendarView })));
const ReviewView = lazy(() => import('./features/review/ReviewView').then((m) => ({ default: m.ReviewView })));
const SettingsView = lazy(() => import('./features/settings/SettingsView').then((m) => ({ default: m.SettingsView })));
const TasksView = lazy(() => import('./features/tasks/TasksView').then((m) => ({ default: m.TasksView })));

export function App() {
  if (!supabaseConfigured) return <ConfigMissing />;
  return (
    <ToastProvider>
      <Switch>
        <Route path="/auth/confirm" component={AuthConfirm} />
        <Route>
          <AuthGate />
        </Route>
      </Switch>
    </ToastProvider>
  );
}

function AuthGate() {
  const session = useSession();
  if (session === undefined) return null;
  if (session === null) return <SignedOut />;
  return <UserApp userId={session.user.id} />;
}

function SignedOut() {
  useTheme('system', null);
  return <SignIn />;
}

function UserApp({ userId }: { userId: string }) {
  const { status, data } = useStore();
  const toast = useToast();
  const today = useToday();
  const mode = useMemo(
    () => (data?.rhythm ? modeAt(createRhythm(data.rhythm.startDate, data.rhythm.pattern, data.overrides), today) : null),
    [data?.rhythm, data?.overrides, today],
  );
  useTheme(data?.profile.theme ?? 'system', mode);

  useEffect(() => {
    void startStore(userId);
    // Une connexion par jour au plus est comptée (côté base).
    void supabase.rpc('log_login');
    return () => stopStore();
  }, [userId]);

  useEffect(() => onSyncError((message) => toast.show(`Modification refusée par le serveur : ${message}`)), [toast]);

  if (status === 'loading' || status === 'idle') return <Splash />;
  if (status === 'offline-empty' || !data) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <EmptyState icon="refresh" title="Connexion nécessaire">
          Le premier chargement a besoin d’internet. Ensuite, Rythme fonctionne aussi hors ligne.
        </EmptyState>
      </main>
    );
  }
  if (!data.rhythm || !data.profile.onboardedAt) return <Onboarding />;
  return <MainApp />;
}

function MainApp() {
  return (
    <Shell>
      <Suspense fallback={null}>
        <Switch>
          <Route path="/" component={TodayView} />
          <Route path="/taches" component={TasksView} />
          <Route path="/calendrier" component={CalendarView} />
          <Route path="/revue" component={ReviewView} />
          <Route path="/reglages" component={SettingsView} />
          <Route>
            <EmptyState icon="search" title="Page introuvable" action={<a href="/" className="text-sm font-medium text-accent">Revenir à aujourd’hui</a>}>
              Ce lien ne correspond à aucune page de Rythme.
            </EmptyState>
          </Route>
        </Switch>
      </Suspense>
    </Shell>
  );
}

function Splash() {
  return (
    <main className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <span className="h-8 w-8 animate-pulse rounded-lg bg-line" aria-label="Chargement" />
    </main>
  );
}

function ConfigMissing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 px-6">
      <h1 className="text-xl font-semibold">Configuration manquante</h1>
      <p className="text-sm leading-6 text-muted">
        Les variables <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> ne sont pas définies. Copie <code>.env.example</code> en{' '}
        <code>.env.local</code>, renseigne-les puis relance <code>npm run dev</code>.
      </p>
    </main>
  );
}
