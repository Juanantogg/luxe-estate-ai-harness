'use server';

import { revalidatePath } from 'next/cache';
import { mapSupabaseError } from '@/lib/auth/errors';
import { getSiteUrl } from '@/lib/auth/site-url';
import { createClient } from '@/lib/supabase/server';
import {
  AVATAR_MIME_TO_EXT,
  avatarFileSchema,
  changeEmailSchema,
  type AvatarMime,
} from './schemas';

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

/**
 * Códigos de error específicos del flujo de cambio de email.
 *
 * Algunos se solapan con `AuthErrorCode` (ej. `invalid_input`,
 * `rate_limited`, `session_missing`, `unknown`) y se reusan los mensajes
 * del catálogo central. Los códigos nuevos (`same_email`, `oauth_only`,
 * `invalid_password`, `email_in_use`) son específicos de este flujo y
 * viven INLINE en esta action (decisión spec §4): no se promueven a
 * `lib/auth/errors.ts` mientras no aparezca un segundo call site.
 */
export type ChangeEmailErrorCode =
  | 'invalid_input'
  | 'invalid_password'
  | 'email_in_use'
  | 'same_email'
  | 'rate_limit'
  | 'session_missing'
  | 'oauth_only'
  | 'unknown';

export type ChangeEmailResult =
  | { ok: true }
  | { ok: false; error: { code: ChangeEmailErrorCode; message: string } };

function firstZodError(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? 'Revisa los campos marcados.';
}

/**
 * Solicita un cambio de email para el usuario actual.
 *
 * Flujo:
 *  1. Valida el form con zod.
 *  2. Lee la sesión y aborta si falta.
 *  3. Re-autentica con `signInWithPassword(emailViejo, password)` —
 *     Supabase no expone `reauthenticate()` para email/password, así que
 *     verificamos la identidad con un login completo. Usar el MISMO
 *     cliente preserva la sesión actual: si las credenciales son válidas,
 *     `signInWithPassword` solo renueva el JWT.
 *  4. Defensa OAuth-only: si el user no tiene identity `email`, devuelve
 *     `oauth_only`. El botón de la UI ya está deshabilitado para este
 *     caso, pero alguien podría POSTear el form directo.
 *  5. Defensa `same_email`: case-insensitive contra `user.email` actual.
 *  6. Llama `auth.updateUser({ email })` con `emailRedirectTo` al route
 *     handler `/auth/email-change`. Supabase envía link(s) de
 *     confirmación; con "Secure email change" ON (default Cloud) manda
 *     uno al email viejo Y otro al nuevo, y el cambio solo aplica cuando
 *     ambos se confirman.
 *
 * Importante:
 *  - NO se invoca `revalidatePath` ni `redirect`: el email aún no cambió.
 *  - NO se loguea email ni password en `console.warn` — solo
 *    `error.code` / `error.status` de Supabase para no filtrar PII.
 */
export async function changeEmail(formData: FormData): Promise<ChangeEmailResult> {
  const parsed = changeEmailSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'invalid_input', message: firstZodError(parsed.error) },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: {
        code: 'session_missing',
        message: 'Tu sesión expiró. Vuelve a iniciar sesión.',
      },
    };
  }

  // Defensa OAuth-only: la UI ya bloquea el botón, pero el form podría
  // POSTearse manipulado desde DevTools.
  const hasEmailIdentity = user.identities?.some((i) => i.provider === 'email') ?? false;
  if (!hasEmailIdentity) {
    return {
      ok: false,
      error: {
        code: 'oauth_only',
        message:
          'Tu cuenta usa inicio de sesión con Google. No es posible cambiar el correo desde acá por ahora.',
      },
    };
  }

  // Defensa same_email (case-insensitive + trim implícito por emailSchema).
  const currentEmail = (user.email ?? '').toLowerCase();
  const newEmail = parsed.data.email.toLowerCase();
  if (currentEmail === newEmail) {
    return {
      ok: false,
      error: {
        code: 'same_email',
        message: 'El correo nuevo debe ser distinto al actual.',
      },
    };
  }

  // Re-autenticación. Si las credenciales son válidas, el JWT se renueva
  // sin invalidar la sesión actual. Si no, el cliente devuelve error sin
  // tocar la sesión existente.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: currentEmail,
    password: parsed.data.password,
  });
  if (signInError) {
    const mapped = mapSupabaseError(signInError);
    if (mapped.code === 'invalid_credentials') {
      return {
        ok: false,
        error: { code: 'invalid_password', message: 'Contraseña incorrecta.' },
      };
    }
    if (mapped.code === 'rate_limited') {
      return {
        ok: false,
        error: {
          code: 'rate_limit',
          message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
        },
      };
    }
    console.warn('[changeEmail] re-auth failed', {
      code: signInError.code ?? null,
      status: signInError.status ?? null,
    });
    return {
      ok: false,
      error: { code: 'unknown', message: 'Algo salió mal. Inténtalo de nuevo.' },
    };
  }

  // Pedimos el cambio. Supabase envía los emails de confirmación.
  const { error: updateError } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${getSiteUrl()}/auth/email-change` },
  );
  if (updateError) {
    const mapped = mapSupabaseError(updateError);
    if (mapped.code === 'email_taken') {
      return {
        ok: false,
        error: {
          code: 'email_in_use',
          message: 'Ya existe una cuenta con ese correo. Elige otro.',
        },
      };
    }
    if (mapped.code === 'rate_limited') {
      return {
        ok: false,
        error: {
          code: 'rate_limit',
          message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
        },
      };
    }
    console.warn('[changeEmail] updateUser failed', {
      code: updateError.code ?? null,
      status: updateError.status ?? null,
    });
    return {
      ok: false,
      error: { code: 'unknown', message: 'Algo salió mal. Inténtalo de nuevo.' },
    };
  }

  // NO revalidamos /profile: el email todavía no cambió en la DB. Solo
  // cambiará cuando el user confirme los link(s) y el route handler
  // `/auth/email-change` haga el code-exchange.
  return { ok: true };
}
