import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Cliente Supabase con service_role.
 *
 * BYPASSEA RLS. Solo úsalo en Server Actions / Route Handlers para
 * operaciones privilegiadas (Admin API: invites, signOut global,
 * notificaciones del sistema, jobs administrativos).
 *
 * Nunca lo importes desde un Client Component — `'server-only'` rompe el
 * build si se intenta. Tampoco lo expongas por props/contexto.
 *
 * El cliente se cachea en un singleton para evitar re-instanciar en cada
 * request (Next puede invocar la misma Server Action muchas veces durante
 * la vida de un worker). En hot reload de dev, Next descarta el módulo y
 * el singleton se reinicializa solo.
 */
type AdminClient = SupabaseClient<Database>;

let cached: AdminClient | null = null;

export function createAdminClient(): AdminClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  }

  cached = createClient<Database>(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}
