import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { ToastProvider } from './components/Toast';
import { EmptyState } from './components/ui';
import { AppDataContext, useLoadAppData } from './hooks/useAppData';
import { useTheme } from './hooks/useTheme';
import { Onboarding } from './features/onboarding/Onboarding';
import { TodayView } from './features/today/TodayView';
import { Shell } from './shell/Shell';

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
              <Switch>
                <Route path="/" component={TodayView} />
                <Route>
                  <EmptyState icon="sparkle" title="Bientôt ici">
                    Cette vue arrive dans une prochaine étape.
                  </EmptyState>
                </Route>
              </Switch>
            </Shell>
          </Router>
        </AppDataContext.Provider>
      )}
    </ToastProvider>
  );
}
