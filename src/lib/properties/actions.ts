'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Server Action `toggleFavorite`.
 *
 * - Si no hay sesión, devuelve `{ ok: false, error: { code: 'unauthenticated' } }`
 *   y el cliente decide qué hacer (redirigir a `/login?next=/` en el caso del
 *   heart de la home).
 * - Lee el estado actual de `favorites` y alterna INSERT / DELETE.
 * - Revalida `/`, `/favorites`, `/property/[id]` para que cualquier listado
 *   server-side se refresque tras la mutación.
 */

const schema = z.object({ propertyId: z.string().uuid() });

export type ToggleFavoriteResult =
  | { ok: true; isFavorite: boolean }
  | {
      ok: false;
      error: { code: 'unauthenticated' | 'invalid' | 'server'; message: string };
    };

export async function toggleFavorite(input: { propertyId: string }): Promise<ToggleFavoriteResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'invalid', message: 'ID de propiedad inválido.' },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: { code: 'unauthenticated', message: 'Inicia sesión para guardar.' },
    };
  }

  const propertyId = parsed.data.propertyId;

  const { data: existing } = await supabase
    .from('favorites')
    .select('property_id')
    .eq('user_id', user.id)
    .eq('property_id', propertyId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('property_id', propertyId);
    if (error) {
      return {
        ok: false,
        error: { code: 'server', message: 'No se pudo quitar el favorito.' },
      };
    }
    revalidatePath('/');
    revalidatePath('/favorites');
    revalidatePath(`/property/${propertyId}`);
    return { ok: true, isFavorite: false };
  }

  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: user.id, property_id: propertyId });
  if (error) {
    return {
      ok: false,
      error: { code: 'server', message: 'No se pudo guardar.' },
    };
  }
  revalidatePath('/');
  revalidatePath('/favorites');
  revalidatePath(`/property/${propertyId}`);
  return { ok: true, isFavorite: true };
}
