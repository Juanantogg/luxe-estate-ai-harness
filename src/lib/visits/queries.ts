import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type SupabaseDb = SupabaseClient<Database>;

/**
 * Devuelve los timestamps ISO (UTC) de los slots OCUPADOS de un agente en
 * la ventana [now, now + windowDays].
 *
 * Implementación: invoca la RPC `get_agent_occupied_slots` (security
 * definer, ver migración 0017). Esto preserva privacidad: NO se devuelven
 * user_id ni mensajes — solo timestamps.
 *
 * Si la query falla, devuelve `[]` (mejor mostrar slots libres que romper
 * la pantalla). El error se loguea para que sea visible en dev.
 */
export async function getAgentOccupiedSlots(
  supabase: SupabaseDb,
  agentId: string,
  windowDays = 60,
): Promise<string[]> {
  const now = new Date();
  const fromIso = now.toISOString();
  const toIso = new Date(now.getTime() + windowDays * 24 * 3600 * 1000).toISOString();

  const { data, error } = await supabase.rpc('get_agent_occupied_slots', {
    agent: agentId,
    from_ts: fromIso,
    to_ts: toIso,
  });
  if (error) {
    console.warn('[getAgentOccupiedSlots] rpc failed', error);
    return [];
  }
  return (data ?? []).map((r) => new Date(r.scheduled_at).toISOString());
}
