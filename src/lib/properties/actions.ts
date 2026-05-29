'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Filters } from '@/lib/search/filter-params';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import {
  AMENITY_KEYS,
  MAX_IMAGES_PER_PROPERTY,
  draftSchema,
  flattenFieldErrors,
  publishSchema,
} from './form-schemas';
import { PROPERTY_IMAGES_BUCKET } from './image-upload';

type SupabaseDb = SupabaseClient<Database>;

/**
 * Revalida ambos paths del detalle de una property: el slug actual (canónico)
 * y el path UUID legacy (que ya no existe como page pero puede estar cacheado
 * en clientes que llegaron vía el 308 antes del rename, o en links externos).
 *
 * Defensivo: Next ignora silenciosamente la revalidación de un path sin matcher
 * — el `/property/<uuid>` no rompe nada, solo deja una invalidación de cache
 * sin efecto visible. Costo cero, robustez contra estados intermedios.
 *
 * Interno (sin export): solo se usa desde las actions de este módulo.
 * Si la query del slug falla o devuelve null, revalidamos al menos el path
 * UUID y loggeamos warn para no perder señales sin matar el Server Action.
 */
async function revalidatePropertyPaths(supabase: SupabaseDb, propertyId: string): Promise<void> {
  const { data, error } = await supabase
    .from('properties')
    .select('slug')
    .eq('id', propertyId)
    .maybeSingle();
  if (error) {
    console.warn('[revalidatePropertyPaths] slug lookup failed', { propertyId, error });
  }
  revalidatePath(`/property/${propertyId}`);
  if (data?.slug) {
    revalidatePath(`/property/${data.slug}`);
  }
}

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
    await revalidatePropertyPaths(supabase, propertyId);
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
  await revalidatePropertyPaths(supabase, propertyId);
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

// ============================================================
// Archive / Restore (feature property_management_dashboard)
// ============================================================

const idOnlySchema = z.object({ id: z.string().uuid() });

export type ArchivePropertyErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid'
  | 'pending_visits'
  | 'server';

export type ArchivePropertyResult =
  | { ok: true }
  | { ok: false; error: { code: ArchivePropertyErrorCode; message: string } };

/**
 * Server Action `archiveProperty` — soft-delete que setea
 * `listing_status='archived'`.
 *
 * Guards (spec §"Server Actions > archiveProperty"):
 *  1. zod (id uuid).
 *  2. Sesión autenticada.
 *  3. Property existe.
 *  4. Caller es admin o owner.
 *  5. **Server-side guard de visits pendientes** (defense-in-depth): si la
 *     property tiene visits futuras con `status IN
 *     ('pending','confirmed','rescheduled')`, devuelve `pending_visits`
 *     y NO archiva. El UI ya impide llegar acá; este check protege contra
 *     clientes que se salteen el dialog.
 *  6. UPDATE listing_status = 'archived'.
 *  7. revalidatePath dashboard + home + detalle.
 */
export async function archiveProperty(input: { id: string }): Promise<ArchivePropertyResult> {
  const parsed = idOnlySchema.safeParse(input);
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

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('owner_id, listing_status')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (propertyError) {
    console.warn('[archiveProperty] property query failed', propertyError);
    return { ok: false, error: { code: 'server', message: 'No se pudo archivar.' } };
  }
  if (!property) {
    return { ok: false, error: { code: 'not_found', message: 'Propiedad no encontrada.' } };
  }

  // Role check (defense-in-depth). RLS también protege.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = profile?.role === 'admin';
  const isOwner = property.owner_id === user.id;
  if (!isAdmin && !isOwner) {
    return {
      ok: false,
      error: { code: 'forbidden', message: 'No tienes permiso para archivar esta propiedad.' },
    };
  }

  // Guard de visits pendientes futuras.
  const nowIso = new Date().toISOString();
  const { count: pendingCount, error: visitsCountError } = await supabase
    .from('visits')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', parsed.data.id)
    .in('status', ['pending', 'confirmed', 'rescheduled'])
    .gt('scheduled_at', nowIso);
  if (visitsCountError) {
    console.warn('[archiveProperty] visits count failed', visitsCountError);
    return { ok: false, error: { code: 'server', message: 'No se pudo archivar.' } };
  }
  if ((pendingCount ?? 0) > 0) {
    return {
      ok: false,
      error: {
        code: 'pending_visits',
        message: 'Cancela las visitas pendientes antes de archivar.',
      },
    };
  }

  const { error: updateError } = await supabase
    .from('properties')
    .update({ listing_status: 'archived' })
    .eq('id', parsed.data.id);
  if (updateError) {
    console.warn('[archiveProperty] update failed', updateError);
    return { ok: false, error: { code: 'server', message: 'No se pudo archivar.' } };
  }

  revalidatePath('/dashboard');
  revalidatePath('/');
  await revalidatePropertyPaths(supabase, parsed.data.id);
  return { ok: true };
}

