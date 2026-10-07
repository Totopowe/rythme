/** Accès Supabase côté serveur (fonctions Vercel). Les fichiers préfixés par _ ne sont pas des routes. */

export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export const supabaseUrl = () => process.env.SUPABASE_URL ?? env('VITE_SUPABASE_URL');
export const anonKey = () => process.env.SUPABASE_ANON_KEY ?? env('VITE_SUPABASE_ANON_KEY');

/** Appel d'une fonction SQL exposée au rôle anonyme. */
export async function rpcAnon<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: anonKey(), Authorization: `Bearer ${anonKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`RPC ${fn} : ${res.status}`);
  return (await res.json()) as T | null;
}

/** Lecture complète d'une table avec la clé service_role, page par page (PostgREST limite à 1000 lignes). */
export async function selectAll<T>(table: string, columns: string, order = 'created_at.asc'): Promise<T[]> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${supabaseUrl()}/rest/v1/${table}?select=${columns}&order=${order}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + pageSize - 1}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) throw new Error(`Lecture ${table} : ${res.status}`);
    const page = (await res.json()) as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

/** Utilisateur correspondant à un jeton de session Supabase (ou null). */
export async function userFromToken(token: string): Promise<{ id: string; email?: string } | null> {
  const res = await fetch(`${supabaseUrl()}/auth/v1/user`, { headers: { apikey: anonKey(), Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; email?: string };
}
