import { computeUsageStats, type UsageEvent } from '../src/domain/analytics.js';
import { env, selectAll, userFromToken } from './_supabase.js';

/**
 * Statistiques d'usage pour /admin. Réservé au compte dont l'e-mail est ADMIN_EMAIL.
 * La clé service_role n'est utilisée qu'ici, côté serveur.
 */
export async function GET(request: Request): Promise<Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const user = token ? await userFromToken(token) : null;
  const admins = env('ADMIN_EMAIL')
    .split(',')
    .map((e) => e.trim().toLowerCase());
  if (!user?.email || !admins.includes(user.email.toLowerCase())) {
    return Response.json({ error: 'Accès réservé.' }, { status: 403 });
  }

  const [events, profiles, feedback] = await Promise.all([
    selectAll<{ subject_id: string; type: string; created_at: string }>('events', 'subject_id,type,created_at'),
    selectAll<{ created_at: string; onboarded_at: string | null }>('profiles', 'created_at,onboarded_at'),
    selectAll<{ id: string; message: string; page: string; created_at: string }>('feedback', 'id,message,page,created_at', 'created_at.desc'),
  ]);

  const usage: UsageEvent[] = events.map((e) => ({ subjectId: e.subject_id, type: e.type, createdAt: e.created_at }));
  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      accounts: profiles.length,
      onboarded: profiles.filter((p) => p.onboarded_at).length,
      stats: computeUsageStats(usage, new Date()),
      feedback: feedback.slice(0, 300),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
