import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { NotificationRow } from './types';

/**
 * Lee las últimas N notificaciones del user + el conteo total sin leer.
 *
 * - RLS (`notifications_select_own_or_admin`) ya filtra por
 *   `recipient_id = auth.uid()`. El `eq('recipient_id', userId)` es
 *   defense-in-depth y garantiza el filtrado aún si en algún flujo se
 *   invoca con un admin client (no es el caso hoy).
 * - `unreadCount` es el conteo total (no truncado por `limit`) — el badge
 *   del `TopNav` muestra "hay sin leer", no "hay sin leer en los últimos 10".
 *
 * @param supabase Cliente Supabase del request actual.
 * @param userId   ID del recipient (debe coincidir con `auth.uid()`).
 * @param limit    Máximo de items devueltos (default 10).
 */
export async function getRecentNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 10,
): Promise<{ items: NotificationRow[]; unreadCount: number }> {
  const itemsRes = await supabase
    .from('notifications')
    .select('id, type, title, body, property_id, visit_id, conversation_id, read_at, created_at')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  const countRes = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null);

  return {
    items: (itemsRes.data ?? []) as NotificationRow[],
    unreadCount: countRes.count ?? 0,
  };
}