// ============================================================
// Helpers internos para create/update
// ============================================================

const DRAFT_PREFIX = '_drafts/';
const PROPERTIES_PREFIX = 'properties/';

const VALID_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

function extensionFromPath(path: string): string {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return 'jpg';
  return path.slice(dot + 1).toLowerCase();
}

function buildFinalImagePath(propertyId: string, originalPath: string): string {
  const ext = extensionFromPath(originalPath);
  const safeExt = (VALID_EXTENSIONS as readonly string[]).includes(ext) ? ext : 'jpg';
  return `${PROPERTIES_PREFIX}${propertyId}/${crypto.randomUUID()}.${safeExt}`;
}

function isDraftPathOfUser(path: string, userId: string): boolean {
  // Esperado: `_drafts/<userId>/<file>`
  if (!path.startsWith(DRAFT_PREFIX)) return false;
  const parts = path.split('/');
  if (parts.length < 3) return false;
  return parts[1] === userId;
}

function isPropertyPathOf(path: string, propertyId: string): boolean {
  // Aceptar URLs absolutas (placeholders del seed). `getImageUrl` ya las
  // resuelve directamente y no hay nada que mover/borrar en Storage; el
  // form las pasa tal cual y la action las preserva en `property_images`.
  if (isExternalUrl(path)) return true;
  if (!path.startsWith(PROPERTIES_PREFIX)) return false;
  const parts = path.split('/');
  if (parts.length < 3) return false;
  return parts[1] === propertyId;
}

function isExternalUrl(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://');
}

// ============================================================
// Create / Update (feature add_edit_property_form)
// ============================================================

const imageInputSchema = z.object({
  id: z.string().uuid().optional(),
  storagePath: z.string().min(1).max(500),
  isMain: z.boolean(),
  altText: z.string().nullable(),
  position: z.number().int().min(0),
  deleted: z.boolean().optional(),
});

const amenitiesInputSchema = z.array(z.enum(AMENITY_KEYS)).max(64);

const createInputSchema = z.object({
  mode: z.enum(['draft', 'publish']),
  values: z.unknown(),
  draftImages: z.array(imageInputSchema).max(MAX_IMAGES_PER_PROPERTY),
  amenities: amenitiesInputSchema,
});

const updateInputSchema = z.object({
  id: z.string().uuid(),
  mode: z.enum(['draft', 'publish']),
  values: z.unknown(),
  images: z.array(imageInputSchema).max(MAX_IMAGES_PER_PROPERTY * 2),
  amenities: amenitiesInputSchema,
});

export type CreatePropertyErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid'
  | 'image_move_failed'
  | 'server';

export type CreatePropertyResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error: {
        code: CreatePropertyErrorCode;
        message: string;
        fieldErrors?: Record<string, string>;
      };
    };

export type CreatePropertyInput = z.input<typeof createInputSchema>;

/**
 * Server Action `createProperty` — crea una propiedad nueva.
 *
 * Flujo (spec §7.1):
 *  1. Auth + rol (agent/broker/admin).
 *  2. Validar `values` con `draftSchema` o `publishSchema` según `mode`.
 *  3. Validar imágenes (≥1 + 1 main en publish; paths bajo `_drafts/<uid>/`).
 *  4. INSERT en `properties`.
 *  5. Mover imágenes secuencialmente de `_drafts/` a `properties/<id>/`.
 *     Si falla un move → rollback: borrar la property y best-effort de
 *     imágenes movidas (los originales en `_drafts/` permanecen).
 *  6. INSERT `property_images` + INSERT `property_amenities`.
 *  7. Revalidate paths.
 */
