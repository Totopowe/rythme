import { Suspense, lazy } from 'react';
import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { ToastProvider } from './components/Toast';
import { EmptyState } from './components/ui';
import { AppDataContext, useLoadAppData } from './hooks/useAppData';
import { useTheme } from './hooks/useTheme';
import { Onboarding } from './features/onboarding/Onboarding';
import { TodayView } from './features/today/TodayView';
import { Shell } from './shell/Shell';

// Vues secondaires chargées à la demande : la vue Aujourd'hui s'affiche plus vite.
const CalendarView = lazy(() => import('./features/calendar/CalendarView').then((m) => ({ default: m.CalendarView })));
const NotesView = lazy(() => import('./features/notes/NotesView').then((m) => ({ default: m.NotesView })));
const ReviewView = lazy(() => import('./features/review/ReviewView').then((m) => ({ default: m.ReviewView })));
const SettingsView = lazy(() => import('./features/settings/SettingsView').then((m) => ({ default: m.SettingsView })));
const TasksView = lazy(() => import('./features/tasks/TasksView').then((m) => ({ default: m.TasksView })));

export function App() {
  const data = useLoadAppData();
  useTheme(data?.settings.theme ?? 'system', data?.mode ?? null);

  // IndexedDB répond en quelques millisecondes : pas d'écran de chargement visible.
  if (data === undefined) return null;

  return (
    <ToastProvider>
      {data === null ? (
        <Onboarding />
      ) : (
        <AppDataContext.Provider value={data}>
          <Router hook={useHashLocation}>
            <Shell>
              <Suspense fallback={null}>
                <Switch>
                  <Route path="/" component={TodayView} />
                  <Route path="/taches" component={TasksView} />
                  <Route path="/calendrier" component={CalendarView} />
                  <Route path="/notes" component={NotesView} />
                  <Route path="/notes/:id" component={NotesView} />
                  <Route path="/revue" component={ReviewView} />
                  <Route path="/reglages" component={SettingsView} />
                  <Route>
                    <EmptyState icon="search" title="Page introuvable" action={<a href="#/" className="text-sm font-medium text-accent">Revenir à aujourd’hui</a>}>
                      Ce lien ne correspond à aucune page de Rythme.
                    </EmptyState>
                  </Route>
                </Switch>
              </Suspense>
            </Shell>
          </Router>
        </AppDataContext.Provider>
      )}
    </ToastProvider>
  );
}
