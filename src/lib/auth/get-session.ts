import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export interface Session {
  user: User;
  profile: Profile | null;
}

/**
 * Devuelve `{ user, profile }` para el request actual leyendo la sesión de
 * Supabase desde las cookies (vía `createClient()` de `src/lib/supabase/server`).
 *
 * Si no hay sesión activa devuelve `null`. Si hay user pero no profile
 * (caso edge: race condition entre signup y trigger de profile), devuelve
 * `{ user, profile: null }` para que el caller decida.
 *
 * Se usa en los layouts segmentados (`(app)`, `(dashboard)`, `(admin)`,
 * `(auth)`) y en el `TopNav` para evitar duplicar la query.
 */
export async function getSessionAndProfile(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return { user, profile: profile ?? null };
}
