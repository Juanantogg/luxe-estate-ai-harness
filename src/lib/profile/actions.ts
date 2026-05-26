'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AVATAR_MIME_TO_EXT, avatarFileSchema, type AvatarMime } from './schemas';

/**
 * Server Actions del perfil del usuario:
 * - `uploadAvatar`: sube un avatar al bucket `avatars/{user_id}/avatar.<ext>`
 *   y actualiza `profiles.avatar_url` con la URL pública (más cache-buster).
 * - `removeAvatar`: borra el avatar actual y limpia `profiles.avatar_url`.
 *
 * Las policies del bucket `avatars` viven en migración 0010 y validan
 * `split_part(name, '/', 1) = auth.uid()::text`. El path `<user_id>/avatar.<ext>`
 * cumple naturalmente.
 *
 * El path es **fijo** por extensión y se sube con `upsert: true` para que
 * un re-upload sobrescriba el archivo en vez de acumular. Si el user cambia
 * de extensión (jpg → png), el cleanup borra cualquier `avatar.*` previo.
 */

const AVATAR_BUCKET = 'avatars';

export type UploadAvatarErrorCode =
  | 'unauthenticated'
  | 'invalid'
  | 'upload_failed'
  | 'update_failed';

export type UploadAvatarResult =
  | { ok: true; url: string }
  | { ok: false; error: { code: UploadAvatarErrorCode; message: string } };

export type RemoveAvatarErrorCode = 'unauthenticated' | 'update_failed';

export type RemoveAvatarResult =
  | { ok: true }
  | { ok: false; error: { code: RemoveAvatarErrorCode; message: string } };

/**
 * Construye la URL pública de un objeto del bucket de avatars usando
 * `NEXT_PUBLIC_SUPABASE_URL`. No usamos `supabase.storage.from(...).getPublicUrl`
 * para evitar una dependencia adicional en runtime; el formato es estable.
 */
function buildPublicAvatarUrl(path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL no está definida; no se puede construir la URL del avatar.',
    );
  }
  const base = supabaseUrl.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}

/**
 * Borra cualquier blob existente del usuario que matchee `avatar.{jpg,png,webp}`.
 * Se invoca antes de subir uno nuevo para evitar acumular extensiones
 * huérfanas (ej. user subió jpg, ahora sube png — el jpg quedaría).
 *
 * Si el delete falla, loguea pero no aborta el upload: prefiero un archivo
 * huérfano que un upload roto.
 */
async function cleanupExistingAvatars(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<void> {
  const candidates = ['avatar.jpg', 'avatar.jpeg', 'avatar.png', 'avatar.webp'];
  const paths = candidates.map((c) => `${userId}/${c}`);
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove(paths);
  if (error) {
    console.warn('[uploadAvatar] cleanup previous avatars failed', error);
  }
}

/**
 * Sube un avatar al bucket `avatars` y actualiza el profile del usuario.
 *
 * Flujo:
 * 1. Lee user de la sesión.
 * 2. Valida tamaño/MIME con zod.
 * 3. Borra cualquier `avatar.*` previo del usuario (cleanup).
 * 4. Sube el blob a `avatars/<user_id>/avatar.<ext>` con `upsert: true`.
 * 5. Actualiza `profiles.avatar_url` con la URL pública + `?v=<ts>` como
 *    cache-buster (el TopNav muestra el avatar cacheado si no lo invalido).
 * 6. Revalida `/profile` y `/`.
 */
export async function uploadAvatar(formData: FormData): Promise<UploadAvatarResult> {
  const file = formData.get('file');
  const parsed = avatarFileSchema.safeParse(file);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Archivo inválido.';
    return { ok: false, error: { code: 'invalid', message: first } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: { code: 'unauthenticated', message: 'Inicia sesión para cambiar el avatar.' },
    };
  }

  const ext = AVATAR_MIME_TO_EXT[parsed.data.type as AvatarMime];
  const path = `${user.id}/avatar.${ext}`;

  await cleanupExistingAvatars(supabase, user.id);

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, parsed.data, {
      upsert: true,
      cacheControl: '3600',
      contentType: parsed.data.type,
    });

  if (uploadError) {
    console.warn('[uploadAvatar] upload failed', uploadError);
    return {
      ok: false,
      error: { code: 'upload_failed', message: 'No se pudo subir la imagen.' },
    };
  }

  const publicUrl = `${buildPublicAvatarUrl(path)}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', user.id);

  if (updateError) {
    console.warn('[uploadAvatar] profile update failed', updateError);
    return {
      ok: false,
      error: { code: 'update_failed', message: 'No se pudo guardar el cambio.' },
    };
  }

  revalidatePath('/profile');
  revalidatePath('/');

  return { ok: true, url: publicUrl };
}

/**
 * Elimina el avatar del usuario: borra los blobs del bucket y setea
 * `profiles.avatar_url = null` para que el `Avatar` caiga a iniciales.
 */
export async function removeAvatar(): Promise<RemoveAvatarResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: { code: 'unauthenticated', message: 'Inicia sesión para cambiar el avatar.' },
    };
  }

  await cleanupExistingAvatars(supabase, user.id);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id);

  if (updateError) {
    console.warn('[removeAvatar] profile update failed', updateError);
    return {
      ok: false,
      error: { code: 'update_failed', message: 'No se pudo guardar el cambio.' },
    };
  }

  revalidatePath('/profile');
  revalidatePath('/');

  return { ok: true };
}
