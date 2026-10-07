import { useEffect, useState } from 'react';
import { Button, Card, EmptyState, SectionTitle, cx } from '../../components/ui';
import { supabase } from '../../data/supabase';
import { RETENTION_WEEKS, type UsageStats } from '../../domain/analytics';
import { formatShort } from '../../domain/dates';

interface AdminData {
  generatedAt: string;
  accounts: number;
  onboarded: number;
  stats: UsageStats;
  feedback: { id: string; message: string; page: string; created_at: string }[];
}

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)} %`);

const EVENT_LABELS: Record<string, string> = {
  signup: 'Inscriptions',
  login: 'Connexions (jours)',
  task_created: 'Tâches créées',
  task_completed: 'Tâches terminées',
  review_completed: 'Revues complétées',
  tutor_link_created: 'Liens tuteur créés',
};

/** Tableau de bord d'usage, réservé au compte ADMIN_EMAIL (vérifié côté serveur). */
export function AdminPage() {
  const [state, setState] = useState<{ status: 'loading' | 'forbidden' | 'error' | 'ready'; data?: AdminData }>({ status: 'loading' });

  const load = async () => {
    setState({ status: 'loading' });
    const { data: session } = await supabase.auth.getSession();
    try {
      const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${session.session?.access_token ?? ''}` } });
      if (res.status === 403) return setState({ status: 'forbidden' });
      if (!res.ok) throw new Error(String(res.status));
      setState({ status: 'ready', data: (await res.json()) as AdminData });
    } catch {
      setState({ status: 'error' });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (state.status === 'loading') return <p className="text-sm text-muted">Chargement des statistiques…</p>;
  if (state.status === 'forbidden') return <EmptyState icon="shield" title="Accès réservé">Cette page est réservée à l’administrateur de Rythme.</EmptyState>;
  if (state.status === 'error' || !state.data)
    return (
      <EmptyState icon="refresh" title="Statistiques indisponibles" action={<Button onClick={() => void load()}>Réessayer</Button>}>
        L’API /api/admin ne répond pas. En local, elle n’existe qu’avec <code>vercel dev</code> ; sinon vérifie les variables du projet Vercel.
      </EmptyState>
    );

  const { stats, accounts, onboarded, feedback, generatedAt } = state.data;
  const maxActive = Math.max(1, ...stats.weekly.map((w) => w.active));

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Usage de Rythme</h1>
          <p className="mt-1 text-sm text-muted">Mis à jour {new Date(generatedAt).toLocaleString('fr-FR')} · données anonymes</p>
        </div>
        <Button size="sm" icon="refresh" onClick={() => void load()}>
          Actualiser
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Chiffres clés">
        <Stat label="Inscrits" value={String(onboarded)} hint={`${accounts} comptes créés`} />
        <Stat label="Actifs sur 7 jours" value={String(stats.activeLast7Days)} />
        <Stat label="Rétention S1" value={pct(stats.overall[1])} hint="actifs la 2ᵉ semaine" />
        <Stat label="Rétention S4" value={pct(stats.overall[4])} hint="l’indicateur clé de la V1" emphasis />
      </section>

      <section>
        <SectionTitle>Utilisateurs actifs par semaine</SectionTitle>
        <Card className="p-5">
          <div className="flex h-40 items-end gap-[2px]" role="list" aria-label="Utilisateurs actifs par semaine">
            {stats.weekly.map((w) => (
              <div key={w.weekStart} role="listitem" className="group relative flex h-full flex-1 flex-col items-center justify-end">
                <span className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-bg shadow-pop group-hover:block">
                  Sem. du {formatShort(w.weekStart)} : {w.active} actif{w.active > 1 ? 's' : ''}, {w.signups} inscrit{w.signups > 1 ? 's' : ''}
                </span>
                <span
                  className="w-full max-w-10 rounded-t bg-accent transition-colors group-hover:bg-accent/80"
                  style={{ height: `${(w.active / maxActive) * 100}%`, minHeight: w.active ? 2 : 0 }}
                  aria-label={`Semaine du ${formatShort(w.weekStart)} : ${w.active} actifs`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-2xs text-faint">
            <span>{formatShort(stats.weekly[0]!.weekStart)}</span>
            <span>
              Cette semaine : <strong className="text-muted">{stats.weekly.at(-1)!.active}</strong>
            </span>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Rétention par cohorte d’inscription</SectionTitle>
        {stats.cohorts.length === 0 ? (
          <p className="px-1 text-sm text-muted">Aucune inscription pour l’instant.</p>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Semaine d’inscription</th>
                  <th className="px-4 py-2.5 text-right font-medium">Inscrits</th>
                  {RETENTION_WEEKS.map((k) => (
                    <th key={k} className="px-4 py-2.5 text-center font-medium">
                      Semaine {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.cohorts.map((c) => (
                  <tr key={c.weekStart} className="border-b border-line last:border-none">
                    <td className="px-4 py-2.5">{formatShort(c.weekStart)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.size}</td>
                    {RETENTION_WEEKS.map((k) => {
                      const cell = c.retention[k];
                      const rate = cell.retained / c.size;
                      return (
                        <td key={k} className="px-2 py-1.5 text-center">
                          {cell.measurable ? (
                            <span
                              className="inline-flex min-w-16 justify-center rounded-md px-2 py-1 tabular-nums"
                              style={{ backgroundColor: `rgb(var(--accent) / ${0.08 + rate * 0.5})` }}
                              title={`${cell.retained} sur ${c.size}`}
                            >
                              {pct(rate)}
                            </span>
                          ) : (
                            <span className="text-faint" title="Fenêtre pas encore terminée">
                              …
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-line px-4 py-2 text-xs text-muted">
              Semaine N : part des inscrits ayant utilisé l’app entre J+7N et J+7N+6. « … » : trop tôt pour mesurer.
            </p>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Événements</SectionTitle>
        <Card className="divide-y divide-line">
          {Object.entries(EVENT_LABELS).map(([type, label]) => (
            <div key={type} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-muted">{label}</span>
              <span className="tabular-nums">{stats.eventsByType[type] ?? 0}</span>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <SectionTitle count={feedback.length}>Retours reçus</SectionTitle>
        {feedback.length === 0 ? (
          <p className="px-1 text-sm text-muted">Aucun retour pour l’instant.</p>
        ) : (
          <ul className="space-y-2">
            {feedback.map((f) => (
              <li key={f.id}>
                <Card className="p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6">{f.message}</p>
                  <p className="mt-2 text-xs text-faint">
                    {new Date(f.created_at).toLocaleString('fr-FR')} · page {f.page || '/'}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint, emphasis }: { label: string; value: string; hint?: string; emphasis?: boolean }) {
  return (
    <Card className={cx('p-4', emphasis && 'border-accent/40 bg-accent-soft')}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
}
