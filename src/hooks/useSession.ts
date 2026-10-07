import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../data/supabase';

/** Session Supabase : `undefined` pendant la vérification, `null` si personne n'est connecté. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(supabaseConfigured ? undefined : null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return session;
}
