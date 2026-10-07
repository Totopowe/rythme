import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Faux si les variables d'environnement ne sont pas renseignées (voir .env.example). */
export const supabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : (null as unknown as SupabaseClient);

/** Une erreur sans code Postgres est un problème de réseau : on réessaiera plus tard. */
export function isNetworkError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return !error.code || /fetch|network|timeout/i.test(error.message ?? '');
}
