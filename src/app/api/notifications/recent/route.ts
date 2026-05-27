import { NextResponse } from 'next/server';
import { getRecentNotifications } from '@/lib/notifications/queries';
import { createClient } from '@/lib/supabase/server';

/**
 * Route handler `GET /api/notifications/recent` (spec §7.4).
 *
 * Devuelve las últimas 10 notificaciones del user autenticado + el total
 * sin leer. Lo consume el cliente `NotificationsDropdown` con polling cada
 * 30s mientras el panel está abierto y la pestaña visible.
 *
 * - 200 `{ items, unreadCount }` cuando hay sesión.
 * - 401 `{ error }` cuando no hay sesión (el `NotifBell` solo se monta con
 *   user, pero el handler hace doble guardia).
 * - 500 `{ error }` ante cualquier error de servidor.
 *
 * `cache: 'no-store'` + `force-dynamic` para garantizar que el polling
 * siempre obtiene datos frescos.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthenticated', message: 'Inicia sesión.' } },
      { status: 401 },
    );
  }

  try {
    const result = await getRecentNotifications(supabase, user.id, 10);
    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'server', message: 'No se pudieron obtener las notificaciones.' } },
      { status: 500 },
    );
  }
}
