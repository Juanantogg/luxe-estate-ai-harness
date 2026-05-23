'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Filters } from '@/lib/search/filter-params';
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

/**
 * Server Action `getMatchingPropertiesCount`.
 *
 * Conteo en vivo del modal de filtros. Aplica los mismos filtros que la
 * página `/search` (incluido el subquery de amenities en modo OR) pero con
 * `head: true` para no transferir filas — solo el header `Content-Range`
 * con el count.
 *
 * Errores se loggean y devuelven `count: 0` para que el UI muestre la
 * variante "sin número" del botón sin romper.
 */
export async function getMatchingPropertiesCount(filters: Filters): Promise<{ count: number }> {
  const supabase = await createClient();

  // Si hay filtro de amenities, primero resolvemos los property_ids
  // candidatos (modo OR: al menos una). Decisión humana 2026-05-23.
  let amenityPropertyIds: string[] | null = null;
  if (filters.amenities.length > 0) {
    const { data: amenityRows, error: amenityErr } = await supabase
      .from('property_amenities')
      .select('property_id')
      .in('amenity', filters.amenities);
    if (amenityErr) {
      console.warn('[getMatchingPropertiesCount] amenities subquery failed', amenityErr);
      return { count: 0 };
    }
    amenityPropertyIds = Array.from(new Set((amenityRows ?? []).map((r) => r.property_id)));
    if (amenityPropertyIds.length === 0) return { count: 0 };
  }

  let q = supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('listing_status', 'active');

  if (filters.q) q = q.textSearch('search_vector', filters.q);
  if (filters.location) q = q.ilike('city', `%${filters.location}%`);
  if (filters.minPrice != null) q = q.gte('price', filters.minPrice);
  if (filters.maxPrice != null) q = q.lte('price', filters.maxPrice);
  if (filters.type) q = q.eq('property_type', filters.type);
  if (filters.listing) q = q.eq('listing_type', filters.listing);
  if (filters.bedrooms > 0) q = q.gte('bedrooms', filters.bedrooms);
  if (filters.bathrooms > 0) q = q.gte('bathrooms', filters.bathrooms);
  if (amenityPropertyIds) q = q.in('id', amenityPropertyIds);

  const { count, error } = await q;
  if (error) {
    console.warn('[getMatchingPropertiesCount] query failed', error);
    return { count: 0 };
  }
  return { count: count ?? 0 };
}
