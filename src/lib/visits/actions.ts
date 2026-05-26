'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getZonedHourMinute, VISIT_SLOT_CONSTANTS } from './slot-utils';

/**
 * Server Action `scheduleVisit`.
 *
 * Flujo (spec §7.2):
 * 1. Valida con zod (uuid + ISO + ventana 24h-60d + message ≤ 500).
 * 2. Lee user de la sesión.
 * 3. Lee property (owner_id, listing_status, timezone). Valida active
 *    y que user no sea dueño.
 * 4. Valida `hour ∈ [9..19]` y `minute ∈ {0,30}` en zona local de la
 *    propiedad (defense-in-depth, spec §16.3.6).
 * 5. INSERT en visits con status='confirmed'. El trigger DB notifica al
 *    agente automáticamente.
 * 6. Mapea el error 23505 (unique_violation) a `slot_taken`.
 * 7. revalidatePath de la pantalla y del profile.
 *
 * Decisión: status inicial = `confirmed` (D4, no `pending`).
 */

const MIN_WINDOW_MS = 24 * 3600 * 1000;
const MAX_WINDOW_MS = 60 * 24 * 3600 * 1000;

const schema = z.object({
  propertyId: z.string().uuid(),
  scheduledAt: z
    .string()
    .datetime({ offset: true })
    .refine((iso) => {
      const t = new Date(iso).getTime();
      if (Number.isNaN(t)) return false;
      const now = Date.now();
      return t >= now + MIN_WINDOW_MS && t <= now + MAX_WINDOW_MS;
    }, 'La fecha debe estar entre 24 horas y 60 días desde ahora.'),
  message: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type ScheduleVisitErrorCode =
  | 'unauthenticated'
  | 'invalid'
  | 'property_not_found'
  | 'is_owner'
  | 'slot_taken'
  | 'server';

export type ScheduleVisitResult =
  | { ok: true; visitId: string }
  | {
      ok: false;
      error: { code: ScheduleVisitErrorCode; message: string };
    };

export interface ScheduleVisitInput {
  propertyId: string;
  scheduledAt: string;
  message?: string | null;
}

export async function scheduleVisit(input: ScheduleVisitInput): Promise<ScheduleVisitResult> {
  const parsed = schema.safeParse({
    propertyId: input.propertyId,
    scheduledAt: input.scheduledAt,
    message: input.message ?? '',
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Datos inválidos.';
    return { ok: false, error: { code: 'invalid', message: first } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: { code: 'unauthenticated', message: 'Inicia sesión para agendar.' },
    };
  }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('owner_id, listing_status, timezone')
    .eq('id', parsed.data.propertyId)
    .maybeSingle();

  if (propertyError) {
    console.warn('[scheduleVisit] property query failed', propertyError);
    return {
      ok: false,
      error: { code: 'server', message: 'No se pudo agendar.' },
    };
  }
  if (!property || property.listing_status !== 'active') {
    return {
      ok: false,
      error: { code: 'property_not_found', message: 'La propiedad no está disponible.' },
    };
  }
  if (property.owner_id === user.id) {
    return {
      ok: false,
      error: {
        code: 'is_owner',
        message: 'No puedes agendar una visita a tu propia propiedad.',
      },
    };
  }

  // Defense-in-depth: el slot debe ser :00 o :30, y hora 9..19:30 en zona
  // local de la propiedad.
  const scheduledDate = new Date(parsed.data.scheduledAt);
  const { hour, minute } = getZonedHourMinute(scheduledDate, property.timezone);
  const isValidMinute = minute === 0 || minute === 30;
  const isValidHour =
    hour >= VISIT_SLOT_CONSTANTS.HOUR_START &&
    (hour < VISIT_SLOT_CONSTANTS.HOUR_END_INCLUSIVE ||
      (hour === VISIT_SLOT_CONSTANTS.HOUR_END_INCLUSIVE && minute <= 30));
  if (!isValidMinute || !isValidHour) {
    return {
      ok: false,
      error: { code: 'invalid', message: 'Horario fuera de la ventana válida.' },
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('visits')
    .insert({
      property_id: parsed.data.propertyId,
      user_id: user.id,
      agent_id: property.owner_id,
      scheduled_at: parsed.data.scheduledAt,
      duration_minutes: 30,
      status: 'confirmed',
      message: parsed.data.message,
    })
    .select('id')
    .single();

  if (insertError) {
    // 23505 = unique_violation del índice parcial creado en 0017.
    if (insertError.code === '23505') {
      revalidatePath(`/property/${parsed.data.propertyId}/schedule`);
      return {
        ok: false,
        error: {
          code: 'slot_taken',
          message: 'Ese horario acaba de ser tomado. Elige otro.',
        },
      };
    }
    console.warn('[scheduleVisit] insert failed', insertError);
    return {
      ok: false,
      error: { code: 'server', message: 'No se pudo agendar.' },
    };
  }

  revalidatePath(`/property/${parsed.data.propertyId}/schedule`);
  revalidatePath('/profile');
  return { ok: true, visitId: inserted.id };
}

// ============================================================
// cancelVisit (feature property_management_dashboard)
// ============================================================

const cancelVisitSchema = z.object({ visitId: z.string().uuid() });

export type CancelVisitErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid'
  | 'already_cancelled'
  | 'past_visit'
  | 'server';

export type CancelVisitResult =
  | { ok: true }
  | { ok: false; error: { code: CancelVisitErrorCode; message: string } };

/**
 * Server Action `cancelVisit` — el agent (o admin) cancela una visita
 * pendiente. Se usa desde el dialog "Archivar" cuando hay visits
 * bloqueando.
 *
 * Guards (spec §"Server Actions > cancelVisit"):
 *  1. zod (visitId uuid).
 *  2. Sesión autenticada.
 *  3. Visit existe.
 *  4. Caller es admin o `agent_id === user.id` (el agent_id siempre es el
 *     owner de la property por el trigger `validate_visit_agent`).
 *  5. Status actual en (pending|confirmed|rescheduled). Si no →
 *     `already_cancelled`.
 *  6. `scheduled_at > now()`. Si no → `past_visit`.
 *  7. UPDATE status='cancelled'. El trigger
 *     `notify_user_on_visit_cancel` (mig 0018) crea la notification al
 *     user afectado.
 *  8. revalidatePath dashboard + profile.
 *
 * **Decisión sobre status**: el enum `visit_status` no tiene
 * `cancelled_by_agent`. Usamos `cancelled` y distinguimos "quién canceló"
 * vía notification con copy específico (mig 0018).
 */
export async function cancelVisit(input: { visitId: string }): Promise<CancelVisitResult> {
  const parsed = cancelVisitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'invalid', message: 'ID inválido.' } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: { code: 'unauthenticated', message: 'Inicia sesión para continuar.' },
    };
  }

  const { data: visit, error: visitError } = await supabase
    .from('visits')
    .select('id, agent_id, user_id, status, scheduled_at')
    .eq('id', parsed.data.visitId)
    .maybeSingle();
  if (visitError) {
    console.warn('[cancelVisit] visit query failed', visitError);
    return { ok: false, error: { code: 'server', message: 'No se pudo cancelar la visita.' } };
  }
  if (!visit) {
    return { ok: false, error: { code: 'not_found', message: 'Visita no encontrada.' } };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = profile?.role === 'admin';
  const isAgent = visit.agent_id === user.id;
  if (!isAdmin && !isAgent) {
    return {
      ok: false,
      error: { code: 'forbidden', message: 'No tienes permiso para cancelar esta visita.' },
    };
  }

  if (
    !(['pending', 'confirmed', 'rescheduled'] as const).includes(
      visit.status as 'pending' | 'confirmed' | 'rescheduled',
    )
  ) {
    return {
      ok: false,
      error: { code: 'already_cancelled', message: 'La visita ya no está activa.' },
    };
  }

  if (new Date(visit.scheduled_at).getTime() <= Date.now()) {
    return {
      ok: false,
      error: { code: 'past_visit', message: 'No se pueden cancelar visitas pasadas.' },
    };
  }

  const { error: updateError } = await supabase
    .from('visits')
    .update({ status: 'cancelled' })
    .eq('id', parsed.data.visitId);
  if (updateError) {
    console.warn('[cancelVisit] update failed', updateError);
    return { ok: false, error: { code: 'server', message: 'No se pudo cancelar la visita.' } };
  }

  revalidatePath('/dashboard');
  revalidatePath('/profile');
  return { ok: true };
}

// ============================================================
// getPendingVisitsForArchive (feature property_management_dashboard)
// ============================================================

const pendingVisitsSchema = z.object({ propertyId: z.string().uuid() });

export interface PendingVisitForDialog {
  id: string;
  scheduledAt: string;
  propertyTimezone: string;
  userDisplayName: string;
}

export type GetPendingVisitsErrorCode = 'unauthenticated' | 'forbidden' | 'invalid' | 'server';

export type GetPendingVisitsResult =
  | { ok: true; visits: PendingVisitForDialog[] }
  | {
      ok: false;
      error: { code: GetPendingVisitsErrorCode; message: string };
    };

/**
 * Query auxiliar del delete-dialog. La empaquetamos como Server Action
 * (`'use server'`) en lugar de exponer un endpoint REST porque el cliente
 * la invoca sobre la cookie de sesión y nos apoyamos en RLS de `visits`
 * (`visits_select_participant_or_admin`).
 *
 * Filtra a visits con `status IN ('pending','confirmed','rescheduled')` y
 * `scheduled_at > now()` para la property dada. Devuelve además la timezone
 * de la property y el display name del user que agendó (full_name del
 * profile, fallback a "Usuario sin nombre").
 */
export async function getPendingVisitsForArchive(input: {
  propertyId: string;
}): Promise<GetPendingVisitsResult> {
  const parsed = pendingVisitsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'invalid', message: 'ID inválido.' } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: { code: 'unauthenticated', message: 'Inicia sesión para continuar.' },
    };
  }

  // Comprobamos que el caller sea owner o admin antes de exponer los
  // datos (defense-in-depth — RLS ya cubre el caso para los usuarios
  // normales, pero un agent que no sea owner no debería ver visits de
  // otra property).
  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('owner_id, timezone')
    .eq('id', parsed.data.propertyId)
    .maybeSingle();
  if (propertyError) {
    console.warn('[getPendingVisitsForArchive] property query failed', propertyError);
    return { ok: false, error: { code: 'server', message: 'No se pudieron leer las visitas.' } };
  }
  if (!property) {
    return { ok: false, error: { code: 'forbidden', message: 'No tienes acceso.' } };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = profile?.role === 'admin';
  const isOwner = property.owner_id === user.id;
  if (!isAdmin && !isOwner) {
    return { ok: false, error: { code: 'forbidden', message: 'No tienes acceso.' } };
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('visits')
    .select(
      `
      id, scheduled_at,
      visitor:profiles!visits_user_id_fkey ( full_name )
    `,
    )
    .eq('property_id', parsed.data.propertyId)
    .in('status', ['pending', 'confirmed', 'rescheduled'])
    .gt('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true });

  if (error) {
    console.warn('[getPendingVisitsForArchive] visits query failed', error);
    return { ok: false, error: { code: 'server', message: 'No se pudieron leer las visitas.' } };
  }

  type RawVisitRow = {
    id: string;
    scheduled_at: string;
    visitor: { full_name: string | null } | Array<{ full_name: string | null }> | null;
  };

  const visits = (data as unknown as RawVisitRow[]).map((row) => {
    const visitor = Array.isArray(row.visitor) ? (row.visitor[0] ?? null) : (row.visitor ?? null);
    const name = visitor?.full_name?.trim();
    return {
      id: row.id,
      scheduledAt: row.scheduled_at,
      propertyTimezone: property.timezone ?? 'America/Mexico_City',
      userDisplayName: name && name.length > 0 ? name : 'Usuario sin nombre',
    };
  });

  return { ok: true, visits };
}