export async function createProperty(input: CreatePropertyInput): Promise<CreatePropertyResult> {
  const parsedInput = createInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: 'invalid',
        message: 'Datos inválidos.',
        fieldErrors: flattenFieldErrors(parsedInput.error),
      },
    };
  }
  const { mode, values, draftImages } = parsedInput.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: { code: 'unauthenticated', message: 'Iniciá sesión para continuar.' },
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = profile?.role ?? 'user';
  if (!['agent', 'broker', 'admin'].includes(role)) {
    return {
      ok: false,
      error: { code: 'forbidden', message: 'No tienes permiso para crear propiedades.' },
    };
  }

  // Validar values
  const schema = mode === 'publish' ? publishSchema : draftSchema;
  const parsedValues = schema.safeParse(values);
  if (!parsedValues.success) {
    return {
      ok: false,
      error: {
        code: 'invalid',
        message: 'Faltan campos requeridos.',
        fieldErrors: flattenFieldErrors(parsedValues.error),
      },
    };
  }
  const v = parsedValues.data;

  // Validar paths de imágenes (deben ser _drafts/<user.id>/...)
  for (const img of draftImages) {
    if (!isDraftPathOfUser(img.storagePath, user.id)) {
      return {
        ok: false,
        error: {
          code: 'invalid',
          message: 'Una de las imágenes tiene un path inválido.',
        },
      };
    }
  }

  // Reglas extra para publish
  if (mode === 'publish') {
    if (draftImages.length === 0) {
      return {
        ok: false,
        error: {
          code: 'invalid',
          message: 'Subí al menos una imagen para publicar.',
          fieldErrors: { images: 'Subí al menos una imagen.' },
        },
      };
    }
    const mains = draftImages.filter((i) => i.isMain);
    if (mains.length !== 1) {
      return {
        ok: false,
        error: {
          code: 'invalid',
          message: 'Marcá exactamente una imagen como principal.',
          fieldErrors: { images: 'Marcá una imagen como principal.' },
        },
      };
    }
  }

  // El check constraint de la DB exige price > 0. Si es draft sin price,
  // persistimos 1 como placeholder mínimo válido (no afecta UX porque el
  // form se relee con string vacío vía null-handling). Documentado en
  // §7 del spec: el draft permite campos faltantes; la DB exige > 0.
  const priceForInsert = v.price == null || v.price === 0 ? 1 : v.price;

  // El check constraint en la DB requiere `address_line` y `city` not null.
  // Drafts pueden traer strings vacíos — los aceptamos como `' '` mínimo
  // si están vacíos para no violar NOT NULL. (Mejor opción: serían null,
  // pero la columna es NOT NULL desde la migración 0003.)
  const addressForInsert = v.address_line && v.address_line.trim() !== '' ? v.address_line : ' ';
  const cityForInsert = v.city && v.city.trim() !== '' ? v.city : ' ';

  const nowIso = new Date().toISOString();
  const insertPayload = {
    owner_id: user.id,
    title: v.title,
    description: v.description ?? null,
    price: priceForInsert,
    listing_type: v.listing_type,
    listing_status: (mode === 'publish' ? 'active' : 'draft') as 'active' | 'draft',
    property_type: v.property_type,
    address_line: addressForInsert,
    city: cityForInsert,
    state: v.state,
    country: v.country,
    postal_code: v.postal_code,
    bedrooms: v.bedrooms,
    bathrooms: v.bathrooms,
    area_sqm: v.area_sqm,
    parking_spaces: v.parking_spaces,
    year_built: v.year_built,
    published_at: mode === 'publish' ? nowIso : null,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('properties')
    .insert(insertPayload)
    .select('id')
    .single();
  if (insertError || !inserted) {
    console.warn('[createProperty] insert failed', insertError);
    return {
      ok: false,
      error: { code: 'server', message: 'No se pudo crear la propiedad.' },
    };
  }
  const propertyId = inserted.id;

  // Mover imágenes secuencialmente
  const moves: Array<{
    from: string;
    to: string;
    isMain: boolean;
    altText: string | null;
    position: number;
  }> = [];
  const movedSoFar: string[] = [];
  for (const img of draftImages) {
    const to = buildFinalImagePath(propertyId, img.storagePath);
    const { error: moveError } = await supabase.storage
      .from(PROPERTY_IMAGES_BUCKET)
      .move(img.storagePath, to);
    if (moveError) {
      console.warn('[createProperty] image move failed', { from: img.storagePath, to, moveError });
      // Rollback: borrar la property recién creada + best-effort de imágenes movidas
      await supabase.from('properties').delete().eq('id', propertyId);
      if (movedSoFar.length > 0) {
        await supabase.storage.from(PROPERTY_IMAGES_BUCKET).remove(movedSoFar);
      }
      return {
        ok: false,
        error: {
          code: 'image_move_failed',
          message: 'No se pudo mover una imagen. Intenta de nuevo.',
        },
      };
    }
    movedSoFar.push(to);
    moves.push({
      from: img.storagePath,
      to,
      isMain: img.isMain,
      altText: img.altText,
      position: img.position,
    });
  }

  // INSERT property_images
  if (moves.length > 0) {
    const imageRows = moves.map((m) => ({
      property_id: propertyId,
      storage_path: m.to,
      is_main: m.isMain,
      alt_text: m.altText,
      position: m.position,
    }));
    const { error: imagesError } = await supabase.from('property_images').insert(imageRows);
    if (imagesError) {
      console.warn('[createProperty] property_images insert failed', imagesError);
      // No revertimos los moves (las imágenes ya están en `properties/<id>/`).
      // Tampoco borramos la property porque la imagen ya está movida.
      // Es un estado degradado pero recuperable manualmente. Loggeo es
      // suficiente para MVP.
    }
  }

  // INSERT property_amenities
  if (parsedInput.data.amenities.length > 0) {
    const rows = parsedInput.data.amenities.map((a) => ({
      property_id: propertyId,
      amenity: a,
    }));
    const { error: amenitiesError } = await supabase.from('property_amenities').insert(rows);
    if (amenitiesError) {
      console.warn('[createProperty] property_amenities insert failed', amenitiesError);
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/');
  await revalidatePropertyPaths(supabase, propertyId);
  return { ok: true, id: propertyId };
}

export type UpdatePropertyErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid'
  | 'image_move_failed'
  | 'server';

export type UpdatePropertyResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error: {
        code: UpdatePropertyErrorCode;
        message: string;
        fieldErrors?: Record<string, string>;
      };
    };

export type UpdatePropertyInput = z.input<typeof updateInputSchema>;

/**
 * Server Action `updateProperty` — edita una propiedad existente.
 *
 * Flujo (spec §7.2):
 *  1. Auth + rol.
 *  2. Cargar property (owner_id, listing_status).
 *  3. Ownership: owner o admin. Sino → `not_found` (no leak).
 *  4. Validar values con schema según mode.
 *  5. Computar diff de imágenes:
 *     - toCreate: nuevas (sin `id`, no `deleted`) — mover de `_drafts/`.
 *     - toDelete: existentes con `deleted=true` — DELETE + remove.
 *     - toUpdate: existentes con `deleted=false` — UPDATE selectivo.
 *  6. UPDATE properties.
 *  7. Aplicar diff de imágenes en orden: deletes → moves+inserts → updates.
 *  8. Diff de amenities.
 *  9. Si publish + estaba draft/archived → listing_status='active' + published_at.
 * 10. Revalidate.
 */
export async function updateProperty(input: UpdatePropertyInput): Promise<UpdatePropertyResult> {
  const parsedInput = updateInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: 'invalid',
        message: 'Datos inválidos.',
        fieldErrors: flattenFieldErrors(parsedInput.error),
      },
    };
  }
  const { id, mode, values, images, amenities } = parsedInput.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: { code: 'unauthenticated', message: 'Iniciá sesión para continuar.' },
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = profile?.role ?? 'user';
  if (!['agent', 'broker', 'admin'].includes(role)) {
    return {
      ok: false,
      error: { code: 'forbidden', message: 'No tienes permiso para editar propiedades.' },
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from('properties')
    .select('owner_id, listing_status')
    .eq('id', id)
    .maybeSingle();
  if (existingError) {
    console.warn('[updateProperty] property query failed', existingError);
    return { ok: false, error: { code: 'server', message: 'No se pudo actualizar.' } };
  }
  if (!existing) {
    return { ok: false, error: { code: 'not_found', message: 'Propiedad no encontrada.' } };
  }
  const isAdmin = role === 'admin';
  const isOwner = existing.owner_id === user.id;
  if (!isAdmin && !isOwner) {
    return { ok: false, error: { code: 'not_found', message: 'Propiedad no encontrada.' } };
  }

  const schema = mode === 'publish' ? publishSchema : draftSchema;
  const parsedValues = schema.safeParse(values);
  if (!parsedValues.success) {
    return {
      ok: false,
      error: {
        code: 'invalid',
        message: 'Faltan campos requeridos.',
        fieldErrors: flattenFieldErrors(parsedValues.error),
      },
    };
  }
  const v = parsedValues.data;

  // Diff de imágenes
  const toCreate = images.filter((i) => !i.id && !i.deleted);
  const toDelete = images.filter((i) => i.id && i.deleted);
  const toUpdate = images.filter((i) => i.id && !i.deleted);

  // Validar paths
  for (const img of toCreate) {
    if (!isDraftPathOfUser(img.storagePath, user.id)) {
      return {
        ok: false,
        error: { code: 'invalid', message: 'Una imagen nueva tiene un path inválido.' },
      };
    }
  }
  for (const img of [...toDelete, ...toUpdate]) {
    if (!isPropertyPathOf(img.storagePath, id)) {
      return {
        ok: false,
        error: { code: 'invalid', message: 'Una imagen existente tiene un path inválido.' },
      };
    }
  }

  // Cuenta final de imágenes para validación de máximo
  const finalImageCount = toCreate.length + toUpdate.length;
  if (finalImageCount > MAX_IMAGES_PER_PROPERTY) {
    return {
      ok: false,
      error: {
        code: 'invalid',
        message: `Máximo ${MAX_IMAGES_PER_PROPERTY} imágenes por propiedad.`,
      },
    };
  }

  // Validación específica publish: ≥1 imagen final + 1 main
  if (mode === 'publish') {
    if (finalImageCount === 0) {
      return {
        ok: false,
        error: {
          code: 'invalid',
          message: 'La propiedad necesita al menos una imagen para publicarse.',
          fieldErrors: { images: 'Subí al menos una imagen.' },
        },
      };
    }
    const mains = [...toCreate, ...toUpdate].filter((i) => i.isMain);
    if (mains.length !== 1) {
      return {
        ok: false,
        error: {
          code: 'invalid',
          message: 'Marcá exactamente una imagen como principal.',
          fieldErrors: { images: 'Marcá una imagen como principal.' },
        },
      };
    }
  }

  // Lógica de listing_status:
  //  - publish + estaba draft → active + published_at=now
  //  - publish + estaba archived → active + published_at=now
  //  - publish + estaba active/pending/sold/rented → mantener
  //  - draft + cualquier estado → no cambia listing_status (ni published_at)
  //    (El draft en edit solo guarda cambios; no degrada de active a draft.)
  let nextListingStatus = existing.listing_status;
  let nextPublishedAt: string | null | undefined = undefined;
  if (mode === 'publish') {
    if (existing.listing_status === 'draft' || existing.listing_status === 'archived') {
      nextListingStatus = 'active';
      nextPublishedAt = new Date().toISOString();
    }
  }

  const priceForUpdate = v.price == null || v.price === 0 ? 1 : v.price;
  const addressForUpdate = v.address_line && v.address_line.trim() !== '' ? v.address_line : ' ';
  const cityForUpdate = v.city && v.city.trim() !== '' ? v.city : ' ';

  const baseUpdatePayload = {
    title: v.title,
    description: v.description ?? null,
    price: priceForUpdate,
    listing_type: v.listing_type,
    property_type: v.property_type,
    address_line: addressForUpdate,
    city: cityForUpdate,
    state: v.state,
    country: v.country,
    postal_code: v.postal_code,
    bedrooms: v.bedrooms,
    bathrooms: v.bathrooms,
    area_sqm: v.area_sqm,
    parking_spaces: v.parking_spaces,
    year_built: v.year_built,
    listing_status: nextListingStatus,
  };
  const updatePayload =
    nextPublishedAt !== undefined
      ? { ...baseUpdatePayload, published_at: nextPublishedAt }
      : baseUpdatePayload;

  const { error: updateError } = await supabase
    .from('properties')
    .update(updatePayload)
    .eq('id', id);
  if (updateError) {
    console.warn('[updateProperty] update failed', updateError);
    return { ok: false, error: { code: 'server', message: 'No se pudo actualizar.' } };
  }

  // 1. DELETE imágenes marcadas
  for (const img of toDelete) {
    if (!img.id) continue;
    const { error: delDbErr } = await supabase.from('property_images').delete().eq('id', img.id);
    if (delDbErr) {
      console.warn('[updateProperty] property_images delete failed', delDbErr);
    }
    // Solo borrar de Storage si el path es relativo (no placeholder URL).
    if (!isExternalUrl(img.storagePath)) {
      const { error: delStorageErr } = await supabase.storage
        .from(PROPERTY_IMAGES_BUCKET)
        .remove([img.storagePath]);
      if (delStorageErr) {
        console.warn('[updateProperty] storage remove failed', delStorageErr);
      }
    }
  }

  // 2. UPDATEs sobre existentes (is_main, position, alt_text).
  //    Cuidado con la constraint `property_images_one_main_idx`:
  //    primero apagamos cualquier main que ya NO sea main; luego
  //    encendemos el main definitivo.
  const mainKeepers = toUpdate.filter((i) => i.isMain).map((i) => i.id);
  // Apagar main en las que NO deberían serlo
  for (const img of toUpdate) {
    if (!img.id) continue;
    if (!img.isMain) {
      const { error: updErr } = await supabase
        .from('property_images')
        .update({
          is_main: false,
          alt_text: img.altText,
          position: img.position,
        })
        .eq('id', img.id);
      if (updErr) {
        console.warn('[updateProperty] property_images update (off main) failed', updErr);
      }
    }
  }
  // Encender los main definitivos
  for (const img of toUpdate) {
    if (!img.id || !img.isMain) continue;
    const { error: updErr } = await supabase
      .from('property_images')
      .update({
        is_main: true,
        alt_text: img.altText,
        position: img.position,
      })
      .eq('id', img.id);
    if (updErr) {
      console.warn('[updateProperty] property_images update (on main) failed', updErr);
    }
  }
  // Si no hay mains entre las kept, podríamos quedar sin main. Eso es OK
  // sólo cuando no hay imágenes finales. Si hay imágenes pero ninguna es
  // main, el caller (form) tiene que prevenirlo; defense-in-depth en
  // publish ya lo validó arriba.
  void mainKeepers;

  // 3. CREATE: mover desde _drafts/ y INSERT
  const movedSoFar: string[] = [];
  const newImageRows: Array<{
    property_id: string;
    storage_path: string;
    is_main: boolean;
    alt_text: string | null;
    position: number;
  }> = [];
  for (const img of toCreate) {
    const to = buildFinalImagePath(id, img.storagePath);
    const { error: moveError } = await supabase.storage
      .from(PROPERTY_IMAGES_BUCKET)
      .move(img.storagePath, to);
    if (moveError) {
      console.warn('[updateProperty] image move failed', {
        from: img.storagePath,
        to,
        moveError,
      });
      // best-effort: borrar las que ya movimos (en update, NO borramos la property)
      if (movedSoFar.length > 0) {
        await supabase.storage.from(PROPERTY_IMAGES_BUCKET).remove(movedSoFar);
      }
      return {
        ok: false,
        error: {
          code: 'image_move_failed',
          message:
            'No se pudo mover una imagen. Los cambios de propiedad ya se guardaron; intenta volver a subir las imágenes faltantes.',
        },
      };
    }
    movedSoFar.push(to);
    newImageRows.push({
      property_id: id,
      storage_path: to,
      is_main: img.isMain,
      alt_text: img.altText,
      position: img.position,
    });
  }
  if (newImageRows.length > 0) {
    // Si hay una NUEVA imagen marcada como main, primero apagar mains existentes
    const newMains = newImageRows.filter((r) => r.is_main);
    if (newMains.length > 0) {
      const { error: clearMainsErr } = await supabase
        .from('property_images')
        .update({ is_main: false })
        .eq('property_id', id)
        .eq('is_main', true);
      if (clearMainsErr) {
        console.warn('[updateProperty] clear mains failed', clearMainsErr);
      }
    }
    const { error: insertErr } = await supabase.from('property_images').insert(newImageRows);
    if (insertErr) {
      console.warn('[updateProperty] property_images insert failed', insertErr);
    }
  }

  // 4. Diff de amenities
  const { data: currentAmenityRows } = await supabase
    .from('property_amenities')
    .select('amenity')
    .eq('property_id', id);
  const currentSet = new Set((currentAmenityRows ?? []).map((r) => r.amenity));
  const nextSet = new Set(amenities);
  const amenitiesToInsert = amenities.filter((a) => !currentSet.has(a));
  const amenitiesToDelete = [...currentSet].filter((a) => !nextSet.has(a));

  if (amenitiesToInsert.length > 0) {
    const rows = amenitiesToInsert.map((a) => ({ property_id: id, amenity: a }));
    const { error: insErr } = await supabase.from('property_amenities').insert(rows);
    if (insErr) {
      console.warn('[updateProperty] amenities insert failed', insErr);
    }
  }
  if (amenitiesToDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('property_amenities')
      .delete()
      .eq('property_id', id)
      .in('amenity', amenitiesToDelete);
    if (delErr) {
      console.warn('[updateProperty] amenities delete failed', delErr);
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/');
  await revalidatePropertyPaths(supabase, id);
  return { ok: true, id };
}

export type RestorePropertyErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid'
  | 'not_archived'
  | 'server';

export type RestorePropertyResult =
  | { ok: true }
  | { ok: false; error: { code: RestorePropertyErrorCode; message: string } };

/**
 * Server Action `restoreProperty` — invierte el soft-delete de
 * `archiveProperty` seteando `listing_status='active'`.
 *
 * No guardamos el status previo (decisión R3/E2): el 99% de las veces se
 * archivó algo activo, y si quería quedar en draft el agent edita después.
 *
 * Guards:
 *  1. zod (id uuid).
 *  2. Sesión autenticada.
 *  3. Property existe.
 *  4. Caller es admin o owner.
 *  5. La property está actualmente `archived` (rechazo de clicks duplicados).
 *  6. UPDATE listing_status = 'active'.
 *  7. revalidatePath dashboard + home + detalle.
 */
export async function restoreProperty(input: { id: string }): Promise<RestorePropertyResult> {
  const parsed = idOnlySchema.safeParse(input);
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

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('owner_id, listing_status')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (propertyError) {
    console.warn('[restoreProperty] property query failed', propertyError);
    return { ok: false, error: { code: 'server', message: 'No se pudo restaurar.' } };
  }
  if (!property) {
    return { ok: false, error: { code: 'not_found', message: 'Propiedad no encontrada.' } };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = profile?.role === 'admin';
  const isOwner = property.owner_id === user.id;
  if (!isAdmin && !isOwner) {
    return {
      ok: false,
      error: { code: 'forbidden', message: 'No tienes permiso para restaurar esta propiedad.' },
    };
  }

  if (property.listing_status !== 'archived') {
    return {
      ok: false,
      error: { code: 'not_archived', message: 'La propiedad no está archivada.' },
    };
  }

  const { error: updateError } = await supabase
    .from('properties')
    .update({ listing_status: 'active' })
    .eq('id', parsed.data.id);
  if (updateError) {
    console.warn('[restoreProperty] update failed', updateError);
    return { ok: false, error: { code: 'server', message: 'No se pudo restaurar.' } };
  }

  revalidatePath('/dashboard');
  revalidatePath('/');
  await revalidatePropertyPaths(supabase, parsed.data.id);
  return { ok: true };
}
