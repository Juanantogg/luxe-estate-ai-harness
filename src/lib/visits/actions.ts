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
