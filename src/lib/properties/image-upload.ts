import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Helpers cliente para upload de imágenes de propiedad al bucket
 * `property-images`. Las imágenes se suben a `_drafts/{userId}/{uuid}.{ext}`
 * desde el browser (la auth de Storage usa la sesión del user) y la
 * Server Action las mueve a `properties/{propertyId}/...` tras crear la
 * propiedad.
 *
 * Migración 0019 amplía las policies de Storage para permitir el prefijo
 * `_drafts/`. Sin esa migración los uploads fallan con RLS 403.
 */

export const PROPERTY_IMAGES_BUCKET = 'property-images';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

const MIME_TO_EXT: Record<AllowedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type ImageValidationError = 'too_big' | 'wrong_type' | 'empty';

export type ImageValidationResult =
  | { ok: true; mime: AllowedMime; extension: string }
  | { ok: false; reason: ImageValidationError };

/**
 * Valida que un `File` cumpla tamaño y tipo permitidos. Devuelve el mime
 * normalizado y la extensión a usar al construir el path.
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!file || file.size === 0) {
    return { ok: false, reason: 'empty' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, reason: 'too_big' };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMime)) {
    return { ok: false, reason: 'wrong_type' };
  }
  const mime = file.type as AllowedMime;
  return { ok: true, mime, extension: MIME_TO_EXT[mime] };
}

export function getImageValidationMessage(reason: ImageValidationError): string {
  switch (reason) {
    case 'too_big':
      return 'Máximo 5 MB por imagen.';
    case 'wrong_type':
      return 'Formato no permitido. Solo JPG, PNG o WEBP.';
    case 'empty':
      return 'Archivo vacío o inválido.';
  }
}

export interface UploadDraftImageInput {
  supabase: SupabaseClient<Database>;
  userId: string;
  file: File;
  /** UUID generado por el caller para reconciliación local. Si no se pasa, el helper lo genera. */
  localId?: string;
}

export type UploadDraftImageResult =
  | { ok: true; storagePath: string; localId: string }
  | { ok: false; error: { code: 'validation' | 'storage'; message: string } };

/**
 * Sube un archivo individual a `_drafts/{userId}/{uuid}.{ext}` dentro del
 * bucket `property-images`. La Server Action lo moverá a su path final
 * tras crear la propiedad.
 *
 * Notas:
 *  - El cliente JS de Supabase NO expone progress events para `upload`.
 *    El componente padre simula el progreso visualmente.
 *  - `upsert: false` para que dos files con el mismo UUID no colisionen
 *    silenciosamente (improbable, pero defense-in-depth).
 */
export async function uploadDraftImage({
  supabase,
  userId,
  file,
  localId,
}: UploadDraftImageInput): Promise<UploadDraftImageResult> {
  const validation = validateImageFile(file);
  if (!validation.ok) {
    return {
      ok: false,
      error: { code: 'validation', message: getImageValidationMessage(validation.reason) },
    };
  }

  const id = localId ?? crypto.randomUUID();
  const path = `_drafts/${userId}/${id}.${validation.extension}`;

  const { error } = await supabase.storage.from(PROPERTY_IMAGES_BUCKET).upload(path, file, {
    contentType: validation.mime,
    upsert: false,
  });

  if (error) {
    return {
      ok: false,
      error: {
        code: 'storage',
        message: error.message || 'No se pudo subir la imagen.',
      },
    };
  }

  return { ok: true, storagePath: path, localId: id };
}

/**
 * Borra una imagen del bucket. Usado por la UI cuando el agente elimina
 * un upload local (en `_drafts/`) antes de submitear. El delete de
 * imágenes ya persistidas en DB lo hace la Server Action.
 */
export async function deleteDraftImage(
  supabase: SupabaseClient<Database>,
  storagePath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.storage.from(PROPERTY_IMAGES_BUCKET).remove([storagePath]);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Compone la URL pública de una imagen del bucket. Se usa para renderizar
 * previews de imágenes ya persistidas en DB (modo edit) sin pasar por
 * `next/image` (que requiere `remotePatterns` y agrega overhead — para un
 * thumb de form es innecesario).
 *
 * Si `storagePath` es ya una URL absoluta (placeholder Unsplash del seed),
 * la devuelve tal cual.
 */
export function getDraftImagePublicUrl(storagePath: string): string {
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return storagePath;
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${PROPERTY_IMAGES_BUCKET}/${storagePath}`;
}
