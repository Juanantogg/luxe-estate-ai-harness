'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Server Actions del dropdown de notificaciones (spec §7).
 *
 * Patrón del proyecto: cada action devuelve
 *   `{ ok: true }` o `{ ok: false; error: { code, message } }`
 * con mensajes ya en español neutro.
 *
 * Seguridad:
 * - `markAsRead` valida zod (id uuid) y delega a RLS. La policy
 *   `notifications_update_own` (mig 0009) garantiza que solo el dueño
 *   puede modificar sus filas (`with check recipient_id = auth.uid()`).
 * - `markAllAsRead` filtra explícitamente por `recipient_id = user.id`
 *   (defense-in-depth) además del filtro RLS.
 *
 * Ambas hacen `revalidatePath('/')` para invalidar el render del layout
 * `(app)/` y refrescar el `unreadCount` del `TopNav` en la próxima
 * navegación natural. El badge local del `NotifBell` se actualiza
 * optimistically para que la UX no espere el round-trip.
 */

const markAsReadSchema = z.object({ id: z.string().uuid() });

export type MarkAsReadErrorCode = 'unauthenticated' | 'invalid' | 'server';

export type MarkAsReadResult =
  | { ok: true }
  | { ok: false; error: { code: MarkAsReadErrorCode; message: string } };

export async function markAsRead(id: string): Promise<MarkAsReadResult> {
  const parsed = markAsReadSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: { code: 'invalid', message: 'Identificador inválido.' } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: { code: 'unauthenticated', message: 'Inicia sesión.' } };
  }

  // `is('read_at', null)` hace la operación idempotente: si la fila ya
  // estaba leída, no la toca. RLS garantiza que solo afecta filas del user.
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .is('read_at', null);

  if (error) {
    return { ok: false, error: { code: 'server', message: 'No se pudo marcar la notificación.' } };
  }

  revalidatePath('/');
  return { ok: true };
}

export type MarkAllAsReadErrorCode = 'unauthenticated' | 'server';

export type MarkAllAsReadResult =
  | { ok: true; count: number }
  | { ok: false; error: { code: MarkAllAsReadErrorCode; message: string } };

export async function markAllAsRead(): Promise<MarkAllAsReadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: { code: 'unauthenticated', message: 'Inicia sesión.' } };
  }

  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', user.id) // defense-in-depth — RLS ya filtra
    .is('read_at', null)
    .select('id');

  if (error) {
    return { ok: false, error: { code: 'server', message: 'No se pudo actualizar.' } };
  }

  revalidatePath('/');
  return { ok: true, count: data?.length ?? 0 };
}
